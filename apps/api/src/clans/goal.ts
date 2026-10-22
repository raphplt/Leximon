import type { BoosterWalletResponse, ClaimableGoal, ClanGoal, GoalTier } from "@leximon/contract";
import {
  BONUS_SCHEDULE,
  bonusRulesAt,
  CLAN_GOAL_SCHEDULE,
  CLAN_SCHEDULE,
  type ClanGoalRules,
  claimableTiers,
  claimDeadline,
  clanGoalRulesAt,
  clanRulesAt,
  type EpochMs,
  type GameDay,
  type GoalTargets,
  gameWeekOf,
  goalTargets,
  highestTier,
  nextEmblemUnlock,
  reserveCapacity,
  tiersReached,
} from "@leximon/core";
import { type Database, schema } from "@leximon/db";
import { and, eq, inArray, sql } from "drizzle-orm";
import { lockWallet, walletView } from "../levels/rewards";

const { clanGoalClaims, clanMembers, clanMessages, clanWeekMembers, clanWeeks, clans } = schema;

type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
type Reader = Pick<Database, "select">;

/** The game week of a key ("2026-10-19"); `null` if the key is not a Monday's. */
export function weekOfKey(key: string): GameDay | null {
  const noon = Date.parse(`${key}T12:00:00Z`);
  if (Number.isNaN(noon)) return null;
  const week = gameWeekOf(noon);
  return week.key === key ? week : null;
}

function previousWeek(now: EpochMs): GameDay {
  return gameWeekOf(gameWeekOf(now).start - 1);
}

type WeekRow = typeof clanWeeks.$inferSelect;

function targetsOf(row: Pick<WeekRow, "bronze" | "silver" | "gold">): GoalTargets {
  return { bronze: row.bronze, silver: row.silver, gold: row.gold };
}

/** The rules of a week are those in force when it starts. */
function goalRulesOf(week: GameDay): ClanGoalRules {
  return clanGoalRulesAt(CLAN_GOAL_SCHEDULE, week.start);
}

/**
 * The clan's current week, created at its first use: the targets are fixed then, from the
 * members who opened a booster in the 7 days before. Concurrent first uses insert once.
 */
export async function ensureClanWeek(db: Database, clanId: string, now: EpochMs): Promise<WeekRow> {
  const week = gameWeekOf(now);
  const existing = await readWeek(db, clanId, week.key);
  if (existing !== null) return existing;

  const rules = goalRulesOf(week);
  const since = new Date(now - rules.activeWindowMs);
  const [active] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(clanMembers)
    .where(
      and(
        eq(clanMembers.clanId, clanId),
        sql`exists (select 1 from booster_opens o where o.user_id = ${clanMembers.userId}
          and o.opened_at >= ${since} and o.opened_at < ${new Date(now)})`,
      ),
    );
  const activeMembers = active?.count ?? 0;
  const targets = goalTargets(rules, activeMembers);
  await db
    .insert(clanWeeks)
    .values({ clanId, week: week.key, activeMembers, ...targets, updatedAt: new Date(now) })
    .onConflictDoNothing();
  const created = await readWeek(db, clanId, week.key);
  if (created === null) throw new Error(`Clan week missing right after its creation: ${clanId}`);
  return created;
}

async function readWeek(db: Reader, clanId: string, week: string): Promise<WeekRow | null> {
  const [row] = await db
    .select()
    .from(clanWeeks)
    .where(and(eq(clanWeeks.clanId, clanId), eq(clanWeeks.week, week)));
  return row ?? null;
}

export interface RecountReport {
  readonly words: number;
  readonly newTiers: readonly GoalTier[];
}

/**
 * Recounts a clan's week from the albums: each member's new words since they joined,
 * within the week. A member's count never goes down, so a member who leaves keeps what they
 * brought and a tier reached stays reached. A newly reached tier enters the journal once (unique
 * event key), and a gold one unlocks one more emblem item.
 *
 * The current week is created if needed; a past week only recounted if it exists. Lock order: the
 * week's row, then the clan's.
 */
export async function recountClanWeek(
  db: Database,
  clanId: string,
  weekKey: string,
  now: EpochMs,
): Promise<RecountReport | null> {
  const week = weekOfKey(weekKey);
  if (week === null || week.start > now) return null;
  if (week.key === gameWeekOf(now).key) {
    await ensureClanWeek(db, clanId, now);
  }
  const rules = goalRulesOf(week);

  return db.transaction(async (tx): Promise<RecountReport | null> => {
    const [row] = await tx
      .select()
      .from(clanWeeks)
      .where(and(eq(clanWeeks.clanId, clanId), eq(clanWeeks.week, week.key)))
      .for("update");
    if (row === undefined) return null;

    const start = new Date(week.start);
    const end = new Date(week.end);
    await tx.execute(sql`
      insert into clan_week_members (clan_id, week, user_id, words, updated_at)
      select m.clan_id, ${week.key}, m.user_id,
        (select count(distinct uc.card_id)::int from user_cards uc
          where uc.user_id = m.user_id
            and uc.first_obtained_at >= greatest(${start}::timestamptz, m.joined_at)
            and uc.first_obtained_at < ${end}),
        ${new Date(now)}
      from clan_members m
      where m.clan_id = ${clanId} and m.joined_at < ${end}
      on conflict (clan_id, week, user_id) do update
        set words = greatest(clan_week_members.words, excluded.words),
            updated_at = excluded.updated_at`);
    const [total] = await tx
      .select({ words: sql<number>`coalesce(sum(${clanWeekMembers.words}), 0)::int` })
      .from(clanWeekMembers)
      .where(and(eq(clanWeekMembers.clanId, clanId), eq(clanWeekMembers.week, week.key)));
    const words = total?.words ?? 0;

    const targets = targetsOf(row);
    const before = new Set(tiersReached(targets, row.words));
    const newTiers = tiersReached(targets, words).filter((tier) => !before.has(tier));
    for (const tier of newTiers) {
      const inserted = await tx
        .insert(clanMessages)
        .values({
          clanId,
          kind: "event",
          event: { type: "tier", week: week.key, tier },
          eventKey: `tier:${week.key}:${tier}`,
          createdAt: new Date(now),
        })
        .onConflictDoNothing()
        .returning({ id: clanMessages.id });
      if (inserted.length > 0 && rules.emblemTiers.includes(tier)) {
        await tx
          .update(clans)
          .set({ emblemUnlocked: sql`${clans.emblemUnlocked} + 1` })
          .where(eq(clans.id, clanId));
      }
    }
    await tx
      .update(clanWeeks)
      .set({ words, tier: highestTier(targets, words), updatedAt: new Date(now) })
      .where(and(eq(clanWeeks.clanId, clanId), eq(clanWeeks.week, week.key)));
    return { words, newTiers };
  });
}

// --- Rewards -------------------------------------------------------------------------------------

/**
 * Tiers whose boosters the player may claim: this week and the last one, in any clan they
 * brought enough words to, minus what they already claimed. One claim per tier and week, so two
 * boosters a week at most, even after changing clans.
 */
export async function readClaimable(
  db: Reader,
  userId: string,
  now: EpochMs,
): Promise<ClaimableGoal[]> {
  const weeks = [gameWeekOf(now), previousWeek(now)];
  const keys = weeks.map((week) => week.key);
  const rows = await db
    .select({
      week: clanWeekMembers.week,
      mine: clanWeekMembers.words,
      words: clanWeeks.words,
      bronze: clanWeeks.bronze,
      silver: clanWeeks.silver,
      gold: clanWeeks.gold,
    })
    .from(clanWeekMembers)
    .innerJoin(
      clanWeeks,
      and(eq(clanWeeks.clanId, clanWeekMembers.clanId), eq(clanWeeks.week, clanWeekMembers.week)),
    )
    .where(and(eq(clanWeekMembers.userId, userId), inArray(clanWeekMembers.week, keys)));
  if (rows.length === 0) return [];
  const claimed = await db
    .select({ week: clanGoalClaims.week, tier: clanGoalClaims.tier })
    .from(clanGoalClaims)
    .where(and(eq(clanGoalClaims.userId, userId), inArray(clanGoalClaims.week, keys)));
  const taken = new Set(claimed.map((claim) => `${claim.week}:${claim.tier}`));

  const found = new Map<string, ClaimableGoal>();
  for (const row of rows) {
    const week = weeks.find((candidate) => candidate.key === row.week);
    if (week === undefined) continue;
    const rules = goalRulesOf(week);
    const reached = tiersReached(targetsOf(row), row.words);
    for (const tier of claimableTiers(rules, reached, row.mine)) {
      const key = `${row.week}:${tier}`;
      if (taken.has(key) || found.has(key)) continue;
      found.set(key, {
        week: row.week,
        tier,
        boosters: rules.bonusBoosters[tier],
        until: new Date(claimDeadline(week.start)).toISOString(),
      });
    }
  }
  return [...found.values()].sort((a, b) => a.week.localeCompare(b.week));
}

export type ClaimGoalResult =
  | {
      readonly kind: "claimed";
      readonly week: string;
      readonly tier: GoalTier;
      readonly boosters: number;
      readonly wallet: BoosterWalletResponse;
    }
  | {
      readonly kind: "refused";
      readonly reason: "goal_not_reached" | "claim_expired" | "reserve_full";
    };

/**
 * Puts a weekly goal's boosters in the reserve. Idempotent: the tier and week are the
 * key, a second claim returns the first. A full reserve refuses and the boosters wait, until the
 * end of the following week.
 *
 * One transaction: lock the wallet (the lock order of every reserve write), read the claim and
 * the eligibility, then write both.
 */
export async function claimGoal(
  db: Database,
  input: {
    readonly userId: string;
    readonly week: string;
    readonly tier: GoalTier;
    readonly now: EpochMs;
  },
): Promise<ClaimGoalResult> {
  const { userId, tier, now } = input;
  const week = weekOfKey(input.week);
  if (week === null || week.start > now) return { kind: "refused", reason: "goal_not_reached" };
  if (now >= claimDeadline(week.start)) return { kind: "refused", reason: "claim_expired" };

  return db.transaction(async (tx): Promise<ClaimGoalResult> => {
    const locked = await lockWallet(tx, userId, now);
    const [previous] = await tx
      .select({ boosters: clanGoalClaims.boosters })
      .from(clanGoalClaims)
      .where(
        and(
          eq(clanGoalClaims.userId, userId),
          eq(clanGoalClaims.week, week.key),
          eq(clanGoalClaims.tier, tier),
        ),
      );
    if (previous !== undefined) {
      return {
        kind: "claimed",
        week: week.key,
        tier,
        boosters: previous.boosters,
        wallet: walletView(locked, now),
      };
    }

    const source = await findEligibleClan(tx, userId, week, tier);
    if (source === null) return { kind: "refused", reason: "goal_not_reached" };
    const boosters = goalRulesOf(week).bonusBoosters[tier];
    const capacity = reserveCapacity(bonusRulesAt(BONUS_SCHEDULE, now), locked.reserveSlots);
    if (locked.bonusBoosters + boosters > capacity) {
      return { kind: "refused", reason: "reserve_full" };
    }

    await tx.insert(clanGoalClaims).values({
      userId,
      week: week.key,
      tier,
      clanId: source,
      boosters,
      claimedAt: new Date(now),
    });
    const after = { ...locked, bonusBoosters: locked.bonusBoosters + boosters };
    await tx
      .update(schema.boosterWallets)
      .set({ bonusBoosters: after.bonusBoosters })
      .where(eq(schema.boosterWallets.userId, userId));
    return { kind: "claimed", week: week.key, tier, boosters, wallet: walletView(after, now) };
  });
}

/** A clan where the player brought enough words to a week that reached the tier. */
async function findEligibleClan(
  tx: Transaction,
  userId: string,
  week: GameDay,
  tier: GoalTier,
): Promise<string | null> {
  const rules = goalRulesOf(week);
  const rows = await tx
    .select({
      clanId: clanWeekMembers.clanId,
      mine: clanWeekMembers.words,
      words: clanWeeks.words,
      bronze: clanWeeks.bronze,
      silver: clanWeeks.silver,
      gold: clanWeeks.gold,
    })
    .from(clanWeekMembers)
    .innerJoin(
      clanWeeks,
      and(eq(clanWeeks.clanId, clanWeekMembers.clanId), eq(clanWeeks.week, clanWeekMembers.week)),
    )
    .where(and(eq(clanWeekMembers.userId, userId), eq(clanWeekMembers.week, week.key)));
  const eligible = rows.find((row) =>
    claimableTiers(rules, tiersReached(targetsOf(row), row.words), row.mine).includes(tier),
  );
  return eligible?.clanId ?? null;
}

// --- View ----------------------------------------------------------------------------------------

/** The goal as a member sees it on the clan's page. */
export async function readGoal(
  db: Database,
  input: {
    readonly clanId: string;
    readonly userId: string;
    readonly emblemUnlocked: number;
    readonly now: EpochMs;
  },
): Promise<ClanGoal> {
  const { clanId, userId, emblemUnlocked, now } = input;
  const row = await ensureClanWeek(db, clanId, now);
  const week = gameWeekOf(now);
  const [mine] = await db
    .select({ words: clanWeekMembers.words })
    .from(clanWeekMembers)
    .where(
      and(
        eq(clanWeekMembers.clanId, clanId),
        eq(clanWeekMembers.week, week.key),
        eq(clanWeekMembers.userId, userId),
      ),
    );
  const targets = targetsOf(row);
  return {
    week: week.key,
    endsAt: new Date(week.end).toISOString(),
    targets,
    words: row.words,
    tier: highestTier(targets, row.words),
    myWords: mine?.words ?? 0,
    minContribution: goalRulesOf(week).minContribution,
    claimable: await readClaimable(db, userId, now),
    nextUnlock: nextEmblemUnlock(clanRulesAt(CLAN_SCHEDULE, now), emblemUnlocked),
  };
}
