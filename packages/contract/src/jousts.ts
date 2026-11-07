import { z } from "zod";
import { slugSchema, timestampSchema } from "./common";
import { groupPlaceSchema, joustStandingSchema, leagueSchema } from "./leagues";
import { playerBadgeSchema } from "./profile";

/** Whether the player may joust, or what keeps them from it. */
export const joustAccessSchema = z.enum([
  "open",
  "account_required",
  "pseudo_required",
  "level_too_low",
  /** Jousts are open to a few testers first. */
  "not_yet",
]);
export type JoustAccess = z.infer<typeof joustAccessSchema>;

/** A card the player may put in their deck, with what it costs. */
export const deckCandidateSchema = z.object({
  cardId: slugSchema,
  cost: z.int().positive(),
});

/** `GET /jousts/deck`: the deck, as saved or as the game composes it, and what can enter it. */
export const joustDeckResponseSchema = z.object({
  cardIds: z.array(slugSchema),
  /** `false` while the game composes the deck: the player never changed it. */
  saved: z.boolean(),
  candidates: z.array(deckCandidateSchema),
  budget: z.int().positive(),
  size: z.int().positive(),
  /** The fewest cards a deck holds: the cards drawn for one joust. */
  min: z.int().positive(),
});
export type JoustDeckResponse = z.infer<typeof joustDeckResponseSchema>;

export const saveDeckRequestSchema = z.object({
  cardIds: z.array(slugSchema).max(50),
});

/** `PUT /jousts/deck` refusals, 409, as `{ error }`. */
export const deckRefusalSchema = z.enum([
  "too_few",
  "too_many",
  "duplicate",
  "not_eligible",
  "over_budget",
  "not_open",
]);
export type DeckRefusal = z.infer<typeof deckRefusalSchema>;

/** Right answers and total time of a run, in milliseconds. */
export const runScoreSchema = z.object({
  correct: z.int().nonnegative(),
  ms: z.int().nonnegative(),
});
export type RunScore = z.infer<typeof runScoreSchema>;

/**
 * Where a joust stands for the player: their own run to play or finish (`play`), the opponent to
 * play (`waiting`), or `ended`.
 */
export const joustStateSchema = z.enum(["play", "waiting", "ended"]);
export type JoustState = z.infer<typeof joustStateSchema>;

export const joustOutcomeSchema = z.enum(["won", "lost", "draw"]);
export type JoustOutcome = z.infer<typeof joustOutcomeSchema>;

export const joustSummarySchema = z.object({
  id: z.uuid(),
  kind: z.enum(["ranked", "free", "friendly"]),
  /** The player launched it. */
  launched: z.boolean(),
  opponent: playerBadgeSchema.nullable(),
  state: joustStateSchema,
  /** Until when the second player may play; `null` before the first run ends. */
  replyBy: timestampSchema.nullable(),
  outcome: joustOutcomeSchema.nullable(),
  /** The opponent never played. */
  forfeit: z.boolean(),
  mine: runScoreSchema.nullable(),
  theirs: runScoreSchema.nullable(),
  createdAt: timestampSchema,
  /** The player watched the result; until then it shows sealed. `true` while not ended. */
  seen: z.boolean(),
});
export type JoustSummary = z.infer<typeof joustSummarySchema>;

/** `GET /jousts`: access, the deck's state, and the player's jousts. */
export const joustsResponseSchema = z.object({
  access: joustAccessSchema,
  opensAtLevel: z.int().positive(),
  /** The deck holds enough cards for a joust. */
  deckReady: z.boolean(),
  /** The player composed their deck: no joust before. */
  deckSaved: z.boolean(),
  /** The player went through the first visit, or skipped it. */
  guideDone: z.boolean(),
  /** Jousts launched still waiting for their opponent, and how many may. */
  waiting: z.int().nonnegative(),
  maxWaiting: z.int().positive(),
  /** Seconds to answer a question. */
  answerSeconds: z.int().positive(),
  questions: z.int().positive(),
  jousts: z.array(joustSummarySchema),
  /** League and place in this week's tournament. */
  standing: joustStandingSchema,
});
export type JoustsResponse = z.infer<typeof joustsResponseSchema>;

/** `GET /jousts/opponents`: friends and clan members the player may challenge. */
export const joustOpponentsResponseSchema = z.object({
  players: z.array(playerBadgeSchema),
});
export type JoustOpponentsResponse = z.infer<typeof joustOpponentsResponseSchema>;

export const launchJoustRequestSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("ranked") }),
  /** An opponent chosen by the game, for nothing but the game. */
  z.object({ kind: z.literal("free") }),
  /** A friend or clan member, by the code of their badge. */
  z.object({ kind: z.literal("friendly"), opponentCode: z.string().min(1).max(32) }),
  /** A friendly rematch against the other player of an earlier joust. */
  z.object({ kind: z.literal("revenge"), joustId: z.uuid() }),
]);
export type LaunchJoustRequest = z.infer<typeof launchJoustRequestSchema>;

/** `POST /jousts` refusals, 409, as `{ error }`. */
export const launchRefusalSchema = z.enum([
  "not_open",
  "deck_too_small",
  /** The player never composed a deck. */
  "deck_not_saved",
  "too_many_waiting",
  /** No ranked opponent came by recently enough. */
  "no_opponent",
  /** The player played their ranked jousts of the day. */
  "ranked_limit",
  /** The player chosen cannot joust now. */
  "opponent_unavailable",
  "not_friends",
]);
export type LaunchRefusal = z.infer<typeof launchRefusalSchema>;

export const launchJoustResponseSchema = z.object({ joustId: z.uuid() });

/**
 * The next question of the player's run. The right card stays on the server: only the definition
 * and the words to choose from are sent. `deadline` is the server's clock for this question.
 */
export const joustQuestionResponseSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("question"),
    position: z.int().nonnegative(),
    definition: z.string(),
    choices: z.array(slugSchema),
    servedAt: timestampSchema,
    deadline: timestampSchema,
  }),
  z.object({ kind: z.literal("run_over") }),
]);
export type JoustQuestionResponse = z.infer<typeof joustQuestionResponseSchema>;

export const answerJoustRequestSchema = z.object({
  position: z.int().nonnegative().max(20),
  cardId: slugSchema,
});

export const answerJoustResponseSchema = z.object({
  correct: z.boolean(),
  rightCardId: slugSchema,
  /** The answer came after the clock: it counts as wrong. */
  late: z.boolean(),
  runOver: z.boolean(),
});
export type AnswerJoustResponse = z.infer<typeof answerJoustResponseSchema>;

/** Refusals of a question or an answer, 409, as `{ error }`. */
export const joustRefusalSchema = z.enum(["not_your_turn", "not_served", "not_a_choice"]);
export type JoustRefusal = z.infer<typeof joustRefusalSchema>;

/** One question of a run, once it can be shown: the card asked, the word chosen, the time. */
export const joustAnswerSchema = z.object({
  cardId: slugSchema,
  chosenCardId: slugSchema.nullable(),
  correct: z.boolean(),
  ms: z.int().nonnegative(),
});
export type JoustAnswer = z.infer<typeof joustAnswerSchema>;

/** `GET /jousts/:id`: the joust as the player may see it now. */
export const joustViewSchema = z.object({
  summary: joustSummarySchema,
  /**
   * The first player's run, question by question, shown to the second player as they play: the
   * recorded game of a real player. `null` for the first player and before it ends.
   */
  ghost: z.array(z.object({ correct: z.boolean(), ms: z.int().nonnegative() })).nullable(),
  /** The first player's run was played at this time. */
  ghostPlayedAt: timestampSchema.nullable(),
  /** Questions of the player's run answered so far, the cards shown once answered. */
  answered: z.int().nonnegative(),
  /** Once the player's run is closed: its questions and the XP it gave. */
  run: z.object({ answers: z.array(joustAnswerSchema), xp: z.int().nonnegative() }).nullable(),
  /** Once the player's run is closed: the cards of their deck the other player has to find. */
  traps: z.array(slugSchema).nullable(),
  /** Once ended: the questions of both runs, and what the joust gave the player. */
  result: z
    .object({
      mine: z.array(joustAnswerSchema),
      theirs: z.array(joustAnswerSchema),
      xp: z.int().nonnegative(),
      boosters: z.int().nonnegative(),
      /**
       * A ranked joust: the tournament points it gave the player, and where they stand now in
       * the group of the week it ended in (`group` is `null` once that week is over).
       */
      tournament: z
        .object({
          won: z.int().nonnegative(),
          league: leagueSchema,
          group: groupPlaceSchema.nullable(),
        })
        .nullable(),
    })
    .nullable(),
});
export type JoustView = z.infer<typeof joustViewSchema>;
