import {
  type LevelCounts,
  MASTERY_LEVEL_LABELS,
  type MasteryLevelCode,
  type ReviewQuestion,
  type ReviewScope,
  type ReviewSummaryResponse,
} from "@leximon/contract";
import { PRACTICE_SCHEDULE, practiceRulesAt } from "@leximon/core";
import { themeLabel } from "./album";
import { type AnsweredQuestion, nextDueLabel } from "./challenges";
import { type PackNoun, SACHET_NOUN } from "./format";

/** Past this many words to review, the line stops detailing them: the most urgent go first. */
const BACKLOG = 50;

/** Seconds a question takes, to estimate a series: a multiple choice, a word to type. */
const CHOICE_SECONDS = 15;
const TYPED_SECONDS = 25;

function plural(count: number, one: string, many: string): string {
  return count > 1 ? many : one;
}

// --- What waits ---------------------------------------------------------------------

export interface ReviewWell {
  readonly key: "due" | "fresh" | "rising";
  readonly figure: number;
  /** « à revoir », « nouveaux », « peuvent monter » */
  readonly label: string;
  /** The words that can rise shine in gold. */
  readonly gilt: boolean;
}

/** The three counters of the review, like Anki's three figures. */
export function reviewWells(summary: ReviewSummaryResponse): readonly ReviewWell[] {
  return [
    { key: "due", figure: summary.due, label: "à revoir", gilt: false },
    {
      key: "fresh",
      figure: summary.fresh,
      label: plural(summary.fresh, "nouveau", "nouveaux"),
      gilt: false,
    },
    {
      key: "rising",
      figure: summary.rising,
      label: plural(summary.rising, "peut monter", "peuvent monter"),
      gilt: summary.rising > 0,
    },
  ];
}

function ownedWords(levels: LevelCounts): number {
  return levels.blank + levels.sketch + levels.ink + levels.gilded;
}

/**
 * The counters said in a sentence: « 12 mots sont à revoir, dont 2 peuvent monter d'un palier.
 * 5 nouveaux mots attendent leur première question. »
 */
export function reviewLine(
  summary: ReviewSummaryResponse,
  now: number,
  noun: PackNoun = SACHET_NOUN,
): string {
  const { due, fresh, rising } = summary;
  if (ownedWords(summary.levels) === 0) {
    return `Ouvre des ${noun.many} pour trouver tes premiers mots.`;
  }
  if (due === 0 && fresh === 0) {
    const next = nextDueLabel(summary.nextDueAt, now);
    const comeback = next === null ? "" : ` Le prochain revient ${next}.`;
    return `Tes mots tiennent bon.${comeback} Tu peux t'entraîner en attendant.`;
  }
  const lines: string[] = [];
  if (due >= BACKLOG) {
    lines.push(`${due} mots sont à revoir. Les plus urgents passent d'abord.`);
  } else if (due > 0) {
    const words = due > 1 ? `${due} mots sont à revoir` : "1 mot est à revoir";
    const climb =
      rising === 0
        ? ""
        : `, dont ${rising} ${plural(rising, "peut", "peuvent")} monter d'un palier`;
    lines.push(`${words}${climb}.`);
  }
  if (fresh > 0) {
    lines.push(
      fresh > 1
        ? `${fresh} nouveaux mots attendent leur première question.`
        : "1 nouveau mot attend sa première question.",
    );
  }
  return lines.join(" ");
}

export interface ReviewAction {
  /** « Commencer », or « S'entraîner » when nothing waits. */
  readonly label: string;
  /** The length of the series, shown at the end of the button. */
  readonly count: number;
  /** « 10 questions, environ 3 minutes » */
  readonly estimate: string;
  /** Nothing owned yet: there is nothing to ask. */
  readonly disabled: boolean;
}

function minutes(seconds: number): string {
  const count = Math.max(1, Math.round(seconds / 60));
  return `environ ${count} minute${count > 1 ? "s" : ""}`;
}

/** The gold button of the review and the estimate under it. */
export function reviewAction(summary: ReviewSummaryResponse): ReviewAction {
  const { length } = summary.settings;
  const waiting = summary.due + summary.fresh > 0;
  const typed = Math.min(summary.rising, length);
  const time = minutes(typed * TYPED_SECONDS + (length - typed) * CHOICE_SECONDS);
  return {
    label: waiting ? "Commencer" : "S'entraîner",
    count: length,
    estimate: waiting
      ? `${length} questions, ${time}`
      : `${length} questions sur tes mots les plus fragiles, ${time}`,
    disabled: ownedWords(summary.levels) === 0,
  };
}

// --- Settings -----------------------------------------------------------------------

export interface SettingOption {
  readonly value: number;
  readonly label: string;
}

export const REVIEW_SETTINGS_TITLE = "Régler la révision";
export const REVIEW_LENGTH_TITLE = "Questions par révision";
export const REVIEW_PACE_TITLE = "Mots nouveaux par jour";
export const REVIEW_PACE_NOTE =
  "Les autres mots attendent leur tour dans l'album, sans rien perdre. Tu peux t'entraîner sur tous tes mots.";

export function lengthOptions(summary: ReviewSummaryResponse): readonly SettingOption[] {
  return summary.settings.lengths.map((value) => ({ value, label: `${value} questions` }));
}

export function paceOptions(summary: ReviewSummaryResponse): readonly SettingOption[] {
  return summary.settings.newWordsPerDayChoices.map((value) => ({
    value,
    label: `${value} par jour`,
  }));
}

export const REVIEW_FORMATS_TITLE = "Types de questions";
export const REVIEW_FORMATS_NOTE =
  "Les deux QCM et le mot à écrire restent toujours. Sans le son, l'écoute devient un QCM.";
export const REVIEW_DIFFICULTY_TITLE = "Entraînement";
export const REVIEW_DIFFICULTY_NOTE =
  "Exigeant fait souvent écrire le mot et rapproche les mauvais choix, sur les questions d'entraînement seulement. Une révision qui compte ne change pas.";
export const REVIEW_SOUND_LABEL = "Dire le mot à voix haute";

export type FormatSetting = "listen" | "pairs";

export interface FormatOption {
  readonly key: FormatSetting;
  readonly label: string;
  readonly on: boolean;
}

export function formatOptions(summary: ReviewSummaryResponse): readonly FormatOption[] {
  const { settings } = summary;
  return [
    { key: "listen", label: "Le mot seulement entendu", on: settings.listen },
    { key: "pairs", label: "Les paires en fin de série", on: settings.pairs },
  ];
}

/** The preference each format option writes. */
export const FORMAT_PREFERENCE = {
  listen: "reviewListen",
  pairs: "reviewPairs",
} as const satisfies Record<FormatSetting, string>;

export interface DifficultyOption {
  readonly value: ReviewSummaryResponse["settings"]["difficulty"];
  readonly label: string;
}

export const DIFFICULTY_OPTIONS: readonly DifficultyOption[] = [
  { value: "normal", label: "Normal" },
  { value: "hard", label: "Exigeant" },
];

// --- The streak ---------------------------------------------------------------------

/**
 * The days played first, then the streak, never a word about losing it: « 12 jours joués, dont 5
 * à la suite. » `null` before the first day.
 */
export function streakLine(streak: ReviewSummaryResponse["streak"]): string | null {
  if (streak.total === 0) return null;
  const total = `${streak.total} ${plural(streak.total, "jour joué", "jours joués")}`;
  if (streak.current < 2) return `${total}.`;
  return streak.current === streak.total
    ? `${total}, tous à la suite.`
    : `${total}, dont ${streak.current} à la suite.`;
}

// --- The shelf of scopes ------------------------------------------------------------

export type CoverKind = "rising" | "missed" | "recent" | "collection" | "theme";

export interface ReviewCover {
  readonly key: string;
  readonly kind: CoverKind;
  readonly scope: ReviewScope;
  readonly name: string;
  /** « 48 mots » */
  readonly words: string;
  /** Words to review now, for the badge; 0 shows none. */
  readonly due: number;
  readonly levels: LevelCounts;
  /** The level that opens it, while it stays closed. */
  readonly lockedAt: number | null;
  /** What a touch says: « 10 questions ». */
  readonly go: string;
}

export interface ReviewShelf {
  /** Ready to rise, missed, recent. */
  readonly shortcuts: readonly ReviewCover[];
  readonly collections: readonly ReviewCover[];
  readonly themes: readonly ReviewCover[];
}

function scopeKey(scope: ReviewScope): string {
  return "id" in scope ? `${scope.kind}-${scope.id}` : scope.kind;
}

function scopeName(scope: ReviewScope, collectionName: (id: string) => string): string {
  switch (scope.kind) {
    case "rising":
      return "Prêts à monter";
    case "missed":
      return "Mes mots ratés";
    case "recent":
      return "Mes mots récents";
    case "collection":
      return collectionName(scope.id);
    case "theme":
      return themeLabel(scope.id);
    case "cards":
      return "Mes mots filtrés";
  }
}

/**
 * The scopes as book covers, by shelf. Themes open at `themesLevel`; `null` once they are open.
 * The words ready to rise come first: each right answer there raises a card.
 */
export function reviewShelf(
  summary: ReviewSummaryResponse,
  collectionName: (id: string) => string,
  themesLevel: number | null,
): ReviewShelf {
  const covers = summary.scopes.flatMap(({ scope, words, due, levels }): ReviewCover[] =>
    scope.kind === "cards"
      ? []
      : [
          {
            key: scopeKey(scope),
            kind: scope.kind,
            scope,
            name: scopeName(scope, collectionName),
            words: `${words} ${plural(words, "mot", "mots")}`,
            due,
            levels,
            lockedAt: scope.kind === "theme" ? themesLevel : null,
            go: `${Math.min(words, summary.settings.length)} ${plural(Math.min(words, summary.settings.length), "question", "questions")}`,
          },
        ],
  );
  const ofKind = (...kinds: CoverKind[]) => covers.filter((cover) => kinds.includes(cover.kind));
  return {
    shortcuts: ofKind("rising", "missed", "recent").sort(
      (a, b) =>
        ["rising", "missed", "recent"].indexOf(a.kind) -
        ["rising", "missed", "recent"].indexOf(b.kind),
    ),
    collections: ofKind("collection"),
    themes: ofKind("theme").sort((a, b) => a.name.localeCompare(b.name, "fr")),
  };
}

/** Under the shelf: what free practice earns today. */
export function shelfXpLine(summary: ReviewSummaryResponse, now: number): string {
  const { today, cap } = summary.xp;
  const { xpPerAnswer } = practiceRulesAt(PRACTICE_SCHEDULE, now);
  if (today >= cap) {
    return `Tu as atteint les ${cap} XP d'entraînement du jour. Les mots à revoir rapportent toujours leur XP.`;
  }
  return `Une bonne réponse d'entraînement rapporte ${xpPerAnswer} XP, ${cap} XP par jour au plus. Elle compte pour le défi du jour.`;
}

// --- Ta mémoire ---------------------------------------------------------------------

export interface MemoryPart {
  readonly level: MasteryLevelCode;
  readonly label: string;
  readonly count: number;
  /** Share of the owned words, 0 to 1. */
  readonly share: number;
}

const LEVEL_ORDER: readonly MasteryLevelCode[] = ["blank", "sketch", "ink", "gilded"];

/** The owned words by level, from the blank page to the gilding. */
export function memoryParts(levels: LevelCounts): readonly MemoryPart[] {
  const total = ownedWords(levels);
  return LEVEL_ORDER.map((level) => ({
    level,
    label: MASTERY_LEVEL_LABELS[level],
    count: levels[level],
    share: total === 0 ? 0 : levels[level] / total,
  }));
}

/** « Le prochain mot revient dans 3 h. », or what waits now. */
export function memoryLine(summary: ReviewSummaryResponse, now: number): string {
  if (ownedWords(summary.levels) === 0) return "Tes mots apparaîtront ici.";
  if (summary.due > 0) {
    return summary.due > 1
      ? `${summary.due} mots attendent leur révision.`
      : "1 mot attend sa révision.";
  }
  const next = nextDueLabel(summary.nextDueAt, now);
  return next === null
    ? "Aucun mot ne revient pour l'instant."
    : `Le prochain mot revient ${next}.`;
}

// --- The series ---------------------------------------------------------------------

/** A question of a series as asked: a catch-up is a missed word asked again, as practice. */
export type SeriesQuestion = ReviewQuestion & { readonly catchUp: boolean };

/**
 * The question as it can be asked here: a word to listen to is shown instead when the sound is
 * off, and the answer says so.
 */
export function playable(question: SeriesQuestion, soundOn: boolean): SeriesQuestion {
  return question.format === "listen" && !soundOn
    ? { ...question, format: "definition" }
    : question;
}

export function seriesOf(questions: readonly ReviewQuestion[]): readonly SeriesQuestion[] {
  return questions.map((question) => ({ ...question, catchUp: false }));
}

/**
 * After a wrong answer at `index`, the same word asked the other way round `catchUpGap` questions
 * later (or last), as free practice: once per word, `catchUps` times per series at most.
 */
export function withCatchUp(
  series: readonly SeriesQuestion[],
  index: number,
  now: number,
): readonly SeriesQuestion[] {
  const missed = series[index];
  const { catchUps, catchUpGap } = practiceRulesAt(PRACTICE_SCHEDULE, now);
  if (missed === undefined || missed.retry === null || missed.catchUp) return series;
  const caught = series.filter((question) => question.catchUp);
  if (caught.length >= catchUps || caught.some((q) => q.cardId === missed.cardId)) return series;
  const again: SeriesQuestion = {
    cardId: missed.cardId,
    format: missed.retry.format,
    choices: [...missed.retry.choices],
    counted: false,
    fresh: false,
    retry: null,
    catchUp: true,
  };
  const at = Math.min(series.length, index + catchUpGap);
  return [...series.slice(0, at), again, ...series.slice(at)];
}

export const MEET_KICKER = "Nouveau mot";
export const MEET_ACTION = "Voir la question";

/** Above a catch-up: why this word comes back. */
export const CATCH_UP_HINT = "Tu l'as raté tout à l'heure : le revoici, posé autrement.";

/** 1 to 4, or a to d, picks a choice; `null` for any other key. */
export function choiceIndexOfKey(key: string): number | null {
  const index = "1234".indexOf(key) >= 0 ? "1234".indexOf(key) : "abcd".indexOf(key.toLowerCase());
  return index >= 0 && key.length === 1 ? index : null;
}

export const KEYBOARD_HINT =
  "Au clavier : 1 à 4 pour répondre, Entrée pour la question suivante, Échap pour arrêter.";
export const TYPED_KEYBOARD_HINT =
  "Au clavier : Entrée pour valider puis pour la question suivante, Échap pour arrêter.";

// --- The recap ----------------------------------------------------------------------

/** The answers the score is read on: a catch-up asks a word again, it is not one more question. */
export function scoredAnswers(
  series: readonly SeriesQuestion[],
  answers: readonly AnsweredQuestion[],
): readonly AnsweredQuestion[] {
  return answers.filter((_, index) => series[index]?.catchUp !== true);
}

/** Words missed on a question that counts: the memory brings them back tomorrow. */
export function comingBackTomorrow(answers: readonly AnsweredQuestion[]): readonly string[] {
  return [...new Set(answers.filter((a) => !a.correct && a.free !== true).map((a) => a.cardId))];
}

/** « Ces 2 mots reviendront demain. » */
export function comingBackLine(count: number): string | null {
  if (count === 0) return null;
  return count > 1 ? `Ces ${count} mots reviendront demain.` : "Ce mot reviendra demain.";
}

/** Words that climbed a level during the series, for the recap's cards. */
export function climbedWords(
  answers: readonly AnsweredQuestion[],
): readonly { readonly cardId: string; readonly level: MasteryLevelCode }[] {
  return answers.filter((a) => a.levelUp).map((a) => ({ cardId: a.cardId, level: a.level }));
}

export interface RecapActions {
  /** « Encore 10 questions » */
  readonly more: string;
  /** Words still wait: another series comes first; otherwise a sachet does. */
  readonly moreFirst: boolean;
  readonly open: string;
}

export function recapActions(
  summary: ReviewSummaryResponse | null,
  length: number,
  noun: PackNoun = SACHET_NOUN,
): RecapActions {
  return {
    more: `Encore ${length} questions`,
    moreFirst: summary === null || summary.due + summary.fresh > 0,
    open: `Ouvrir un ${noun.one}`,
  };
}
