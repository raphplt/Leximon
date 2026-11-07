import type {
  Board,
  BoardEntry,
  BoardResponse,
  BoosterWalletResponse,
  DivisionView,
  JoustStanding,
  LeagueClaimRefusal,
  LeagueResponse,
  LevelRewardView,
  PlayerBadge,
} from "@leximon/contract";
import {
  type Division,
  divisionOf,
  divisionRewards,
  divisions,
  type EpochMs,
  freshStanding,
  gameDayOf,
  joustLaurels,
  LEAGUE_SCHEDULE,
  LEAGUES,
  type LeagueRules,
  leagueOf,
  leagueRulesAt,
  leagueStepRewards,
  pendingLeagueRewards,
  rewardEcus,
  rewardedDivisions,
  type SeasonStanding,
  type Standing,
  seasonAt,
  seasonOf,
} from "@leximon/core";
import { type Database, type EcuMovementDetails, schema } from "@leximon/db";
import { eq, sql, type WithSubquery } from "drizzle-orm";
import { lockWallet, walletView, withRewards } from "../levels/rewards";
import { readBadges } from "../profile/profile";

const { boosterWallets, ecuMovements, joustLeagueRewards, joustStandings } = schema;

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

export function seasonNow(rules: LeagueRules, now: EpochMs): number {
  return seasonOf(rules, gameDayOf(now).key).index;
}

type SeasonRow = {
  readonly season: number;
  readonly started: number;
  readonly laurels: number;
  readonly peak: number;
  readonly streak: number;
  readonly wins: number;
  readonly losses: number;
  readonly draws: number;
};

async function readSeasons(db: Reader, userId: string): Promise<SeasonRow[]> {
  return db
    .select({
      season: joustStandings.season,
      started: joustStandings.started,
      laurels: joustStandings.laurels,
      peak: joustStandings.peak,
      streak: joustStandings.streak,
      wins: joustStandings.wins,
      losses: joustStandings.losses,
      draws: joustStandings.draws,
    })
    .from(joustStandings)
    .where(eq(joustStandings.userId, userId))
    .orderBy(joustStandings.season);
}

/** The standing of a season: its row, or where it starts from the last season played. */
function standingIn(
  rules: LeagueRules,
  rows: readonly SeasonRow[],
  season: number,
): Standing & { readonly started: number } {
  const row = rows.find((candidate) => candidate.season === season);
  if (row !== undefined) return row;
  const last = rows.findLast((candidate) => candidate.season < season) ?? null;
  const fresh = freshStanding(rules, last, season);
  return { ...fresh, started: fresh.laurels };
}

function isChampion(rules: LeagueRules, rows: readonly SeasonRow[], season: number): boolean {
  const before = rows.find((row) => row.season === season - 1);
  return before !== undefined && leagueOf(rules, before.laurels) === "champion";
}

function divisionView(division: Division): DivisionView {
  return {
    league: division.league,
    rank: division.rank,
    from: division.from,
    index: division.index,
  };
}

function standingView(
  rules: LeagueRules,
  rows: readonly SeasonRow[],
  claimed: readonly { readonly season: number; readonly step: number }[],
  now: EpochMs,
): JoustStanding {
  const season = seasonNow(rules, now);
  const standing = standingIn(rules, rows, season);
  const division = divisionOf(rules, standing.laurels);
  const next = divisions(rules)[division.index + 1];
  return {
    season: seasonAt(rules, season),
    laurels: standing.laurels,
    division: divisionView(division),
    nextDivision: next === undefined ? null : divisionView(next),
    streak: standing.streak,
    champion: isChampion(rules, rows, season),
    rewardsWaiting: pendingLeagueRewards(rules, rows, claimed, season).length,
  };
}

async function readClaims(db: Reader, userId: string) {
  return db
    .select({ season: joustLeagueRewards.season, step: joustLeagueRewards.step })
    .from(joustLeagueRewards)
    .where(eq(joustLeagueRewards.userId, userId));
}

/** Laurels and league this season, for the jousts' home. */
export async function readStanding(
  db: Reader,
  userId: string,
  now: EpochMs,
): Promise<JoustStanding> {
  const [rows, claimed] = await Promise.all([readSeasons(db, userId), readClaims(db, userId)]);
  return standingView(rulesAt(now), rows, claimed, now);
}

// --- A ranked joust's laurels --------------------------------------------------------------------

export interface LaurelsChanges {
  readonly challenger: { readonly before: number; readonly after: number };
  readonly opponent: { readonly before: number; readonly after: number };
}

/**
 * Writes the laurels of a ranked joust that just ended, inside its transaction, after the
 * ratings: both standings of the season are created if missing, then locked in user id order.
 * `ratings` are both ratings as they stood before the joust.
 */
export async function applyLaurels(
  tx: Transaction,
  input: {
    readonly challengerId: string;
    readonly opponentId: string;
    readonly outcome: "challenger" | "opponent" | "draw";
    readonly ratings: ReadonlyMap<string, number>;
    readonly now: EpochMs;
  },
): Promise<LaurelsChanges> {
  const { challengerId, opponentId, outcome, ratings, now } = input;
  const rules = rulesAt(now);
  const season = seasonNow(rules, now);
  const ids = [challengerId, opponentId].sort();
  for (const userId of ids) {
    const [last] = await tx
      .select({ season: joustStandings.season, laurels: joustStandings.laurels })
      .from(joustStandings)
      .where(sql`${joustStandings.userId} = ${userId} and ${joustStandings.season} < ${season}`)
      .orderBy(sql`${joustStandings.season} desc`)
      .limit(1);
    const fresh = freshStanding(rules, last ?? null, season);
    await tx
      .insert(joustStandings)
      .values({
        userId,
        season,
        started: fresh.laurels,
        laurels: fresh.laurels,
        peak: fresh.peak,
        updatedAt: new Date(now),
      })
      .onConflictDoNothing();
  }
  const locked = await tx.execute<{
    user_id: string;
    laurels: number;
    peak: number;
    streak: number;
  }>(sql`select user_id, laurels, peak, streak from joust_standings
    where season = ${season} and user_id in (${challengerId}, ${opponentId})
    order by user_id for update`);
  const rows = new Map(locked.rows.map((row) => [row.user_id, row]));
  const sideOutcome = (userId: string) => {
    if (outcome === "draw") return "draw" as const;
    const winner = outcome === "challenger" ? challengerId : opponentId;
    return userId === winner ? ("won" as const) : ("lost" as const);
  };
  const changes = new Map<string, { before: number; after: number }>();
  for (const userId of ids) {
    const row = rows.get(userId);
    if (row === undefined) throw new Error(`Standing missing for ${userId}`);
    const other = userId === challengerId ? opponentId : challengerId;
    const result = sideOutcome(userId);
    const change = joustLaurels(rules, row, {
      outcome: result,
      rating: ratings.get(userId) ?? 0,
      opponentRating: ratings.get(other) ?? 0,
    });
    await tx
      .update(joustStandings)
      .set({
        laurels: change.after.laurels,
        peak: change.after.peak,
        streak: change.after.streak,
        ...(result === "won"
          ? { wins: sql`${joustStandings.wins} + 1` }
          : result === "lost"
            ? { losses: sql`${joustStandings.losses} + 1` }
            : { draws: sql`${joustStandings.draws} + 1` }),
        updatedAt: new Date(now),
      })
      .where(sql`${joustStandings.userId} = ${userId} and ${joustStandings.season} = ${season}`);
    changes.set(userId, { before: row.laurels, after: change.after.laurels });
  }
  const of = (userId: string) => changes.get(userId) ?? { before: 0, after: 0 };
  return { challenger: of(challengerId), opponent: of(opponentId) };
}

/** A joust's laurels for its result, with the division they reached. */
export function laurelsView(
  change: { readonly before: number; readonly after: number },
  now: EpochMs,
) {
  const rules = rulesAt(now);
  const division = divisionOf(rules, change.after);
  const next = divisions(rules)[division.index + 1];
  return {
    before: change.before,
    after: change.after,
    division: divisionView(division),
    nextDivision: next === undefined ? null : divisionView(next),
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

/** `GET /jousts/league`: the road of the season, the rewards to claim, the player's figures. */
export async function readLeague(
  db: Database,
  userId: string,
  now: EpochMs,
): Promise<LeagueResponse> {
  const rules = rulesAt(now);
  const season = seasonNow(rules, now);
  const [rows, claimed, rating, open] = await Promise.all([
    readSeasons(db, userId),
    readClaims(db, userId),
    db.execute<{ rating: number; games: number }>(
      sql`select rating, games from joust_ratings where user_id = ${userId}`,
    ),
    generalOpen(db, now),
  ]);
  const standing = standingIn(rules, rows, season);
  const climbed = new Set(
    rewardedDivisions(rules, standing.started, standing.peak).map((division) => division.index),
  );
  const done = new Set(claimed.map((key) => `${key.season}:${key.step}`));
  const row = rows.find((candidate) => candidate.season === season);
  const games = rating.rows[0]?.games ?? 0;
  return {
    standing: standingView(rules, rows, claimed, now),
    road: divisions(rules).map((division) => ({
      division: divisionView(division),
      rewards: division.index === 0 ? [] : [...divisionRewards(rules, division)],
      rewarded: climbed.has(division.index),
      claimed: done.has(`${season}:${division.index}`),
    })),
    seasonRewards: LEAGUES.map((league) => ({
      league,
      rewards: [...rules.seasonRewards[league]],
    })),
    waiting: pendingLeagueRewards(rules, rows, claimed, season).map((key) => ({
      ...key,
      rewards: [...rewardsOf(rules, rows, key)],
    })),
    stats: {
      ranked: games,
      wins: row?.wins ?? 0,
      losses: row?.losses ?? 0,
      draws: row?.draws ?? 0,
      rating:
        games >= RATING_SHOWN_AFTER && rating.rows[0] !== undefined
          ? Math.round(rating.rows[0].rating)
          : null,
      ratingAfter: RATING_SHOWN_AFTER,
    },
    generalOpen: open,
  };
}

function rewardsOf(
  rules: LeagueRules,
  rows: readonly SeasonStanding[],
  key: { readonly season: number; readonly step: number },
) {
  const row = rows.find((candidate) => candidate.season === key.season);
  return leagueStepRewards(rules, key.step, leagueOf(rules, row?.laurels ?? 0));
}

// --- Claiming a reward ---------------------------------------------------------------------------

export type LeagueClaimResult =
  | {
      readonly kind: "claimed";
      readonly season: number;
      readonly step: number;
      readonly rewards: readonly LevelRewardView[];
      readonly wallet: BoosterWalletResponse;
    }
  | { readonly kind: "refused"; readonly reason: LeagueClaimRefusal };

/**
 * Claims a league reward. Idempotent by nature: the season and the step are the key, a second
 * claim returns what the first one gave. A division gives once it was climbed that season, the
 * end of a season once it is over; a reward whose sachets do not fit in the reserve waits.
 *
 * One transaction, the wallet locked first as for every reward: BEGIN, lock the wallet, the
 * seasons and claims, one combined write (the claim, the reserve and the écus with their
 * movement), COMMIT. Laurels only grow a season's peak, so seasons read without their lock can
 * only refuse a reward a joust just opened, never give one twice.
 */
export async function claimLeagueReward(
  db: Database,
  input: {
    readonly userId: string;
    readonly season: number;
    readonly step: number;
    readonly now: EpochMs;
  },
): Promise<LeagueClaimResult> {
  const { userId, season, step, now } = input;
  const rules = rulesAt(now);

  return db.transaction(async (tx): Promise<LeagueClaimResult> => {
    const locked = await lockWallet(tx, userId, now);
    const [previous] = await tx
      .select({ rewards: joustLeagueRewards.rewards })
      .from(joustLeagueRewards)
      .where(
        sql`${joustLeagueRewards.userId} = ${userId} and ${joustLeagueRewards.season} = ${season}
          and ${joustLeagueRewards.step} = ${step}`,
      );
    if (previous !== undefined) {
      return {
        kind: "claimed",
        season,
        step,
        rewards: previous.rewards,
        wallet: walletView(locked, now),
      };
    }
    const [rows, claimed] = await Promise.all([readSeasons(tx, userId), readClaims(tx, userId)]);
    const open = pendingLeagueRewards(rules, rows, claimed, seasonNow(rules, now)).some(
      (key) => key.season === season && key.step === step,
    );
    if (!open) return { kind: "refused", reason: "not_reached" };

    const rewards = [...rewardsOf(rules, rows, { season, step })];
    const reserved = withRewards(locked, rewards, locked.reserveSlots, now);
    if (reserved === null) return { kind: "refused", reason: "reserve_full" };
    const ecus = rewardEcus(rewards);
    const after = { ...reserved, ecus: reserved.ecus + ecus };

    const claimInsert = tx.$with("claim_insert").as(
      tx
        .insert(joustLeagueRewards)
        .values({ userId, season, step, rewards, claimedAt: new Date(now) })
        .returning({ season: joustLeagueRewards.season }),
    );
    const ctes: WithSubquery[] = [claimInsert];
    if (ecus > 0) {
      const details: EcuMovementDetails = { kind: "league", season, step };
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
    return { kind: "claimed", season, step, rewards, wallet: walletView(after, now) };
  });
}

// --- Boards --------------------------------------------------------------------------------------

/** The cursor of a page: the laurels and the user id of the last row shown. */
export const BOARD_CURSOR = /^(\d{1,9})\.([A-Za-z0-9_-]{1,64})$/;

function cursorOf(laurels: number, userId: string): string {
  return `${laurels}.${userId}`;
}

interface Ranked {
  readonly userId: string;
  readonly laurels: number;
  readonly place: number;
  readonly champion: boolean;
}

function entryOf(
  rules: LeagueRules,
  ranked: Ranked,
  badges: ReadonlyMap<string, PlayerBadge>,
): BoardEntry | null {
  const player = badges.get(ranked.userId);
  if (player === undefined) return null;
  return {
    player,
    place: ranked.place,
    laurels: ranked.laurels,
    division: divisionView(divisionOf(rules, ranked.laurels)),
    champion: ranked.champion,
  };
}

/** Players who block the player or whom the player blocks stay off their boards. */
function notBlocked(column: string, userId: string) {
  return sql`not exists (select 1 from user_blocks
    where (blocker_id = ${userId} and blocked_id = ${sql.raw(column)})
      or (blocker_id = ${sql.raw(column)} and blocked_id = ${userId}))`;
}

/**
 * `GET /jousts/boards/:board`: a page of a board of the season, most laurels first, ties by
 * place shared. Ma ligue and the general board are paged by cursor among the season's jousters;
 * friends and clan are bounded and come whole, with their jousters of earlier seasons at where
 * they start this one.
 */
export async function readBoard(
  db: Database,
  input: {
    readonly userId: string;
    readonly board: Board;
    readonly after: { readonly laurels: number; readonly userId: string } | null;
    readonly now: EpochMs;
  },
): Promise<BoardResponse> {
  const { userId, board, after, now } = input;
  const rules = rulesAt(now);
  const season = seasonNow(rules, now);
  const mine = await readSeasons(db, userId);
  const myStanding = standingIn(rules, mine, season);
  const myChampion = isChampion(rules, mine, season);
  const myLeague = leagueOf(rules, myStanding.laurels);

  if (board === "league" || board === "general") {
    if (board === "general" && !(await generalOpen(db, now))) {
      return closedBoard(db, rules, {
        board,
        closed: "general_closed",
        me: { userId, laurels: myStanding.laurels, place: 1, champion: myChampion },
        now,
      });
    }
    const next = LEAGUES[LEAGUES.indexOf(myLeague) + 1];
    const range =
      board === "league"
        ? sql`and s.laurels >= ${rules.leagueFrom[myLeague]}
            ${next === undefined ? sql`` : sql`and s.laurels < ${rules.leagueFrom[next]}`}`
        : sql``;
    const page = await db.execute<{
      user_id: string;
      laurels: number;
      place: number;
      champion: boolean;
    }>(sql`
      select * from (
        select s.user_id, s.laurels, (rank() over (order by s.laurels desc))::int as place,
          coalesce(b.laurels >= ${rules.leagueFrom.champion}, false) as champion
        from joust_standings s
        left join joust_standings b on b.user_id = s.user_id and b.season = ${season - 1}
        where s.season = ${season} ${range} and (s.user_id = ${userId} or ${notBlocked("s.user_id", userId)})
      ) ranked
      ${after === null ? sql`` : sql`where laurels < ${after.laurels} or (laurels = ${after.laurels} and user_id > ${after.userId})`}
      order by laurels desc, user_id
      limit ${BOARD_PAGE + 1}`);
    const rows = page.rows.slice(0, BOARD_PAGE);
    const ahead = await db.execute<{ count: number }>(sql`
      select count(*)::int as count from joust_standings s
      where s.season = ${season} ${range} and s.laurels > ${myStanding.laurels}
        and ${notBlocked("s.user_id", userId)}`);
    const badges = await readBadges(db, [userId, ...rows.map((row) => row.user_id)], now);
    const entries = rows.flatMap((row) => {
      const entry = entryOf(
        rules,
        { userId: row.user_id, laurels: row.laurels, place: row.place, champion: row.champion },
        badges,
      );
      return entry === null ? [] : [entry];
    });
    const last = rows.at(-1);
    return {
      board,
      closed: null,
      league: board === "league" ? myLeague : null,
      entries,
      me: meEntry(rules, badges, {
        userId,
        laurels: myStanding.laurels,
        place: (ahead.rows[0]?.count ?? 0) + 1,
        champion: myChampion,
      }),
      next:
        page.rows.length > BOARD_PAGE && last !== undefined
          ? cursorOf(last.laurels, last.user_id)
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
    if (inClan.rows[0]?.found !== true) {
      return closedBoard(db, rules, {
        board,
        closed: "no_clan",
        me: { userId, laurels: myStanding.laurels, place: 1, champion: myChampion },
        now,
      });
    }
  }
  const ids = [userId, ...members.rows.map((row) => row.id)];
  const seasons = await db.execute<SeasonRow & { user_id: string }>(sql`
    select user_id, season, started, laurels, peak, streak, wins, losses, draws
    from joust_standings
    where user_id in (${sql.join(
      ids.map((id) => sql`${id}`),
      sql`, `,
    )}) and season <= ${season}
    order by season`);
  const byUser = new Map<string, SeasonRow[]>();
  for (const row of seasons.rows) {
    byUser.set(row.user_id, [...(byUser.get(row.user_id) ?? []), row]);
  }
  const standings = ids
    .filter((id) => id === userId || byUser.has(id))
    .map((id) => {
      const rows = byUser.get(id) ?? [];
      return {
        userId: id,
        laurels: standingIn(rules, rows, season).laurels,
        champion: isChampion(rules, rows, season),
      };
    })
    .sort((a, b) => b.laurels - a.laurels || a.userId.localeCompare(b.userId));
  const ranked = standings.map((standing) => ({
    ...standing,
    place: 1 + standings.filter((other) => other.laurels > standing.laurels).length,
  }));
  const badges = await readBadges(db, ids, now);
  const entries = ranked.flatMap((row) => {
    const entry = entryOf(rules, row, badges);
    return entry === null ? [] : [entry];
  });
  const me = ranked.find((row) => row.userId === userId);
  return {
    board,
    closed: null,
    league: null,
    entries,
    me: meEntry(rules, badges, {
      userId,
      laurels: myStanding.laurels,
      place: me?.place ?? 1,
      champion: myChampion,
    }),
    next: null,
  };
}

function meEntry(rules: LeagueRules, badges: ReadonlyMap<string, PlayerBadge>, me: Ranked) {
  const entry = entryOf(rules, me, badges);
  if (entry === null) throw new Error("Badge missing for the player");
  return entry;
}

/** A board the player cannot see yet: only themself, with their laurels. */
async function closedBoard(
  db: Reader,
  rules: LeagueRules,
  input: {
    readonly board: Board;
    readonly closed: "no_clan" | "general_closed";
    readonly me: Ranked;
    readonly now: EpochMs;
  },
): Promise<BoardResponse> {
  const badges = await readBadges(db, [input.me.userId], input.now);
  return {
    board: input.board,
    closed: input.closed,
    league: null,
    entries: [],
    me: meEntry(rules, badges, input.me),
    next: null,
  };
}
