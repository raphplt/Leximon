import type { BoosterSource, BoosterWalletResponse } from "@leximon/contract";
import {
  canOpenCollection,
  DRAW_SCHEDULE,
  drawRulesAt,
  type EpochMs,
  intervalAt,
  MISSION_SCHEDULE,
  missionRulesAt,
  REFILL_SCHEDULE,
  UNLOCK_SCHEDULE,
  unlockRulesAt,
} from "@leximon/core";
import { levelBadge, levelsOfFeatures } from "./features";
import { capitalize, formatWait } from "./format";
import { MISSIONS_TITLE } from "./missions";

/** The Jouer screen and the stock shown in the top bar. */

// --- Stock --------------------------------------------------------------------------------

export interface StockView {
  readonly stored: number;
  readonly capacity: number;
  readonly bonus: number;
  /** Nothing to open: the sachet turns grey and still. */
  readonly empty: boolean;
  /** « +1 dans 18 min », « plein », « 2 bonus »: the note beside the dots. */
  readonly note: string;
  /** « Ouvrir le sachet », « Ouvrir un sachet bonus », « Prochain dans 18 min ». */
  readonly action: string;
  /** « 18 min », « plein »: the short form of the top bar chip. */
  readonly refillShort: string;
  /** « 4 sachets sur 6 ». */
  readonly count: string;
  /** « Le prochain arrive dans 18 min. », « Ton stock est plein. » */
  readonly refillLine: string;
  /** « 4 sachets sur 6, 2 bonus en réserve », for screen readers. */
  readonly description: string;
  /** Share of the wait for the next sachet already gone, 0 to 1; `null` when the stock is full. */
  readonly refill: number | null;
}

export function stockView(wallet: BoosterWalletResponse, now: EpochMs): StockView {
  const wait =
    wallet.nextRefillAt === null ? null : formatWait(Date.parse(wallet.nextRefillAt) - now);
  const { stored, capacity, bonus } = wallet;
  const count = `${stored} ${stored > 1 ? "sachets" : "sachet"} sur ${capacity}`;
  const note =
    stored >= capacity ? "plein" : stored === 0 && bonus > 0 ? `${bonus} bonus` : `+1 dans ${wait}`;
  return {
    stored,
    capacity,
    bonus,
    empty: stored === 0 && bonus === 0,
    note,
    action:
      stored > 0
        ? "Ouvrir le sachet"
        : bonus > 0
          ? "Ouvrir un sachet bonus"
          : `Prochain dans ${wait}`,
    refillShort: wait ?? "plein",
    count,
    refillLine: wait === null ? "Ton stock est plein." : `Le prochain arrive dans ${wait}.`,
    description: `${count}, ${bonus} bonus en réserve`,
    refill:
      wallet.nextRefillAt === null
        ? null
        : Math.min(
            1,
            Math.max(
              0,
              1 - (Date.parse(wallet.nextRefillAt) - now) / intervalAt(REFILL_SCHEDULE, now),
            ),
          ),
  };
}

/**
 * The button under the sachet, with what is left to open: « Ouvrir le sachet · 4 restants ». A
 * guest counts only the sachets it may still open before it needs an account.
 */
export function openButtonLabel(stock: StockView, guestLeft: number | null): string {
  if (stock.stored > 0) {
    const left = guestLeft === null ? stock.stored : Math.min(stock.stored, guestLeft);
    return `${stock.action} · ${left} ${left > 1 ? "restants" : "restant"}`;
  }
  if (stock.bonus > 0) return `${stock.action} · ${stock.bonus} en réserve`;
  return stock.action;
}

export const BACK_HOME_LABEL = "Retour à l'accueil";

/** Whether the recap can tear the next sachet straight away. */
export function canOpenAgain(wallet: BoosterWalletResponse): boolean {
  return wallet.stored > 0 || wallet.bonus > 0;
}

/**
 * The recap's button once the cards are seen: open another, a bonus, or, with nothing left, go
 * back to the counter, where the day's challenge and the other screens wait.
 */
export function openAgainLabel(wallet: BoosterWalletResponse): string {
  if (wallet.stored > 0) return "Ouvrir un autre sachet";
  if (wallet.bonus > 0) return "Ouvrir un sachet bonus";
  return BACK_HOME_LABEL;
}

/** The button under a revealed card: the next one, or, after the last, all of them. */
export function revealNextLabel(last: boolean): string {
  return last ? "Voir mes cartes" : "Suivante";
}

/** The speaker under a revealed card, which turns the same setting as the settings screen. */
export function speechToggleLabel(on: boolean): string {
  return on ? "Couper la prononciation" : "Remettre la prononciation";
}

/** Under the recap's button when nothing is left to open: « Ton prochain sachet arrive dans 18 min. » */
export function nextSachetLine(wallet: BoosterWalletResponse, now: EpochMs): string | null {
  if (canOpenAgain(wallet) || wallet.nextRefillAt === null) return null;
  return `Ton prochain sachet arrive dans ${formatWait(Date.parse(wallet.nextRefillAt) - now)}.`;
}

// --- The desk's two columns, on a wide screen ----------------------------------------------

/** « Lundi 3 novembre »: the day in Paris, at the head of the day's column. */
export function todayLabel(now: EpochMs): string {
  const day = new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Europe/Paris",
  }).format(now);
  return capitalize(day);
}

export const DESK_TEXTS = {
  today: "Aujourd'hui",
  standing: "Ta progression",
  stock: "Tes sachets",
  daily: "Défi du jour",
  riddle: "Énigme du jour",
  clanGoal: "Objectif du clan cette semaine",
  clanInvite:
    "Un clan vise un objectif chaque semaine, et ses membres y gagnent des sachets bonus.",
  findClan: "Trouver un clan",
  seeClan: "Voir le clan",
  chat: "Discussion",
} as const;

// --- Reserve of bonus sachets ---------------------------------------------------------------

export interface ReserveView {
  /** « 3 sachets bonus », « Aucun sachet bonus ». */
  readonly headline: string;
  /** « Dont 1 garni, ouvert en premier. », or nothing without a garni. */
  readonly garni: string | null;
  /** « Ta réserve en garde jusqu'à 12. » */
  readonly places: string;
  /** When they open, or nothing with an empty reserve. */
  readonly rule: string | null;
  readonly sources: string;
}

/** The second half of the stock chip's detail: the reserve, when it serves, where it fills from. */
export function reserveView(wallet: BoosterWalletResponse): ReserveView {
  const { bonus, garni, bonusCap } = wallet;
  return {
    headline:
      bonus === 0
        ? "Aucun sachet bonus"
        : `${bonus} ${bonus > 1 ? "sachets bonus" : "sachet bonus"}`,
    garni:
      garni === 0
        ? null
        : garni > 1
          ? `Dont ${garni} sachets garnis (au moins une carte Rare), ouverts en premier.`
          : "Dont 1 sachet garni (au moins une carte Rare), ouvert en premier.",
    places: `Ta réserve en garde jusqu'à ${bonusCap}.`,
    rule: bonus === 0 ? null : "Tu les ouvres quand tu n'as plus de sachet gratuit.",
    sources:
      "Tu en gagnes avec les coffrets de niveau, le défi du jour, les mots qui atteignent la Dorure et les objectifs de clan.",
  };
}

// --- Collection of the sachet --------------------------------------------------------------

export interface CollectionChoice {
  readonly id: string;
  readonly name: string;
  readonly short: string;
  /** What the collection holds, in a line; `null` in catalogues made before taglines. */
  readonly tagline: string | null;
  readonly source: BoosterSource;
  /** `null` when open, else « Niv. 3 ». */
  readonly lock: string | null;
}

/**
 * One sachet per published collection, the starter one first. Before the level that opens the
 * choice, only the starter sachet opens; the others show their level.
 */
export function collectionChoices(
  collections: readonly {
    readonly id: string;
    readonly name: string;
    readonly tagline?: string | undefined;
  }[],
  level: number,
  now: EpochMs,
): CollectionChoice[] {
  const rules = unlockRulesAt(UNLOCK_SCHEDULE, now);
  const lock = levelBadge(rules.levels.choose_collection);
  const starterFirst = [
    ...collections.filter((c) => c.id === rules.starterCollection),
    ...collections.filter((c) => c.id !== rules.starterCollection),
  ];
  return starterFirst.map((c) => ({
    id: c.id,
    name: c.name,
    short: shortName(c.name),
    tagline: c.tagline ?? null,
    source: { kind: "collection", collectionId: c.id } as const,
    lock: canOpenCollection(rules, c.id, level) ? null : lock,
  }));
}

const ARTICLES = new Set(["le", "la", "les", "l'", "un", "une", "des"]);

/** « Caractères et travers » → « Caractères », « Les Fondateurs » → « Fondateurs »: the first word that is not an article, for chips. */
export function shortName(name: string): string {
  const words = name.split(/\s+/);
  return words.find((w) => !ARTICLES.has(w.toLowerCase())) ?? name;
}

/** The choice kept when the one asked for is closed or gone: the starter sachet. */
export function pickCollection(
  choices: readonly CollectionChoice[],
  wanted: string | null,
): CollectionChoice {
  const found = choices.find((c) => c.id === wanted && c.lock === null);
  // The starter sachet is always first and always open.
  return found ?? (choices[0] as CollectionChoice);
}

/**
 * The sachets tucked behind the one on the counter: the previous collection on its left, the
 * next on its right, going round; with two collections, only the other one, on the right.
 */
export function neighbourChoices(
  choices: readonly CollectionChoice[],
  current: CollectionChoice,
): { readonly left: CollectionChoice | null; readonly right: CollectionChoice | null } {
  const count = choices.length;
  const index = choices.findIndex((c) => c.id === current.id);
  if (count < 2 || index < 0) return { left: null, right: null };
  const right = choices[(index + 1) % count] ?? null;
  if (count === 2) return { left: null, right };
  return { left: choices[(index - 1 + count) % count] ?? null, right };
}

/** « 5 cartes », printed on the sachet as on a real booster. */
export function sachetContents(now: EpochMs): string {
  return `${drawRulesAt(DRAW_SCHEDULE, now).cardsPerBooster} cartes`;
}

// --- Word slipping away --------------------------------------------------------------------

/** « Lucubrateur est à réviser. », split so that the word can be set in italics. */
export const SLIPPING_AWAY = { after: " est à réviser.", action: "Réviser" } as const;

/**
 * Under the counter, a word slipping away shows its definition but not itself: the review that
 * follows asks for the word, so the answer is never one touch away from its question.
 */
export const SLIPPING_RIDDLE = "Un de tes mots est à réviser.";

/** Above a word of the album when none is slipping away; « Lire » for a card never opened. */
export const OWN_WORD = { kicker: "Un de tes mots", action: "Relire", first: "Lire" } as const;

export interface WordUnderCounter {
  readonly cardId: string;
  /** `slipping`: due for review; `owned`: one of the player's words, to read (again). */
  readonly kind: "slipping" | "owned";
  /** A card whose sheet was never opened. */
  readonly fresh: boolean;
}

/**
 * The word shown under the counter, another at each visit: one of the words due for review,
 * most overdue first, else one of the player's words, those never read first. `null` without
 * any card.
 */
export function wordUnderCounter(
  memory: ReadonlyMap<string, { readonly due: number }>,
  owned: ReadonlyMap<string, number>,
  fresh: (cardId: string) => boolean,
  now: EpochMs,
  visit: number,
): WordUnderCounter | null {
  const due = [...memory.entries()]
    .filter(([id, word]) => word.due <= now && (owned.get(id) ?? 0) > 0)
    .sort((a, b) => a[1].due - b[1].due || a[0].localeCompare(b[0]))
    .map(([id]) => id);
  const slipping = pickAt(due, visit);
  if (slipping !== undefined) return { cardId: slipping, kind: "slipping", fresh: fresh(slipping) };
  const mine = [...owned.entries()]
    .filter(([, quantity]) => quantity > 0)
    .map(([id]) => id)
    .sort();
  const unread = mine.filter(fresh);
  const word = pickAt(unread.length > 0 ? unread : mine, visit);
  return word === undefined ? null : { cardId: word, kind: "owned", fresh: fresh(word) };
}

function pickAt<T>(items: readonly T[], visit: number): T | undefined {
  return items.length === 0 ? undefined : items[Math.abs(Math.trunc(visit)) % items.length];
}

// --- Floating buttons -----------------------------------------------------------------------

export type FabId =
  | "missions"
  | "clan"
  | "chat"
  | "jousts"
  | "friends"
  | "daily"
  | "coffrets"
  | "mail"
  | "settings";

export interface Fab {
  readonly id: FabId;
  readonly label: string;
  /** Red count of what waits for the player; 0 shows nothing (never a nudge to come back). */
  readonly badge: number;
  /** « Niv. 10 » when closed by the level. */
  readonly lock: string | null;
  /** Gold and pulsing: a coffret waits. */
  readonly glow: boolean;
}

export interface FabInput {
  readonly level: number;
  readonly coffrets: number;
  readonly mail: number;
  /** Missions done and bonus sachets that wait to be claimed. */
  readonly missions?: number;
}

export function playFabs(input: FabInput, now: EpochMs): { left: Fab[]; right: Fab[] } {
  const levels = levelsOfFeatures(now);
  const lockOf = (featureLevel: number) =>
    input.level >= featureLevel ? null : levelBadge(featureLevel);
  const fab = (id: FabId, label: string, extra: Partial<Fab> = {}): Fab => ({
    id,
    label,
    badge: 0,
    lock: null,
    glow: false,
    ...extra,
  });
  return {
    left: [
      fab("missions", MISSIONS_TITLE, {
        lock: lockOf(missionRulesAt(MISSION_SCHEDULE, now).opensAtLevel),
        badge: input.missions ?? 0,
        glow: (input.missions ?? 0) > 0,
      }),
      fab("clan", "Clan", { lock: lockOf(levels.join_clan) }),
      fab("chat", "Discussion", { lock: lockOf(levels.join_clan) }),
      fab("jousts", "Joutes", { lock: lockOf(levels.jousts) }),
    ],
    right: [
      fab("daily", "Défi du jour"),
      fab("friends", "Amis"),
      fab("coffrets", "Récompenses", { badge: input.coffrets, glow: input.coffrets > 0 }),
      fab("mail", "Courrier", { badge: input.mail }),
      fab("settings", "Réglages"),
    ],
  };
}
