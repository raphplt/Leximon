import { z } from "zod";
import { timestampSchema } from "./common";

/**
 * Closed beta: who may come in (invitations), where players come from, and what the back office
 * measures. Everything is computed from our own database: no tracker, no third party.
 */

/** Header carrying the invitation code with the sign-in that creates a player. */
export const INVITE_HEADER = "X-Leximon-Invite";
/** Header carrying the `?src=` of the link the player first arrived by. */
export const SOURCE_HEADER = "X-Leximon-Source";

/** An invitation code: random by default, or a readable word chosen by the admin. */
export const inviteCodeSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9-]{3,32}$/);

/** A `?src=` code: one per posted link, so that each channel is measured on its own. */
export const sourceCodeSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9_-]{1,40}$/);

/** Age bracket, declared freely when creating an account; compares retention by age. */
export const AGE_BRACKETS = ["15-17", "18-24", "25-34", "35-49", "50+"] as const;
export const ageBracketSchema = z.enum(AGE_BRACKETS);
export type AgeBracket = z.infer<typeof ageBracketSchema>;

/** `GET /invites/{code}`, 200: whether the link still lets someone in. Public. */
export const inviteStatusSchema = z.object({
  status: z.enum(["open", "full", "expired", "unknown"]),
});
export type InviteStatus = z.infer<typeof inviteStatusSchema>;

// --- Feedback and interest -------------------------------------------------------------------

/**
 * `POST /me/feedback` body: a short note from a tester, and the screen it was written from. Read
 * by admins only, never shown to other players: not filtered, so that a blunt opinion gets through.
 */
export const sendFeedbackRequestSchema = z.object({
  body: z.string().trim().min(3).max(1000),
  screen: z
    .string()
    .max(100)
    .regex(/^\/[a-z0-9/_-]*$/),
});
export type SendFeedbackRequest = z.input<typeof sendFeedbackRequestSchema>;

/**
 * Signals of interest in an offer not sold yet:
 * - `patron_door`: the player opened the patron page;
 * - `patron_notify`: they asked to be told when it opens.
 */
export const interestKindSchema = z.enum(["patron_door", "patron_notify"]);
export type InterestKind = z.infer<typeof interestKindSchema>;

/** `POST /me/interest` body. Idempotent: the first date is kept. */
export const recordInterestRequestSchema = z.object({ kind: interestKindSchema });

// --- Back office -----------------------------------------------------------------------------

export const adminInviteSchema = z.object({
  id: z.uuid(),
  code: z.string(),
  label: z.string(),
  maxUses: z.int().positive(),
  uses: z.int().nonnegative(),
  expiresAt: timestampSchema.nullable(),
  revokedAt: timestampSchema.nullable(),
  createdAt: timestampSchema,
});
export type AdminInvite = z.infer<typeof adminInviteSchema>;

/** `GET /admin/invites`, 200: every invitation, newest first (a few dozen at most). */
export const adminInvitesResponseSchema = z.object({ invites: z.array(adminInviteSchema) });
export type AdminInvitesResponse = z.infer<typeof adminInvitesResponseSchema>;

/** `POST /admin/invites` body. Without `code`, a random one is drawn. */
export const adminCreateInviteRequestSchema = z.object({
  label: z.string().trim().min(1).max(80),
  maxUses: z.int().min(1).max(10_000),
  code: inviteCodeSchema.optional(),
  expiresAt: timestampSchema.optional(),
});
export type AdminCreateInviteRequest = z.input<typeof adminCreateInviteRequestSchema>;

/** `POST /admin/invites` refusal (`{ error }`), besides `invalid_request`. */
export const adminCreateInviteRefusalSchema = z.enum(["code_taken"]);

/**
 * `POST /admin/invites/{id}/places` body: the new number of places, not a difference, so that a
 * request sent twice gives the same result.
 */
export const adminSetInvitePlacesRequestSchema = z.object({
  maxUses: z.int().min(1).max(10_000),
});
export type AdminSetInvitePlacesRequest = z.input<typeof adminSetInvitePlacesRequestSchema>;

/** `POST /admin/invites/{id}/places` refusal (`{ error }`), besides `invalid_request`. */
export const adminSetInvitePlacesRefusalSchema = z.enum(["invite_not_found", "below_uses"]);

/** Players of a cohort back on a given day, out of those for whom that day has come. */
const rateSchema = z.object({
  players: z.int().nonnegative(),
  /** Players of the cohort for whom that day has passed. */
  eligible: z.int().nonnegative(),
});

export const retentionRowSchema = z.object({
  /** Cohort: the week (Monday, `YYYY-MM-DD`), the invitation or the source, the age bracket. */
  key: z.string(),
  players: z.int().nonnegative(),
  d1: rateSchema,
  d7: rateSchema,
  d30: rateSchema,
});
export type RetentionRow = z.infer<typeof retentionRowSchema>;

/** Longest period the measures cover at once, in days. */
export const MEASURES_MAX_DAYS = 366;

/** Days returned per cohort: J0 (the arrival, every player) to J30. */
export const COHORT_DAYS = 31;

/** `GET /admin/measures` query: the period, both days included, Paris time. By default, the last 30 days. */
export const adminMeasuresQuerySchema = z.object({
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
});
export type AdminMeasuresQuery = z.infer<typeof adminMeasuresQuerySchema>;

/** One day of activity. */
export const measuresDaySchema = z.object({
  day: z.iso.date(),
  /** Players who opened the game that day. */
  active: z.int().nonnegative(),
  /** Players whose first day it was. */
  arrived: z.int().nonnegative(),
  boosters: z.int().nonnegative(),
  answers: z.int().nonnegative(),
  /** Accounts created (a guest who keeps their progress counts here). */
  accounts: z.int().nonnegative(),
});
export type MeasuresDay = z.infer<typeof measuresDaySchema>;

/** Players arrived on `day`, and how many played again on each of the 30 days after. */
export const measuresCohortSchema = z.object({
  day: z.iso.date(),
  players: z.int().nonnegative(),
  /** `back[n]`: players of the cohort who played on day `day + n`; `back[0]` is `players`. */
  back: z.array(z.int().nonnegative()).length(COHORT_DAYS),
});
export type MeasuresCohort = z.infer<typeof measuresCohortSchema>;

/** `GET /admin/measures`, 200: retention and funnel, admins excluded. */
export const adminMeasuresSchema = z.object({
  /**
   * The period asked, the one just before it (same length) for comparison, and today. Cohorts,
   * funnel, breakdowns and interest cover players arrived in the period.
   */
  period: z.object({
    from: z.iso.date(),
    to: z.iso.date(),
    previousFrom: z.iso.date(),
    previousTo: z.iso.date(),
    today: z.iso.date(),
    /** First day a counted player was seen; null before anyone came. */
    firstDay: z.iso.date().nullable(),
  }),
  /** Every day from `previousFrom` to `to`, empty days included. */
  daily: z.array(measuresDaySchema),
  /** Distinct players active in the period and in the previous one. */
  uniqueActive: z.object({ current: z.int().nonnegative(), previous: z.int().nonnegative() }),
  /** Cohorts by day of arrival, from `previousFrom` to `to`; days without arrivals left out. */
  cohorts: z.array(measuresCohortSchema),
  /** Boosters opened and challenges answered in the period, by weekday (0 Monday) and hour (Paris). */
  hours: z.array(
    z.object({
      weekday: z.int().min(0).max(6),
      hour: z.int().min(0).max(23),
      events: z.int().nonnegative(),
    }),
  ),
  funnel: z.object({
    /** Players seen at least one day. */
    arrived: z.int().nonnegative(),
    openedBooster: z.int().nonnegative(),
    answeredChallenge: z.int().nonnegative(),
    tradedOnce: z.int().nonnegative(),
    createdAccount: z.int().nonnegative(),
    cameBack: z.int().nonnegative(),
  }),
  activeToday: z.int().nonnegative(),
  active7d: z.int().nonnegative(),
  active30d: z.int().nonnegative(),
  byWeek: z.array(retentionRowSchema),
  byOrigin: z.array(retentionRowSchema),
  byAge: z.array(retentionRowSchema),
  interest: z.object({
    patronDoor: z.int().nonnegative(),
    patronNotify: z.int().nonnegative(),
    /** Players whose first patron payment falls within the period. */
    newPatrons: z.int().nonnegative(),
  }),
});
export type AdminMeasures = z.infer<typeof adminMeasuresSchema>;

/** `GET /admin/testers` query. */
export const adminTestersQuerySchema = z.object({ cursor: z.string().max(200).optional() });

export const adminTesterSchema = z.object({
  id: z.string(),
  /** null for a guest. */
  email: z.string().nullable(),
  pseudo: z.string().nullable(),
  /** Invitation label, or `src:<code>`, or null. */
  origin: z.string().nullable(),
  ageBracket: ageBracketSchema.nullable(),
  firstDay: z.iso.date(),
  lastDay: z.iso.date(),
  daysPlayed: z.int().nonnegative(),
  boosters: z.int().nonnegative(),
  answers: z.int().nonnegative(),
  level: z.int().positive(),
});
export type AdminTester = z.infer<typeof adminTesterSchema>;

/** `GET /admin/testers`, 200: players by last day played, newest first. */
export const adminTestersResponseSchema = z.object({
  testers: z.array(adminTesterSchema),
  nextCursor: z.string().nullable(),
});
export type AdminTestersResponse = z.infer<typeof adminTestersResponseSchema>;

/** `GET /admin/feedback` query. */
export const adminFeedbackQuerySchema = z.object({ cursor: z.string().max(200).optional() });

export const adminFeedbackSchema = z.object({
  id: z.uuid(),
  userId: z.string(),
  email: z.string().nullable(),
  screen: z.string(),
  body: z.string(),
  createdAt: timestampSchema,
  readAt: timestampSchema.nullable(),
});
export type AdminFeedback = z.infer<typeof adminFeedbackSchema>;

/** `GET /admin/feedback`, 200: newest first. */
export const adminFeedbackResponseSchema = z.object({
  feedback: z.array(adminFeedbackSchema),
  unread: z.int().nonnegative(),
  nextCursor: z.string().nullable(),
});
export type AdminFeedbackResponse = z.infer<typeof adminFeedbackResponseSchema>;
