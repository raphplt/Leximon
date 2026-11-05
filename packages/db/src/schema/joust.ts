import { JOUST_KINDS } from "@leximon/core";
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./auth";
import { cards } from "./game";

export const joustKind = pgEnum("joust_kind", JOUST_KINDS);

/** The deck a player chose. Without a row, the game composes one from their words. */
export const joustDecks = pgTable("joust_decks", {
  userId: text()
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  cardIds: text().array().notNull(),
  updatedAt: timestamp({ withTimezone: true }).notNull(),
});

/** Each player's rating, as it stood before and after a ranked joust. */
export interface JoustRatingChange {
  readonly before: number;
  readonly after: number;
}

/**
 * A joust between two players. The challenger plays at once; the opponent then has until
 * `replyBy`. A run closes when its questions are answered or its time is gone; the joust ends when
 * both are closed, or when the opponent let `replyBy` pass (`forfeit`). Rewards and ratings are
 * written once, when the run or the joust closes.
 */
export const jousts = pgTable(
  "jousts",
  {
    id: uuid().primaryKey().defaultRandom(),
    kind: joustKind().notNull(),
    challengerId: text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    opponentId: text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** The challenger's idempotency key: a launch sent twice makes one joust. */
    launchKey: uuid().notNull(),
    /** The joust this one answers, for a rematch. */
    revengeOf: uuid(),
    createdAt: timestamp({ withTimezone: true }).notNull(),
    challengerDoneAt: timestamp({ withTimezone: true }),
    challengerCorrect: smallint(),
    challengerMs: integer(),
    replyBy: timestamp({ withTimezone: true }),
    opponentStartedAt: timestamp({ withTimezone: true }),
    opponentDoneAt: timestamp({ withTimezone: true }),
    opponentCorrect: smallint(),
    opponentMs: integer(),
    endedAt: timestamp({ withTimezone: true }),
    /** `challenger`, `opponent` or `draw`, once ended. */
    outcome: text(),
    /** The opponent never played: the joust went to the challenger. */
    forfeit: boolean().notNull().default(false),
    /** Whether the run counted among the player's rewarded jousts of the day. */
    challengerRewarded: boolean().notNull().default(false),
    opponentRewarded: boolean().notNull().default(false),
    challengerXp: integer().notNull().default(0),
    opponentXp: integer().notNull().default(0),
    challengerBoosters: smallint().notNull().default(0),
    opponentBoosters: smallint().notNull().default(0),
    ratings: jsonb().$type<{
      readonly challenger: JoustRatingChange;
      readonly opponent: JoustRatingChange;
    }>(),
  },
  (table) => [
    uniqueIndex("jousts_launch_idx").on(table.challengerId, table.launchKey),
    index("jousts_challenger_idx").on(table.challengerId, table.createdAt.desc()),
    index("jousts_opponent_idx").on(table.opponentId, table.createdAt.desc()),
    // Jousts still open, for the lists and the sweep of those whose time ran out.
    index("jousts_open_idx").on(table.replyBy).where(sql`${table.endedAt} is null`),
    check("jousts_players_check", sql`${table.challengerId} <> ${table.opponentId}`),
    check(
      "jousts_outcome_check",
      sql`${table.outcome} is null or ${table.outcome} in ('challenger', 'opponent', 'draw')`,
    ),
  ],
);

/**
 * The questions of a joust, five for each player, drawn when it is launched. The right card and
 * the choices stay on the server until the answer: `servedAt` starts the clock, the first time
 * the question is shown.
 */
export const joustQuestions = pgTable(
  "joust_questions",
  {
    joustId: uuid()
      .notNull()
      .references(() => jousts.id, { onDelete: "cascade" }),
    answererId: text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    position: smallint().notNull(),
    cardId: text()
      .notNull()
      .references(() => cards.id),
    choices: text().array().notNull(),
    servedAt: timestamp({ withTimezone: true }),
    answeredAt: timestamp({ withTimezone: true }),
    chosenCardId: text(),
    correct: boolean(),
  },
  (table) => [
    primaryKey({ columns: [table.joustId, table.answererId, table.position] }),
    check("joust_questions_position_check", sql`${table.position} >= 0`),
  ],
);

/** The Glicko-2 rating of ranked jousts; a player without a row stands at the start. */
export const joustRatings = pgTable(
  "joust_ratings",
  {
    userId: text()
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    rating: doublePrecision().notNull(),
    deviation: doublePrecision().notNull(),
    volatility: doublePrecision().notNull(),
    games: integer().notNull().default(0),
    lastPlayedAt: timestamp({ withTimezone: true }).notNull(),
  },
  (table) => [index("joust_ratings_rating_idx").on(table.rating)],
);
