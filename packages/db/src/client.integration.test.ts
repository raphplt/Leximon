import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb } from "./client";
import { cards, collections } from "./schema/index";
import { testDatabaseUrl } from "./testing";

const { db, close } = createDb(testDatabaseUrl(), { maxConnections: 1 });
afterAll(close);

describe("database", () => {
  it("runs queries against Postgres", async () => {
    const { rows } = await db.execute<{ ok: number }>(sql`select 1 as ok`);
    expect(rows[0]?.ok).toBe(1);
  });

  it("has all migrations applied", async () => {
    const { rows } = await db.execute<{ name: string }>(sql`
      select c.relname as name from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relispartition
      order by c.relname`);
    expect(rows.map((row) => row.name)).toEqual([
      "accounts",
      "admin_actions",
      "booster_bonus_awards",
      "booster_open_requests",
      "booster_opens",
      "booster_wallets",
      "card_themes",
      "cards",
      "clan_goal_claims",
      "clan_join_requests",
      "clan_library",
      "clan_members",
      "clan_messages",
      "clan_week_members",
      "clan_weeks",
      "clans",
      "collections",
      "daily_riddles",
      "ecu_movements",
      "email_campaign_sends",
      "email_campaigns",
      "email_consents",
      "email_suppressions",
      "friend_feed_events",
      "friend_reactions",
      "friend_requests",
      "friendships",
      "guest_links",
      "invites",
      "joust_decks",
      "joust_group_members",
      "joust_groups",
      "joust_questions",
      "joust_ratings",
      "joust_traps",
      "joust_week_rewards",
      "jousts",
      "mail_letters",
      "moderation_reports",
      "notification_emails",
      "pinned_cards",
      "player_age_brackets",
      "player_days",
      "player_feedback",
      "player_interest",
      "player_signups",
      "players",
      "practice_answers",
      "referrals",
      "review_logs",
      "riddle_plays",
      "riddle_words",
      "sanctions",
      "sessions",
      "sign_in_code_quotas",
      "sign_in_emails",
      "themes",
      "trade_items",
      "trades",
      "user_blocks",
      "user_cards",
      "user_carnet_cases",
      "user_level_rewards",
      "user_mastery",
      "user_missions",
      "user_preferences",
      "user_progress",
      "user_rarity_completions",
      "user_welcome_days",
      "users",
      "verifications",
      "waitlist_signups",
      "wishes",
    ]);
  });
});

describe("card rarity", () => {
  beforeAll(async () => {
    await db.insert(collections).values({ id: "rarity-tests", name: "Rarity tests" });
  });

  it("cannot change once the card exists", async () => {
    await db.insert(cards).values({
      id: "frozen-test",
      lemma: "frozen",
      rarity: "rare",
      collectionId: "rarity-tests",
    });
    await expect(
      db.update(cards).set({ rarity: "legendary" }).where(eq(cards.id, "frozen-test")),
    ).rejects.toThrow(/frozen/);
  });

  it("does not block other updates of the card", async () => {
    await db.insert(cards).values({
      id: "retire-test",
      lemma: "retire",
      rarity: "rare",
      collectionId: "rarity-tests",
    });
    await db.update(cards).set({ retiredAt: new Date() }).where(eq(cards.id, "retire-test"));
  });
});

describe("booster_opens partitions", () => {
  const monthlyPartitions = async () =>
    (
      await db.execute<{ name: string }>(sql`
        select c.relname as name from pg_inherits i join pg_class c on c.oid = i.inhrelid
        where i.inhparent = 'booster_opens'::regclass and c.relname <> 'booster_opens_default'
        order by c.relname`)
    ).rows.map((row) => row.name);

  it("exist for the current month and the next two", async () => {
    const now = new Date();
    const expected = [0, 1, 2].map((offset) => {
      const month = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1));
      return `booster_opens_${month.getUTCFullYear()}_${String(month.getUTCMonth() + 1).padStart(2, "0")}`;
    });
    expect(await monthlyPartitions()).toEqual(expect.arrayContaining(expected));
  });

  it("are created idempotently", async () => {
    const before = await monthlyPartitions();
    await db.execute(sql`select leximon_ensure_booster_open_partitions(2)`);
    expect(await monthlyPartitions()).toEqual(before);
  });
});
