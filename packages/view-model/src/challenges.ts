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
  type RandomSource,
} from "@leximon/core";
import { type PackNoun, SACHET_NOUN } from "./format";
import type { SoundCue } from "./staging";

export { hideWordIn } from "@leximon/core";

/** Outcome of one answered question, kept for the recap. */
export interface AnsweredQuestion {
  readonly cardId: string;
  readonly correct: boolean;
  readonly levelUp: boolean;
  readonly level: MasteryLevelCode;
  readonly bonus: AnswerBonus;
  /** XP the answer earned. */
  readonly progress: ProgressGain;
  /** Free practice: it counts for neither the word's memory nor the clan. */
  readonly free?: boolean;
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

/** « à l'Esquisse », « à l'Encre », « à la Dorure » */
export function toLevel(level: MasteryLevelCode): string {
  const label = MASTERY_LEVEL_LABELS[level];
  return /^[AEIOUÉ]/.test(label) ? `à l'${label}` : `à la ${label}`;
}

export function levelUpLine(word: string, level: MasteryLevelCode): string {
  return `${word} passe ${toLevel(level)} !`;
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
    : `${score}, ${ups} mot${ups > 1 ? "s" : ""} ${ups > 1 ? "montent" : "monte"} d'un palier`;
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
  if (bonus.gilded > 0) {
    lines.push(
      `${bonusCount(bonus.gilded, noun)} pour ${bonus.gilded === 1 ? "ce mot passé" : "ces mots passés"} à la Dorure !`,
    );
  }
  const lost = bonus.daily + bonus.gilded - bonus.credited;
  if (lost > 0) {
    lines.push(
      `Ta réserve est pleine, ${lost === 1 ? `ce ${noun.one} bonus est perdu` : `${lost} ${noun.many} bonus sont perdus`}.`,
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
  return `${count}, rangé${won > 1 ? "s" : ""} dans ta réserve.`;
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
  const title = `${goal.correct} bonnes réponses sur ${goal.answers}`;
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

/** Words at each level: every owned word starts on a blank page. */
export function memoryCounts(
  ownedIds: Iterable<string>,
  levels: ReadonlyMap<string, MasteryLevelCode>,
): Readonly<Record<MasteryLevelCode, number>> {
  const counts = { blank: 0, sketch: 0, ink: 0, gilded: 0 };
  for (const id of ownedIds) counts[levels.get(id) ?? "blank"] += 1;
  return counts;
}

/** How a word climbs, with the rules of `now`: written from memory, long enough after. */
export function memoryNote(now: number): string {
  const { ink, gilded } = masteryRulesAt(MASTERY_SCHEDULE, now).levelThresholdDays;
  return `Entre deux paliers, des questions à choix multiples t'aident à retenir le mot. Pour passer à l'Encre, écris-le de mémoire ${ink} jours après ta dernière révision (${gilded} jours pour la Dorure). Si tu te trompes, il revient le lendemain.`;
}

/** What the memory needs to tell how a word stands. */
interface Remembered {
  readonly level: MasteryLevelCode;
  readonly due: number;
  readonly lastReviewedAt: number | null;
}

/** Whether the next challenge asks this word typed, to raise it a level. */
function risesNow(word: Remembered, now: number): boolean {
  const rules = masteryRulesAt(MASTERY_SCHEDULE, now);
  return word.due <= now && levelUpPossible(rules, word.level, word.lastReviewedAt, now);
}

export interface ChallengeOutlook {
  /** Reviewed words due now. */
  readonly due: number;
  /** Of those, the ones a right typed answer raises a level. */
  readonly rising: number;
  /** Owned words never asked yet. */
  readonly fresh: number;
}

/** What the next challenges hold: words due, words that can climb, words never asked. */
export function challengeOutlook(
  memory: ReadonlyMap<string, Remembered>,
  owned: Iterable<string>,
  now: number,
): ChallengeOutlook {
  let due = 0;
  let rising = 0;
  let fresh = 0;
  for (const id of owned) {
    const word = memory.get(id);
    if (word === undefined) fresh += 1;
    else if (word.due <= now) {
      due += 1;
      if (risesNow(word, now)) rising += 1;
    }
  }
  return { due, rising, fresh };
}

/** « 8 mots à revoir, dont 2 peuvent monter de palier. 5 nouveaux mots attendent leur première question. » */
export function outlookLine({ due, rising, fresh }: ChallengeOutlook): string | null {
  const lines: string[] = [];
  if (due > 0) {
    const words = due > 1 ? `${due} mots à revoir` : "1 mot à revoir";
    const climb =
      rising === 0
        ? ""
        : rising > 1
          ? `, dont ${rising} peuvent monter de palier`
          : ", dont 1 peut monter de palier";
    lines.push(`${words}${climb}.`);
  }
  if (fresh > 0) {
    lines.push(
      fresh > 1
        ? `${fresh} nouveaux mots attendent leur première question.`
        : "1 nouveau mot attend sa première question.",
    );
  }
  return lines.length === 0 ? null : lines.join(" ");
}

/** Each level's share of the owned words, for the bar under the counts. */
export function levelShares(
  counts: Readonly<Record<MasteryLevelCode, number>>,
): Readonly<Record<MasteryLevelCode, number>> {
  const total = counts.blank + counts.sketch + counts.ink + counts.gilded;
  if (total === 0) return { blank: 0, sketch: 0, ink: 0, gilded: 0 };
  return {
    blank: counts.blank / total,
    sketch: counts.sketch / total,
    ink: counts.ink / total,
    gilded: counts.gilded / total,
  };
}

export interface EscapingWord {
  readonly cardId: string;
  readonly due: boolean;
  /** « À réviser maintenant », « À réviser dans 3 h » */
  readonly when: string;
  /** « Peut passer à l'Encre » when the next challenge asks it typed, to climb. */
  readonly rise: string | null;
}

/**
 * Words slipping away: reviewed words due now, those that can climb a level first, then the most
 * overdue, then those due within a day, up to `limit`.
 */
export function escapingWords(
  memory: ReadonlyMap<string, Remembered>,
  owned: ReadonlySet<string>,
  now: number,
  limit = 6,
): EscapingWord[] {
  return [...memory.entries()]
    .filter(([id, word]) => owned.has(id) && word.due <= now + DAY)
    .sort(
      (a, b) => Number(risesNow(b[1], now)) - Number(risesNow(a[1], now)) || a[1].due - b[1].due,
    )
    .slice(0, limit)
    .map(([cardId, word]) => ({
      cardId,
      due: word.due <= now,
      when:
        word.due <= now
          ? "À réviser maintenant"
          : `À réviser ${nextDueLabel(new Date(word.due).toISOString(), now) ?? "bientôt"}`,
      rise: risesNow(word, now)
        ? `Peut passer ${word.level === "sketch" ? "à l'Encre" : "à la Dorure"}`
        : null,
    }));
}

/** The question line. */
export function questionKicker(format: ChallengeFormat): string {
  switch (format) {
    case "typed":
      return "Écris le mot";
    case "definition":
      return "Que veut dire ce mot ?";
    case "word":
      return "Quel mot correspond à cette définition ?";
    case "listen":
      return "Écoute le mot : que veut-il dire ?";
    case "pairs":
      return "Relie chaque mot à sa définition";
  }
}

/** Under a word to type in practice: nothing rises, the same slips are forgiven. */
export const PRACTICE_TYPED_HINT =
  "Écris le mot de mémoire. Les accents ne comptent pas et une faute de frappe est tolérée.";

/** Under a word to type: what it is worth, and what is forgiven. */
export function typedQuestionHint(level: MasteryLevelCode): string {
  const next = level === "sketch" ? "l'Encre" : "la Dorure";
  return `Écris le mot de mémoire pour passer à ${next}. Les accents ne comptent pas et une faute de frappe est tolérée.`;
}

export interface AnswerFeedback {
  readonly cue: SoundCue;
  readonly vibration: readonly number[];
  /** Played `AFTER_ANSWER_MS` later, once the answer has sounded: the bigger news. */
  readonly followUp: SoundCue | null;
}

export const AFTER_ANSWER_MS = 350;

/** In a session's recap, the sachet won lands after the score has counted up; its chime waits for it. */
export const RECAP_BONUS_MS = 700;

/** What an answer sounds and feels like; a level or a sachet won rings after it. */
export function answerFeedback(
  answer: Pick<AnsweredQuestion, "correct" | "levelUp" | "bonus">,
): AnswerFeedback {
  const won = answer.bonus.daily + answer.bonus.gilded > 0;
  if (!answer.correct) return { cue: "answerWrong", vibration: [10, 60, 10], followUp: null };
  return {
    cue: "answerRight",
    vibration: answer.levelUp ? [12, 120, 40] : [12],
    followUp: answer.levelUp ? "chimeRare" : won ? "chimePrecious" : null,
  };
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
    return `Aucun mot à réviser. Ouvre des ${noun.many} pour découvrir tes premiers mots.`;
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
