import { z } from "zod";

/** A released version of the app, `major.minor.patch`. */
export const appVersionSchema = z.string().regex(/^\d{1,4}\.\d{1,4}\.\d{1,4}$/);

/**
 * `GET /app`: what a client checks before it plays. Below `mobileMinVersion`, the mobile app no
 * longer talks to the API and asks to be updated. `googleSignIn` and `appleSignIn`: whether those
 * sign-in methods are offered (absent from an API older than them). `patronOffer`: whether the
 * patron subscription is on sale, so that its page is shown to every player.
 */
export const appStatusResponseSchema = z.object({
  mobileMinVersion: appVersionSchema,
  googleSignIn: z.boolean().default(false),
  appleSignIn: z.boolean().default(false),
  patronOffer: z.boolean().default(false),
});
export type AppStatusResponse = z.infer<typeof appStatusResponseSchema>;
