import { INVITE_HEADER, REFERRER_HEADER, SOURCE_HEADER } from "@leximon/contract";
import { addOAuthServerContext, getOAuthState } from "better-auth/api";

/**
 * A sign-in through Google is a trip: the client asks for it (`/sign-in/social`), the player
 * leaves for Google, and Google's redirect brings them back (`/callback/google`). What the client
 * would send with a code sign-in (age, consent to lose the guest's game) travels in the OAuth
 * state instead, and so do the arrival headers, which Google's redirect does not carry.
 */

const ARRIVAL_KEY = "arrival";
const ARRIVAL_HEADERS = [INVITE_HEADER, REFERRER_HEADER, SOURCE_HEADER] as const;

/** The context Better Auth hands to hooks and callbacks: only what is read here. */
interface TripContext {
  readonly path?: string | undefined;
  readonly body?: unknown;
  readonly headers?: Headers | undefined;
}

/** Google's redirect back to us, where the account is found or created. */
export function isOAuthCallback(ctx: TripContext | null | undefined): boolean {
  return ctx?.path?.startsWith("/callback/") === true;
}

/**
 * What the player declared with this sign-in: the request's body, or on Google's return the
 * fields the client joined to the trip (`additionalData`). Both come from the client: they hold
 * the player's own declarations, never a permission.
 */
export async function declarations(ctx: TripContext | null | undefined): Promise<unknown> {
  if (!isOAuthCallback(ctx)) return ctx?.body;
  return (await getOAuthState()) ?? undefined;
}

/** A boolean the player declared with this sign-in. */
export async function readDeclaredFlag(
  ctx: TripContext | null | undefined,
  name: string,
): Promise<boolean> {
  const fields = await declarations(ctx);
  return (
    typeof fields === "object" &&
    fields !== null &&
    (fields as Record<string, unknown>)[name] === true
  );
}

/**
 * Called as the trip starts: keeps the arrival headers in the state's server part, which the
 * client cannot write to. They are checked on the way back as when a code sign-in sends them.
 */
export async function keepArrivalForTrip(headers: Headers | undefined): Promise<void> {
  const kept: Record<string, string> = {};
  for (const name of ARRIVAL_HEADERS) {
    const value = headers?.get(name);
    if (value) kept[name] = value;
  }
  if (Object.keys(kept).length > 0) await addOAuthServerContext({ [ARRIVAL_KEY]: kept });
}

/** The headers that tell where a new player comes from: kept for the trip on Google's return. */
export async function arrivalHeaders(
  ctx: TripContext | null | undefined,
): Promise<Headers | undefined> {
  if (!isOAuthCallback(ctx)) return ctx?.headers;
  const kept = (await getOAuthState())?.serverContext?.[ARRIVAL_KEY];
  const headers = new Headers();
  if (typeof kept !== "object" || kept === null) return headers;
  for (const name of ARRIVAL_HEADERS) {
    const value = (kept as Record<string, unknown>)[name];
    if (typeof value === "string") headers.set(name, value);
  }
  return headers;
}

/**
 * The guest who left for Google, on its return: its cookie may not come back (the mobile app's
 * browser does not carry it), so Better Auth's anonymous plugin notes it in the state's server
 * part as the trip starts.
 */
export async function guestOnTrip(ctx: TripContext | null | undefined): Promise<boolean> {
  if (!isOAuthCallback(ctx)) return false;
  return typeof (await getOAuthState())?.serverContext?.["anonymousUserId"] === "string";
}

/** Where Google's return goes when the sign-in fails, with the reason (`?error=`). */
export async function tripErrorURL(code: string, extra: Record<string, string> = {}) {
  const errorURL = (await getOAuthState())?.errorURL;
  if (typeof errorURL !== "string") return null;
  // Relative or in the app's scheme (`leximon://`), as Better Auth accepts it: no URL parsing.
  const query = new URLSearchParams({ error: code, ...extra });
  return `${errorURL}${errorURL.includes("?") ? "&" : "?"}${query}`;
}
