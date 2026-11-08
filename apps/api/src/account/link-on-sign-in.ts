import { ACCOUNT_ERROR_CODES } from "@leximon/contract";
import type { Database } from "@leximon/db";
import { APIError } from "better-auth/api";
import { expireCookie, setSessionCookie } from "better-auth/cookies";
import type { AnonymousOptions } from "better-auth/plugins";
import { errorSummary } from "../error-summary";
import { linkGuest } from "./link-guest";
import { isOAuthCallback, readDeclaredFlag, tripErrorURL } from "./oauth-trip";

type LinkAccountData = Parameters<NonNullable<AnonymousOptions["onLinkAccount"]>>[0];

/**
 * `onLinkAccount` of Better Auth's anonymous plugin: runs after any sign-in made with a guest
 * session (e-mail code, Google), once the account and its new session exist and the new session
 * cookie is already on the response.
 *
 * If the guest's game cannot follow, the sign-in must not go through: otherwise the browser would
 * hold the account's session while the guest's game stayed behind, out of reach. So on any
 * failure the new session is deleted, the response puts the guest's own session cookie back (it
 * is still valid: nothing was committed), and the error tells the client it is still the guest.
 * Better Auth keeps the cookies set by a hook that throws an `APIError`, in order: the restored
 * guest cookie comes last, so it is the one the browser keeps. On Google's return the player is in
 * a browser tab, not a script: the error is a redirect to the client's error page instead.
 */
export async function linkGuestOnSignIn(db: Database, data: LinkAccountData): Promise<void> {
  const { anonymousUser: guest, newUser: account, ctx } = data;
  // Signing in to another guest (its placeholder address cannot receive a code, but still).
  if (account.user["isAnonymous"] === true || account.user.id === guest.user.id) return;

  const acceptGuestLoss = await readDeclaredFlag(ctx, "acceptGuestLoss");
  let failure: APIError;
  let guestCards = 0;
  try {
    const result = await linkGuest(db, {
      guestId: guest.user.id,
      accountId: account.user.id,
      now: Date.now(),
      acceptGuestLoss,
    });
    if (result.kind !== "guest_loss_not_acknowledged") return;
    guestCards = result.cards;
    failure = new APIError("CONFLICT", {
      code: ACCOUNT_ERROR_CODES.guestLossNotAcknowledged,
      message: "Signing in would abandon the guest's cards: the player must accept it first",
    });
  } catch (error) {
    // Identifiers and addresses stay out of the logs.
    console.error("Guest link failed", errorSummary(error));
    failure = new APIError("INTERNAL_SERVER_ERROR", {
      code: ACCOUNT_ERROR_CODES.accountLinkFailed,
      message: "The guest's game could not be moved: the player is still the guest",
    });
  }

  await restoreGuestSession(data);
  if (isOAuthCallback(ctx)) {
    const code = String(failure.body?.code);
    // The client needs the count to warn the player before sending them back to Google.
    const url = await tripErrorURL(code, guestCards > 0 ? { cards: String(guestCards) } : {});
    if (url !== null) throw ctx.redirect(url);
  }
  throw failure;
}

async function restoreGuestSession({
  anonymousUser: guest,
  newUser: account,
  ctx,
}: LinkAccountData) {
  try {
    await ctx.context.internalAdapter.deleteSession(account.session.token);
  } catch {
    // The browser gets the guest's cookie back anyway: the account's token is no longer sent.
  }
  // Drops the account's cookies from the response before setting the guest's again.
  expireCookie(ctx, ctx.context.authCookies.sessionToken);
  expireCookie(ctx, ctx.context.authCookies.sessionData);
  await setSessionCookie(ctx, { session: guest.session, user: guest.user });
}
