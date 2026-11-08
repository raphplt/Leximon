import type {
  LevelCounts,
  ReviewQuestion,
  ReviewScope,
  ReviewSummaryResponse,
} from "@leximon/contract";
import {
  buildQuestion,
  closeChoicePools,
  createSeededRandom,
  type EpochMs,
  endsWithPairs,
  type FormatChoices,
  gameDayOf,
  levelOf,
  levelUpPossible,
  MASTERY_SCHEDULE,
  type MasteryRules,
  masteryRulesAt,
  normalizeWord,
  otherChoiceFormat,
  PRACTICE_SCHEDULE,
  type PracticeRules,
  pairsCards,
  pickDistinct,
  pickFormat,
  planReview,
  practiceRulesAt,
  type QuizFormat,
  type RandomSource,
  type ReviewDifficulty,
  recallProbability,
  UNLOCK_SCHEDULE,
  unlockRulesAt,
} from "@leximon/core";
import type { Database } from "@leximon/db";
import { readPreferences } from "../profile/profile";
import { readXp } from "../progress/progress";
import { readStreak } from "../progress/streak";
import { type CatalogIndex, choicePools } from "./catalog-index";
import {
  countsAsReview,
  inScope,
  missedWords,
  ownedWords,
  type PoolWord,
  practiceXpToday,
  scopeChoicePools,
  scopeLevel,
} from "./practice";

interface Settings extends FormatChoices {
  readonly length: number;
  readonly newWordsPerDay: number;
  readonly pairs: boolean;
}

/** The player's settings, kept to what the rules in force allow. */
function settingsOf(
  rules: PracticeRules,
  preferences: {
    readonly reviewLength: number;
    readonly newWordsPerDay: number;
    readonly reviewListen: boolean;
    readonly reviewPairs: boolean;
    readonly reviewDifficulty: ReviewDifficulty;
  },
): Settings {
  return {
    length: rules.lengths.includes(preferences.reviewLength)
      ? preferences.reviewLength
      : rules.seriesSize,
    newWordsPerDay: rules.newWordsPerDay.includes(preferences.newWordsPerDay)
      ? preferences.newWordsPerDay
      : rules.defaultNewWordsPerDay,
    listen: preferences.reviewListen,
    pairs: preferences.reviewPairs,
    difficulty: preferences.reviewDifficulty,
  };
}

/** New words the player may still start today, Paris time. */
function newWordsLeft(pool: readonly PoolWord[], perDay: number, now: EpochMs): number {
  const { start } = gameDayOf(now);
  const started = pool.filter((word) => word.startedAt !== null && word.startedAt >= start).length;
  return Math.max(0, perDay - started);
}

function isDueNow(word: PoolWord, now: EpochMs): boolean {
  return word.due !== null && word.due <= now;
}

function canRise(mastery: MasteryRules, catalog: CatalogIndex, word: PoolWord, now: EpochMs) {
  return (
    isDueNow(word, now) &&
    word.level !== null &&
    catalog.wordOf.has(word.cardId) &&
    levelUpPossible(mastery, word.level, word.lastReviewedAt, now)
  );
}

function levelCounts(words: readonly PoolWord[]): LevelCounts {
  const counts = { blank: 0, sketch: 0, ink: 0, gilded: 0 };
  for (const word of words) counts[word.level ?? "blank"] += 1;
  return counts;
}

/** The words of a scope; « rising » is the words due whose typed answer raises the level. */
function wordsOf(
  scope: ReviewScope,
  pool: readonly PoolWord[],
  catalog: CatalogIndex,
  missed: ReadonlySet<string>,
  rules: PracticeRules,
  mastery: MasteryRules,
  now: EpochMs,
): readonly PoolWord[] {
  return scope.kind === "rising"
    ? pool.filter((word) => canRise(mastery, catalog, word, now))
    : inScope(scope, pool, catalog, missed, rules);
}

/**
 * What waits for the player, their settings, and the scopes they can pick, in three reads: the
 * words owned with their memory, the words missed lately, the free practice XP of the day (the
 * preferences are a fourth, by primary key).
 */
export async function reviewSummary(
  db: Database,
  catalog: CatalogIndex,
  input: { userId: string; now: EpochMs },
): Promise<ReviewSummaryResponse> {
  const { userId, now } = input;
  const rules = practiceRulesAt(PRACTICE_SCHEDULE, now);
  const mastery = masteryRulesAt(MASTERY_SCHEDULE, now);
  const [pool, missed, xpToday, preferences, streak] = await Promise.all([
    ownedWords(db, userId),
    missedWords(db, userId, rules, now),
    practiceXpToday(db, userId, now),
    readPreferences(db, userId),
    readStreak(db, userId, now),
  ]);
  const settings = settingsOf(rules, preferences);
  const due = pool.filter((word) => isDueNow(word, now));
  const neverReviewed = pool.filter((word) => word.due === null).length;
  const upcoming = pool
    .flatMap((word) => (word.due !== null && word.due > now ? [word.due] : []))
    .reduce<EpochMs | null>(
      (soonest, at) => (soonest === null || at < soonest ? at : soonest),
      null,
    );

  const collections = [...new Set(pool.flatMap((w) => catalog.collectionOf.get(w.cardId) ?? []))];
  const themes = [...new Set(pool.flatMap((w) => catalog.themesOf.get(w.cardId) ?? []))];
  const candidates: ReviewScope[] = [
    { kind: "rising" },
    { kind: "missed" },
    { kind: "recent" },
    ...collections.map((id) => ({ kind: "collection" as const, id })),
    ...themes.map((id) => ({ kind: "theme" as const, id })),
  ];
  const scopes = candidates.flatMap((scope) => {
    const words = wordsOf(scope, pool, catalog, missed, rules, mastery, now);
    // The words ready to rise are asked typed: one is enough for a series.
    const enough = scope.kind === "rising" ? words.length > 0 : words.length >= rules.minWords;
    if (!enough) return [];
    return [
      {
        scope,
        words: words.length,
        due: words.filter((word) => isDueNow(word, now)).length,
        rising: words.filter((word) => canRise(mastery, catalog, word, now)).length,
        levels: levelCounts(words),
      },
    ];
  });

  return {
    due: due.length,
    fresh: Math.min(neverReviewed, newWordsLeft(pool, settings.newWordsPerDay, now)),
    rising: due.filter((word) => canRise(mastery, catalog, word, now)).length,
    nextDueAt: due.length === 0 && upcoming !== null ? new Date(upcoming).toISOString() : null,
    levels: levelCounts(pool),
    settings: {
      ...settings,
      lengths: [...rules.lengths],
      newWordsPerDayChoices: [...rules.newWordsPerDay],
    },
    scopes,
    xp: { today: xpToday, cap: rules.dailyXpCap },
    streak,
  };
}

export type ReviewSeries =
  | { readonly kind: "ready"; readonly questions: readonly ReviewQuestion[] }
  | { readonly kind: "level_required"; readonly level: number }
  | { readonly kind: "scope_too_small"; readonly minWords: number };

/**
 * Composes a review series (see `planReview`) and builds its questions. Reads only: nothing is
 * written until an answer arrives, so abandoning a series costs nothing.
 *
 * A word that can rise is asked typed; a new word, met right after its card, is asked its
 * definition; the others get a multiple choice of either format. Each question carries the same
 * word asked the other way round, for the client to ask again when it is missed.
 */
export async function startReview(
  db: Database,
  catalog: CatalogIndex,
  input: {
    userId: string;
    scope?: ReviewScope | undefined;
    length?: number | undefined;
    first?: string | undefined;
    now: EpochMs;
    seed: string;
  },
): Promise<ReviewSeries> {
  const { userId, scope, now } = input;
  if (scope !== undefined && scope.kind !== "rising") {
    const level = scopeLevel(scope, unlockRulesAt(UNLOCK_SCHEDULE, now));
    if (level > 1 && levelOf(await readXp(db, userId)).level < level) {
      return { kind: "level_required", level };
    }
  }
  const rules = practiceRulesAt(PRACTICE_SCHEDULE, now);
  const mastery = masteryRulesAt(MASTERY_SCHEDULE, now);
  const [pool, missed, preferences] = await Promise.all([
    ownedWords(db, userId),
    scope?.kind === "missed" ? missedWords(db, userId, rules, now) : new Set<string>(),
    readPreferences(db, userId),
  ]);
  const words =
    scope === undefined ? pool : wordsOf(scope, pool, catalog, missed, rules, mastery, now);
  if (scope !== undefined && scope.kind !== "rising" && words.length < rules.minWords) {
    return { kind: "scope_too_small", minWords: rules.minWords };
  }

  const settings = settingsOf(rules, preferences);
  const allowed = [...rules.lengths, rules.dailyChallengeLength];
  const size =
    input.length !== undefined && allowed.includes(input.length) ? input.length : settings.length;
  const byId = new Map(words.map((word) => [word.cardId, word]));
  const random = createSeededRandom(input.seed);
  const items = planReview(random, rules, {
    candidates: words.map((word) => ({
      cardId: word.cardId,
      due: word.due,
      obtainedAt: word.obtainedAt,
      recall: word.memory === null ? null : recallProbability(mastery, word.memory, now),
    })),
    now,
    size,
    newWordsLeft: newWordsLeft(pool, settings.newWordsPerDay, now),
    first: input.first,
  });

  const questions: ReviewQuestion[] = [];
  for (const item of items) {
    const word = byId.get(item.cardId);
    if (word === undefined) continue;
    const rising =
      item.counted && canRise(mastery, catalog, word, now) && countsAsReview(word, now);
    const question = buildReviewQuestion(random, rules, catalog, item, rising, settings, scope);
    if (question !== null) questions.push(question);
  }
  const last = questions.at(-1);
  if (settings.pairs && last !== undefined && endsWithPairs(rules, questions)) {
    const cards = pairsCards(
      random,
      rules,
      last.cardId,
      words.map((word) => word.cardId),
    );
    if (cards !== null) {
      questions[questions.length - 1] = {
        cardId: last.cardId,
        format: "pairs",
        cards: [...cards],
        definitions: pickDistinct(random, cards, cards.length),
        counted: false,
        fresh: false,
        retry: null,
      };
    }
  }
  return { kind: "ready", questions };
}

/** The theme a demanding question stays in: the theme reviewed, or else every theme of the card. */
function closeTheme(
  scope: ReviewScope | undefined,
  catalog: CatalogIndex,
  cardId: string,
): readonly string[] {
  if (scope?.kind === "theme") return catalog.byTheme.get(scope.id) ?? [];
  const themes = catalog.themesOf.get(cardId) ?? [];
  return [...new Set(themes.flatMap((theme) => catalog.byTheme.get(theme) ?? []))];
}

function buildReviewQuestion(
  random: RandomSource,
  rules: PracticeRules,
  catalog: CatalogIndex,
  item: { readonly cardId: string; readonly counted: boolean; readonly fresh: boolean },
  rising: boolean,
  choices: FormatChoices,
  scope: ReviewScope | undefined,
): ReviewQuestion | null {
  const { cardId, counted, fresh } = item;
  const format = pickFormat(random, rules, { counted, fresh, rising }, choices);
  const pools = choicePools(
    catalog,
    cardId,
    !counted && choices.difficulty === "hard"
      ? closeChoicePools(
          cardId,
          (id) => normalizeWord(catalog.wordOf.get(id) ?? "").slice(0, 1),
          closeTheme(scope, catalog, cardId),
        )
      : scopeChoicePools(scope, catalog),
  );
  const choice = (asked: QuizFormat) => buildQuestion(random, cardId, pools, asked);
  const other = otherChoiceFormat(format);
  const again = rules.catchUps > 0 ? choice(other) : null;
  const meta = {
    counted,
    fresh,
    retry: again === null ? null : { format: other, choices: [...again.choices] },
  };
  switch (format) {
    case "typed":
      return { cardId, format, ...meta };
    default: {
      const main = choice(format);
      return main === null ? null : { cardId, format, choices: [...main.choices], ...meta };
    }
  }
}
