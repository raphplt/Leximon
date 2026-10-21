import type { BoosterSource, BoosterWalletResponse } from "@leximon/contract";
import type { EpochMs } from "@leximon/core";
import { isFeatureOpen, levelBadge, levelsOfFeatures } from "./features";
import { formatWait } from "./format";

/** The Jouer screen (J-05 to J-08) and the stock shown in the top bar (C-01). */

// --- Stock (J-07) --------------------------------------------------------------------------------

export interface StockView {
  readonly stored: number;
  readonly capacity: number;
  readonly bonus: number;
  /** Nothing to open: the sachet turns grey and still. */
  readonly empty: boolean;
  /** « 4 sur 6 · le prochain dans 18 min ». */
  readonly line: string;
  /** « Ouvrir le sachet », « Ouvrir un sachet bonus », « Prochain dans 18 min ». */
  readonly action: string;
  /** « 18 min », « plein »: the short form of the top bar chip. */
  readonly refillShort: string;
  /** « 4 sachets sur 6, 2 bonus en réserve », for screen readers. */
  readonly description: string;
}

export function stockView(wallet: BoosterWalletResponse, now: EpochMs): StockView {
  const wait =
    wallet.nextRefillAt === null ? null : formatWait(Date.parse(wallet.nextRefillAt) - now);
  const { stored, capacity, bonus } = wallet;
  const line =
    stored >= capacity
      ? "Stock plein. Ouvre, ça se recharge."
      : stored > 0
        ? `${stored} sur ${capacity} · le prochain dans ${wait}`
        : bonus > 0
          ? `Stock vide. ${bonus} bonus en réserve.`
          : `Plus rien dans la besace. Prochain sachet dans ${wait}.`;
  return {
    stored,
    capacity,
    bonus,
    empty: stored === 0 && bonus === 0,
    line,
    action:
      stored > 0
        ? "Ouvrir le sachet"
        : bonus > 0
          ? "Ouvrir un sachet bonus"
          : `Prochain dans ${wait}`,
    refillShort: wait ?? "plein",
    description: `${stored} ${stored > 1 ? "sachets" : "sachet"} sur ${capacity}, ${bonus} bonus en réserve`,
  };
}

/** The recap's button once the cards are seen (O-04): open another, a bonus, or wait. */
export function openAgainLabel(wallet: BoosterWalletResponse, now: EpochMs): string {
  if (wallet.stored > 0) return "Ouvrir un autre sachet";
  if (wallet.bonus > 0) return "Ouvrir un sachet bonus";
  const wait =
    wallet.nextRefillAt === null ? "" : `, ${formatWait(Date.parse(wallet.nextRefillAt) - now)}`;
  return `Plus de sachet${wait}`;
}

// --- Collection of the sachet (J-05) --------------------------------------------------------------

export interface CollectionChoice {
  /** `discovery` for the sachet drawn from the whole catalog (P14). */
  readonly id: string;
  readonly name: string;
  readonly short: string;
  readonly source: BoosterSource;
  /** `null` when open, else « Niv. 3 ». */
  readonly lock: string | null;
}

export const DISCOVERY_ID = "discovery";

/**
 * The discovery sachet, then one per published collection. Before the level that opens the
 * choice (P59), only the discovery sachet opens; the others show their level.
 */
export function collectionChoices(
  collections: readonly { readonly id: string; readonly name: string }[],
  level: number,
  now: EpochMs,
): CollectionChoice[] {
  const open = isFeatureOpen("choose_collection", level, now);
  const lock = open ? null : levelBadge(levelsOfFeatures(now).choose_collection);
  return [
    {
      id: DISCOVERY_ID,
      name: "Découverte",
      short: "Découverte",
      source: { kind: "discovery" },
      lock: null,
    },
    ...collections.map((c) => ({
      id: c.id,
      name: c.name,
      short: shortName(c.name),
      source: { kind: "collection", collectionId: c.id } as const,
      lock,
    })),
  ];
}

const ARTICLES = new Set(["le", "la", "les", "l'", "un", "une", "des"]);

/** « Caractères et travers » → « Caractères », « Les Fondateurs » → « Fondateurs »: the first word that is not an article, for chips. */
export function shortName(name: string): string {
  const words = name.split(/\s+/);
  return words.find((w) => !ARTICLES.has(w.toLowerCase())) ?? name;
}

/** The choice kept when the one asked for is closed or gone: the discovery sachet. */
export function pickCollection(
  choices: readonly CollectionChoice[],
  wanted: string | null,
): CollectionChoice {
  const found = choices.find((c) => c.id === wanted && c.lock === null);
  // The discovery sachet is always first and always open.
  return found ?? (choices[0] as CollectionChoice);
}

// --- Word slipping away (J-08) --------------------------------------------------------------------

/** « Lucubrateur est en train de t'échapper. », split so that the word can be set in italics. */
export const SLIPPING_AWAY = { after: " est en train de t'échapper.", action: "Réviser" } as const;

// --- Floating buttons (J-04) -----------------------------------------------------------------------

export type FabId = "clan" | "chat" | "jousts" | "daily" | "coffrets" | "mail" | "settings";

export interface Fab {
  readonly id: FabId;
  readonly label: string;
  /** Red count of what waits for the player; 0 shows nothing (P51: never a nudge to come back). */
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
      fab("clan", "Clan", { lock: lockOf(levels.join_clan) }),
      fab("chat", "Discussion", { lock: lockOf(levels.join_clan) }),
      fab("jousts", "Joutes", { lock: lockOf(levels.jousts) }),
    ],
    right: [
      fab("daily", "Défi du jour"),
      fab("coffrets", "Coffrets", { badge: input.coffrets, glow: input.coffrets > 0 }),
      fab("mail", "Courrier", { badge: input.mail }),
      fab("settings", "Réglages"),
    ],
  };
}
