import type { z } from "zod";
import { ACCOUNT_ERROR_CODES, authErrorResponseSchema } from "../account";
import { errorResponseSchema } from "../common";

/**
 * Sends a request to the API with the player's session. Each platform carries the session its own
 * way: the browser's cookie on the web, the cookie kept by Better Auth's Expo client on mobile.
 * `path` starts with "/" and is relative to the API's origin.
 */
export type ApiTransport = (path: string, init: RequestInit) => Promise<Response>;

/** Invitation, source and referrer brought by the sign-ins that may create a player. */
export interface Arrival {
  headers(): Record<string, string>;
  /** Once a player exists, there is nothing more to keep. */
  forget(): void;
}

export type BetaClosedReason = "invite_required" | "invite_closed";

export interface ApiClientOptions {
  readonly transport: ApiTransport;
  readonly arrival?: Arrival;
  /** The closed beta refused to create a guest: the platform leads to its invitation screen. */
  readonly onBetaClosed?: (reason: BetaClosedReason) => void;
}

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

/** The beta is on invitation and this device brings none that is still open. */
export class BetaClosedError extends ApiError {
  constructor(readonly reason: BetaClosedReason) {
    super(reason, 403);
    this.name = "BetaClosedError";
  }
}

export interface Http {
  /** A request with the session, never signing in. */
  send(path: string, init?: RequestInit): Promise<Response>;
  /** Sends a request, signing in as a guest first if there is no session yet. */
  sendAsPlayer(path: string, init?: RequestInit): Promise<Response>;
  readonly arrival: Arrival;
}

const NO_ARRIVAL: Arrival = { headers: () => ({}), forget: () => {} };

export function createHttp(options: ApiClientOptions): Http {
  const arrival = options.arrival ?? NO_ARRIVAL;

  async function send(path: string, init: RequestInit = {}): Promise<Response> {
    try {
      return await options.transport(path, init);
    } catch {
      throw new ApiError("network_error", null);
    }
  }

  /**
   * One guest sign-in at a time: screens load several resources in parallel, and each would
   * otherwise create its own guest account on a first visit.
   */
  let guestSignIn: Promise<void> | null = null;

  function signInAsGuest(): Promise<void> {
    guestSignIn ??= send("/api/auth/sign-in/anonymous", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...arrival.headers() },
      body: "{}",
    })
      .then(async (response) => {
        if (response.ok) {
          arrival.forget();
          return;
        }
        const closed =
          response.status === 403 ? betaClosedReason(await authErrorCode(response)) : null;
        if (closed === null) throw new ApiError("guest_sign_in_failed", response.status);
        options.onBetaClosed?.(closed);
        throw new BetaClosedError(closed);
      })
      .catch((error: unknown) => {
        // Kept after a success, so that a request answered late reuses the new session.
        guestSignIn = null;
        throw error;
      });
    return guestSignIn;
  }

  async function sendAsPlayer(path: string, init: RequestInit = {}): Promise<Response> {
    const response = await send(path, init);
    if (response.status !== 401) return response;
    await signInAsGuest();
    return send(path, init);
  }

  return { send, sendAsPlayer, arrival };
}

export async function parse<T>(response: Response, schema: z.ZodType<T>): Promise<T> {
  const body: unknown = await response.json().catch(() => null);
  const result = schema.safeParse(body);
  if (!result.success) throw new ApiError("unexpected_response", response.status);
  return result.data;
}

/** Reads `{ error }` when it is one of the refusals `schema` knows, else `null`. */
export async function refusal<T>(response: Response, schema: z.ZodType<T>): Promise<T | null> {
  const body = errorResponseSchema.safeParse(await response.json().catch(() => null));
  const reason = schema.safeParse(body.success ? body.data.error : null);
  return reason.success ? reason.data : null;
}

/** The `error` code of a response, without consuming its body. */
export async function errorCode(response: Response): Promise<string | null> {
  const body: unknown = await response
    .clone()
    .json()
    .catch(() => null);
  return errorResponseSchema.safeParse(body).data?.error ?? null;
}

/** Error code of a Better Auth route (ours included), `null` when there is none. */
export async function authErrorCode(response: Response): Promise<string | null> {
  const body = authErrorResponseSchema.safeParse(await response.json().catch(() => null));
  return body.success ? body.data.code : null;
}

export function betaClosedReason(code: string | null): BetaClosedReason | null {
  if (code === ACCOUNT_ERROR_CODES.inviteRequired) return "invite_required";
  if (code === ACCOUNT_ERROR_CODES.inviteClosed) return "invite_closed";
  return null;
}

/** A request whose body is JSON; no body when `body` is left out. */
export function json(
  method: string,
  body?: unknown,
  headers: Record<string, string> = {},
): RequestInit {
  return body === undefined
    ? { method, headers }
    : {
        method,
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify(body),
      };
}

/** `path?a=1&b=2`, leaving out empty values. */
export function withQuery(
  path: string,
  query: Record<string, string | number | null | undefined>,
): string {
  const pairs = Object.entries(query)
    .filter((entry): entry is [string, string | number] => entry[1] != null && entry[1] !== "")
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  return pairs.length === 0 ? path : `${path}?${pairs.join("&")}`;
}

export const segment = (value: string): string => encodeURIComponent(value);
