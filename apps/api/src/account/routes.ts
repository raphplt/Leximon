import {
  INVITE_HEADER,
  type LinkPreviewError,
  type LinkPreviewResponse,
  linkPreviewRequestSchema,
} from "@leximon/contract";
import { APIError } from "better-auth/api";
import { Hono } from "hono";
import type { Auth } from "../auth";
import { invitesRequired, parseInviteCode, readInviteStatus } from "../beta/invites";
import type { AppEnv } from "../context";
import { withCodeLock } from "../middleware/auth-email";
import { codeVerifyIpRateLimit } from "../middleware/rate-limit";
import { previewGuestLink } from "./link-guest";

/** Account routes beside Better Auth's. Must run after `withDatabase`. */
export function accountRoutes() {
  const routes = new Hono<AppEnv>();
  routes.use(async (c, next) => {
    await next();
    c.header("Cache-Control", "no-store");
  });

  /**
   * What signing in with this code would do to the guest's game, so that the player sees
   * what follows or is lost before confirming. The code is checked without being used up,
   * and a wrong one counts as an attempt: only the owner of the address learns whether it has an
   * account.
   */
  routes.post("/link-preview", codeVerifyIpRateLimit, async (c) => {
    const body = linkPreviewRequestSchema.safeParse(await c.req.json().catch(() => null));
    if (!body.success) {
      return c.json({ error: "invalid_request" }, 400);
    }
    const { email, code } = body.data;

    const refusal = await withCodeLock(c, email, () => checkCode(c.var.auth, email, code));
    if (refusal !== null) {
      return c.json({ error: refusal }, refusal === "too_many_attempts" ? 403 : 400);
    }

    const session = await c.var.auth.api.getSession({ headers: c.req.raw.headers });
    const guestId = session?.user.isAnonymous === true ? session.user.id : null;
    const preview = await previewGuestLink(c.var.db, { guestId, email });
    const createsPlayer = guestId === null && !preview.accountExists;
    const invite = parseInviteCode(c.req.header(INVITE_HEADER));
    return c.json<LinkPreviewResponse>({
      accountExists: preview.accountExists,
      outcome: preview.outcome,
      guestCards: preview.guestCards,
      inviteRequired:
        createsPlayer &&
        invitesRequired(c.env) &&
        (invite === null || (await readInviteStatus(c.var.db, invite, Date.now())) !== "open"),
    });
  });

  return routes;
}

/** `null` when the code is right. Better Auth counts a wrong code as one of its attempts. */
async function checkCode(
  auth: Auth,
  email: string,
  code: string,
): Promise<LinkPreviewError | null> {
  try {
    await auth.api.checkVerificationOTP({ body: { email, type: "sign-in", otp: code } });
    return null;
  } catch (error) {
    if (!(error instanceof APIError)) throw error;
    switch (error.body?.code) {
      // Checked after the code: a right code for an address without an account yet.
      case "USER_NOT_FOUND":
        return null;
      case "OTP_EXPIRED":
        return "code_expired";
      case "TOO_MANY_ATTEMPTS":
        return "too_many_attempts";
      default:
        return "invalid_code";
    }
  }
}
