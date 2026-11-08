import type { PatronCosmetic } from "@leximon/core";
import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { users } from "./auth";

/**
 * The patron subscription. Stripe keeps it and says what happens through its webhooks: these rows
 * are its copy, written only from what Stripe returns, never from what a client says.
 */

/**
 * One row per account that went to pay once: its Stripe customer, made before the first checkout
 * and kept for every later one, and the state of its latest subscription.
 */
export const patronSubscriptions = pgTable(
  "patron_subscriptions",
  {
    userId: text()
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    stripeCustomerId: text().notNull().unique(),
    /** The latest checkout opened: expired when another one opens, so that only one can be paid. */
    checkoutSessionId: text(),
    stripeSubscriptionId: text().unique(),
    /** Stripe's status, as Stripe names it (`trialing`, `active`, `past_due`, `canceled`…). */
    status: text(),
    plan: text(),
    currentPeriodEnd: timestamp({ withTimezone: true }),
    trialEnd: timestamp({ withTimezone: true }),
    /** When a subscription cancelled by the player stops; `null` while it renews. */
    cancelAt: timestamp({ withTimezone: true }),
    /** A trial, once per account. */
    trialUsedAt: timestamp({ withTimezone: true }),
    firstPaidAt: timestamp({ withTimezone: true }),
    /** First payment within the founding month: a founder for life. */
    founderAt: timestamp({ withTimezone: true }),
    /** The box giving up the right of withdrawal, ticked before the latest checkout. */
    waiverAcceptedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check("patron_subscriptions_plan_check", sql`${table.plan} in ('monthly', 'yearly')`),
  ],
);

/**
 * One row per invoice paid with money: the months it covers. Trials and invoices of zero are not
 * periods. What a patron is given for having paid is read from here.
 */
export const patronPeriods = pgTable(
  "patron_periods",
  {
    invoiceId: text().primaryKey(),
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    stripeSubscriptionId: text().notNull(),
    plan: text().notNull(),
    startsAt: timestamp({ withTimezone: true }).notNull(),
    endsAt: timestamp({ withTimezone: true }).notNull(),
    /** In cents of euro. */
    amountPaid: integer().notNull(),
    paidAt: timestamp({ withTimezone: true }).notNull(),
    refundedAt: timestamp({ withTimezone: true }),
  },
  (table) => [
    index("patron_periods_user_idx").on(table.userId, table.startsAt),
    check("patron_periods_plan_check", sql`${table.plan} in ('monthly', 'yearly')`),
    check("patron_periods_amount_check", sql`${table.amountPaid} > 0`),
  ],
);

/**
 * The cosmetic of a month paid for, claimed by the patron: the primary key makes it once.
 * `cosmetic` keeps what was given, so that a later change of the calendar never takes it back.
 */
export const patronCosmeticClaims = pgTable(
  "patron_cosmetic_claims",
  {
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** In Paris, `YYYY-MM`. */
    month: text().notNull(),
    cosmetic: jsonb().$type<PatronCosmetic>().notNull(),
    claimedAt: timestamp({ withTimezone: true }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.month] })],
);

/** Every Stripe event applied: one Stripe sends again finds its row and changes nothing. */
export const stripeEvents = pgTable("stripe_events", {
  id: text().primaryKey(),
  type: text().notNull(),
  receivedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
});

/**
 * The words patrons may find: pre-screened and not published yet, loaded from the content
 * pipeline's reserve. A word's id is the card it would become. The rarity never comes here, so
 * nobody picks a word for it.
 */
export const reserveWords = pgTable(
  "reserve_words",
  {
    id: text().primaryKey(),
    word: text().notNull(),
    definition: text().notNull(),
    theme: text(),
    partOfSpeech: text(),
    /** The word lowercased and without accents: searched by its beginning. */
    searchKey: text().notNull(),
    /** The reserve version that last listed it. */
    release: text().notNull(),
    /** No longer in the latest reserve (published meanwhile, or dropped by the pipeline). */
    removedAt: timestamp({ withTimezone: true }),
  },
  (table) => [
    index("reserve_words_search_idx")
      .on(table.searchKey.op("text_pattern_ops"))
      .where(sql`${table.removedAt} is null`),
    index("reserve_words_theme_idx")
      .on(table.theme, table.searchKey)
      .where(sql`${table.removedAt} is null`),
  ],
);

/**
 * A word found by a patron: the word as primary key, so that it is found once. It stays
 * `reserved` until its card is published, or `rejected` if the quality check sets it aside,
 * which gives the patron's right back.
 */
export const wordFinds = pgTable(
  "word_finds",
  {
    wordId: text()
      .primaryKey()
      .references(() => reserveWords.id),
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    state: text().notNull(),
    foundAt: timestamp({ withTimezone: true }).notNull(),
    /** When it was published or set aside. */
    settledAt: timestamp({ withTimezone: true }),
  },
  (table) => [
    index("word_finds_user_idx").on(table.userId, table.foundAt),
    check("word_finds_state_check", sql`${table.state} in ('reserved', 'published', 'rejected')`),
  ],
);
