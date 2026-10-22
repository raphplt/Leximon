import { z } from "zod";

/** Sent by clients on every write so that a retried request is applied only once. */
export const IDEMPOTENCY_KEY_HEADER = "Idempotency-Key";
export const idempotencyKeySchema = z.uuid();

/** Timestamps cross the API as ISO 8601 UTC strings. */
export const timestampSchema = z.iso.datetime();

/** Every error response carries a stable machine-readable code. */
export const errorResponseSchema = z.object({ error: z.string() });
export type ErrorResponse = z.infer<typeof errorResponseSchema>;

/** Stable identifiers of catalog entries (collections, cards, themes): lowercase kebab-case. */
export const slugSchema = z
  .string()
  .max(64)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

/** A colour or engraving key of the clan emblem lists. */
export const emblemKeySchema = z
  .string()
  .max(32)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

/** A clan's emblem: an engraving and two colours. */
export const emblemSchema = z.object({
  /** Card id whose engraving the emblem shows. */
  engraving: emblemKeySchema,
  colors: z.tuple([emblemKeySchema, emblemKeySchema]),
});
export type EmblemView = z.infer<typeof emblemSchema>;
