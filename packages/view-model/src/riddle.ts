import type { RiddleResponse } from "@leximon/contract";
import { RIDDLE_CLUES, RIDDLE_SCHEDULE, riddleRulesAt } from "@leximon/core";
import { formatWait, plural } from "./format";

const SITE = "https://leximon.fr";

const NATURES: Readonly<Record<string, string>> = {
  "n. m.": "Nom masculin",
  "n. f.": "Nom féminin",
  "n. m. et f.": "Nom masculin et féminin",
  "n. m. pl.": "Nom masculin pluriel",
  "n. f. pl.": "Nom féminin pluriel",
  "n. f. plur.": "Nom féminin pluriel",
  "v. tr.": "Verbe",
  "v. intr.": "Verbe",
  "v. réfl.": "Verbe pronominal",
  "adj.": "Adjectif",
  "adj. f.": "Adjectif féminin",
  "adj. m. pl.": "Adjectif masculin pluriel",
  "adj. f. pl.": "Adjectif féminin pluriel",
  "interj.": "Interjection",
};

/** « Nom féminin de 8 lettres ». An abbreviation not listed here is shown as the card shows it. */
export function riddleNature(partOfSpeech: string, letters: number): string {
  return `${NATURES[partOfSpeech] ?? partOfSpeech} de ${letters} lettres`;
}

function tries(lastStep: number): number {
  return lastStep + 1;
}

export function riddleRule(lastStep: number): string {
  return `Trouve le mot du jour en ${tries(lastStep)} essais. Chaque mauvaise réponse dévoile un indice, puis des lettres, et demander un indice coûte aussi un essai.`;
}

/** The line of the Défis screen, before the player starts. */
export function riddleInvitation(lastStep: number, now: number): string {
  const { xp } = riddleRulesAt(RIDDLE_SCHEDULE, now);
  return `Le même mot pour tout le monde, à trouver en ${tries(lastStep)} essais. Il rapporte ${xp} XP, et la carte si tu ne l'as pas.`;
}

/** « Trouvé au 2e indice », for the screen and for the shared result. */
export function riddleResultLine(riddle: Pick<RiddleResponse, "step" | "outcome">): string {
  const { step, outcome } = riddle;
  if (outcome !== "found") return "Pas trouvé";
  if (step === 0) return "Trouvé sans indice";
  if (step === 1) return "Trouvé au 1er indice";
  return `Trouvé au ${step}e indice`;
}

/** One square per try, the last one green when the word was found. The word stays hidden. */
export function riddleSquares(
  riddle: Pick<RiddleResponse, "step" | "outcome" | "lastStep">,
): string {
  return riddle.outcome === "found"
    ? `${"🟧".repeat(riddle.step)}🟩`
    : "🟧".repeat(tries(riddle.lastStep));
}

export function riddleLink(number: number): string {
  return `${SITE}/enigme/${number}`;
}

/** The text a player shares: the result, never the word. */
export function riddleShareText(riddle: RiddleResponse): string {
  return [
    `Énigme Leximon n° ${riddle.number}`,
    `${riddleResultLine(riddle)} ${riddleSquares(riddle)}`,
    riddleLink(riddle.number),
  ].join("\n");
}

export interface RiddleClueLine {
  readonly label: string;
  readonly text: string;
}

/** The clues to read. The whole definition replaces its opening. */
export function riddleClueLines(riddle: RiddleResponse): readonly RiddleClueLine[] {
  const { opening, definition, etymology } = riddle.clues;
  const lines: RiddleClueLine[] = [];
  if (definition !== null) lines.push({ label: "Définition", text: definition });
  else if (opening !== null) lines.push({ label: "Début de la définition", text: opening });
  if (etymology !== null) lines.push({ label: "Origine", text: etymology });
  return lines;
}

/** One letter per box, empty while hidden. */
export function riddleCells(riddle: RiddleResponse): readonly string[] {
  const shown = [...riddle.shownLetters];
  return Array.from({ length: riddle.letters }, (_, index) => shown[index] ?? "");
}

export function riddleTriesLine(riddle: Pick<RiddleResponse, "step" | "lastStep">): string {
  const left = tries(riddle.lastStep) - riddle.step;
  return left === 1
    ? "Il te reste un dernier essai."
    : `Il te reste ${plural(left, "essai", "essais")}.`;
}

/** The button that spends a try on the next clue. On the last try it gives the word away. */
export function riddleAskLabel(riddle: Pick<RiddleResponse, "step" | "lastStep">): string {
  if (riddle.step >= riddle.lastStep) return "Abandonner et voir le mot";
  return riddle.step < RIDDLE_CLUES ? "Demander un indice" : "Demander des lettres";
}

export const RIDDLE_WRONG = "Ce n'est pas ce mot.";

export const RIDDLE_NEW_DAY = "Une nouvelle énigme vient de commencer.";

export const RIDDLE_UNAVAILABLE = "Il n'y a pas d'énigme pour l'instant. Reviens un peu plus tard.";

export const RIDDLE_SEND_FAILED = "Ta réponse n'est pas partie. Vérifie ta connexion.";

export const RIDDLE_COPIED = "Ton résultat est copié.";

export function riddleHeadline(riddle: RiddleResponse): string {
  if (riddle.outcome === "found") return "Bien trouvé !";
  return `Le mot était « ${riddle.answer?.word ?? ""} ».`;
}

/** What the game earned; nothing to say when it is lost. */
export function riddleRewardLines(riddle: RiddleResponse): readonly string[] {
  if (riddle.outcome !== "found") return [];
  return [
    `Tu gagnes ${riddle.xp} XP.`,
    riddle.cardGiven
      ? `La carte « ${riddle.answer?.word ?? ""} » rejoint ton album.`
      : "Tu avais déjà cette carte.",
  ];
}

export function riddleNextLine(riddle: Pick<RiddleResponse, "nextAt">, now: number): string {
  return `La prochaine énigme arrive dans ${formatWait(Date.parse(riddle.nextAt) - now)}.`;
}

/** Under the riddle on the Défis screen, once the player has started. */
export function riddleProgressLine(riddle: RiddleResponse): string {
  return riddle.outcome === null ? riddleTriesLine(riddle) : `${riddleResultLine(riddle)}.`;
}

/** The public page's count: how many of those who finished the riddle found it. */
export function riddlePublicLine(played: number, found: number): string {
  if (found === 0) return "Personne n'a trouvé ce mot pour l'instant.";
  return found === 1
    ? `1 joueur sur ${played} a trouvé ce mot.`
    : `${found} joueurs sur ${played} ont trouvé ce mot.`;
}
