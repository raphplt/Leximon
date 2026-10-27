import {
  type AnswerBonus,
  type ChallengeQuestion,
  MASTERY_LEVEL_LABELS,
  type MasteryLevelCode,
  type ProgressGain,
} from "@leximon/contract";
import {
  buildQuestion,
  type ChallengeFormat,
  levelUpPossible,
  MASTERY_SCHEDULE,
  masteryRulesAt,
  normalizeWord,
  type RandomSource,
} from "@leximon/core";
import { type PackNoun, SACHET_NOUN } from "./format";

/** Outcome of one answered question, kept for the recap. */
export interface AnsweredQuestion {
  readonly cardId: string;
  readonly correct: boolean;
  readonly levelUp: boolean;
  readonly level: MasteryLevelCode;
  readonly bonus: AnswerBonus;
  /** XP the answer earned. */
  readonly progress: ProgressGain;
}

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/** "dans 3 h", "demain", "dans 5 jours": when the next word comes back. */
export function nextDueLabel(nextDueAt: string | null, now: number): string | null {
  if (nextDueAt === null) return null;
  const wait = Date.parse(nextDueAt) - now;
  if (wait <= 0) return "maintenant";
  if (wait < HOUR) return `dans ${Math.max(1, Math.round(wait / 60_000))} min`;
  const hours = Math.round(wait / HOUR);
  if (hours < 24) return `dans ${hours} h`;
  const days = Math.round(wait / DAY);
  return days <= 1 ? "demain" : `dans ${days} jours`;
}

export function levelUpLine(word: string, level: MasteryLevelCode): string {
  return `${word} passe à ${level === "ink" ? "l'" : "la "}${MASTERY_LEVEL_LABELS[level]} !`;
}

/** "4 bonnes réponses sur 5", plus the level ups, if any. */
export function recapLine(answers: readonly AnsweredQuestion[]): string {
  const right = answers.filter((answer) => answer.correct).length;
  const score =
    right === 0
      ? `Aucune bonne réponse sur ${answers.length}`
      : `${right} bonne${right > 1 ? "s" : ""} réponse${right > 1 ? "s" : ""} sur ${answers.length}`;
  const ups = answers.filter((answer) => answer.levelUp).length;
  return ups === 0
    ? score
    : `${score}, ${ups} carte${ups > 1 ? "s" : ""} montée${ups > 1 ? "s" : ""} de niveau`;
}

export function feedbackLine(correct: boolean): string {
  return correct ? "Bien vu." : "Raté. C'était celle-ci.";
}

function bonusCount(count: number, noun: PackNoun): string {
  return count === 1 ? `Un ${noun.one} bonus` : `${count} ${noun.many} bonus`;
}

/** What an answer earned: "Un pli bonus pour le défi du jour !", and what the cap took. */
export function bonusLines(bonus: AnswerBonus, noun: PackNoun = SACHET_NOUN): string[] {
  const lines: string[] = [];
  if (bonus.daily > 0) lines.push(`${bonusCount(bonus.daily, noun)} pour le défi du jour !`);
  if (bonus.gilded > 0) lines.push(`${bonusCount(bonus.gilded, noun)} pour la Dorure !`);
  const lost = bonus.daily + bonus.gilded - bonus.credited;
  if (lost > 0) {
    lines.push(
      `Réserve pleine, ${lost === 1 ? `ce ${noun.one} bonus est perdu` : `${lost} ${noun.many} bonus perdus`}.`,
    );
  }
  return lines;
}

/** "2 plis bonus gagnés…" for the recap, or `null` when the session earned none. */
export function sessionBonusLine(
  answers: readonly AnsweredQuestion[],
  noun: PackNoun = SACHET_NOUN,
): string | null {
  const won = answers.reduce((sum, answer) => sum + answer.bonus.credited, 0);
  if (won === 0) return null;
  const count = won === 1 ? `1 ${noun.one} bonus gagné` : `${won} ${noun.many} bonus gagnés`;
  return `${count}, en réserve.`;
}

/** "+75 XP gagnés pendant ce défi" for the recap, or `null` when the session earned none. */
export function sessionXpLine(answers: readonly AnsweredQuestion[]): string | null {
  const xp = answers.reduce((sum, answer) => sum + answer.progress.xpGained, 0);
  return xp === 0 ? null : `+${xp} XP`;
}

// --- Défis screen -----------------------------------------------------------------

export interface DailyTally {
  readonly goal: { readonly answers: number; readonly correct: number };
  readonly answers: number;
  readonly correct: number;
  readonly awarded: boolean;
}

export type DailyBar = "right" | "wrong" | "empty";

export interface DailyView {
  readonly title: string;
  readonly text: string;
  /** One bar per answer of the goal; the right answers first. */
  readonly bars: readonly DailyBar[];
  readonly action: string;
  readonly done: boolean;
  /** Part of the goal reached, 0 to 1, for the ring of the Jouer button. */
  readonly ratio: number;
}

/** The daily challenge card: five answers, three right, and a bonus sachet. */
export function dailyView(tally: DailyTally, noun: PackNoun = SACHET_NOUN): DailyView {
  const { goal, answers, correct, awarded } = tally;
  const filled = Math.min(answers, goal.answers);
  const right = Math.min(correct, filled);
  const bars = Array.from(
    { length: goal.answers },
    (_, index): DailyBar => (index < right ? "right" : index < filled ? "wrong" : "empty"),
  );
  const title = `${goal.answers} questions, ${goal.correct} bonnes`;
  if (awarded) {
    return {
      title: `${capitalize(noun.one)} gagné`,
      text: "Reviens demain pour le suivant.",
      bars,
      action: "Reviens demain",
      done: true,
      ratio: 1,
    };
  }
  const ratio = Math.min(1, answers / goal.answers, correct / goal.correct);
  if (answers === 0) {
    return {
      title,
      text: `Trouve ${numberWord(goal.correct).toLowerCase()} bonnes réponses sur ${numberWord(goal.answers).toLowerCase()} pour gagner un ${noun.one} bonus.`,
      bars,
      action: "Commencer le défi",
      done: false,
      ratio,
    };
  }
  const questionsLeft = goal.answers - answers;
  const rightLeft = goal.correct - correct;
  const text =
    questionsLeft > 0
      ? `Encore ${questionsLeft} question${questionsLeft > 1 ? "s" : ""}.`
      : `Encore ${rightLeft} bonne${rightLeft > 1 ? "s" : ""} réponse${rightLeft > 1 ? "s" : ""}.`;
  return { title, text, bars, action: "Continuer le défi", done: false, ratio };
}

const NUMBER_WORDS: Readonly<Record<number, string>> = {
  1: "Une",
  2: "Deux",
  3: "Trois",
  4: "Quatre",
  5: "Cinq",
};

function numberWord(value: number): string {
  return NUMBER_WORDS[value] ?? String(value);
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Words at each level: every owned word starts as a sketch. */
export function memoryCounts(
  ownedIds: Iterable<string>,
  levels: ReadonlyMap<string, MasteryLevelCode>,
): Readonly<Record<MasteryLevelCode, number>> {
  const counts = { sketch: 0, ink: 0, gilded: 0 };
  for (const id of ownedIds) counts[levels.get(id) ?? "sketch"] += 1;
  return counts;
}

/** How a word climbs, with the rules of `now`: written from memory, long enough after. */
export function memoryNote(now: number): string {
  const { ink, gilded } = masteryRulesAt(MASTERY_SCHEDULE, now).levelThresholdDays;
  return `Entre deux paliers, des questions à choix multiples t'aident à retenir le mot. Pour passer à l'Encre, écris-le de mémoire ${ink} jours après ta dernière révision (${gilded} jours pour la Dorure). Si tu te trompes, il revient le lendemain.`;
}

export interface EscapingWord {
  readonly cardId: string;
  readonly due: boolean;
  /** « À revoir maintenant », « Revient dans 3 h » */
  readonly when: string;
}

/**
 * Words slipping away: reviewed words due now, most overdue first, then those due
 * within a day, up to `limit`.
 */
export function escapingWords(
  memory: ReadonlyMap<string, { readonly due: number }>,
  owned: ReadonlySet<string>,
  now: number,
  limit = 6,
): EscapingWord[] {
  return [...memory.entries()]
    .filter(([id, word]) => owned.has(id) && word.due <= now + DAY)
    .sort((a, b) => a[1].due - b[1].due)
    .slice(0, limit)
    .map(([cardId, word]) => ({
      cardId,
      due: word.due <= now,
      when:
        word.due <= now
          ? "À revoir maintenant"
          : `Revient ${nextDueLabel(new Date(word.due).toISOString(), now) ?? "bientôt"}`,
    }));
}

/** The question line. */
export function questionKicker(format: ChallengeFormat): string {
  if (format === "typed") return "Écris le mot";
  return format === "definition" ? "Que veut dire ce mot ?" : "Quel mot se cache là-dessous ?";
}

/** Under a word to type: what it is worth, and what is forgiven. */
export function typedQuestionHint(level: MasteryLevelCode): string {
  const next = level === "sketch" ? "l'Encre" : "la Dorure";
  return `Écris le mot de mémoire pour passer à ${next}. Les accents ne comptent pas et une faute de frappe est tolérée.`;
}

const HIDDEN = "…";

/**
 * The definition shown when the word is to be found: words of the same family hidden, so that
 * « Petit du renard » does not give away *renardeau*. A word of the definition is hidden when it
 * starts like the card's word over 5 letters or 60 % of it, whichever is longer, or over all of a
 * shorter word.
 */
export function hideWordIn(definition: string, word: string): string {
  const target = normalizeWord(word);
  const needed = Math.min(target.length, Math.max(5, Math.ceil(target.length * 0.6)));
  return definition.replaceAll(/[\p{L}\p{M}]+/gu, (token) =>
    sharedPrefix(normalizeWord(token), target) >= needed ? HIDDEN : token,
  );
}

function sharedPrefix(a: string, b: string): number {
  let length = 0;
  while (length < a.length && length < b.length && a[length] === b[length]) length++;
  return length;
}

/** « Juste. +15 XP », « Juste, à une lettre près. +15 XP » or « Raté. » */
export function answerTitle(correct: boolean, xpGained: number, slip = false): string {
  if (!correct) return "Raté.";
  const title = slip ? "Juste, à une lettre près." : "Juste.";
  return xpGained > 0 ? `${title} +${xpGained} XP` : title;
}

/** « Ça s'écrit écornifleur. » when the word typed was right but not spelled like the card. */
export function spellingLine(typed: string, word: string): string | null {
  const same = typed.trim().toLocaleLowerCase("fr") === word.toLocaleLowerCase("fr");
  return same ? null : `Ça s'écrit ${word}.`;
}

/** The score of a finished session, « 4/5 ». */
export function sessionScore(answers: readonly AnsweredQuestion[]): string {
  return `${answers.filter((answer) => answer.correct).length}/${answers.length}`;
}

/** When the session ends and the day's goal is still open: it adds up over the day. */
/** Said when a challenge was asked for and no word is due. */
export function noChallengeNotice(
  nextDueAt: string | null,
  now: number,
  noun: PackNoun = SACHET_NOUN,
): string {
  if (nextDueAt === null) {
    return `Aucun mot à réviser pour l'instant. Ouvre des ${noun.many} pour découvrir tes premiers mots.`;
  }
  return `Tes mots tiennent bon. Le prochain revient ${nextDueLabel(nextDueAt, now) ?? "bientôt"}.`;
}

export const NOT_THIS_TIME =
  "Tu peux continuer le défi du jour jusqu'à minuit pour gagner ton sachet bonus.";

/**
 * A one-word session (a word slipping away, on the Défis screen): the same question the server would
 * build, the word to type when a right answer can raise its level, wrong choices from the word's
 * collection first otherwise. The server still checks the answer and whether the word is due.
 */
export function reviewQuestion(
  random: RandomSource,
  cardId: string,
  collections: readonly { readonly cards: readonly { readonly id: string }[] }[],
  memory: { readonly level: MasteryLevelCode; readonly lastReviewedAt: number | null } | undefined,
  now: number,
): ChallengeQuestion | null {
  const home = collections.find((collection) => collection.cards.some((c) => c.id === cardId));
  if (home === undefined) return null;
  const rules = masteryRulesAt(MASTERY_SCHEDULE, now);
  if (memory !== undefined && levelUpPossible(rules, memory.level, memory.lastReviewedAt, now)) {
    return { cardId, format: "typed" };
  }
  const all = collections.flatMap((collection) => collection.cards.map((card) => card.id));
  const question = buildQuestion(
    random,
    cardId,
    home.cards.map((card) => card.id),
    all,
  );
  return question === null
    ? null
    : { cardId: question.cardId, format: question.format, choices: [...question.choices] };
}
