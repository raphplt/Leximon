import { z } from "zod";
import { timestampSchema } from "./common";
import { playerBadgeSchema } from "./profile";

/** Sanctions and the back office that handles reports. */

export const sanctionKindSchema = z.enum([
  "hide_message",
  "reset_pseudo",
  "reset_clan_name",
  "mute",
  "trade_ban",
  "suspend",
  "close",
]);
export type SanctionKind = z.infer<typeof sanctionKindSchema>;

/** A sanction as the player reads it. */
export const sanctionSchema = z.object({
  id: z.uuid(),
  kind: sanctionKindSchema,
  reason: z.string(),
  until: timestampSchema.nullable(),
  createdAt: timestampSchema,
  /** The text that was sanctioned, if any (a message, a pseudo, a clan name). */
  content: z.string().nullable(),
  seen: z.boolean(),
  /** Still within the six months, and not contested yet. */
  contestable: z.boolean(),
  contestedAt: timestampSchema.nullable(),
  contestOutcome: z.enum(["upheld", "revoked"]).nullable(),
  revokedAt: timestampSchema.nullable(),
});
export type Sanction = z.infer<typeof sanctionSchema>;

/** `GET /me/sanctions`, newest first. */
export const sanctionsResponseSchema = z.object({ sanctions: z.array(sanctionSchema) });
export type SanctionsResponse = z.infer<typeof sanctionsResponseSchema>;

/** `POST /me/sanctions/:id/contest` body. */
export const contestRequestSchema = z.object({ text: z.string().trim().min(1).max(2000) });

/** `{ error }` of a route the player's sanctions forbid: 403. */
export const sanctionRefusalSchema = z.enum(["account_locked", "sanctioned"]);

/** `{ error }` of `POST /me/sanctions/:id/contest`. */
export const contestRefusalSchema = z.enum(["sanction_not_found", "not_contestable"]);

// --- Back office -----------------------------------------------------------------------------

export const reportTargetSchema = z.enum(["pseudo", "clan_name", "message"]);

/** Reports grouped by what they point at: one row per target, with how many players reported it. */
export const adminReportSchema = z.object({
  /** The oldest report of the group: the one actions refer to. */
  id: z.uuid(),
  targetKind: reportTargetSchema,
  targetKey: z.string(),
  reported: playerBadgeSchema.nullable(),
  reportedUserId: z.string(),
  /** The pseudo or text as it was reported. */
  content: z.string(),
  /** For a message: the clan, and the messages around it. */
  clanId: z.uuid().nullable(),
  clanName: z.string().nullable(),
  messageId: z.int().nullable(),
  context: z.array(
    z.object({ id: z.int(), author: z.string().nullable(), body: z.string().nullable() }),
  ),
  reporters: z.int().positive(),
  firstReportedAt: timestampSchema,
  /** Sanctions the player already had: the team weighs them. */
  previousSanctions: z.int().nonnegative(),
});
export type AdminReport = z.infer<typeof adminReportSchema>;

export const adminReportsResponseSchema = z.object({ reports: z.array(adminReportSchema) });
export type AdminReportsResponse = z.infer<typeof adminReportsResponseSchema>;

/** `POST /admin/sanctions` body, with an `Idempotency-Key`: a retry applies the sanction once. */
export const createSanctionRequestSchema = z.object({
  userId: z.string().min(1),
  kind: sanctionKindSchema,
  reason: z.string().trim().min(10).max(1000),
  /** For a timed sanction. */
  durationMs: z.int().positive().optional(),
  /** The report group it answers; closed with it. */
  reportId: z.uuid().optional(),
  messageId: z.int().positive().optional(),
  clanId: z.uuid().optional(),
});
export type CreateSanctionRequest = z.infer<typeof createSanctionRequestSchema>;

/** A contested sanction, for the back office. */
export const adminContestSchema = z.object({
  sanction: sanctionSchema,
  player: playerBadgeSchema.nullable(),
  userId: z.string(),
  contestText: z.string(),
});
export const adminContestsResponseSchema = z.object({ contests: z.array(adminContestSchema) });
export type AdminContestsResponse = z.infer<typeof adminContestsResponseSchema>;

/** `POST /admin/sanctions/:id/contest` body. */
export const resolveContestRequestSchema = z.object({ outcome: z.enum(["upheld", "revoked"]) });

export const adminModerationRefusalSchema = z.enum([
  "report_not_found",
  "sanction_not_found",
  "player_not_found",
  "duration_required",
  "duration_not_allowed",
  "target_required",
  "already_resolved",
  "admin_target",
]);
