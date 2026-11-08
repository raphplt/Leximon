/**
 * Jousts: two players face each other on the words of their decks, one after the other, each
 * question on the clock. Each player keeps a deck of cards whose word they found at least once;
 * a joust draws a few cards from each deck, and each player finds the words of the other's cards
 * from their definition, among a few words of the same collection and rarity.
 */

import { type Rarity, rarityRank } from "../booster/rarity";
import type { EpochMs } from "../booster/refill";
import type { WordClass } from "../mastery/challenge";
import { MASTERY_LEVELS, type MasteryLevel } from "../mastery/mastery";
import { type RandomSource, randomInt } from "../random";
import type { GlickoRules } from "./glicko";

export const JOUST_KINDS = ["ranked", "free", "friendly"] as const;
export type JoustKind = (typeof JOUST_KINDS)[number];

export interface JoustRules {
  readonly startsAt: EpochMs;
  /** Until then, only the players opened from the back office joust. */
  readonly openToAll: boolean;
  readonly deckSize: number;
  /** Cards drawn from each deck for one joust: the fewest a deck may hold. */
  readonly drawn: number;
  /** Points a deck may spend on its cards' rarities. */
  readonly deckBudget: number;
  readonly cost: Readonly<Record<Rarity, number>>;
  /** A card enters a deck once its word reached this level. */
  readonly minimumMastery: MasteryLevel;
  /** Words offered for one question, the right one included. */
  readonly choices: number;
  readonly answerMs: number;
  /** Allowance for the network on top of `answerMs`: an answer sent in time is never refused. */
  readonly graceMs: number;
  /** Once a player's first question is served, their run ends this long after, done or not. */
  readonly runMs: number;
  /** The second player's time to play, from the end of the first player's run. */
  readonly replyMs: number;
  /** Jousts a player may have launched and waiting for their opponent. */
  readonly maxWaiting: number;
  /** A ranked opponent has fewer jousts than this left to play. */
  readonly maxToPlay: number;
  /** A ranked opponent came by this recently. */
  readonly seenWithinMs: number;
  /** Two players meet in a ranked joust once in this window. */
  readonly pairCooldownMs: number;
  readonly xpPlayed: number;
  readonly xpWon: number;
  /** Jousts that give their rewards in one day (Paris time). */
  readonly rewardedPerDay: number;
  /** Bonus sachets of the first joust won in a day. */
  readonly firstWinBoosters: number;
  readonly glicko: GlickoRules;
}

export type JoustSchedule = readonly [JoustRules, ...JoustRules[]];

export function joustRulesAt(schedule: JoustSchedule, time: EpochMs): JoustRules {
  let active = schedule[0];
  for (const rules of schedule) {
    if (rules.startsAt > time) break;
    active = rules;
  }
  return active;
}

// --- The deck ------------------------------------------------------------------------------------

/** A card the player could put in a deck: owned, with the level of its word. */
export interface DeckCandidate {
  readonly cardId: string;
  readonly rarity: Rarity;
  readonly level: MasteryLevel;
}

export function deckCost(rules: JoustRules, rarities: readonly Rarity[]): number {
  return rarities.reduce((total, rarity) => total + rules.cost[rarity], 0);
}

export function canEnterDeck(rules: JoustRules, level: MasteryLevel): boolean {
  return MASTERY_LEVELS.indexOf(level) >= MASTERY_LEVELS.indexOf(rules.minimumMastery);
}

export type DeckProblem = "too_few" | "too_many" | "duplicate" | "not_eligible" | "over_budget";

/** Why the deck `cardIds` cannot be kept, or `null` when it can. */
export function deckProblem(
  rules: JoustRules,
  cardIds: readonly string[],
  candidates: readonly DeckCandidate[],
): DeckProblem | null {
  if (cardIds.length < rules.drawn) return "too_few";
  if (cardIds.length > rules.deckSize) return "too_many";
  if (new Set(cardIds).size !== cardIds.length) return "duplicate";
  const byId = new Map(candidates.map((candidate) => [candidate.cardId, candidate]));
  const cards = cardIds.map((id) => byId.get(id));
  const eligible = cards.filter(
    (card): card is DeckCandidate => card !== undefined && canEnterDeck(rules, card.level),
  );
  if (eligible.length !== cardIds.length) return "not_eligible";
  if (
    deckCost(
      rules,
      eligible.map((card) => card.rarity),
    ) > rules.deckBudget
  ) {
    return "over_budget";
  }
  return null;
}

function byCostThenId(rules: JoustRules) {
  return (a: DeckCandidate, b: DeckCandidate) =>
    rules.cost[a.rarity] - rules.cost[b.rarity] || (a.cardId < b.cardId ? -1 : 1);
}

/**
 * The deck the game makes: as many cards as it holds, the rarest words the budget allows, so that
 * a player who never opens the editor still sets good traps. `kept` stay in it when they still can.
 */
export function composeDeck(
  rules: JoustRules,
  candidates: readonly DeckCandidate[],
  kept: readonly string[] = [],
): readonly string[] {
  const eligible = candidates.filter((candidate) => canEnterDeck(rules, candidate.level));
  const byId = new Map(eligible.map((candidate) => [candidate.cardId, candidate]));
  const chosen: DeckCandidate[] = [];
  let spent = 0;
  for (const id of new Set(kept)) {
    const card = byId.get(id);
    if (card === undefined || chosen.length === rules.deckSize) continue;
    if (spent + rules.cost[card.rarity] > rules.deckBudget) continue;
    chosen.push(card);
    spent += rules.cost[card.rarity];
  }
  const keptIds = new Set(chosen.map((card) => card.cardId));
  const rest = eligible.filter((card) => !keptIds.has(card.cardId)).sort(byCostThenId(rules));

  // The cheapest words fill the deck, then each is traded for a rarer one while the budget allows.
  const added: DeckCandidate[] = [];
  for (const card of rest) {
    if (chosen.length + added.length === rules.deckSize) break;
    if (spent + rules.cost[card.rarity] > rules.deckBudget) break;
    added.push(card);
    spent += rules.cost[card.rarity];
  }
  const addedIds = new Set(added.map((card) => card.cardId));
  for (const card of [...rest].reverse()) {
    if (addedIds.has(card.cardId)) continue;
    const cheapest = added[0];
    if (cheapest === undefined) break;
    const gain = rules.cost[card.rarity] - rules.cost[cheapest.rarity];
    if (gain <= 0 || spent + gain > rules.deckBudget) continue;
    added.shift();
    addedIds.delete(cheapest.cardId);
    added.push(card);
    addedIds.add(card.cardId);
    added.sort(byCostThenId(rules));
    spent += gain;
  }
  return [...chosen, ...added].map((card) => card.cardId);
}

// --- The draw ------------------------------------------------------------------------------------

/** `count` distinct items of `items`, in a random order. */
export function drawDistinct<T>(random: RandomSource, items: readonly T[], count: number): T[] {
  const pool = [...items];
  const drawn: T[] = [];
  while (drawn.length < count && pool.length > 0) {
    const index = randomInt(random, pool.length);
    const [item] = pool.splice(index, 1);
    if (item !== undefined) drawn.push(item);
  }
  return drawn;
}

/** A card of the catalogue, as the choices of a question need it. */
export interface ChoiceCard {
  readonly id: string;
  readonly collectionId: string;
  readonly rarity: Rarity;
  /** `null` until a publication writes the card's part of speech. */
  readonly wordClass: WordClass | null;
}

/**
 * The words offered for the card `answer`, the right one among them, in a random order: words of
 * the same class, collection and rarity first, then of the same class and collection at the
 * nearest rarity, then of the same class anywhere, and only then of another class, so that a small
 * rarity or class still makes a full question.
 */
export function joustChoices(
  rules: JoustRules,
  random: RandomSource,
  answer: ChoiceCard,
  catalogue: readonly ChoiceCard[],
): readonly string[] {
  const others = catalogue.filter((card) => card.id !== answer.id);
  const distance = (card: ChoiceCard) =>
    (card.wordClass === answer.wordClass ? 0 : 100) +
    (card.collectionId === answer.collectionId ? 0 : 10) +
    Math.abs(rarityRank(card.rarity) - rarityRank(answer.rarity));
  const wrong: string[] = [];
  const needed = rules.choices - 1;
  const tiers = [...new Set(others.map(distance))].sort((a, b) => a - b);
  for (const tier of tiers) {
    if (wrong.length === needed) break;
    const pool = others.filter((card) => distance(card) === tier).map((card) => card.id);
    wrong.push(...drawDistinct(random, pool, needed - wrong.length));
  }
  return drawDistinct(random, [answer.id, ...wrong], wrong.length + 1);
}

// --- The run and its score -----------------------------------------------------------------------

/** One question of a player's run, as the server recorded it. */
export interface RunAnswer {
  readonly servedAt: EpochMs | null;
  readonly answeredAt: EpochMs | null;
  readonly correct: boolean;
}

/** Whether an answer arriving at `answeredAt` for a question served at `servedAt` still counts. */
export function answerInTime(rules: JoustRules, servedAt: EpochMs, answeredAt: EpochMs): boolean {
  return answeredAt - servedAt <= rules.answerMs + rules.graceMs;
}

/** The time a question took, as the score counts it: never more than the clock. */
export function answerTime(rules: JoustRules, answer: RunAnswer): number {
  if (answer.servedAt === null || answer.answeredAt === null) return rules.answerMs;
  return Math.max(0, Math.min(rules.answerMs, answer.answeredAt - answer.servedAt));
}

export interface RunScore {
  readonly correct: number;
  readonly ms: number;
}

/** Right answers and total time of a run; a question left without answer is wrong, on full time. */
export function runScore(rules: JoustRules, answers: readonly RunAnswer[]): RunScore {
  return answers.reduce<RunScore>(
    (score, answer) => ({
      correct: score.correct + (answer.correct && answer.answeredAt !== null ? 1 : 0),
      ms: score.ms + answerTime(rules, answer),
    }),
    { correct: 0, ms: 0 },
  );
}

/**
 * When a run is over: every question answered or left past its clock, or the run's time gone
 * since it started.
 */
export function runOver(
  rules: JoustRules,
  answers: readonly RunAnswer[],
  startedAt: EpochMs | null,
  now: EpochMs,
): boolean {
  const closed = (answer: RunAnswer) =>
    answer.answeredAt !== null ||
    (answer.servedAt !== null && !answerInTime(rules, answer.servedAt, now));
  if (answers.every(closed)) return true;
  return startedAt !== null && now >= startedAt + rules.runMs;
}

export type JoustOutcome = "challenger" | "opponent" | "draw";

/** More right answers wins; the shorter total time breaks a tie. */
export function joustOutcome(challenger: RunScore, opponent: RunScore): JoustOutcome {
  if (challenger.correct !== opponent.correct) {
    return challenger.correct > opponent.correct ? "challenger" : "opponent";
  }
  if (challenger.ms !== opponent.ms) return challenger.ms < opponent.ms ? "challenger" : "opponent";
  return "draw";
}

// --- Rewards -------------------------------------------------------------------------------------

/**
 * XP for playing a joust, given when the player's run ends, while the day's rewarded jousts are not
 * all used. A loss takes nothing.
 */
export function playedXp(rules: JoustRules, rewardedToday: number): number {
  return rewardedToday < rules.rewardedPerDay ? rules.xpPlayed : 0;
}

export interface WinReward {
  readonly xp: number;
  readonly boosters: number;
}

/**
 * What winning gives, once the joust ends: more XP when the joust was among the day's rewarded
 * ones, and bonus sachets for the first such win of the day.
 */
export function winReward(
  rules: JoustRules,
  input: { readonly rewarded: boolean; readonly wonToday: number },
): WinReward {
  if (!input.rewarded) return { xp: 0, boosters: 0 };
  return { xp: rules.xpWon, boosters: input.wonToday === 0 ? rules.firstWinBoosters : 0 };
}

// --- Traps and wishes ----------------------------------------------------------------------------

/**
 * The cards of a played run the answerer did not find: each one trapped them once. A run never
 * played (the joust given up) traps no one.
 */
export function trappedCards(
  questions: readonly { readonly cardId: string; readonly correct: boolean }[],
  played: boolean,
): string[] {
  if (!played) return [];
  return [...new Set(questions.filter((q) => !q.correct).map((q) => q.cardId))];
}

/** The words a player met in a joust without owning them: they go to their list of wishes. */
export function wishedCards(asked: readonly string[], owned: ReadonlySet<string>): string[] {
  return [...new Set(asked.filter((cardId) => !owned.has(cardId)))];
}
