import { z } from "zod";

/** A released version of the app, `major.minor.patch`. */
export const appVersionSchema = z.string().regex(/^\d{1,4}\.\d{1,4}\.\d{1,4}$/);

/**
 * `GET /app`: what a client checks before it plays. Below `mobileMinVersion`, the mobile app no
 * longer talks to the API and asks to be updated.
 */
export const appStatusResponseSchema = z.object({ mobileMinVersion: appVersionSchema });
export type AppStatusResponse = z.infer<typeof appStatusResponseSchema>;
