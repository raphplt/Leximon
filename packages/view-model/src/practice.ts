import type {
  AnswerBonus,
  ChallengeQuestion,
  MasteryLevelCode,
  PracticeScope,
  PracticeSummaryResponse,
} from "@leximon/contract";
import { PRACTICE_MAX_CARDS, PRACTICE_SCHEDULE, practiceRulesAt } from "@leximon/core";
import type { AlbumState, AlbumView } from "./album";
import { themeLabel } from "./album";
import type { AnsweredQuestion } from "./challenges";
import { type PackNoun, SACHET_NOUN } from "./format";

/** A question of a series; a free practice word has `counted: false`. */
export type SessionQuestion = ChallengeQuestion & { readonly counted?: boolean };

export const PRACTICE_RULE =
  "Les mots à revoir comptent pour ta mémoire, les autres servent à t'entraîner.";

/** Under a word that is not due: why this answer will change nothing but the XP. */
export const PRACTICE_FREE_HINT = "Ce mot n'est pas à revoir : cette question sert à t'entraîner.";

export const PRACTICE_REFUSED = "Cette série n'est plus disponible. Choisis-en une autre.";

export const PRACTICE_THEMES_CLOSED =
  "Les révisions par thème et depuis l'album s'ouvrent au niveau 3.";

export function practiceEmptyLine(minWords: number, noun: PackNoun = SACHET_NOUN): string {
  return `Il te faut au moins ${minWords} mots pour t'entraîner. Ouvre un ${noun.one} pour en trouver.`;
}

export interface PracticeChoice {
  readonly key: string;
  readonly scope: PracticeScope;
  readonly label: string;
  /** « 12 mots, dont 3 à revoir » */
  readonly detail: string;
}

export interface PracticeView {
  readonly mine: readonly PracticeChoice[];
  readonly collections: readonly PracticeChoice[];
  /** Empty while the level has not opened them. */
  readonly themes: readonly PracticeChoice[];
  readonly xpLine: string;
}

function scopeKey(scope: PracticeScope): string {
  return "id" in scope ? `${scope.kind}-${scope.id}` : scope.kind;
}

function scopeLabel(scope: PracticeScope, collectionName: (id: string) => string): string {
  switch (scope.kind) {
    case "collection":
      return collectionName(scope.id);
    case "theme":
      return themeLabel(scope.id);
    case "missed":
      return "Mes mots ratés";
    case "recent":
      return "Mes mots récents";
    case "cards":
      return "Mes mots filtrés";
  }
}

function practiceDetail(words: number, due: number): string {
  return due === 0 ? `${words} mots` : `${words} mots, dont ${due} à revoir`;
}

function practiceXpLine(xp: PracticeSummaryResponse["xp"], now: number): string {
  const { xpPerAnswer } = practiceRulesAt(PRACTICE_SCHEDULE, now);
  if (xp.today >= xp.cap) {
    return `Tu as atteint les ${xp.cap} XP d'entraînement du jour. Les mots à revoir rapportent toujours leur XP.`;
  }
  if (xp.today > 0) {
    return `Tu as gagné ${xp.today} XP d'entraînement aujourd'hui, sur ${xp.cap} au plus.`;
  }
  return `Une bonne réponse d'entraînement rapporte ${xpPerAnswer} XP, ${xp.cap} XP par jour au plus.`;
}

/** The series on offer, by family, and what today's practice has earned. */
export function practiceView(
  summary: PracticeSummaryResponse,
  collectionName: (id: string) => string,
  themesOpen: boolean,
  now: number,
): PracticeView {
  const choices = summary.scopes.map(({ scope, words, due }) => ({
    key: scopeKey(scope),
    scope,
    label: scopeLabel(scope, collectionName),
    detail: practiceDetail(words, due),
  }));
  const ofKind = (...kinds: PracticeScope["kind"][]) =>
    choices.filter(({ scope }) => kinds.includes(scope.kind));
  return {
    mine: ofKind("missed", "recent"),
    collections: ofKind("collection"),
    themes: themesOpen ? ofKind("theme") : [],
    xpLine: practiceXpLine(summary.xp, now),
  };
}

/** A free practice answer in the shape of a review: it wins no level and no bonus. */
export function freeAnswerOutcome(level: MasteryLevelCode): {
  readonly slip: false;
  readonly level: MasteryLevelCode;
  readonly levelUp: false;
  readonly bonus: AnswerBonus;
} {
  return {
    slip: false,
    level,
    levelUp: false,
    bonus: { daily: 0, gilded: 0, credited: 0, reserve: 0 },
  };
}

/** The clan's goal only sees the answers that count, not free practice. */
export function clanAnswers(answers: readonly AnsweredQuestion[]): number {
  return answers.filter((answer) => answer.correct && answer.free !== true).length;
}

/** The words of an album filter, worth a series: never the whole album, never a search. */
export function albumPracticeCards(
  view: AlbumView,
  state: AlbumState,
  minWords: number,
): readonly string[] | null {
  const filtered = state.rarity !== null || state.theme !== null || state.filter !== "all";
  if (!filtered || view.searching || (state.compare ?? null) !== null) return null;
  const owned = view.items.filter((item) => item.kind === "owned");
  if (owned.length < minWords) return null;
  return owned.slice(0, PRACTICE_MAX_CARDS).map((item) => item.card.id);
}
