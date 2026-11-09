import type {
  BoosterWalletResponse,
  ChangeMissionRefusal,
  MissionsResponse,
} from "@leximon/contract";
import {
  BONUS_SCHEDULE,
  bonusRulesAt,
  changeMission,
  claimOfDay,
  createSeededRandom,
  type DayActivity,
  drawMissions,
  ECU_SCHEDULE,
  type EpochMs,
  ecuRulesAt,
  favouriteGesture,
  featureLevels,
  gameDayOf,
  JOUST_SCHEDULE,
  joustRulesAt,
  levelOf,
  MASTERY_LEVELS,
  MISSION_SCHEDULE,
  type Mission,
  type MissionContext,
  type MissionKind,
  type MissionRules,
  missionDone,
  missionProgress,
  missionRulesAt,
  PRACTICE_SCHEDULE,
  type ProgressGain,
  practiceRulesAt,
  progressGain,
  reserveCapacity,
  TRADE_SCHEDULE,
  UNLOCK_SCHEDULE,
} from "@leximon/core";
import { type Database, type EcuMovementDetails, schema } from "@leximon/db";
import { and, asc, eq, gte, sql, type WithSubquery } from "drizzle-orm";
import { lockWallet, walletView } from "../levels/rewards";
import { addXp, readXp } from "../progress/progress";

const {
  boosterOpens,
  boosterWallets,
  cards,
  ecuMovements,
  guestLinks,
  jousts,
  players,
  practiceAnswers,
  reviewLogs,
  riddlePlays,
  trades,
  userCards,
  userMastery,
  userMissions,
  userProgress,
  users,
} = schema;

interface Day {
  readonly key: string;
  readonly start: EpochMs;
  readonly end: EpochMs;
}

/** Today and the days before it, today first. */
function daysBack(now: EpochMs, count: number): Day[] {
  const days: Day[] = [];
  let day: Day = gameDayOf(now);
  for (let n = 0; n < count; n++) {
    days.push(day);
    day = gameDayOf(day.start - 1);
  }
  return days;
}

type MissionRow = typeof userMissions.$inferSelect;

/**
 * What the player did on each day, as missions count it, in one round trip: every source is read
 * by its index on the player and the time.
 */
async function readActivity(
  db: Pick<Database, "execute">,
  userId: string,
  days: readonly Day[],
): Promise<Map<string, DayActivity>> {
  if (days.length === 0) return new Map();
  const values = sql.join(
    days.map(
      (day) =>
        sql`(${day.key}::date, ${new Date(day.start)}::timestamptz, ${new Date(day.end)}::timestamptz)`,
    ),
    sql`, `,
  );
  const result = await db.execute<{
    day: string;
    sachets: number;
    good: number;
    written: number;
    collections: (string | null)[];
    riddle: boolean;
    trades: number;
    recycles: number;
    jousts: number;
  }>(sql`
    select d.day::text as day,
      (select count(*)::int from ${boosterOpens} where ${boosterOpens.userId} = ${userId}
        and ${boosterOpens.openedAt} >= d.starts and ${boosterOpens.openedAt} < d.ends) as sachets,
      answers.good, answers.written, answers.collections,
      exists (select 1 from ${riddlePlays} where ${riddlePlays.userId} = ${userId}
        and ${riddlePlays.day} = d.day and ${riddlePlays.outcome} = 'found') as riddle,
      (select count(*)::int from ${trades} where ${trades.status} = 'completed'
        and (${trades.proposerId} = ${userId} or ${trades.recipientId} = ${userId})
        and ${trades.resolvedAt} >= d.starts and ${trades.resolvedAt} < d.ends) as trades,
      (select count(*)::int from ${ecuMovements} where ${ecuMovements.userId} = ${userId}
        and ${ecuMovements.kind} = 'recycle'
        and ${ecuMovements.createdAt} >= d.starts and ${ecuMovements.createdAt} < d.ends) as recycles,
      (select count(*)::int from ${jousts}
        where (${jousts.challengerId} = ${userId}
            and ${jousts.challengerDoneAt} >= d.starts and ${jousts.challengerDoneAt} < d.ends)
          or (${jousts.opponentId} = ${userId} and ${jousts.opponentStartedAt} is not null
            and ${jousts.opponentDoneAt} >= d.starts and ${jousts.opponentDoneAt} < d.ends))
        as jousts
    from (values ${values}) as d(day, starts, ends)
    cross join lateral (
      select (count(*) filter (where a.correct))::int as good,
        (count(*) filter (where a.correct and a.format = 'typed'))::int as written,
        coalesce(json_agg(a.collection_id) filter (where a.correct), '[]'::json) as collections
      from (
        select ${reviewLogs.correct} as correct, ${reviewLogs.format}::text as format,
          ${cards.collectionId} as collection_id
        from ${reviewLogs} join ${cards} on ${cards.id} = ${reviewLogs.cardId}
        where ${reviewLogs.userId} = ${userId}
          and ${reviewLogs.reviewedAt} >= d.starts and ${reviewLogs.reviewedAt} < d.ends
        union all
        select ${practiceAnswers.correct}, ${practiceAnswers.format}::text, ${cards.collectionId}
        from ${practiceAnswers} left join ${cards} on ${cards.id} = ${practiceAnswers.cardId}
        where ${practiceAnswers.userId} = ${userId}
          and ${practiceAnswers.answeredAt} >= d.starts and ${practiceAnswers.answeredAt} < d.ends
      ) a
    ) answers
  `);
  return new Map(
    result.rows.map((row) => {
      const byCollection: Record<string, number> = {};
      for (const id of row.collections) {
        if (id !== null) byCollection[id] = (byCollection[id] ?? 0) + 1;
      }
      return [
        row.day,
        {
          sachets: row.sachets,
          goodAnswers: row.good,
          wordsWritten: row.written,
          goodAnswersByCollection: byCollection,
          riddleFound: row.riddle,
          trades: row.trades,
          recycles: row.recycles,
          jousts: row.jousts,
        },
      ];
    }),
  );
}

const IDLE: DayActivity = {
  sachets: 0,
  goodAnswers: 0,
  wordsWritten: 0,
  goodAnswersByCollection: {},
  riddleFound: false,
  trades: 0,
  recycles: 0,
  jousts: 0,
};

/** What the player can do today and does most, for a draw: one round trip. */
async function readDrawContext(
  db: Pick<Database, "execute">,
  userId: string,
  rules: MissionRules,
  today: Day,
  now: EpochMs,
): Promise<MissionContext> {
  const ecuRules = ecuRulesAt(ECU_SCHEDULE, now);
  const minWords = practiceRulesAt(PRACTICE_SCHEDULE, now).minWords;
  const yesterday = gameDayOf(today.start - 1).key;
  const since = new Date(today.start - rules.favouriteWindowDays * 86_400_000);
  const sinceDay = gameDayOf(since.getTime()).key;
  const recycled = sql.join(
    ecuRules.recycledTogether.map((rarity) => sql`${rarity}`),
    sql`, `,
  );
  const joustRules = joustRulesAt(JOUST_SCHEDULE, now);
  const deckLevels = sql.join(
    MASTERY_LEVELS.slice(MASTERY_LEVELS.indexOf(joustRules.minimumMastery)).map(
      (level) => sql`${level}`,
    ),
    sql`, `,
  );
  const result = await db.execute<{
    xp: number;
    guest: boolean;
    owned: number;
    reviewed: number;
    recyclable: boolean;
    riddle_over: boolean;
    collections: string[];
    yesterday: Mission[] | null;
    sachet_days: number;
    challenge_days: number;
    riddle_days: number;
    trade_days: number;
    recycle_days: number;
    pseudo: boolean;
    joust_access: boolean;
    deck_cards: number;
    joust_days: number;
  }>(sql`
    select
      coalesce((select ${userProgress.xp} from ${userProgress}
        where ${userProgress.userId} = ${userId}), 0) as xp,
      coalesce((select ${users.isAnonymous} from ${users} where ${users.id} = ${userId}), true)
        as guest,
      (select count(*)::int from ${userCards}
        where ${userCards.userId} = ${userId} and ${userCards.quantity} > 0) as owned,
      (select count(*)::int from ${userMastery}
        where ${userMastery.userId} = ${userId} and ${userMastery.lastReviewedAt} is not null)
        as reviewed,
      exists (select 1 from ${userCards} join ${cards} on ${cards.id} = ${userCards.cardId}
        where ${userCards.userId} = ${userId} and ${userCards.quantity} > ${ecuRules.copiesKept}
          and ${cards.rarity}::text in (${recycled})) as recyclable,
      exists (select 1 from ${riddlePlays} where ${riddlePlays.userId} = ${userId}
        and ${riddlePlays.day} = ${today.key} and ${riddlePlays.outcome} is not null) as riddle_over,
      coalesce((select json_agg(owned.collection_id order by owned.collection_id) from (
        select ${cards.collectionId} as collection_id
        from ${userCards} join ${cards} on ${cards.id} = ${userCards.cardId}
        where ${userCards.userId} = ${userId} and ${userCards.quantity} > 0
        group by ${cards.collectionId} having count(*) >= ${minWords}
      ) owned), '[]'::json) as collections,
      (select ${userMissions.missions} from ${userMissions}
        where ${userMissions.userId} = ${userId} and ${userMissions.day} = ${yesterday}) as yesterday,
      (select count(distinct (${boosterOpens.openedAt} at time zone 'Europe/Paris')::date)::int
        from ${boosterOpens} where ${boosterOpens.userId} = ${userId}
          and ${boosterOpens.openedAt} >= ${since}) as sachet_days,
      (select count(distinct played.day)::int from (
        select (${reviewLogs.reviewedAt} at time zone 'Europe/Paris')::date as day from ${reviewLogs}
        where ${reviewLogs.userId} = ${userId} and ${reviewLogs.reviewedAt} >= ${since}
        union
        select (${practiceAnswers.answeredAt} at time zone 'Europe/Paris')::date
        from ${practiceAnswers}
        where ${practiceAnswers.userId} = ${userId} and ${practiceAnswers.answeredAt} >= ${since}
      ) played) as challenge_days,
      (select count(*)::int from ${riddlePlays} where ${riddlePlays.userId} = ${userId}
        and ${riddlePlays.day} >= ${sinceDay}) as riddle_days,
      (select count(distinct (${trades.resolvedAt} at time zone 'Europe/Paris')::date)::int
        from ${trades} where ${trades.status} = 'completed'
          and (${trades.proposerId} = ${userId} or ${trades.recipientId} = ${userId})
          and ${trades.resolvedAt} >= ${since}) as trade_days,
      (select count(distinct (${ecuMovements.createdAt} at time zone 'Europe/Paris')::date)::int
        from ${ecuMovements} where ${ecuMovements.userId} = ${userId}
          and ${ecuMovements.kind} = 'recycle' and ${ecuMovements.createdAt} >= ${since})
        as recycle_days,
      exists (select 1 from ${players} where ${players.userId} = ${userId}
        and ${players.pseudo} is not null) as pseudo,
      coalesce((select ${players.joustAccess} from ${players}
        where ${players.userId} = ${userId}), false) as joust_access,
      (select count(*)::int from ${userCards}
        join ${cards} on ${cards.id} = ${userCards.cardId} and ${cards.definition} is not null
        join ${userMastery} on ${userMastery.userId} = ${userCards.userId}
          and ${userMastery.cardId} = ${userCards.cardId}
        where ${userCards.userId} = ${userId} and ${userCards.quantity} > 0
          and ${userMastery.level}::text in (${deckLevels})) as deck_cards,
      (select count(distinct (played.at at time zone 'Europe/Paris')::date)::int from (
        select ${jousts.challengerDoneAt} as at from ${jousts}
        where ${jousts.challengerId} = ${userId} and ${jousts.challengerDoneAt} >= ${since}
        union all
        select ${jousts.opponentDoneAt} from ${jousts}
        where ${jousts.opponentId} = ${userId} and ${jousts.opponentStartedAt} is not null
          and ${jousts.opponentDoneAt} >= ${since}
      ) played) as joust_days
  `);
  const row = result.rows[0];
  if (row === undefined) throw new Error("Mission context query returned no row");
  const level = levelOf(row.xp).level;
  const levels = featureLevels(UNLOCK_SCHEDULE, TRADE_SCHEDULE, now);
  const feasible = new Set<MissionKind>(["open_sachets"]);
  if (row.owned > 0) feasible.add("good_answers");
  if (row.reviewed >= rules.targets.write_words) feasible.add("write_words");
  if (row.collections.length > 0) feasible.add("review_collection");
  if (!row.riddle_over) feasible.add("riddle");
  if (!row.guest && level >= levels.trade) feasible.add("trade");
  if (row.recyclable) feasible.add("recycle");
  // The deck may stay short of the draw when its points run out: the mission can be changed.
  const jouster = !row.guest && row.pseudo && (joustRules.openToAll || row.joust_access);
  if (jouster && level >= levels.jousts && row.deck_cards >= joustRules.drawn) {
    feasible.add("joust");
  }
  return {
    feasible,
    collections: row.collections,
    favourite: favouriteGesture({
      sachets: row.sachet_days,
      challenges: row.challenge_days,
      riddle: row.riddle_days,
      trades: row.trade_days,
      recycle: row.recycle_days,
      jousts: row.joust_days,
    }),
    yesterday: (row.yesterday ?? []).map((mission) => mission.kind),
  };
}

function missionRows(db: Pick<Database, "select">, userId: string, since: string) {
  return db
    .select()
    .from(userMissions)
    .where(and(eq(userMissions.userId, userId), gte(userMissions.day, since)))
    .orderBy(asc(userMissions.day));
}

/** Days whose missions may still give something: a mission not claimed, or the bonus. */
function open(row: MissionRow): boolean {
  return row.claimed.length < row.missions.length || !row.bonusClaimed;
}

/**
 * The missions of the player's day, drawn by the first request of the day once the level opens
 * them: the primary key keeps the first draw when two requests race. Also counts what earlier days
 * still give, to be claimed with today's.
 */
export async function readMissions(
  db: Database,
  userId: string,
  input: { readonly now: EpochMs; readonly seed: string },
): Promise<MissionsResponse> {
  const { now } = input;
  const rules = missionRulesAt(MISSION_SCHEDULE, now);
  const days = daysBack(now, rules.claimableDays);
  const today = days[0] ?? gameDayOf(now);
  const oldest = days[days.length - 1] ?? today;
  const base = {
    opensAtLevel: rules.opensAtLevel,
    rewards: { xp: rules.xp, ecus: rules.ecus, allDoneBoosters: rules.allDoneBoosters },
  };
  const locked: MissionsResponse = {
    ...base,
    day: null,
    missions: [],
    canChange: false,
    bonusClaimed: false,
    claimable: { missions: 0, bonus: 0 },
  };
  if (levelOf(await readXp(db, userId)).level < rules.opensAtLevel) return locked;

  let rows = await missionRows(db, userId, oldest.key);
  if (!rows.some((row) => row.day === today.key)) {
    const context = await readDrawContext(db, userId, rules, today, now);
    const missions = drawMissions(rules, context, createSeededRandom(input.seed));
    await db
      .insert(userMissions)
      .values({ userId, day: today.key, missions, drawnAt: new Date(now) })
      .onConflictDoNothing();
    rows = await missionRows(db, userId, oldest.key);
  }
  const todayRow = rows.find((row) => row.day === today.key);
  if (todayRow === undefined) return locked;

  const pending = rows.filter((row) => row.day === today.key || open(row));
  const activity = await readActivity(
    db,
    userId,
    days.filter((day) => pending.some((row) => row.day === day.key)),
  );
  const claims = pending.map((row) => claimOfDay(rules, toDay(row), activity.get(row.day) ?? IDLE));
  const todayActivity = activity.get(today.key) ?? IDLE;
  return {
    ...base,
    day: today.key,
    missions: todayRow.missions.map((mission, slot) => ({
      ...mission,
      progress: missionProgress(mission, todayActivity),
      claimed: todayRow.claimed.includes(slot),
    })),
    canChange:
      todayRow.changeKey === null &&
      rules.changesPerDay > 0 &&
      todayRow.missions.some((mission) => !missionDone(mission, todayActivity)),
    bonusClaimed: todayRow.bonusClaimed,
    claimable: {
      missions: claims.reduce((sum, claim) => sum + claim.slots.length, 0),
      bonus: claims.filter((claim) => claim.bonus).length * rules.allDoneBoosters,
    },
  };
}

function toDay(row: MissionRow) {
  return {
    day: row.day,
    missions: row.missions,
    claimed: row.claimed,
    bonusClaimed: row.bonusClaimed,
  };
}

export type ChangeMissionResult =
  | { readonly kind: "changed" }
  | { readonly kind: "refused"; readonly reason: ChangeMissionRefusal }
  | { readonly kind: "invalid_slot" };

/**
 * Changes one mission of the day for another kind, once a day. The row of the day is locked
 * (`SELECT … FOR UPDATE`): a claim, which locks the wallet then the same row, never waits on it
 * in a cycle. The key makes a retry return what the first change did.
 */
export async function changeDailyMission(
  db: Database,
  input: {
    readonly userId: string;
    readonly slot: number;
    readonly idempotencyKey: string;
    readonly now: EpochMs;
    readonly seed: string;
  },
): Promise<ChangeMissionResult> {
  const { userId, slot, now } = input;
  const rules = missionRulesAt(MISSION_SCHEDULE, now);
  const today = gameDayOf(now);
  return db.transaction(async (tx): Promise<ChangeMissionResult> => {
    const [row] = await tx
      .select()
      .from(userMissions)
      .where(and(eq(userMissions.userId, userId), eq(userMissions.day, today.key)))
      .for("update");
    if (row === undefined) return { kind: "refused", reason: "no_missions" };
    if (row.changeKey === input.idempotencyKey) return { kind: "changed" };
    if (row.changeKey !== null || rules.changesPerDay === 0) {
      return { kind: "refused", reason: "already_changed" };
    }
    const mission = row.missions[slot];
    if (mission === undefined) return { kind: "invalid_slot" };
    const activity = (await readActivity(tx, userId, [today])).get(today.key) ?? IDLE;
    if (row.claimed.includes(slot) || missionDone(mission, activity)) {
      return { kind: "refused", reason: "mission_done" };
    }
    const context = await readDrawContext(tx, userId, rules, today, now);
    const next = changeMission(rules, context, row.missions, slot, createSeededRandom(input.seed));
    if (next === null) return { kind: "refused", reason: "no_other" };
    await tx
      .update(userMissions)
      .set({
        missions: row.missions.map((current, index) => (index === slot ? next : current)),
        changeKey: input.idempotencyKey,
      })
      .where(and(eq(userMissions.userId, userId), eq(userMissions.day, today.key)));
    return { kind: "changed" };
  });
}

export type ClaimMissionsResult =
  | {
      readonly kind: "claimed";
      readonly missions: number;
      readonly ecus: number;
      readonly boosters: number;
      readonly bonusWaiting: boolean;
      readonly wallet: BoosterWalletResponse;
      readonly progress: ProgressGain;
    }
  | { readonly kind: "guest_archived" };

/**
 * Claims every mission done and not claimed, today and the days before, and the bonus sachet of
 * each day whose missions are all claimed. A bonus that does not fit in the reserve waits, to be
 * claimed later: nothing is wasted.
 *
 * One transaction, lock order the wallet first, then the player's mission rows: BEGIN, lock the
 * wallet, the replay and account lookup, lock the rows, read the activity of their days, write
 * the rows, one combined write of the XP, the écus and the reserve, COMMIT. A retry with the same
 * key returns what the first claim gave.
 */
export async function claimMissions(
  db: Database,
  input: { readonly userId: string; readonly idempotencyKey: string; readonly now: EpochMs },
): Promise<ClaimMissionsResult> {
  const { userId, now } = input;
  const rules = missionRulesAt(MISSION_SCHEDULE, now);
  const days = daysBack(now, rules.claimableDays);
  const oldest = days[days.length - 1] ?? gameDayOf(now);

  return db.transaction(async (tx): Promise<ClaimMissionsResult> => {
    const locked = await lockWallet(tx, userId, now);
    const [state] = await tx
      .select({
        xp: sql<number>`coalesce((select ${userProgress.xp} from ${userProgress}
          where ${userProgress.userId} = ${userId}), 0)`,
        archived: sql<boolean>`exists (select 1 from ${guestLinks}
          where ${guestLinks.guestId} = ${userId})`,
        previous: sql<{ amount: number; details: EcuMovementDetails } | null>`(
          select json_build_object('amount', ${ecuMovements.amount}, 'details', ${ecuMovements.details})
          from ${ecuMovements} where ${ecuMovements.userId} = ${userId}
            and ${ecuMovements.idempotencyKey} = ${input.idempotencyKey})`,
      })
      .from(sql`(select 1) as one`);
    if (state === undefined) throw new Error("Mission claim lookup returned no row");
    const unchanged = {
      kind: "claimed" as const,
      missions: 0,
      ecus: 0,
      boosters: 0,
      bonusWaiting: false,
      wallet: walletView(locked, now),
      progress: progressGain(state.xp, 0),
    };
    if (state.previous !== null) {
      const { details, amount } = state.previous;
      return {
        ...unchanged,
        missions: details.kind === "mission" ? details.missions.length : 0,
        ecus: amount,
      };
    }
    if (state.archived) return { kind: "guest_archived" };

    const rows = (await missionRows(tx, userId, oldest.key).for("update")).filter(open);
    const activity = await readActivity(
      tx,
      userId,
      days.filter((day) => rows.some((row) => row.day === day.key)),
    );
    const capacity = reserveCapacity(bonusRulesAt(BONUS_SCHEDULE, now), locked.reserveSlots);
    let reserve = locked.bonusBoosters;
    let bonusWaiting = false;
    const updates: { day: string; claimed: number[]; bonus: boolean }[] = [];
    const claimed: { day: string; slot: number }[] = [];
    let xpGained = 0;
    let ecus = 0;
    for (const row of rows) {
      // A mission pays what its own day promised, even claimed after the rules changed.
      const start = days.find((day) => day.key === row.day)?.start ?? now;
      const paid = missionRulesAt(MISSION_SCHEDULE, start);
      const claim = claimOfDay(rules, toDay(row), activity.get(row.day) ?? IDLE);
      let bonus = false;
      if (claim.bonus) {
        if (reserve + rules.allDoneBoosters <= capacity) {
          reserve += rules.allDoneBoosters;
          bonus = true;
        } else {
          bonusWaiting = true;
        }
      }
      if (claim.slots.length === 0 && !bonus) continue;
      updates.push({ day: row.day, claimed: [...row.claimed, ...claim.slots], bonus });
      for (const slot of claim.slots) claimed.push({ day: row.day, slot });
      xpGained += claim.slots.length * paid.xp;
      ecus += claim.slots.length * paid.ecus;
    }
    if (updates.length === 0) return { ...unchanged, bonusWaiting };

    await tx.execute(sql`
      update ${userMissions} set
        claimed = changes.claimed,
        bonus_claimed = ${userMissions.bonusClaimed} or changes.bonus
      from (values ${sql.join(
        updates.map(
          (update) =>
            sql`(${update.day}::date, ${JSON.stringify(update.claimed)}::jsonb, ${update.bonus}::boolean)`,
        ),
        sql`, `,
      )}) as changes(day, claimed, bonus)
      where ${userMissions.userId} = ${userId} and ${userMissions.day} = changes.day
    `);

    const boosters = reserve - locked.bonusBoosters;
    const progressUpsert = addXp(tx, "progress_upsert", userId, xpGained);
    const walletUpdate = tx.$with("wallet_update").as(
      tx
        .update(boosterWallets)
        .set({ ecus: sql`${boosterWallets.ecus} + ${ecus}`, bonusBoosters: reserve })
        .where(eq(boosterWallets.userId, userId))
        .returning({ userId: boosterWallets.userId }),
    );
    const ctes: WithSubquery[] = [progressUpsert, walletUpdate];
    if (ecus > 0) {
      const details: EcuMovementDetails = { kind: "mission", missions: claimed };
      ctes.push(
        tx.$with("movement_insert").as(
          tx
            .insert(ecuMovements)
            .values({
              id: crypto.randomUUID(),
              userId,
              kind: "mission",
              amount: ecus,
              idempotencyKey: input.idempotencyKey,
              details,
              createdAt: new Date(now),
            })
            .returning({ userId: ecuMovements.userId }),
        ),
      );
    }
    const [progress] = await tx
      .with(...ctes)
      .select({ xp: progressUpsert.xp })
      .from(progressUpsert);
    if (progress === undefined) throw new Error(`XP missing for user ${userId} after missions`);
    return {
      kind: "claimed",
      missions: claimed.length,
      ecus,
      boosters,
      bonusWaiting,
      wallet: walletView({ ...locked, ecus: locked.ecus + ecus, bonusBoosters: reserve }, now),
      progress: progressGain(progress.xp, xpGained),
    };
  });
}
