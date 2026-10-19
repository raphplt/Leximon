import { z } from "zod";

/** Sent by clients on every write so that a retried request is applied only once. */
export const IDEMPOTENCY_KEY_HEADER = "Idempotency-Key";
export const idempotencyKeySchema = z.uuid();

/** Timestamps cross the API as ISO 8601 UTC strings. */
export const timestampSchema = z.iso.datetime();

/** Every error response carries a stable machine-readable code. */
export const errorResponseSchema = z.object({ error: z.string() });
export type ErrorResponse = z.infer<typeof errorResponseSchema>;
