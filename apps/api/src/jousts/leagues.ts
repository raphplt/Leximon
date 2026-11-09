import type {
  Board,
  BoardEntry,
  BoardResponse,
  BoosterWalletResponse,
  GroupPlace,
  JoustStanding,
  LeagueClaimRefusal,
  LeagueResponse,
  LevelRewardView,
  PlayerBadge,
  ProfileJousts,
} from "@leximon/contract";
import {
  type EpochMs,
  type GroupLine,
  type GroupMember,
  type GroupSeed,
  gameDayOf,
  gameTimeOn,
  groupStandings,
  joustPoints,
  LEAGUE_SCHEDULE,
  LEAGUES,
  type League,
  type LeagueRules,
  leagueAfter,
  leagueAt,
  leagueRank,
  leagueRulesAt,
  rankedLeft,
  rewardEcus,
  weekAt,
  weekOf,
  weekRewards,
} from "@leximon/core";
import { type Database, type EcuMovementDetails, schema } from "@leximon/db";
import { eq, sql, type WithSubquery } from "drizzle-orm";
import { lockWallet, walletView, withRewards } from "../levels/rewards";
import { readBadges } from "../profile/profile";

const { boosterWallets, ecuMovements, joustGroupMembers, joustGroups, joustWeekRewards } = schema;

type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
type Reader = Pick<Database, "select" | "execute">;

/** Ranked jousts played before the rating shows in the player's figures. */
const RATING_SHOWN_AFTER = 5;
/** The board of every league opens with this many jousters of 5 ranked jousts in 30 days. */
const GENERAL_JOUSTERS = 50;
const GENERAL_JOUSTS = 5;
const GENERAL_WINDOW_MS = 30 * 86_400_000;
const BOARD_PAGE = 50;

function rulesAt(now: EpochMs): LeagueRules {
  return leagueRulesAt(LEAGUE_SCHEDULE, now);
}

export function weekNow(rules: LeagueRules, now: EpochMs): number {
  return weekOf(rules, gameDayOf(now).key).index;
}

/** The last instant of a week: where a week over is read. */
function weekEnd(rules: LeagueRules, week: number): EpochMs {
  return gameTimeOn(weekAt(rules, week + 1).firstDay, 0) - 1;
}

function asLeague(value: string): League {
  return (LEAGUES as readonly string[]).includes(value) ? (value as League) : "page";
}

/** The rank of a league in SQL, for ordering the boards. */
const leagueRankSql = (column: string) =>
  sql.raw(`array_position(array[${LEAGUES.map((league) => `'${league}'`).join(", ")}], ${column})`);

const BOT_NAMES_SEED = 4;

/** Picks an automaton's name: the same in a group all week, different from group to group. */
function botName(seed: string, index: number): number {
  return Number.parseInt(seed.slice(0, BOT_NAMES_SEED), 16) + index;
}

// --- Groups and memberships ----------------------------------------------------------------------

type MemberRow = {
  readonly week: number;
  readonly groupId: string;
  readonly league: string;
  readonly points: number;
  readonly wins: number;
  readonly losses: number;
  readonly draws: number;
};

async function readMemberships(db: Reader, userId: string): Promise<MemberRow[]> {
  return db
    .select({
      week: joustGroupMembers.week,
      groupId: joustGroupMembers.groupId,
      league: joustGroupMembers.league,
      points: joustGroupMembers.points,
      wins: joustGroupMembers.wins,
      losses: joustGroupMembers.losses,
      draws: joustGroupMembers.draws,
    })
    .from(joustGroupMembers)
    .where(eq(joustGroupMembers.userId, userId))
    .orderBy(joustGroupMembers.week);
}

interface Group {
  readonly id: string;
  readonly seed: GroupSeed;
  readonly members: readonly GroupMember[];
}

async function readGroup(db: Reader, groupId: string): Promise<Group | null> {
  const result = await db.execute<{
    week: number;
    league: string;
    seed: string;
    user_id: string | null;
    points: number | null;
    scored_at: Date | string | null;
  }>(sql`
    select g.week, g.league, g.seed, m.user_id, m.points, m.scored_at
    from joust_groups g left join joust_group_members m on m.group_id = g.id
    where g.id = ${groupId}`);
  const first = result.rows[0];
  if (first === undefined) return null;
  return {
    id: groupId,
    seed: { week: first.week, league: asLeague(first.league), seed: first.seed },
    members: result.rows.flatMap((row) =>
      row.user_id === null
        ? []
        : [
            {
              userId: row.user_id,
              points: row.points ?? 0,
              scoredAt: new Date(row.scored_at ?? 0).getTime(),
            },
          ],
    ),
  };
}

/** The group as it stands now, or as it ended for a week over. */
function linesOf(rules: LeagueRules, group: Group, now: EpochMs): GroupLine[] {
  return groupStandings(
    rules,
    group.seed,
    group.members,
    Math.min(now, weekEnd(rules, group.seed.week)),
  );
}

function placeOf(rules: LeagueRules, lines: readonly GroupLine[], userId: string): GroupPlace {
  const line = lines.find((each) => each.kind === "player" && each.userId === userId);
  if (line === undefined) throw new Error(`Member missing from their group: ${userId}`);
  return { place: line.place, points: line.points, size: rules.groupSize, move: line.move };
}

/**
 * The league of a week the player has not entered yet: where their last week played sent them,
 * Page before any. The weeks over never change, so this reads without a lock.
 */
async function leagueFrom(
  db: Reader,
  rules: LeagueRules,
  userId: string,
  rows: readonly MemberRow[],
  week: number,
): Promise<League> {
  const current = rows.find((row) => row.week === week);
  if (current !== undefined) return asLeague(current.league);
  const last = rows.findLast((row) => row.week < week);
  if (last === undefined) return "page";
  const group = await readGroup(db, last.groupId);
  if (group === null) return asLeague(last.league);
  const ended = placeOf(rules, linesOf(rules, group, weekEnd(rules, last.week)), userId);
  return leagueAfter(asLeague(last.league), ended.move);
}

async function rankedToday(db: Reader, userId: string, now: EpochMs): Promise<number> {
  const day = gameDayOf(now);
  const [start, end] = [new Date(day.start), new Date(day.end)];
  const result = await db.execute<{ count: number }>(sql`
    select
      (select count(*) from jousts where challenger_id = ${userId} and kind = 'ranked'
        and created_at >= ${start} and created_at < ${end})
      + (select count(*) from jousts where opponent_id = ${userId} and kind = 'ranked'
        and created_at >= ${start} and created_at < ${end}) as count`);
  return Number(result.rows[0]?.count ?? 0);
}

/** Ranked jousts the player may still launch or receive today. */
export async function readRankedLeft(db: Reader, userId: string, now: EpochMs): Promise<number> {
  return rankedLeft(rulesAt(now), await rankedToday(db, userId, now));
}

async function readClaimedWeeks(db: Reader, userId: string): Promise<Set<number>> {
  const rows = await db
    .select({ week: joustWeekRewards.week })
    .from(joustWeekRewards)
    .where(eq(joustWeekRewards.userId, userId));
  return new Set(rows.map((row) => row.week));
}

function waitingWeeks(rows: readonly MemberRow[], claimed: ReadonlySet<number>, week: number) {
  return rows.filter((row) => row.week < week && !claimed.has(row.week));
}

/** A player's league and place this week, as the other player meets them face to face. */
export async function readDuelist(
  db: Reader,
  userId: string,
  now: EpochMs,
): Promise<{ readonly league: League; readonly group: GroupPlace | null }> {
  const rules = rulesAt(now);
  const week = weekNow(rules, now);
  const rows = await readMemberships(db, userId);
  const current = rows.find((row) => row.week === week);
  const group = current === undefined ? null : await readGroup(db, current.groupId);
  return {
    league: await leagueFrom(db, rules, userId, rows, week),
    group: group === null ? null : placeOf(rules, linesOf(rules, group, now), userId),
  };
}

/** League and place in this week's tournament, for the jousts' home. */
export async function readStanding(
  db: Reader,
  userId: string,
  now: EpochMs,
): Promise<JoustStanding> {
  const rules = rulesAt(now);
  const week = weekNow(rules, now);
  const [rows, claimed, today] = await Promise.all([
    readMemberships(db, userId),
    readClaimedWeeks(db, userId),
    rankedToday(db, userId, now),
  ]);
  return standingOf(db, rules, { userId, rows, claimed, today, week, now });
}

async function standingOf(
  db: Reader,
  rules: LeagueRules,
  input: {
    readonly userId: string;
    readonly rows: readonly MemberRow[];
    readonly claimed: ReadonlySet<number>;
    readonly today: number;
    readonly week: number;
    readonly now: EpochMs;
  },
): Promise<JoustStanding> {
  const { userId, rows, claimed, today, week, now } = input;
  const current = rows.find((row) => row.week === week);
  const group = current === undefined ? null : await readGroup(db, current.groupId);
  return {
    week: weekAt(rules, week),
    league: await leagueFrom(db, rules, userId, rows, week),
    group: group === null ? null : placeOf(rules, linesOf(rules, group, now), userId),
    rankedLeft: rankedLeft(rules, today),
    rankedPerDay: rules.rankedPerDay,
    rewardsWaiting: waitingWeeks(rows, claimed, week).length,
  };
}

/**
 * The jousts on a profile (`null` before the first ranked joust: league, this week's place, ranked
 * jousts played) and the highest league ever reached, which gives banner motifs.
 */
export async function readJoustRecord(
  db: Reader,
  userId: string,
  now: EpochMs,
): Promise<{ readonly jousts: ProfileJousts | null; readonly bestLeague: League | null }> {
  const rules = rulesAt(now);
  const week = weekNow(rules, now);
  const [rating, rows] = await Promise.all([
    db.execute<{ games: number }>(sql`select games from joust_ratings where user_id = ${userId}`),
    readMemberships(db, userId),
  ]);
  if (rows.length === 0) return { jousts: null, bestLeague: null };
  const current = rows.find((row) => row.week === week);
  const [league, group] = await Promise.all([
    leagueFrom(db, rules, userId, rows, week),
    current === undefined ? null : readGroup(db, current.groupId),
  ]);
  // The league a week just over sent the player to counts, before they play in it.
  const best = Math.max(leagueRank(league), ...rows.map((row) => leagueRank(asLeague(row.league))));
  const ranked = rating.rows[0]?.games ?? 0;
  const place = group === null ? null : placeOf(rules, linesOf(rules, group, now), userId);
  return {
    jousts:
      ranked === 0
        ? null
        : {
            league,
            ranked,
            week:
              place === null
                ? null
                : { place: place.place, size: place.size, points: place.points },
          },
    bestLeague: leagueAt(best),
  };
}

// --- A ranked joust's points ---------------------------------------------------------------------

export interface PointsWon {
  readonly challenger: number;
  readonly opponent: number;
}

/** Locks the entry of a league's groups for a week: two players never take the same last place. */
async function lockEntry(tx: Transaction, week: number, league: League): Promise<void> {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`joust_group:${week}:${league}`}))`);
}

/** Puts the player in a group of their league with room, or a new one. */
async function enterGroup(
  tx: Transaction,
  rules: LeagueRules,
  input: { readonly userId: string; readonly week: number; readonly league: League },
  now: EpochMs,
): Promise<void> {
  const { userId, week, league } = input;
  const [open] = await tx
    .select({ id: joustGroups.id })
    .from(joustGroups)
    .where(
      sql`${joustGroups.week} = ${week} and ${joustGroups.league} = ${league}
        and ${joustGroups.players} < ${rules.groupSize}`,
    )
    .orderBy(joustGroups.createdAt, joustGroups.id)
    .limit(1);
  let groupId = open?.id;
  if (groupId === undefined) {
    const seed = Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString("hex");
    const [made] = await tx
      .insert(joustGroups)
      .values({ week, league, seed, createdAt: new Date(now) })
      .returning({ id: joustGroups.id });
    if (made === undefined) throw new Error("Group insert returned no row");
    groupId = made.id;
  }
  await tx
    .update(joustGroups)
    .set({ players: sql`${joustGroups.players} + 1` })
    .where(eq(joustGroups.id, groupId));
  await tx.insert(joustGroupMembers).values({
    userId,
    week,
    groupId,
    league,
    scoredAt: new Date(now),
    joinedAt: new Date(now),
  });
}

/**
 * Writes the points of a ranked joust that just ended, inside its transaction, after the
 * ratings. A player not yet in this week's tournament enters a group of their league: the
 * entries of each league are locked in a fixed order, then both members in user id order.
 * Callers hold both players' wallets, so one player's jousts settle one at a time.
 */
export async function applyPoints(
  tx: Transaction,
  input: {
    readonly challengerId: string;
    readonly opponentId: string;
    readonly outcome: "challenger" | "opponent" | "draw";
    readonly now: EpochMs;
  },
): Promise<PointsWon> {
  const { challengerId, opponentId, outcome, now } = input;
  const rules = rulesAt(now);
  const week = weekNow(rules, now);
  const ids = [challengerId, opponentId].sort();

  const entering: { userId: string; league: League }[] = [];
  for (const userId of ids) {
    const rows = await readMemberships(tx, userId);
    if (rows.some((row) => row.week === week)) continue;
    entering.push({ userId, league: await leagueFrom(tx, rules, userId, rows, week) });
  }
  const leagues = [...new Set(entering.map((entry) => entry.league))].sort();
  for (const league of leagues) await lockEntry(tx, week, league);
  for (const entry of entering) await enterGroup(tx, rules, { ...entry, week }, now);

  await tx.execute(sql`select user_id from joust_group_members
    where week = ${week} and user_id in (${challengerId}, ${opponentId})
    order by user_id for update`);
  const resultOf = (userId: string) => {
    if (outcome === "draw") return "draw" as const;
    const winner = outcome === "challenger" ? challengerId : opponentId;
    return userId === winner ? ("won" as const) : ("lost" as const);
  };
  const won = new Map<string, number>();
  for (const userId of ids) {
    const result = resultOf(userId);
    const points = joustPoints(rules, result);
    await tx
      .update(joustGroupMembers)
      .set({
        points: sql`${joustGroupMembers.points} + ${points}`,
        ...(points > 0 ? { scoredAt: new Date(now) } : {}),
        ...(result === "won"
          ? { wins: sql`${joustGroupMembers.wins} + 1` }
          : result === "lost"
            ? { losses: sql`${joustGroupMembers.losses} + 1` }
            : { draws: sql`${joustGroupMembers.draws} + 1` }),
      })
      .where(sql`${joustGroupMembers.userId} = ${userId} and ${joustGroupMembers.week} = ${week}`);
    won.set(userId, points);
  }
  return { challenger: won.get(challengerId) ?? 0, opponent: won.get(opponentId) ?? 0 };
}

/** A ranked joust's points for its result, with where the player stands in that week's group. */
export async function tournamentView(
  db: Reader,
  input: {
    readonly userId: string;
    readonly won: number;
    readonly endedAt: EpochMs;
    readonly now: EpochMs;
  },
) {
  const rules = rulesAt(input.now);
  const week = weekNow(rules, input.endedAt);
  const [row] = await db
    .select({ groupId: joustGroupMembers.groupId, league: joustGroupMembers.league })
    .from(joustGroupMembers)
    .where(
      sql`${joustGroupMembers.userId} = ${input.userId} and ${joustGroupMembers.week} = ${week}`,
    );
  if (row === undefined) return null;
  const current = week === weekNow(rules, input.now);
  const group = current ? await readGroup(db, row.groupId) : null;
  return {
    won: input.won,
    league: asLeague(row.league),
    group: group === null ? null : placeOf(rules, linesOf(rules, group, input.now), input.userId),
  };
}

// --- The league screen ---------------------------------------------------------------------------

async function generalOpen(db: Reader, now: EpochMs): Promise<boolean> {
  // A jouster with 5 ranked jousts who played one in the last 30 days: close enough to 5 in 30
  // days, read without going through the jousts.
  const result = await db.execute<{ count: number }>(sql`
    select count(*)::int as count from (
      select 1 from joust_ratings
      where games >= ${GENERAL_JOUSTS} and last_played_at >= ${new Date(now - GENERAL_WINDOW_MS)}
      limit ${GENERAL_JOUSTERS}) regular`);
  return (result.rows[0]?.count ?? 0) >= GENERAL_JOUSTERS;
}

/** What a week over gave the player: their final place in its group and its rewards. */
async function weekResult(db: Reader, rules: LeagueRules, userId: string, row: MemberRow) {
  const group = await readGroup(db, row.groupId);
  const league = asLeague(row.league);
  const ended =
    group === null
      ? { place: rules.groupSize, points: row.points, size: rules.groupSize, move: "stay" as const }
      : placeOf(rules, linesOf(rules, group, weekEnd(rules, row.week)), userId);
  return {
    week: row.week,
    league,
    place: ended.place,
    move: ended.move,
    rewards: [...weekRewards(rules, league, ended.place, ended.move)],
  };
}

/** `GET /jousts/league`: the ladder, the week rewards to claim, the player's figures. */
export async function readLeague(
  db: Database,
  userId: string,
  now: EpochMs,
): Promise<LeagueResponse> {
  const rules = rulesAt(now);
  const week = weekNow(rules, now);
  const [rows, claimed, today, rating, open] = await Promise.all([
    readMemberships(db, userId),
    readClaimedWeeks(db, userId),
    rankedToday(db, userId, now),
    db.execute<{ rating: number; games: number }>(
      sql`select rating, games from joust_ratings where user_id = ${userId}`,
    ),
    generalOpen(db, now),
  ]);
  const waiting = await Promise.all(
    waitingWeeks(rows, claimed, week).map((row) => weekResult(db, rules, userId, row)),
  );
  const current = rows.find((row) => row.week === week);
  const games = rating.rows[0]?.games ?? 0;
  return {
    standing: await standingOf(db, rules, { userId, rows, claimed, today, week, now }),
    ladder: LEAGUES.map((league) => ({
      league,
      up: rules.moves[league].up,
      down: rules.moves[league].down,
      rewards: [{ kind: "ecus" as const, amount: rules.weekEcus[league] }],
    })),
    upRewards: [...rules.upRewards],
    podium: {
      places: rules.championPodium.places,
      rewards: [...rules.championPodium.rewards],
    },
    points: { ...rules.points },
    waiting,
    stats: {
      ranked: games,
      wins: current?.wins ?? 0,
      losses: current?.losses ?? 0,
      draws: current?.draws ?? 0,
      rating:
        games >= RATING_SHOWN_AFTER && rating.rows[0] !== undefined
          ? Math.round(rating.rows[0].rating)
          : null,
      ratingAfter: RATING_SHOWN_AFTER,
    },
    generalOpen: open,
  };
}

// --- Claiming a reward ---------------------------------------------------------------------------

export type LeagueClaimResult =
  | {
      readonly kind: "claimed";
      readonly week: number;
      readonly rewards: readonly LevelRewardView[];
      readonly wallet: BoosterWalletResponse;
    }
  | { readonly kind: "refused"; readonly reason: LeagueClaimRefusal };

/**
 * Claims the rewards of a week played. Idempotent by nature: the week is the key, a second claim
 * returns what the first one gave. A week gives once it is over; a reward whose sachets do not
 * fit in the reserve waits.
 *
 * One transaction, the wallet locked first as for every reward: BEGIN, lock the wallet, read the
 * week's group (over, so it no longer changes), one combined write (the claim, the reserve and
 * the écus with their movement), COMMIT.
 */
export async function claimLeagueReward(
  db: Database,
  input: { readonly userId: string; readonly week: number; readonly now: EpochMs },
): Promise<LeagueClaimResult> {
  const { userId, week, now } = input;
  const rules = rulesAt(now);

  return db.transaction(async (tx): Promise<LeagueClaimResult> => {
    const locked = await lockWallet(tx, userId, now);
    const [previous] = await tx
      .select({ rewards: joustWeekRewards.rewards })
      .from(joustWeekRewards)
      .where(sql`${joustWeekRewards.userId} = ${userId} and ${joustWeekRewards.week} = ${week}`);
    if (previous !== undefined) {
      return { kind: "claimed", week, rewards: previous.rewards, wallet: walletView(locked, now) };
    }
    if (week >= weekNow(rules, now)) return { kind: "refused", reason: "not_reached" };
    const row = (await readMemberships(tx, userId)).find((each) => each.week === week);
    if (row === undefined) return { kind: "refused", reason: "not_reached" };

    const { rewards } = await weekResult(tx, rules, userId, row);
    const reserved = withRewards(locked, rewards, locked.reserveSlots, now);
    if (reserved === null) return { kind: "refused", reason: "reserve_full" };
    const ecus = rewardEcus(rewards);
    const after = { ...reserved, ecus: reserved.ecus + ecus };

    const claimInsert = tx.$with("claim_insert").as(
      tx
        .insert(joustWeekRewards)
        .values({ userId, week, rewards, claimedAt: new Date(now) })
        .returning({ week: joustWeekRewards.week }),
    );
    const ctes: WithSubquery[] = [claimInsert];
    if (ecus > 0) {
      const details: EcuMovementDetails = { kind: "league", week };
      ctes.push(
        tx.$with("movement_insert").as(
          tx
            .insert(ecuMovements)
            .values({
              id: crypto.randomUUID(),
              userId,
              kind: "league",
              amount: ecus,
              idempotencyKey: crypto.randomUUID(),
              details,
              createdAt: new Date(now),
            })
            .returning({ userId: ecuMovements.userId }),
        ),
      );
    }
    await tx
      .with(...ctes)
      .update(boosterWallets)
      .set(after)
      .where(eq(boosterWallets.userId, userId));
    return { kind: "claimed", week, rewards, wallet: walletView(after, now) };
  });
}

// --- Boards --------------------------------------------------------------------------------------

/** The cursor of a page of the general board: league rank, points and user id of the last row. */
export const BOARD_CURSOR = /^(\d{1,2})\.(\d{1,9})\.([A-Za-z0-9_-]{1,64})$/;

export interface BoardCursor {
  readonly rank: number;
  readonly points: number;
  readonly userId: string;
}

function cursorOf(rank: number, points: number, userId: string): string {
  return `${rank}.${points}.${userId}`;
}

/** Players who block the player or whom the player blocks stay off their boards. */
function notBlocked(column: string, userId: string) {
  return sql`not exists (select 1 from user_blocks
    where (blocker_id = ${userId} and blocked_id = ${sql.raw(column)})
      or (blocker_id = ${sql.raw(column)} and blocked_id = ${userId}))`;
}

async function blockedAmong(
  db: Reader,
  userId: string,
  ids: readonly string[],
): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const list = sql.join(
    ids.map((id) => sql`${id}`),
    sql`, `,
  );
  const result = await db.execute<{ id: string }>(sql`
    select blocked_id as id from user_blocks where blocker_id = ${userId} and blocked_id in (${list})
    union select blocker_id as id from user_blocks where blocked_id = ${userId} and blocker_id in (${list})`);
  return new Set(result.rows.map((row) => row.id));
}

interface Ranked {
  readonly userId: string;
  readonly league: League;
  readonly points: number;
  readonly place: number;
}

function playerEntry(
  ranked: Ranked,
  badges: ReadonlyMap<string, PlayerBadge>,
  move: BoardEntry["move"] = null,
): BoardEntry | null {
  const player = badges.get(ranked.userId);
  if (player === undefined) return null;
  return {
    kind: "player",
    player,
    place: ranked.place,
    points: ranked.points,
    league: ranked.league,
    move,
  };
}

/**
 * `GET /jousts/boards/:board`: a board of this week. The group comes whole, automatons included,
 * a blocked player kept at their place without their name. Friends and clan come whole, by league
 * then points, ties sharing a place; the general board is paged by cursor.
 */
export async function readBoard(
  db: Database,
  input: {
    readonly userId: string;
    readonly board: Board;
    readonly after: BoardCursor | null;
    readonly now: EpochMs;
  },
): Promise<BoardResponse> {
  const { userId, board, after, now } = input;
  const rules = rulesAt(now);
  const week = weekNow(rules, now);
  const rows = await readMemberships(db, userId);
  const mine = rows.find((row) => row.week === week);

  if (board === "group") return readGroupBoard(db, rules, { userId, mine, now });

  const closed = (reason: "no_clan" | "general_closed"): BoardResponse => ({
    board,
    closed: reason,
    league: null,
    moves: null,
    entries: [],
    me: null,
    next: null,
  });

  if (board === "general") {
    if (!(await generalOpen(db, now))) return closed("general_closed");
    const rank = leagueRankSql("m.league");
    const page = await db.execute<{
      user_id: string;
      league: string;
      points: number;
      rank: number;
      place: number;
    }>(sql`
      select * from (
        select m.user_id, m.league, m.points, ${rank} as rank,
          (rank() over (order by ${rank} desc, m.points desc))::int as place
        from joust_group_members m
        where m.week = ${week} and (m.user_id = ${userId} or ${notBlocked("m.user_id", userId)})
      ) ranked
      ${
        after === null
          ? sql``
          : sql`where rank < ${after.rank} or (rank = ${after.rank} and points < ${after.points})
              or (rank = ${after.rank} and points = ${after.points} and user_id > ${after.userId})`
      }
      order by rank desc, points desc, user_id
      limit ${BOARD_PAGE + 1}`);
    const shown = page.rows.slice(0, BOARD_PAGE);
    let me: Ranked | null = null;
    if (mine !== undefined) {
      const myRank = LEAGUES.indexOf(asLeague(mine.league)) + 1;
      const ahead = await db.execute<{ count: number }>(sql`
        select count(*)::int as count from joust_group_members m
        where m.week = ${week} and ${notBlocked("m.user_id", userId)}
          and (${rank} > ${myRank} or (${rank} = ${myRank} and m.points > ${mine.points}))`);
      me = {
        userId,
        league: asLeague(mine.league),
        points: mine.points,
        place: (ahead.rows[0]?.count ?? 0) + 1,
      };
    }
    const badges = await readBadges(db, [userId, ...shown.map((row) => row.user_id)], now);
    const last = shown.at(-1);
    return {
      board,
      closed: null,
      league: null,
      moves: null,
      entries: shown.flatMap((row) => {
        const entry = playerEntry(
          {
            userId: row.user_id,
            league: asLeague(row.league),
            points: row.points,
            place: row.place,
          },
          badges,
        );
        return entry === null ? [] : [entry];
      }),
      me: me === null ? null : playerEntry(me, badges),
      next:
        page.rows.length > BOARD_PAGE && last !== undefined
          ? cursorOf(last.rank, last.points, last.user_id)
          : null,
    };
  }

  const members = await db.execute<{ id: string }>(
    board === "friends"
      ? sql`select friend_id as id from friendships f
          where f.user_id = ${userId} and ${notBlocked("f.friend_id", userId)}`
      : sql`select m2.user_id as id from clan_members m1
          join clan_members m2 on m2.clan_id = m1.clan_id
          where m1.user_id = ${userId} and m2.user_id <> ${userId}
            and ${notBlocked("m2.user_id", userId)}`,
  );
  if (board === "clan" && members.rows.length === 0) {
    const inClan = await db.execute<{ found: boolean }>(
      sql`select exists (select 1 from clan_members where user_id = ${userId}) as found`,
    );
    if (inClan.rows[0]?.found !== true) return closed("no_clan");
  }
  const ids = [userId, ...members.rows.map((row) => row.id)];
  const entered = await db.execute<{ user_id: string; league: string; points: number }>(sql`
    select user_id, league, points from joust_group_members
    where week = ${week} and user_id in (${sql.join(
      ids.map((id) => sql`${id}`),
      sql`, `,
    )})`);
  const standings = entered.rows
    .map((row) => ({ userId: row.user_id, league: asLeague(row.league), points: row.points }))
    .sort(
      (a, b) =>
        LEAGUES.indexOf(b.league) - LEAGUES.indexOf(a.league) ||
        b.points - a.points ||
        a.userId.localeCompare(b.userId),
    );
  const ahead = (one: (typeof standings)[number], other: (typeof standings)[number]) =>
    LEAGUES.indexOf(other.league) > LEAGUES.indexOf(one.league) ||
    (other.league === one.league && other.points > one.points);
  const ranked: Ranked[] = standings.map((standing) => ({
    ...standing,
    place: 1 + standings.filter((other) => ahead(standing, other)).length,
  }));
  const badges = await readBadges(
    db,
    ranked.map((row) => row.userId),
    now,
  );
  const me = ranked.find((row) => row.userId === userId);
  return {
    board,
    closed: null,
    league: null,
    moves: null,
    entries: ranked.flatMap((row) => {
      const entry = playerEntry(row, badges);
      return entry === null ? [] : [entry];
    }),
    me: me === undefined ? null : playerEntry(me, badges),
    next: null,
  };
}

async function readGroupBoard(
  db: Database,
  rules: LeagueRules,
  input: { readonly userId: string; readonly mine: MemberRow | undefined; readonly now: EpochMs },
): Promise<BoardResponse> {
  const { userId, mine, now } = input;
  const group = mine === undefined ? null : await readGroup(db, mine.groupId);
  if (mine === undefined || group === null) {
    return {
      board: "group",
      closed: "not_entered",
      league: null,
      moves: null,
      entries: [],
      me: null,
      next: null,
    };
  }
  const league = group.seed.league;
  const lines = linesOf(rules, group, now);
  const players = group.members.map((member) => member.userId);
  const [badges, blocked] = await Promise.all([
    readBadges(db, players, now),
    blockedAmong(db, userId, players),
  ]);
  const entries = lines.flatMap((line): BoardEntry[] => {
    const common = { place: line.place, points: line.points, league, move: line.move };
    if (line.kind === "bot") {
      return [{ kind: "bot", bot: botName(group.seed.seed, line.index), ...common }];
    }
    const player = badges.get(line.userId);
    if (blocked.has(line.userId) || player === undefined) return [{ kind: "hidden", ...common }];
    return [{ kind: "player", player, ...common }];
  });
  const me = entries.find(
    (entry) => entry.kind === "player" && entry.player.code === badges.get(userId)?.code,
  );
  return {
    board: "group",
    closed: null,
    league,
    moves: { up: rules.moves[league].up, down: rules.moves[league].down },
    entries,
    me: me ?? null,
    next: null,
  };
}
