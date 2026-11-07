import type {
  AnswerJoustResponse,
  DeckRefusal,
  JoustAccess,
  JoustDeckResponse,
  JoustOpponentsResponse,
  JoustRefusal,
  JoustSummary,
  JoustsResponse,
  JoustView,
  LaunchRefusal,
  PlayerBadge,
} from "@leximon/contract";
import {
  answerInTime,
  answerTime,
  BONUS_SCHEDULE,
  bonusRulesAt,
  type ChoiceCard,
  composeDeck,
  createSeededRandom,
  type DeckCandidate,
  deckProblem,
  drawDistinct,
  type EpochMs,
  featureLevels,
  gameDayOf,
  idleRating,
  JOUST_SCHEDULE,
  type JoustRules,
  joustChoices,
  joustOutcome,
  joustRulesAt,
  LEAGUE_SCHEDULE,
  leagueRulesAt,
  levelOf,
  MASTERY_LEVELS,
  type MasteryLevel,
  playedXp,
  type Rarity,
  type Rating,
  type RunAnswer,
  randomInt,
  rateGlicko,
  reserveCapacity,
  runOver,
  runScore,
  TRADE_SCHEDULE,
  UNLOCK_SCHEDULE,
  winReward,
  xpToReach,
} from "@leximon/core";
import { type Database, schema } from "@leximon/db";
import { and, asc, eq, type SQL, sql } from "drizzle-orm";
import type { CatalogIndex } from "../challenges/catalog-index";
import { notLocked } from "../friends/friends";
import { lockWallet } from "../levels/rewards";
import { readBadges } from "../profile/profile";
import { addXpToPlayers, readXp } from "../progress/progress";
import { applyPoints, readRankedLeft, readStanding, tournamentView } from "./leagues";

const { boosterWallets, cards, joustDecks, joustQuestions, joustRatings, jousts, players } = schema;

type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
type Reader = Pick<Database, "select" | "execute">;
type JoustRow = typeof jousts.$inferSelect;
type QuestionRow = typeof joustQuestions.$inferSelect;

const DAY_MS = 86_400_000;
/** Ended jousts listed after the open ones. */
const ENDED_LISTED = 20;
/** Ranked opponents nearest in rating, among which one is drawn. */
const NEAREST_OPPONENTS = 3;

function rulesAt(now: EpochMs): JoustRules {
  return joustRulesAt(JOUST_SCHEDULE, now);
}

function opensAtLevel(now: EpochMs): number {
  return featureLevels(UNLOCK_SCHEDULE, TRADE_SCHEDULE, now).jousts;
}

/** Mastery levels whose words may enter a deck, for SQL filters. */
function deckLevels(rules: JoustRules): SQL {
  const levels = MASTERY_LEVELS.slice(MASTERY_LEVELS.indexOf(rules.minimumMastery));
  return sql.join(
    levels.map((level) => sql`${level}`),
    sql`, `,
  );
}

// --- Access --------------------------------------------------------------------------------------

interface Jouster {
  readonly isAnonymous: boolean;
  readonly pseudo: string | null;
  readonly xp: number;
  readonly joustAccess: boolean;
}

async function readJouster(db: Reader, userId: string): Promise<Jouster | null> {
  const result = await db.execute<{
    is_anonymous: boolean;
    pseudo: string | null;
    xp: number;
    joust_access: boolean;
  }>(sql`
    select u.is_anonymous, p.pseudo, coalesce(pr.xp, 0)::int as xp,
      coalesce(p.joust_access, false) as joust_access
    from users u
    left join players p on p.user_id = u.id
    left join user_progress pr on pr.user_id = u.id
    where u.id = ${userId}`);
  const row = result.rows[0];
  if (row === undefined) return null;
  return {
    isAnonymous: row.is_anonymous,
    pseudo: row.pseudo,
    xp: row.xp,
    joustAccess: row.joust_access,
  };
}

/** What keeps a player from jousting, in the order the screen asks it. */
export function accessOf(rules: JoustRules, level: number, jouster: Jouster | null): JoustAccess {
  if (jouster === null || jouster.isAnonymous) return "account_required";
  if (jouster.pseudo === null) return "pseudo_required";
  if (levelOf(jouster.xp).level < level) return "level_too_low";
  if (!rules.openToAll && !jouster.joustAccess) return "not_yet";
  return "open";
}

async function readAccess(db: Reader, userId: string, now: EpochMs): Promise<JoustAccess> {
  return accessOf(rulesAt(now), opensAtLevel(now), await readJouster(db, userId));
}

/** SQL: the player `userId` may joust now (account, pseudo, level, access, not locked). */
function canJoust(userId: SQL | string, rules: JoustRules, now: EpochMs): SQL {
  return sql`exists (select 1 from players p
    join users u on u.id = p.user_id and not u.is_anonymous
    left join user_progress pr on pr.user_id = p.user_id
    where p.user_id = ${userId} and p.pseudo is not null
      and coalesce(pr.xp, 0) >= ${xpToReach(opensAtLevel(now))}
      and (${rules.openToAll} or p.joust_access))
    and ${notLocked(sql`${userId}`, now)}`;
}

function blockedBetween(a: SQL | string, b: SQL | string): SQL {
  return sql`exists (select 1 from user_blocks
    where (blocker_id = ${a} and blocked_id = ${b}) or (blocker_id = ${b} and blocked_id = ${a}))`;
}

// --- The deck ------------------------------------------------------------------------------------

/** Cards the player owns, with their rarity and the level of their word, drawable in a joust. */
async function readCandidates(
  db: Reader,
  userId: string,
  catalog: CatalogIndex,
): Promise<DeckCandidate[]> {
  const result = await db.execute<{ card_id: string; rarity: Rarity; level: MasteryLevel }>(sql`
    select distinct uc.card_id, c.rarity::text as rarity, coalesce(um.level::text, 'blank') as level
    from user_cards uc
    join cards c on c.id = uc.card_id and c.definition is not null
    left join user_mastery um on um.user_id = uc.user_id and um.card_id = uc.card_id
    where uc.user_id = ${userId} and uc.quantity > 0
    order by uc.card_id`);
  const drawable = new Set(catalog.choiceCards.map((card) => card.id));
  return result.rows
    .filter((row) => drawable.has(row.card_id))
    .map((row) => ({ cardId: row.card_id, rarity: row.rarity, level: row.level }));
}

async function readSavedDeck(db: Reader, userId: string): Promise<readonly string[] | null> {
  const [row] = await db
    .select({ cardIds: joustDecks.cardIds })
    .from(joustDecks)
    .where(eq(joustDecks.userId, userId));
  return row?.cardIds ?? null;
}

/**
 * The deck a joust draws from: the saved one while it holds enough cards that can still enter it,
 * else the game's, keeping what it can of the saved one.
 */
function deckOf(
  rules: JoustRules,
  saved: readonly string[] | null,
  candidates: readonly DeckCandidate[],
): readonly string[] {
  if (saved === null) return composeDeck(rules, candidates);
  const kept = composeDeck(rules, candidates, saved).filter((id) => saved.includes(id));
  return kept.length >= rules.drawn ? kept : composeDeck(rules, candidates, saved);
}

/** `GET /jousts/deck`. */
export async function readDeck(
  db: Reader,
  userId: string,
  catalog: CatalogIndex,
  now: EpochMs,
): Promise<JoustDeckResponse> {
  const rules = rulesAt(now);
  const candidates = await readCandidates(db, userId, catalog);
  const saved = await readSavedDeck(db, userId);
  return {
    cardIds: [...deckOf(rules, saved, candidates)],
    saved: saved !== null,
    candidates: candidates
      .filter((candidate) => deckProblem(rules, [candidate.cardId], candidates) !== "not_eligible")
      .map((candidate) => ({ cardId: candidate.cardId, cost: rules.cost[candidate.rarity] })),
    budget: rules.deckBudget,
    size: rules.deckSize,
    min: rules.drawn,
  };
}

/** `PUT /jousts/deck`: the deck the player chose, checked against what they own now. */
export async function saveDeck(
  db: Database,
  input: {
    readonly userId: string;
    readonly cardIds: readonly string[];
    readonly catalog: CatalogIndex;
    readonly now: EpochMs;
  },
): Promise<
  { readonly kind: "saved" } | { readonly kind: "refused"; readonly reason: DeckRefusal }
> {
  const { userId, cardIds, catalog, now } = input;
  const rules = rulesAt(now);
  if ((await readAccess(db, userId, now)) !== "open")
    return { kind: "refused", reason: "not_open" };
  const problem = deckProblem(rules, cardIds, await readCandidates(db, userId, catalog));
  if (problem !== null) return { kind: "refused", reason: problem };
  await db
    .insert(joustDecks)
    .values({ userId, cardIds: [...cardIds], updatedAt: new Date(now) })
    .onConflictDoUpdate({
      target: joustDecks.userId,
      set: { cardIds: [...cardIds], updatedAt: new Date(now) },
    });
  return { kind: "saved" };
}

// --- Launching -----------------------------------------------------------------------------------

export type LaunchTarget =
  | { readonly kind: "ranked" }
  | { readonly kind: "free" }
  | { readonly kind: "friendly"; readonly opponentCode: string }
  | { readonly kind: "revenge"; readonly joustId: string };

export type LaunchResult =
  | { readonly kind: "launched"; readonly joustId: string }
  | { readonly kind: "refused"; readonly reason: LaunchRefusal }
  | { readonly kind: "not_found" };

const refuseLaunch = (reason: LaunchRefusal): LaunchResult => ({ kind: "refused", reason });

/**
 * Opponents the game picks: came by lately, free to play, nearest in rating. For a ranked joust,
 * also with ranked jousts left today and not met lately, those of the player's league first: a
 * strong player placed too low then meets weaker players, wins more and climbs. The league is the
 * one of the last week each player entered.
 */
async function gameOpponents(
  tx: Transaction,
  userId: string,
  kind: "ranked" | "free",
  rules: JoustRules,
  now: EpochMs,
): Promise<string[]> {
  const mine = await tx.execute<{ rating: number; league: string | null }>(sql`
    select
      (select rating from joust_ratings where user_id = ${userId}) as rating,
      (select league from joust_group_members where user_id = ${userId}
        order by week desc limit 1) as league`);
  const rating = mine.rows[0]?.rating ?? rules.glicko.initial.rating;
  const league = mine.rows[0]?.league ?? "page";
  const day = gameDayOf(now);
  const [dayStart, dayEnd] = [new Date(day.start), new Date(day.end)];
  const ranked = kind === "ranked";
  const lastLeague = sql`coalesce((select m.league from joust_group_members m
    where m.user_id = p.user_id order by m.week desc limit 1), 'page')`;
  const rankedRules = ranked
    ? sql`and (select count(*) from jousts j where j.kind = 'ranked'
          and (j.challenger_id = p.user_id or j.opponent_id = p.user_id)
          and j.created_at >= ${dayStart} and j.created_at < ${dayEnd}) < ${leagueRulesAt(LEAGUE_SCHEDULE, now).rankedPerDay}
        and not exists (select 1 from jousts j
          where j.kind = 'ranked' and j.created_at > ${new Date(now - rules.pairCooldownMs)}
            and ((j.challenger_id = ${userId} and j.opponent_id = p.user_id)
              or (j.challenger_id = p.user_id and j.opponent_id = ${userId})))`
    : sql``;
  const result = await tx.execute<{ user_id: string }>(sql`
    select p.user_id
    from players p
    left join joust_ratings r on r.user_id = p.user_id
    where p.user_id <> ${userId}
      and p.last_seen_at > ${new Date(now - rules.seenWithinMs)}
      and ${canJoust(sql`p.user_id`, rules, now)}
      and not ${blockedBetween(sql`p.user_id`, userId)}
      and (select count(*) from jousts j
        where j.opponent_id = p.user_id and j.ended_at is null and j.opponent_done_at is null)
        < ${rules.maxToPlay}
      ${rankedRules}
      and (select count(distinct uc.card_id) from user_cards uc
        join cards c on c.id = uc.card_id and c.definition is not null
        join user_mastery um on um.user_id = uc.user_id and um.card_id = uc.card_id
          and um.level::text in (${deckLevels(rules)})
        where uc.user_id = p.user_id and uc.quantity > 0) >= ${rules.drawn}
    order by ${ranked ? sql`(${lastLeague} <> ${league}),` : sql``}
      abs(coalesce(r.rating, ${rules.glicko.initial.rating}) - ${rating}), p.user_id
    limit ${NEAREST_OPPONENTS}`);
  return result.rows.map((row) => row.user_id);
}

/** Two players are friends, or members of the same clan. */
async function areClose(tx: Reader, a: string, b: string): Promise<boolean> {
  const result = await tx.execute(sql`
    select 1 where exists (select 1 from friendships where user_id = ${a} and friend_id = ${b})
      or exists (select 1 from clan_members m1 join clan_members m2 on m2.clan_id = m1.clan_id
        where m1.user_id = ${a} and m2.user_id = ${b})`);
  return result.rows.length > 0;
}

async function opponentFor(
  tx: Transaction,
  userId: string,
  target: LaunchTarget,
  rules: JoustRules,
  seed: string,
  now: EpochMs,
): Promise<{ readonly opponentId: string; readonly revengeOf: string | null } | LaunchResult> {
  if (target.kind === "ranked" || target.kind === "free") {
    const nearest = await gameOpponents(tx, userId, target.kind, rules, now);
    if (nearest.length === 0) return refuseLaunch("no_opponent");
    const picked = nearest[randomInt(createSeededRandom(seed), nearest.length)];
    return picked === undefined
      ? refuseLaunch("no_opponent")
      : { opponentId: picked, revengeOf: null };
  }
  let opponentId: string;
  let revengeOf: string | null = null;
  if (target.kind === "friendly") {
    const [row] = await tx
      .select({ userId: players.userId })
      .from(players)
      .where(eq(players.code, target.opponentCode));
    if (row === undefined || row.userId === userId) return refuseLaunch("opponent_unavailable");
    opponentId = row.userId;
    if (!(await areClose(tx, userId, opponentId))) return refuseLaunch("not_friends");
  } else {
    const [earlier] = await tx
      .select({ challengerId: jousts.challengerId, opponentId: jousts.opponentId })
      .from(jousts)
      .where(eq(jousts.id, target.joustId));
    if (earlier === undefined) return { kind: "not_found" };
    if (earlier.challengerId !== userId && earlier.opponentId !== userId) {
      return { kind: "not_found" };
    }
    opponentId = earlier.challengerId === userId ? earlier.opponentId : earlier.challengerId;
    revengeOf = target.joustId;
  }
  const free = await tx.execute(sql`
    select 1 where ${canJoust(opponentId, rules, now)}
      and not ${blockedBetween(opponentId, userId)}`);
  if (free.rows.length === 0) return refuseLaunch("opponent_unavailable");
  return { opponentId, revengeOf };
}

async function hasJousted(tx: Reader, userId: string): Promise<boolean> {
  const result = await tx.execute(sql`
    select 1 where exists (select 1 from jousts where challenger_id = ${userId})
      or exists (select 1 from jousts where opponent_id = ${userId})`);
  return result.rows.length > 0;
}

/**
 * Launches a joust: picks the opponent, draws the cards of both decks and the choices of each
 * question, and freezes them. The challenger plays at once. A key already used returns its joust.
 */
export async function launchJoust(
  db: Database,
  input: {
    readonly userId: string;
    readonly target: LaunchTarget;
    readonly launchKey: string;
    readonly seed: string;
    readonly catalog: CatalogIndex;
    readonly now: EpochMs;
  },
): Promise<LaunchResult> {
  const { userId, target, launchKey, seed, catalog, now } = input;
  const rules = rulesAt(now);
  return db.transaction(async (tx) => {
    // Launches of one player go one at a time: the count of jousts waiting stays true.
    await tx.execute(sql`select 1 from players where user_id = ${userId} for update`);
    const [replayed] = await tx
      .select({ id: jousts.id })
      .from(jousts)
      .where(and(eq(jousts.challengerId, userId), eq(jousts.launchKey, launchKey)));
    if (replayed !== undefined) return { kind: "launched", joustId: replayed.id };

    if (accessOf(rules, opensAtLevel(now), await readJouster(tx, userId)) !== "open") {
      return refuseLaunch("not_open");
    }
    const waiting = await tx.execute<{ count: number }>(sql`
      select count(*)::int as count from jousts
      where challenger_id = ${userId} and ended_at is null`);
    if ((waiting.rows[0]?.count ?? 0) >= rules.maxWaiting) return refuseLaunch("too_many_waiting");
    // The opponent's ranked jousts of the day are counted when they are picked, without their
    // lock: two launches at the same instant may give them one ranked joust more, never fewer.
    if (target.kind === "ranked" && (await readRankedLeft(tx, userId, now)) === 0) {
      return refuseLaunch("ranked_limit");
    }
    const saved = await readSavedDeck(tx, userId);
    const myDeck = deckOf(rules, saved, await readCandidates(tx, userId, catalog));
    if (myDeck.length < rules.drawn) return refuseLaunch("deck_too_small");
    if (saved === null) {
      if (!(await hasJousted(tx, userId))) return refuseLaunch("deck_not_saved");
      // Players who jousted before composing a deck keep the one the game made them play.
      await tx
        .insert(joustDecks)
        .values({ userId, cardIds: [...myDeck], updatedAt: new Date(now) })
        .onConflictDoNothing();
    }

    const found = await opponentFor(tx, userId, target, rules, seed, now);
    if ("kind" in found) return found;
    const { opponentId, revengeOf } = found;
    const theirDeck = deckOf(
      rules,
      await readSavedDeck(tx, opponentId),
      await readCandidates(tx, opponentId, catalog),
    );
    if (theirDeck.length < rules.drawn) return refuseLaunch("opponent_unavailable");

    const random = createSeededRandom(seed);
    const byId = new Map<string, ChoiceCard>(catalog.choiceCards.map((card) => [card.id, card]));
    const questionsOf = (answererId: string, deck: readonly string[]) =>
      drawDistinct(random, deck, rules.drawn).map((cardId, position) => {
        const card = byId.get(cardId);
        if (card === undefined) throw new Error(`Card ${cardId} left the catalogue mid-launch`);
        return {
          answererId,
          position,
          cardId,
          choices: [...joustChoices(rules, random, card, catalog.choiceCards)],
        };
      });
    // The opponent finds the words of the challenger's cards, and the other way round.
    const questions = [...questionsOf(opponentId, myDeck), ...questionsOf(userId, theirDeck)];
    const [joust] = await tx
      .insert(jousts)
      .values({
        kind: target.kind === "revenge" ? "friendly" : target.kind,
        challengerId: userId,
        opponentId,
        launchKey,
        revengeOf,
        createdAt: new Date(now),
      })
      .returning({ id: jousts.id });
    if (joust === undefined) throw new Error("Joust insert returned no row");
    await tx.insert(joustQuestions).values(questions.map((q) => ({ joustId: joust.id, ...q })));
    return { kind: "launched", joustId: joust.id };
  });
}

// --- Playing -------------------------------------------------------------------------------------

type Role = "challenger" | "opponent";

function roleIn(joust: JoustRow, userId: string): Role | null {
  if (joust.challengerId === userId) return "challenger";
  if (joust.opponentId === userId) return "opponent";
  return null;
}

function toRunAnswer(question: QuestionRow): RunAnswer {
  return {
    servedAt: question.servedAt?.getTime() ?? null,
    answeredAt: question.answeredAt?.getTime() ?? null,
    correct: question.correct === true,
  };
}

/** When the player's run started, or `null` while it may not start. */
function runStart(joust: JoustRow, role: Role): EpochMs | null {
  if (role === "challenger") return joust.createdAt.getTime();
  return joust.opponentStartedAt?.getTime() ?? null;
}

function runClosed(joust: JoustRow, role: Role): boolean {
  return (role === "challenger" ? joust.challengerDoneAt : joust.opponentDoneAt) !== null;
}

async function lockJoust(tx: Transaction, joustId: string): Promise<JoustRow | undefined> {
  const [joust] = await tx.select().from(jousts).where(eq(jousts.id, joustId)).for("update");
  return joust;
}

async function runQuestions(tx: Reader, joustId: string, userId: string): Promise<QuestionRow[]> {
  return tx
    .select()
    .from(joustQuestions)
    .where(and(eq(joustQuestions.joustId, joustId), eq(joustQuestions.answererId, userId)))
    .orderBy(asc(joustQuestions.position));
}

export type NextQuestionResult =
  | {
      readonly kind: "question";
      readonly position: number;
      readonly definition: string;
      readonly choices: readonly string[];
      readonly servedAt: EpochMs;
      readonly deadline: EpochMs;
    }
  | { readonly kind: "run_over" }
  | { readonly kind: "refused"; readonly reason: JoustRefusal }
  | { readonly kind: "not_found" };

/**
 * The player's next question, served once: its clock starts now. A question served and still on
 * the clock comes back as it was, so that reloading the page loses nothing and gains nothing.
 */
export async function nextQuestion(
  db: Database,
  input: { readonly userId: string; readonly joustId: string; readonly now: EpochMs },
): Promise<NextQuestionResult> {
  const { userId, joustId, now } = input;
  const rules = rulesAt(now);
  return db.transaction(async (tx) => {
    const joust = await lockJoust(tx, joustId);
    const role = joust === undefined ? null : roleIn(joust, userId);
    if (joust === undefined || role === null) return { kind: "not_found" };
    if (joust.endedAt !== null || runClosed(joust, role)) return { kind: "run_over" };
    if (role === "opponent") {
      if (joust.challengerDoneAt === null) return { kind: "refused", reason: "not_your_turn" };
      if (joust.opponentStartedAt === null) {
        if (joust.replyBy !== null && now >= joust.replyBy.getTime()) return { kind: "run_over" };
        await tx
          .update(jousts)
          .set({ opponentStartedAt: new Date(now) })
          .where(eq(jousts.id, joustId));
        joust.opponentStartedAt = new Date(now);
      }
    }
    const run = await runQuestions(tx, joustId, userId);
    if (runOver(rules, run.map(toRunAnswer), runStart(joust, role), now)) {
      return { kind: "run_over" };
    }
    const pending = run.find(
      (q) =>
        q.servedAt !== null &&
        q.answeredAt === null &&
        answerInTime(rules, q.servedAt.getTime(), now),
    );
    const question = pending ?? run.find((q) => q.servedAt === null);
    if (question === undefined) return { kind: "run_over" };
    const servedAt = question.servedAt?.getTime() ?? now;
    if (question.servedAt === null) {
      await tx
        .update(joustQuestions)
        .set({ servedAt: new Date(now) })
        .where(
          and(
            eq(joustQuestions.joustId, joustId),
            eq(joustQuestions.answererId, userId),
            eq(joustQuestions.position, question.position),
          ),
        );
    }
    const [card] = await tx
      .select({ definition: cards.definition })
      .from(cards)
      .where(eq(cards.id, question.cardId));
    if (card?.definition === null || card?.definition === undefined) {
      throw new Error(`Card ${question.cardId} has no definition`);
    }
    return {
      kind: "question",
      position: question.position,
      definition: card.definition,
      choices: question.choices,
      servedAt,
      deadline: servedAt + rules.answerMs,
    };
  });
}

export type AnswerResult =
  | ({ readonly kind: "answered" } & AnswerJoustResponse)
  | { readonly kind: "refused"; readonly reason: JoustRefusal }
  | { readonly kind: "not_found" };

/**
 * Records the answer to a served question. An answer past the clock is not recorded: the question
 * stays wrong. The position is the key: answering it again returns the first answer.
 */
export async function answerQuestion(
  db: Database,
  input: {
    readonly userId: string;
    readonly joustId: string;
    readonly position: number;
    readonly cardId: string;
    readonly now: EpochMs;
  },
): Promise<AnswerResult> {
  const { userId, joustId, position, cardId, now } = input;
  const rules = rulesAt(now);
  return db.transaction(async (tx) => {
    const joust = await lockJoust(tx, joustId);
    const role = joust === undefined ? null : roleIn(joust, userId);
    if (joust === undefined || role === null) return { kind: "not_found" };
    const run = await runQuestions(tx, joustId, userId);
    const question = run.find((q) => q.position === position);
    if (question === undefined) return { kind: "not_found" };
    const over = () => runOver(rules, run.map(toRunAnswer), runStart(joust, role), now);
    if (question.answeredAt !== null) {
      return {
        kind: "answered",
        correct: question.correct === true,
        rightCardId: question.cardId,
        late: false,
        runOver: over(),
      };
    }
    if (question.servedAt === null) return { kind: "refused", reason: "not_served" };
    if (!question.choices.includes(cardId)) return { kind: "refused", reason: "not_a_choice" };
    const closed = joust.endedAt !== null || runClosed(joust, role);
    if (closed || !answerInTime(rules, question.servedAt.getTime(), now)) {
      return {
        kind: "answered",
        correct: false,
        rightCardId: question.cardId,
        late: true,
        runOver: closed || over(),
      };
    }
    const correct = cardId === question.cardId;
    await tx
      .update(joustQuestions)
      .set({ answeredAt: new Date(now), chosenCardId: cardId, correct })
      .where(
        and(
          eq(joustQuestions.joustId, joustId),
          eq(joustQuestions.answererId, userId),
          eq(joustQuestions.position, position),
        ),
      );
    question.answeredAt = new Date(now);
    question.correct = correct;
    return {
      kind: "answered",
      correct,
      rightCardId: question.cardId,
      late: false,
      runOver: over(),
    };
  });
}

// --- Closing runs and jousts ---------------------------------------------------------------------

async function rewardedToday(tx: Reader, userId: string, now: EpochMs): Promise<number> {
  const day = gameDayOf(now);
  const [start, end] = [new Date(day.start), new Date(day.end)];
  const result = await tx.execute<{ count: number }>(sql`
    select count(*)::int as count from jousts
    where (challenger_id = ${userId} and challenger_rewarded
        and challenger_done_at >= ${start} and challenger_done_at < ${end})
      or (opponent_id = ${userId} and opponent_rewarded
        and opponent_done_at >= ${start} and opponent_done_at < ${end})`);
  return result.rows[0]?.count ?? 0;
}

async function wonToday(tx: Reader, userId: string, now: EpochMs): Promise<number> {
  const day = gameDayOf(now);
  const result = await tx.execute<{ count: number }>(sql`
    select count(*)::int as count from jousts
    where ended_at >= ${new Date(day.start)} and ended_at < ${new Date(day.end)}
      and ((outcome = 'challenger' and challenger_id = ${userId} and challenger_boosters > 0)
        or (outcome = 'opponent' and opponent_id = ${userId} and opponent_boosters > 0))`);
  return result.rows[0]?.count ?? 0;
}

/** Locks both ratings, created at the start if missing, in user id order. */
async function lockRatings(
  tx: Transaction,
  ids: readonly string[],
  rules: JoustRules,
  now: EpochMs,
): Promise<Map<string, Rating & { readonly games: number; readonly lastPlayedAt: EpochMs }>> {
  const { initial } = rules.glicko;
  await tx
    .insert(joustRatings)
    .values(
      ids.map((userId) => ({
        userId,
        rating: initial.rating,
        deviation: initial.deviation,
        volatility: initial.volatility,
        lastPlayedAt: new Date(now),
      })),
    )
    .onConflictDoNothing();
  const result = await tx.execute<{
    user_id: string;
    rating: number;
    deviation: number;
    volatility: number;
    games: number;
    last_played_at: Date | string;
  }>(sql`select user_id, rating, deviation, volatility, games, last_played_at
    from joust_ratings where user_id in (${sql.join(
      ids.map((id) => sql`${id}`),
      sql`, `,
    )}) order by user_id for update`);
  return new Map(
    result.rows.map((row) => [
      row.user_id,
      {
        rating: row.rating,
        deviation: row.deviation,
        volatility: row.volatility,
        games: row.games,
        lastPlayedAt: new Date(row.last_played_at).getTime(),
      },
    ]),
  );
}

export interface SettleReport {
  /** Something closed: letters may be due. */
  readonly changed: boolean;
  readonly levelUps: readonly string[];
}

const NOTHING_SETTLED: SettleReport = { changed: false, levelUps: [] };

/**
 * Closes what time or answers closed: a run whose questions are answered or whose time is gone
 * (the run's XP), an opponent who let the reply time pass (a forfeit), then the joust once both
 * runs are closed (the winner's XP and sachet, the ratings). Locks both wallets in id order, then
 * the joust; replaying it changes nothing.
 */
export async function settleJoust(
  db: Database,
  joustId: string,
  now: EpochMs,
): Promise<SettleReport> {
  const rules = rulesAt(now);
  const [head] = await db
    .select({ challengerId: jousts.challengerId, opponentId: jousts.opponentId })
    .from(jousts)
    .where(eq(jousts.id, joustId));
  if (head === undefined) return NOTHING_SETTLED;
  const ids = [head.challengerId, head.opponentId].sort();

  return db.transaction(async (tx) => {
    const wallets = new Map<string, Awaited<ReturnType<typeof lockWallet>>>();
    for (const id of ids) wallets.set(id, await lockWallet(tx, id, now));
    const joust = await lockJoust(tx, joustId);
    if (joust === undefined || joust.endedAt !== null) return NOTHING_SETTLED;
    const { challengerId, opponentId } = joust;
    const challengerRun = (await runQuestions(tx, joustId, challengerId)).map(toRunAnswer);
    const opponentRun = (await runQuestions(tx, joustId, opponentId)).map(toRunAnswer);

    const changes: Partial<typeof jousts.$inferInsert> = {};
    const gains = new Map<string, number>([
      [challengerId, 0],
      [opponentId, 0],
    ]);
    const gain = (userId: string, xp: number) => gains.set(userId, (gains.get(userId) ?? 0) + xp);

    let challengerDone = joust.challengerDoneAt !== null;
    if (!challengerDone && runOver(rules, challengerRun, joust.createdAt.getTime(), now)) {
      const score = runScore(rules, challengerRun);
      const xp = playedXp(rules, await rewardedToday(tx, challengerId, now));
      Object.assign(changes, {
        challengerDoneAt: new Date(now),
        challengerCorrect: score.correct,
        challengerMs: score.ms,
        challengerRewarded: xp > 0,
        challengerXp: xp,
        replyBy: new Date(now + rules.replyMs),
      });
      gain(challengerId, xp);
      challengerDone = true;
    }

    let opponentDone = joust.opponentDoneAt !== null;
    let forfeit = false;
    if (challengerDone && !opponentDone) {
      const started = joust.opponentStartedAt?.getTime() ?? null;
      const replyBy = (changes.replyBy ?? joust.replyBy)?.getTime() ?? Number.POSITIVE_INFINITY;
      if (started !== null && runOver(rules, opponentRun, started, now)) {
        const score = runScore(rules, opponentRun);
        const xp = playedXp(rules, await rewardedToday(tx, opponentId, now));
        Object.assign(changes, {
          opponentDoneAt: new Date(now),
          opponentCorrect: score.correct,
          opponentMs: score.ms,
          opponentRewarded: xp > 0,
          opponentXp: xp,
        });
        gain(opponentId, xp);
        opponentDone = true;
      } else if (started === null && now >= replyBy) {
        Object.assign(changes, {
          opponentDoneAt: new Date(now),
          opponentCorrect: 0,
          opponentMs: rules.answerMs * opponentRun.length,
          forfeit: true,
        });
        opponentDone = true;
        forfeit = true;
      }
    }

    if (challengerDone && opponentDone) {
      const challengerScore = {
        correct: changes.challengerCorrect ?? joust.challengerCorrect ?? 0,
        ms: changes.challengerMs ?? joust.challengerMs ?? 0,
      };
      const opponentScore = {
        correct: changes.opponentCorrect ?? joust.opponentCorrect ?? 0,
        ms: changes.opponentMs ?? joust.opponentMs ?? 0,
      };
      const outcome = forfeit ? "challenger" : joustOutcome(challengerScore, opponentScore);
      changes.endedAt = new Date(now);
      changes.outcome = outcome;
      if (outcome !== "draw") {
        const winner = outcome === "challenger" ? challengerId : opponentId;
        const rewarded =
          outcome === "challenger"
            ? (changes.challengerRewarded ?? joust.challengerRewarded)
            : (changes.opponentRewarded ?? joust.opponentRewarded);
        const reward = winReward(rules, { rewarded, wonToday: await wonToday(tx, winner, now) });
        const wallet = wallets.get(winner);
        const capacity = reserveCapacity(
          bonusRulesAt(BONUS_SCHEDULE, now),
          wallet?.reserveSlots ?? 0,
        );
        const credited = Math.max(
          0,
          Math.min(reward.boosters, capacity - (wallet?.bonusBoosters ?? 0)),
        );
        if (credited > 0) {
          await tx
            .update(boosterWallets)
            .set({ bonusBoosters: sql`${boosterWallets.bonusBoosters} + ${credited}` })
            .where(eq(boosterWallets.userId, winner));
        }
        gain(winner, reward.xp);
        if (outcome === "challenger") {
          changes.challengerXp = (changes.challengerXp ?? joust.challengerXp) + reward.xp;
          changes.challengerBoosters = credited;
        } else {
          changes.opponentXp = (changes.opponentXp ?? joust.opponentXp) + reward.xp;
          changes.opponentBoosters = credited;
        }
      }
      if (joust.kind === "ranked") {
        const ratings = await lockRatings(tx, ids, rules, now);
        const before = (id: string) => {
          const row = ratings.get(id);
          if (row === undefined) throw new Error(`Rating missing for ${id}`);
          return { row, rating: idleRating(rules.glicko, row, (now - row.lastPlayedAt) / DAY_MS) };
        };
        const a = before(challengerId);
        const b = before(opponentId);
        const score = outcome === "challenger" ? 1 : outcome === "opponent" ? 0 : 0.5;
        const nextA = rateGlicko(rules.glicko, a.rating, [{ opponent: b.rating, score }]);
        const nextB = rateGlicko(rules.glicko, b.rating, [
          { opponent: a.rating, score: (1 - score) as 0 | 0.5 | 1 },
        ]);
        for (const [userId, next, games] of [
          [challengerId, nextA, a.row.games],
          [opponentId, nextB, b.row.games],
        ] as const) {
          await tx
            .update(joustRatings)
            .set({
              rating: next.rating,
              deviation: next.deviation,
              volatility: next.volatility,
              games: games + 1,
              lastPlayedAt: new Date(now),
            })
            .where(eq(joustRatings.userId, userId));
        }
        changes.ratings = {
          challenger: { before: a.rating.rating, after: nextA.rating },
          opponent: { before: b.rating.rating, after: nextB.rating },
        };
        changes.points = await applyPoints(tx, { challengerId, opponentId, outcome, now });
      }
    }

    if (Object.keys(changes).length === 0) return NOTHING_SETTLED;
    await tx.update(jousts).set(changes).where(eq(jousts.id, joustId));

    const gainers = [...gains].filter(([, xp]) => xp > 0);
    const levelUps: string[] = [];
    if (gainers.length > 0) {
      const before = new Map<string, number>();
      for (const [userId] of gainers) before.set(userId, await readXp(tx, userId));
      const added = addXpToPlayers(
        tx,
        "joust_xp",
        gainers.map(([userId, amount]) => ({ userId, amount })),
      );
      await tx.with(added).select().from(added);
      for (const [userId, xp] of gainers) {
        const was = before.get(userId) ?? 0;
        if (levelOf(was + xp).level > levelOf(was).level) levelUps.push(userId);
      }
    }
    return { changed: true, levelUps };
  });
}

/** Open jousts of the player that time may have closed: settled before they are read. */
async function settleDue(db: Database, userId: string, now: EpochMs): Promise<SettledJousts> {
  const rules = rulesAt(now);
  const due = await db.execute<{ id: string }>(sql`
    select id from jousts
    where (challenger_id = ${userId} or opponent_id = ${userId}) and ended_at is null
      and ((challenger_done_at is null and created_at <= ${new Date(now - rules.runMs)})
        or (challenger_done_at is not null and opponent_started_at is null
          and reply_by <= ${new Date(now)})
        or (opponent_done_at is null and opponent_started_at <= ${new Date(now - rules.runMs)}))`);
  return settleMany(
    db,
    due.rows.map((row) => row.id),
    now,
  );
}

export interface SettledJousts extends SettleReport {
  readonly joustIds: readonly string[];
}

const NONE_SETTLED: SettledJousts = { ...NOTHING_SETTLED, joustIds: [] };

async function settleMany(
  db: Database,
  joustIds: readonly string[],
  now: EpochMs,
): Promise<SettledJousts> {
  const levelUps = new Set<string>();
  const changed: string[] = [];
  for (const id of joustIds) {
    const report = await settleJoust(db, id, now);
    if (report.changed) changed.push(id);
    for (const userId of report.levelUps) levelUps.add(userId);
  }
  return { changed: changed.length > 0, levelUps: [...levelUps], joustIds: changed };
}

/** The daily sweep: jousts whose reply time passed while neither player came by. */
export async function settleExpired(
  db: Database,
  now: EpochMs,
  limit = 200,
): Promise<SettledJousts> {
  const rules = rulesAt(now);
  const due = await db.execute<{ id: string }>(sql`
    select id from jousts
    where ended_at is null
      and (reply_by <= ${new Date(now)}
        or (challenger_done_at is null and created_at <= ${new Date(now - rules.runMs)})
        or opponent_started_at <= ${new Date(now - rules.runMs)})
    order by reply_by nulls first
    limit ${limit}`);
  return settleMany(
    db,
    due.rows.map((row) => row.id),
    now,
  );
}

// --- Reading -------------------------------------------------------------------------------------

function stateFor(joust: JoustRow, role: Role): JoustSummary["state"] {
  if (joust.endedAt !== null) return "ended";
  if (role === "challenger") return joust.challengerDoneAt === null ? "play" : "waiting";
  return joust.opponentDoneAt === null ? "play" : "waiting";
}

function outcomeFor(joust: JoustRow, role: Role): JoustSummary["outcome"] {
  if (joust.outcome === null) return null;
  if (joust.outcome === "draw") return "draw";
  return joust.outcome === role ? "won" : "lost";
}

function scoreOf(correct: number | null, ms: number | null) {
  return correct === null || ms === null ? null : { correct, ms };
}

function summaryOf(
  joust: JoustRow,
  role: Role,
  badges: ReadonlyMap<string, PlayerBadge>,
): JoustSummary {
  const otherId = role === "challenger" ? joust.opponentId : joust.challengerId;
  const challenger = scoreOf(joust.challengerCorrect, joust.challengerMs);
  const opponent = scoreOf(joust.opponentCorrect, joust.opponentMs);
  const ended = joust.endedAt !== null;
  return {
    id: joust.id,
    kind: joust.kind,
    launched: role === "challenger",
    opponent: badges.get(otherId) ?? null,
    state: stateFor(joust, role),
    replyBy: joust.replyBy?.toISOString() ?? null,
    outcome: outcomeFor(joust, role),
    forfeit: joust.forfeit,
    mine: role === "challenger" ? challenger : opponent,
    // The other's score shows once the joust ends: the second player meets it as they play.
    theirs: ended ? (role === "challenger" ? opponent : challenger) : null,
    createdAt: joust.createdAt.toISOString(),
    seen:
      !ended || (role === "challenger" ? joust.challengerSeenAt : joust.opponentSeenAt) !== null,
  };
}

/** `GET /jousts`: access, the deck's state, and the player's open and recent jousts. */
export async function listJousts(
  db: Database,
  userId: string,
  catalog: CatalogIndex,
  now: EpochMs,
): Promise<{ readonly response: JoustsResponse; readonly settled: SettledJousts }> {
  const rules = rulesAt(now);
  const access = await readAccess(db, userId, now);
  const settled = access === "account_required" ? NONE_SETTLED : await settleDue(db, userId, now);
  const saved = await readSavedDeck(db, userId);
  const deck = deckOf(rules, saved, await readCandidates(db, userId, catalog));
  const [guide] = await db
    .select({ doneAt: players.joustGuideDoneAt })
    .from(players)
    .where(eq(players.userId, userId));
  const open = await db.execute<{ id: string }>(sql`
    (select id, created_at from jousts
      where (challenger_id = ${userId}
          or (opponent_id = ${userId} and challenger_done_at is not null))
        and ended_at is null)
    union all
    (select id, created_at from jousts
      where (challenger_id = ${userId} or opponent_id = ${userId}) and ended_at is not null
      order by ended_at desc limit ${ENDED_LISTED})
    order by created_at desc`);
  const ids = open.rows.map((row) => row.id);
  const rows =
    ids.length === 0
      ? []
      : await db
          .select()
          .from(jousts)
          .where(
            sql`${jousts.id} in (${sql.join(
              ids.map((id) => sql`${id}`),
              sql`, `,
            )})`,
          );
  const byId = new Map(rows.map((row) => [row.id, row]));
  const ordered = ids.flatMap((id) => {
    const row = byId.get(id);
    return row === undefined ? [] : [row];
  });
  const badges = await readBadges(
    db,
    ordered.flatMap((row) => [row.challengerId, row.opponentId]),
    now,
  );
  const summaries = ordered.flatMap((row) => {
    const role = roleIn(row, userId);
    return role === null ? [] : [summaryOf(row, role, badges)];
  });
  return {
    response: {
      access,
      opensAtLevel: opensAtLevel(now),
      deckReady: deck.length >= rules.drawn,
      deckSaved: saved !== null,
      guideDone: guide?.doneAt != null,
      waiting: ordered.filter((row) => row.challengerId === userId && row.endedAt === null).length,
      maxWaiting: rules.maxWaiting,
      answerSeconds: Math.round(rules.answerMs / 1000),
      questions: rules.drawn,
      jousts: summaries,
      standing: await readStanding(db, userId, now),
    },
    settled,
  };
}

/** `GET /jousts/:id`: the joust as the player may see it now, settled first. */
export async function readJoust(
  db: Database,
  input: { readonly userId: string; readonly joustId: string; readonly now: EpochMs },
): Promise<{ readonly view: JoustView; readonly settled: SettleReport } | null> {
  const { userId, joustId, now } = input;
  const rules = rulesAt(now);
  const [first] = await db.select().from(jousts).where(eq(jousts.id, joustId));
  if (first === undefined || roleIn(first, userId) === null) return null;
  const settled = first.endedAt === null ? await settleJoust(db, joustId, now) : NOTHING_SETTLED;
  const [joust] = settled.changed
    ? await db.select().from(jousts).where(eq(jousts.id, joustId))
    : [first];
  const role = joust === undefined ? null : roleIn(joust, userId);
  if (joust === undefined || role === null) return null;
  if (role === "opponent" && joust.challengerDoneAt === null) return null;

  const otherId = role === "challenger" ? joust.opponentId : joust.challengerId;
  const mine = await runQuestions(db, joustId, userId);
  const theirs = await runQuestions(db, joustId, otherId);
  const badges = await readBadges(db, [otherId], now);
  const answerOf = (q: QuestionRow) => ({
    cardId: q.cardId,
    chosenCardId: q.chosenCardId,
    correct: q.correct === true,
    ms: answerTime(rules, toRunAnswer(q)),
  });
  const ended = joust.endedAt !== null;
  const closed = runClosed(joust, role);
  const ghost =
    role === "opponent" && !joust.forfeit
      ? theirs.map((q) => ({ correct: q.correct === true, ms: answerTime(rules, toRunAnswer(q)) }))
      : null;
  return {
    view: {
      summary: summaryOf(joust, role, badges),
      ghost,
      ghostPlayedAt: role === "opponent" ? (joust.challengerDoneAt?.toISOString() ?? null) : null,
      answered: mine.filter((q) => q.answeredAt !== null).length,
      run: closed
        ? {
            answers: mine.map(answerOf),
            // With the win's, once ended.
            xp: role === "challenger" ? joust.challengerXp : joust.opponentXp,
          }
        : null,
      traps: closed ? theirs.map((q) => q.cardId) : null,
      result: ended
        ? {
            mine: mine.map(answerOf),
            theirs: theirs.map(answerOf),
            xp: role === "challenger" ? joust.challengerXp : joust.opponentXp,
            boosters: role === "challenger" ? joust.challengerBoosters : joust.opponentBoosters,
            tournament:
              joust.points === null || joust.endedAt === null
                ? null
                : await tournamentView(db, {
                    userId,
                    won: joust.points[role],
                    endedAt: joust.endedAt.getTime(),
                    now,
                  }),
          }
        : null,
    },
    settled,
  };
}

/** `POST /jousts/guide`: the first visit is done; the first time stays. */
export async function markGuideDone(db: Database, userId: string, now: EpochMs): Promise<void> {
  await db
    .update(players)
    .set({ joustGuideDoneAt: sql`coalesce(${players.joustGuideDoneAt}, ${new Date(now)})` })
    .where(eq(players.userId, userId));
}

/** `POST /jousts/:id/seen`: the player watched the result of an ended joust; the first time stays. */
export async function markSeen(
  db: Database,
  input: { readonly userId: string; readonly joustId: string; readonly now: EpochMs },
): Promise<"seen" | "not_found"> {
  const { userId, joustId, now } = input;
  const at = new Date(now);
  const result = await db.execute(sql`
    update jousts set
      challenger_seen_at = case when challenger_id = ${userId}
        then coalesce(challenger_seen_at, ${at}) else challenger_seen_at end,
      opponent_seen_at = case when opponent_id = ${userId}
        then coalesce(opponent_seen_at, ${at}) else opponent_seen_at end
    where id = ${joustId} and ended_at is not null
      and (challenger_id = ${userId} or opponent_id = ${userId})
    returning id`);
  return result.rows.length > 0 ? "seen" : "not_found";
}

/** `GET /jousts/opponents`: friends and clan members who may joust now. */
export async function listOpponents(
  db: Database,
  userId: string,
  now: EpochMs,
): Promise<JoustOpponentsResponse> {
  const rules = rulesAt(now);
  const result = await db.execute<{ user_id: string }>(sql`
    select distinct other.id as user_id from (
      select friend_id as id from friendships where user_id = ${userId}
      union
      select m2.user_id from clan_members m1 join clan_members m2 on m2.clan_id = m1.clan_id
        where m1.user_id = ${userId} and m2.user_id <> ${userId}
    ) other
    where ${canJoust(sql`other.id`, rules, now)} and not ${blockedBetween(sql`other.id`, userId)}`);
  const ids = result.rows.map((row) => row.user_id);
  const badges = await readBadges(db, ids, now);
  const players = ids
    .flatMap((id) => {
      const badge = badges.get(id);
      return badge === undefined ? [] : [badge];
    })
    .sort((a, b) => (a.pseudo ?? a.code).localeCompare(b.pseudo ?? b.code, "fr"));
  return { players };
}
