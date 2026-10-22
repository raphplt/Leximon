import { z } from "zod";
import { boosterWalletSchema } from "./boosters";
import { emblemKeySchema, emblemSchema, slugSchema, timestampSchema } from "./common";
import { playerBadgeSchema } from "./profile";

/**
 * Clans. Members only, from the level that opens them.
 * Writes are idempotent by nature (joining twice is refused, leaving twice too); a message sent
 * twice in a row is held back by the message pace. Refusals answer `{ error }` with the codes below.
 */

export const clanIdSchema = z.uuid();

export const clanEntryModeSchema = z.enum(["open", "request", "invite"]);
export type ClanEntryMode = z.infer<typeof clanEntryModeSchema>;

export const clanRoleSchema = z.enum(["chief", "deputy", "member"]);
export type ClanRole = z.infer<typeof clanRoleSchema>;

export const goalTierSchema = z.enum(["bronze", "silver", "gold"]);
export type GoalTier = z.infer<typeof goalTierSchema>;

export const emblemItemSchema = z.object({
  kind: z.enum(["engraving", "color"]),
  id: emblemKeySchema,
});

/** A clan as the list and the header show it. */
export const clanSummarySchema = z.object({
  id: clanIdSchema,
  name: z.string(),
  motto: z.string(),
  entryMode: clanEntryModeSchema,
  emblem: emblemSchema,
  memberCount: z.int().nonnegative(),
});
export type ClanSummary = z.infer<typeof clanSummarySchema>;

/** `GET /clans?q=&entry=&cursor=`: by name prefix, the biggest clans first. */
export const clansQuerySchema = z.object({
  q: z.string().trim().max(30).optional(),
  entry: clanEntryModeSchema.optional(),
  cursor: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const clansResponseSchema = z.object({
  clans: z.array(clanSummarySchema),
  nextCursor: z.string().nullable(),
});
export type ClansResponse = z.infer<typeof clansResponseSchema>;

/** Boosters of a weekly goal the player may claim. */
export const claimableGoalSchema = z.object({
  week: z.string(),
  tier: goalTierSchema,
  boosters: z.int().positive(),
  /** End of the following week. */
  until: timestampSchema,
});
export type ClaimableGoal = z.infer<typeof claimableGoalSchema>;

/** `GET /me/clan`: where the player stands. */
export const myClanResponseSchema = z.object({
  clanId: clanIdSchema.nullable(),
  /** Set while the 24 h after leaving a clan run. */
  rejoinAt: timestampSchema.nullable(),
  /** Clans the player asked to enter. */
  requests: z.array(clanIdSchema),
  /** Weekly goal boosters waiting, even from a clan the player left: for the mail. */
  claimable: z.array(claimableGoalSchema),
});
export type MyClanResponse = z.infer<typeof myClanResponseSchema>;

export const clanMemberSchema = z.object({
  player: playerBadgeSchema,
  role: clanRoleSchema,
  joinedAt: timestampSchema,
  /** Seen within the last few minutes. */
  online: z.boolean(),
  lastSeenAt: timestampSchema.nullable(),
  /** New words brought to this week's goal. */
  weekWords: z.int().nonnegative(),
  mutedUntil: timestampSchema.nullable(),
});
export type ClanMember = z.infer<typeof clanMemberSchema>;

export const clanGoalSchema = z.object({
  /** The Monday in Paris, "2026-10-19". */
  week: z.string(),
  endsAt: timestampSchema,
  targets: z.object({ bronze: z.int(), silver: z.int(), gold: z.int() }),
  words: z.int().nonnegative(),
  tier: goalTierSchema.nullable(),
  myWords: z.int().nonnegative(),
  /** Words a member brings before sharing the boosters. */
  minContribution: z.int().positive(),
  /** Tiers whose boosters the player may claim now, from this week or the last one. */
  claimable: z.array(claimableGoalSchema),
  /** What the next gold goal unlocks for the emblem, `null` once all is unlocked. */
  nextUnlock: emblemItemSchema.nullable(),
});
export type ClanGoal = z.infer<typeof clanGoalSchema>;

/** `GET /clans/:id`: the clan's page. Members see the goal and the library. */
export const clanViewSchema = z.object({
  clan: clanSummarySchema,
  /** The player's place in it; `null` for a visitor. */
  me: z
    .object({
      role: clanRoleSchema,
      mutedUntil: timestampSchema.nullable(),
      /** For "Inviter": shared by any member. */
      inviteCode: z.string(),
    })
    .nullable(),
  /** The visitor already asked to enter. */
  requested: z.boolean(),
  goal: clanGoalSchema.nullable(),
  /** Cards of each collection held by at least one member. */
  library: z.array(z.object({ collectionId: slugSchema, owned: z.int().nonnegative() })),
  /** The first members, chief and deputies first; the rest by `GET /clans/:id/members`. */
  members: z.array(clanMemberSchema),
  /** Requests waiting, for the chief and the deputies; 0 for everyone else. */
  pendingRequests: z.int().nonnegative(),
  /** Engravings and colours the chief may choose. */
  emblemChoices: z.object({ engravings: z.array(z.string()), colors: z.array(z.string()) }),
});
export type ClanView = z.infer<typeof clanViewSchema>;

/**
 * `GET /clans/:id/members` query. With `q`, the members whose pseudo starts with it (for "@" in
 * the discussion): a few at most, without a next page.
 */
export const clanMembersQuerySchema = z.object({
  cursor: z.string().optional(),
  q: z.string().trim().min(1).max(30).optional(),
});

export const clanMembersResponseSchema = z.object({
  members: z.array(clanMemberSchema),
  nextCursor: z.string().nullable(),
});
export type ClanMembersResponse = z.infer<typeof clanMembersResponseSchema>;

/** `POST /clans` body. */
export const createClanRequestSchema = z.object({
  name: z.string().max(200),
  motto: z.string().max(400).default(""),
  entryMode: clanEntryModeSchema,
  emblem: emblemSchema,
});
export type CreateClanRequest = z.infer<typeof createClanRequestSchema>;

/** `PATCH /clans/:id` body, chief only. */
export const updateClanRequestSchema = createClanRequestSchema
  .partial()
  .refine((value) => Object.values(value).some((field) => field !== undefined));
export type UpdateClanRequest = z.infer<typeof updateClanRequestSchema>;

/** `POST /clans/join` body: entry by invitation code. */
export const joinByCodeRequestSchema = z.object({ code: z.string().max(20) });

export const clanJoinResultSchema = z.object({
  /** "joined": in the clan; "requested": waiting for the chief or a deputy. */
  outcome: z.enum(["joined", "requested"]),
  clanId: clanIdSchema,
});
export type ClanJoinResult = z.infer<typeof clanJoinResultSchema>;

/** `PUT /clans/:id/members/:code/role` body, chief only. */
export const setRoleRequestSchema = z.object({ role: z.enum(["deputy", "member"]) });

/** `POST /clans/:id/members/:code/mute` body: one of the allowed durations. */
export const muteRequestSchema = z.object({ durationMs: z.int().positive() });

export const clanRequestSchema = z.object({
  player: playerBadgeSchema,
  createdAt: timestampSchema,
});
export const clanRequestsResponseSchema = z.object({ requests: z.array(clanRequestSchema) });
export type ClanRequestsResponse = z.infer<typeof clanRequestsResponseSchema>;

/** `POST /me/clan/claims` body: the boosters of a tier reached. */
export const claimGoalRequestSchema = z.object({
  week: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  tier: goalTierSchema,
});

export const claimGoalResponseSchema = z.object({
  week: z.string(),
  tier: goalTierSchema,
  boosters: z.int().positive(),
  wallet: boosterWalletSchema,
});
export type ClaimGoalResponse = z.infer<typeof claimGoalResponseSchema>;

// --- Discussion and journal ---------------------------------------------------------

export const clanEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("joined"), player: playerBadgeSchema.nullable() }),
  z.object({ type: z.literal("left"), player: playerBadgeSchema.nullable() }),
  z.object({ type: z.literal("excluded"), player: playerBadgeSchema.nullable() }),
  z.object({ type: z.literal("role"), player: playerBadgeSchema.nullable(), role: clanRoleSchema }),
  z.object({
    type: z.literal("legendary"),
    player: playerBadgeSchema.nullable(),
    cardId: slugSchema,
  }),
  z.object({ type: z.literal("tier"), tier: goalTierSchema }),
  z.object({ type: z.literal("renamed"), name: z.string() }),
]);
export type ClanEvent = z.infer<typeof clanEventSchema>;

export const clanMessageSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("message"),
    id: z.int().positive(),
    /** `null` once the author deleted their account: "Un joueur parti". */
    author: playerBadgeSchema.nullable(),
    /** `null` when deleted or hidden. */
    body: z.string().nullable(),
    removed: z.enum(["deleted", "hidden"]).nullable(),
    mine: z.boolean(),
    /** Members named with "@", as ranges of `body`; `me` when it names the viewer. */
    mentions: z.array(
      z.object({ start: z.int().nonnegative(), end: z.int().positive(), me: z.boolean() }),
    ),
    createdAt: timestampSchema,
  }),
  z.object({
    kind: z.literal("event"),
    id: z.int().positive(),
    event: clanEventSchema,
    createdAt: timestampSchema,
  }),
]);
export type ClanMessage = z.infer<typeof clanMessageSchema>;

/**
 * `GET /clans/:id/messages`: newest first. `after` asks for what came since the last message
 * received (the open screen asks every few seconds); `before` pages back in time.
 */
export const clanMessagesQuerySchema = z.object({
  after: z.coerce.number().int().nonnegative().optional(),
  before: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const clanMessagesResponseSchema = z.object({
  messages: z.array(clanMessageSchema),
  /** More older messages exist. */
  hasMore: z.boolean(),
});
export type ClanMessagesResponse = z.infer<typeof clanMessagesResponseSchema>;

/** `POST /clans/:id/messages` body. */
export const postClanMessageRequestSchema = z.object({ body: z.string().max(2000) });

/** Refusals of clan routes, as `{ error }`. */
export const clanRefusalSchema = z.enum([
  "account_required",
  "pseudo_required",
  "level_too_low",
  "already_in_clan",
  "rejoin_too_soon",
  "not_member",
  "not_allowed",
  "clan_not_found",
  "player_not_found",
  "invite_only",
  "name_taken",
  "name_too_short",
  "name_too_long",
  "name_invalid_characters",
  "name_refused",
  "motto_too_long",
  "motto_refused",
  "emblem_not_allowed",
  "message_empty",
  "message_too_long",
  "message_refused",
  "too_soon",
  "muted",
  "sanctioned",
  "mute_duration",
  "goal_not_reached",
  "already_claimed",
  "claim_expired",
  "reserve_full",
  "self",
]);
export type ClanRefusal = z.infer<typeof clanRefusalSchema>;
