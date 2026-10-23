import type { BoosterWalletResponse, ClaimableGoal, ClanGoal, GoalTier } from "@leximon/contract";
import {
  BONUS_SCHEDULE,
  bonusRulesAt,
  CLAN_GOAL_SCHEDULE,
  CLAN_LEVEL,
  type ClanGoalRules,
  claimableTiers,
  claimDeadline,
  clanGoalRulesAt,
  clanLevelOf,
  clanUnlocks,
  type EpochMs,
  type GameDay,
  type GoalTargets,
  gameWeekOf,
  goalTargets,
  highestTier,
  reserveCapacity,
  tiersReached,
  weekXp,
} from "@leximon/core";
import { type ClanEventPayload, type Database, schema } from "@leximon/db";
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

function targetsOf(row: Pick<WeekRow, "bronze" | "silver" | "gold" | "illuminated">): GoalTargets {
  return { bronze: row.bronze, silver: row.silver, gold: row.gold, illuminated: row.illuminated };
}

/** The rules of a week are those in force when it starts. */
function goalRulesOf(week: GameDay): ClanGoalRules {
  return clanGoalRulesAt(CLAN_GOAL_SCHEDULE, week.start);
}

/**
 * The clan's current week, created at its first use: the targets are fixed then, from the
 * members who opened a booster or answered a challenge in the 7 days before, and the fourth tier
 * if the clan's level opened it. Concurrent first uses insert once.
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
        sql`(exists (select 1 from booster_opens o where o.user_id = ${clanMembers.userId}
            and o.opened_at >= ${since} and o.opened_at < ${new Date(now)})
          or exists (select 1 from review_logs r where r.user_id = ${clanMembers.userId}
            and r.reviewed_at >= ${since} and r.reviewed_at < ${new Date(now)}))`,
      ),
    );
  const activeMembers = active?.count ?? 0;
  const [clan] = await db.select({ xp: clans.xp }).from(clans).where(eq(clans.id, clanId));
  const level = clanLevelOf(CLAN_LEVEL, clan?.xp ?? 0).level;
  const targets = goalTargets(rules, activeMembers, clanUnlocks(CLAN_LEVEL, level).illuminated);
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
  readonly answers: number;
  readonly newTiers: readonly GoalTier[];
  readonly level: number;
}

/**
 * Recounts a clan's week from the challenge answers: each member's correct answers since they
 * joined, within the week. A member's count never goes down, so a member who leaves keeps what
 * they gave and a tier reached stays reached. Then the week's XP, and the clan's as the sum of its
 * weeks. A newly reached tier or level enters the journal once (unique event key).
 *
 * The current week is created if needed; a past week only recounted if it exists. Lock order: the
 * week's row, then the clan's. With `only`, just those members' shares are counted again (they
 * answered): the others' have not moved, and the totals are summed from every share.
 */
export async function recountClanWeek(
  db: Database,
  clanId: string,
  weekKey: string,
  now: EpochMs,
  only?: readonly string[],
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
      insert into clan_week_members (clan_id, week, user_id, answers, updated_at)
      select m.clan_id, ${week.key}, m.user_id,
        (select count(*)::int from review_logs r
          where r.user_id = m.user_id and r.correct
            and r.reviewed_at >= greatest(${start}::timestamptz, m.joined_at)
            and r.reviewed_at < ${end}),
        ${new Date(now)}
      from clan_members m
      where m.clan_id = ${clanId} and m.joined_at < ${end}
        ${only === undefined ? sql`` : sql`and m.user_id in ${only}`}
      on conflict (clan_id, week, user_id) do update
        set answers = greatest(clan_week_members.answers, excluded.answers),
            updated_at = excluded.updated_at`);
    const members = await tx
      .select({ answers: clanWeekMembers.answers })
      .from(clanWeekMembers)
      .where(and(eq(clanWeekMembers.clanId, clanId), eq(clanWeekMembers.week, week.key)));
    const memberAnswers = members.map((member) => member.answers);
    const answers = memberAnswers.reduce((sum, count) => sum + count, 0);

    const targets = targetsOf(row);
    const reached = tiersReached(targets, answers);
    const before = new Set(tiersReached(targets, row.answers));
    const newTiers = reached.filter((tier) => !before.has(tier));
    for (const tier of newTiers) {
      await writeEvent(
        tx,
        clanId,
        { type: "tier", week: week.key, tier },
        `tier:${week.key}:${tier}`,
        now,
      );
    }
    await tx
      .update(clanWeeks)
      .set({
        answers,
        xp: weekXp(rules, memberAnswers, reached),
        tier: highestTier(targets, answers),
        updatedAt: new Date(now),
      })
      .where(and(eq(clanWeeks.clanId, clanId), eq(clanWeeks.week, week.key)));

    const [clan] = await tx
      .select({ xp: clans.xp })
      .from(clans)
      .where(eq(clans.id, clanId))
      .for("update");
    const [total] = await tx
      .select({ xp: sql<number>`coalesce(sum(${clanWeeks.xp}), 0)::int` })
      .from(clanWeeks)
      .where(eq(clanWeeks.clanId, clanId));
    const xp = total?.xp ?? 0;
    const levelBefore = clanLevelOf(CLAN_LEVEL, clan?.xp ?? 0).level;
    const level = clanLevelOf(CLAN_LEVEL, xp).level;
    for (let reachedLevel = levelBefore + 1; reachedLevel <= level; reachedLevel++) {
      await writeEvent(
        tx,
        clanId,
        { type: "level", level: reachedLevel },
        `level:${reachedLevel}`,
        now,
      );
    }
    await tx.update(clans).set({ xp }).where(eq(clans.id, clanId));
    return { answers, newTiers, level };
  });
}

async function writeEvent(
  tx: Transaction,
  clanId: string,
  event: ClanEventPayload,
  eventKey: string,
  now: EpochMs,
): Promise<void> {
  await tx
    .insert(clanMessages)
    .values({ clanId, kind: "event", event, eventKey, createdAt: new Date(now) })
    .onConflictDoNothing();
}

// --- Rewards -------------------------------------------------------------------------------------

/**
 * Tiers whose boosters the player may claim: this week and the last one, in any clan they gave
 * enough correct answers to, minus what they already claimed. One claim per tier and week, even
 * after changing clans.
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
      mine: clanWeekMembers.answers,
      answers: clanWeeks.answers,
      bronze: clanWeeks.bronze,
      silver: clanWeeks.silver,
      gold: clanWeeks.gold,
      illuminated: clanWeeks.illuminated,
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
    const reached = tiersReached(targetsOf(row), row.answers);
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

/** A clan where the player gave enough correct answers to a week that reached the tier. */
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
      mine: clanWeekMembers.answers,
      answers: clanWeeks.answers,
      bronze: clanWeeks.bronze,
      silver: clanWeeks.silver,
      gold: clanWeeks.gold,
      illuminated: clanWeeks.illuminated,
    })
    .from(clanWeekMembers)
    .innerJoin(
      clanWeeks,
      and(eq(clanWeeks.clanId, clanWeekMembers.clanId), eq(clanWeeks.week, clanWeekMembers.week)),
    )
    .where(and(eq(clanWeekMembers.userId, userId), eq(clanWeekMembers.week, week.key)));
  const eligible = rows.find((row) =>
    claimableTiers(rules, tiersReached(targetsOf(row), row.answers), row.mine).includes(tier),
  );
  return eligible?.clanId ?? null;
}

// --- View ----------------------------------------------------------------------------------------

/** The goal as a member sees it on the clan's page. */
export async function readGoal(
  db: Database,
  input: { readonly clanId: string; readonly userId: string; readonly now: EpochMs },
): Promise<ClanGoal> {
  const { clanId, userId, now } = input;
  const row = await ensureClanWeek(db, clanId, now);
  const week = gameWeekOf(now);
  const rules = goalRulesOf(week);
  const [mine] = await db
    .select({ answers: clanWeekMembers.answers })
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
    answers: row.answers,
    tier: highestTier(targets, row.answers),
    myAnswers: mine?.answers ?? 0,
    minContribution: rules.minContribution,
    boosters: rules.bonusBoosters,
    claimable: await readClaimable(db, userId, now),
  };
}
