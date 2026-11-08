import { z } from "zod";

/** A released version of the app, `major.minor.patch`. */
export const appVersionSchema = z.string().regex(/^\d{1,4}\.\d{1,4}\.\d{1,4}$/);

/**
 * `GET /app`: what a client checks before it plays. Below `mobileMinVersion`, the mobile app no
 * longer talks to the API and asks to be updated. `googleSignIn`: whether « Continuer avec
 * Google » is offered (absent from an API older than it).
 */
export const appStatusResponseSchema = z.object({
  mobileMinVersion: appVersionSchema,
  googleSignIn: z.boolean().default(false),
});
export type AppStatusResponse = z.infer<typeof appStatusResponseSchema>;
