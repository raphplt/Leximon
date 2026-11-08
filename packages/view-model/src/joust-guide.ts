import type { CatalogCard, JoustOutcome } from "@leximon/contract";
import { hideWordIn, joustOutcome } from "@leximon/core";
import type { RunSize } from "./jousts";

/**
 * The first visit to the jousts, with Maître Furet: the lists, the deck, a training run against
 * him, then the first real joust. The same on the web and the phone.
 */

export const FURET = "Maître Furet";

export const GUIDE_STEPS = ["La lice", "Ton deck", "L'entraînement", "La première joute"] as const;
export type GuideStep = 0 | 1 | 2 | 3;

export const GUIDE_SKIP = "Passer";
export const GUIDE_UNDERSTOOD = "Compris";
export const GUIDE_LATER = "Plus tard";
export const TRAINING_KICKER = "Entraînement · sans gain";
export const TRAINING_CONTINUE = "Continuer";

/** What Maître Furet says at each step. */
export function guideLine(step: GuideStep, size: RunSize, deck: DeckLimits): string {
  switch (step) {
    case 0:
      return `Bienvenue dans la lice. Chacun apporte un deck de ses mots, et le jeu en tire ${size.questions} de chaque côté : tu trouves les mots de l'autre, l'autre trouve les tiens.`;
    case 1:
      return `Choisis jusqu'à ${deck.size} mots que tu as déjà trouvés, avec ${deck.budget} points en tout. Un mot rare piège mieux, mais il coûte plus de points.`;
    case 2:
      return `Essayons sur ${TRAINING_QUESTIONS} mots, sans rien gagner ni perdre. Je les ai déjà joués : tu vois mon score à côté du tien.`;
    case 3:
      return `À toi. Le jeu te trouve un adversaire de ta force. Il a ${size.replyHours} heures pour jouer sa partie, et je te préviens au courrier dès que le résultat tombe.`;
  }
}

export interface DeckLimits {
  readonly size: number;
  readonly budget: number;
}

/** The three icons of the lists' step. */
export function guideRules(size: RunSize): readonly string[] {
  return [`${size.seconds} s par mot`, "Le plus de mots trouvés gagne", "Égalité : le plus rapide"];
}

/** Once the deck is saved in the guide. */
export const GUIDE_DECK_SAVED = "Ton deck est prêt. Tu pourras le changer quand tu voudras.";
/** The deck step, skipped without a deck: the player composes it before the first joust. */
export const GUIDE_NO_DECK =
  "Sans deck, pas de joute : compose-le avant ta première, depuis l'accueil des joutes.";

// --- The training run ----------------------------------------------------------------------------

export const TRAINING_QUESTIONS = 3;

export interface TrainingQuestion {
  readonly cardId: string;
  readonly definition: string;
  readonly choices: readonly string[];
}

/** Maître Furet's recorded run: the ghost of the training. */
export const FURET_RUN: readonly { readonly correct: boolean; readonly ms: number }[] = [
  { correct: true, ms: 6_200 },
  { correct: false, ms: 15_000 },
  { correct: true, ms: 4_800 },
];

/**
 * Three questions for the training: words the player knows when they have enough, else common
 * words, each with choices of the same collection and rarity, as a joust draws them.
 */
export function trainingQuestions(
  known: readonly CatalogCard[],
  catalog: readonly CatalogCard[],
  choices: number,
  random: () => number,
): readonly TrainingQuestion[] {
  const pool = known.length >= TRAINING_QUESTIONS ? known : commonCards(catalog);
  const asked = shuffled(pool, random).slice(0, TRAINING_QUESTIONS);
  return asked.map((card) => {
    const words = new Set([card.word]);
    const decoys = shuffled(
      catalog.filter(
        (other) =>
          other.id !== card.id &&
          other.collectionId === card.collectionId &&
          other.rarity === card.rarity,
      ),
      random,
    ).filter((other) => {
      if (words.has(other.word)) return false;
      words.add(other.word);
      return true;
    });
    return {
      cardId: card.id,
      definition: hideWordIn(card.definition, card.word),
      choices: shuffled(
        [card.id, ...decoys.slice(0, choices - 1).map((other) => other.id)],
        random,
      ),
    };
  });
}

function commonCards(catalog: readonly CatalogCard[]): readonly CatalogCard[] {
  const firstCollection = catalog[0]?.collectionId;
  return catalog.filter(
    (card) => card.rarity === "common" && card.collectionId === firstCollection,
  );
}

function shuffled<T>(items: readonly T[], random: () => number): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    [copy[index], copy[other]] = [copy[other] as T, copy[index] as T];
  }
  return copy;
}

type TrainingAnswer = { readonly correct: boolean; readonly ms: number };

/** The training's result: the most words found, then the shortest time, as in a joust. */
export function trainingOutcome(
  mine: readonly TrainingAnswer[],
  furet: readonly TrainingAnswer[] = FURET_RUN,
): JoustOutcome {
  const score = (run: readonly TrainingAnswer[]) => ({
    correct: run.filter((answer) => answer.correct).length,
    ms: run.reduce((total, answer) => total + answer.ms, 0),
  });
  const outcome = joustOutcome(score(mine), score(furet));
  return outcome === "challenger" ? "won" : outcome === "opponent" ? "lost" : "draw";
}

/** Under the training's result. */
export function trainingClosing(outcome: JoustOutcome): string {
  switch (outcome) {
    case "won":
      return "Tu m'as battu. En vraie joute, une victoire donne un sachet bonus.";
    case "lost":
      return "Je t'ai battu, cette fois. En vraie joute, chaque partie donne des XP.";
    case "draw":
      return "Égalité parfaite. En vraie joute, le temps aurait départagé.";
  }
}
