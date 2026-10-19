import {
  type BoosterSource,
  type BoosterWalletResponse,
  boosterStockEmptySchema,
  boosterWalletSchema,
  IDEMPOTENCY_KEY_HEADER,
  type OpenBoosterResponse,
  type OwnedCardsResponse,
  openBoosterResponseSchema,
  ownedCardsResponseSchema,
} from "@leximon/contract";
import type { z } from "zod";

/**
 * Browser client of the game API. The session lives in Better Auth's cookie, sent with
 * `credentials: "include"`; every response is validated against the shared contract.
 */

// Dot access only: Next.js inlines NEXT_PUBLIC_ variables at build time, not bracket access.
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";

/** Something went wrong that the player can only retry. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function send(path: string, init: RequestInit = {}): Promise<Response> {
  try {
    return await fetch(`${API_URL}${path}`, { ...init, credentials: "include" });
  } catch {
    throw new ApiError("network_error", null);
  }
}

async function parse<T>(response: Response, schema: z.ZodType<T>): Promise<T> {
  const body: unknown = await response.json().catch(() => null);
  const result = schema.safeParse(body);
  if (!result.success) throw new ApiError("unexpected_response", response.status);
  return result.data;
}

/**
 * One guest sign-in at a time: screens load several resources in parallel, and each would
 * otherwise create its own guest account on a first visit.
 */
let guestSignIn: Promise<void> | null = null;

function signInAsGuest(): Promise<void> {
  guestSignIn ??= send("/api/auth/sign-in/anonymous", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  })
    .then((response) => {
      if (!response.ok) throw new ApiError("guest_sign_in_failed", response.status);
    })
    .catch((error: unknown) => {
      // Kept after a success, so that a request answered late reuses the new session.
      guestSignIn = null;
      throw error;
    });
  return guestSignIn;
}

/** Sends a request, signing in as a guest first if there is no session yet (D-006). */
async function sendAsPlayer(path: string, init: RequestInit = {}): Promise<Response> {
  const response = await send(path, init);
  if (response.status !== 401) return response;
  await signInAsGuest();
  return send(path, init);
}

export async function fetchWallet(): Promise<BoosterWalletResponse> {
  const response = await sendAsPlayer("/me/wallet");
  if (!response.ok) throw new ApiError("wallet_unavailable", response.status);
  return parse(response, boosterWalletSchema);
}

/** Every card the player owns, all pages included. */
export async function fetchOwnedCards(): Promise<OwnedCardsResponse["cards"]> {
  const owned: OwnedCardsResponse["cards"] = [];
  let cursor: string | null = null;
  do {
    const query = new URLSearchParams({ limit: "500" });
    if (cursor !== null) query.set("cursor", cursor);
    const response = await sendAsPlayer(`/me/cards?${query}`);
    if (!response.ok) throw new ApiError("cards_unavailable", response.status);
    const page = await parse(response, ownedCardsResponseSchema);
    owned.push(...page.cards);
    cursor = page.nextCursor;
  } while (cursor !== null);
  return owned;
}

export type OpenBoosterResult =
  | ({ readonly kind: "opened" } & OpenBoosterResponse)
  | { readonly kind: "stock_empty"; readonly nextRefillAt: string };

/**
 * Opens a booster. The caller keeps `idempotencyKey` until it gets a result, so that a retry
 * after a network error never opens a second booster.
 */
export async function openBooster(
  source: BoosterSource,
  idempotencyKey: string,
): Promise<OpenBoosterResult> {
  const response = await sendAsPlayer("/boosters/open", {
    method: "POST",
    headers: { "Content-Type": "application/json", [IDEMPOTENCY_KEY_HEADER]: idempotencyKey },
    body: JSON.stringify(source),
  });
  if (response.status === 409) {
    const empty = await parse(response, boosterStockEmptySchema);
    return { kind: "stock_empty", nextRefillAt: empty.nextRefillAt };
  }
  if (!response.ok) throw new ApiError("open_failed", response.status);
  return { kind: "opened", ...(await parse(response, openBoosterResponseSchema)) };
}
