import { PACK_SHAPE_EXPERIMENT } from "@leximon/core";
import { z } from "zod";
import { timestampSchema } from "./common";

/**
 * A/B tests and the first-party event log behind them (D-030). The log only records a closed
 * list of events, with no free text, under a pseudonymous subject: what the CNIL exemption for
 * audience measurement and A/B testing allows without consent, given an opt-out.
 */

/** `GET /me/experiments`: the player's variant in each running experiment. */
export const experimentsResponseSchema = z.object({
  variants: z.record(z.string(), z.string()),
});
export type ExperimentsResponse = z.infer<typeof experimentsResponseSchema>;

export const packShapeSchema = z.enum(PACK_SHAPE_EXPERIMENT.variants);

/** Pages a visit is counted on: enough to measure return at J1 and J7. */
export const analyticsPageSchema = z.enum(["boosters", "album", "challenges", "trades"]);
export type AnalyticsPage = z.infer<typeof analyticsPageSchema>;

const at = { at: timestampSchema };

export const analyticsEventSchema = z.discriminatedUnion("name", [
  z.object({ name: z.literal("page_viewed"), page: analyticsPageSchema, ...at }),
  /** The player started opening a pack: torn it, or touched the seal or the pouch. */
  z.object({
    name: z.literal("opening_started"),
    shape: packShapeSchema,
    via: z.enum(["tear", "touch"]),
    ...at,
  }),
  /** The recap showed: after every card one by one, or after « Tout révéler ». */
  z.object({
    name: z.literal("opening_finished"),
    shape: packShapeSchema,
    revealed: z.enum(["one_by_one", "all_at_once"]),
    durationMs: z.int().min(0).max(3_600_000),
    ...at,
  }),
]);
export type AnalyticsEvent = z.infer<typeof analyticsEventSchema>;
export type AnalyticsEventName = AnalyticsEvent["name"];

/** Most events a client sends at once. */
export const MAX_EVENTS_PER_BATCH = 50;

/** `POST /events`, answered 202. */
export const analyticsBatchSchema = z.object({
  events: z.array(analyticsEventSchema).min(1).max(MAX_EVENTS_PER_BATCH),
});
export type AnalyticsBatch = z.infer<typeof analyticsBatchSchema>;

/** What the API puts on the analytics queue for each batch accepted. */
export const analyticsMessageSchema = z.object({
  /** Pseudonymous id: an HMAC of the player id, not the id itself. */
  subject: z.string().regex(/^[0-9a-f]{32}$/),
  variants: z.record(z.string(), z.string()),
  receivedAt: timestampSchema,
  events: z.array(analyticsEventSchema).min(1).max(MAX_EVENTS_PER_BATCH),
});
export type AnalyticsMessage = z.infer<typeof analyticsMessageSchema>;
