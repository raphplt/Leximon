import type { ClaimRefusal, LevelRewardView } from "@leximon/contract";
import { capitalize, plural } from "./format";
import { claimRefusalMessage, type RewardItem, rewardItem } from "./rewards";

/** Every coffret waiting, opened one after another in a single gesture. */

/** The button that opens them all, where there is room to say how many. */
export function openAllLabel(count: number): string {
  return `Ouvrir les ${count} coffrets`;
}

/** The same button where room is short, beside « Ouvrir un coffret ». */
export const OPEN_ALL_SHORT = "Tout ouvrir";

/** « Ouverture… 3 / 16 », while the coffrets open. */
export function openingAllLabel(done: number, total: number): string {
  return `Ouverture… ${done} / ${total}`;
}

/** « 16 coffrets ouverts ! », the « ! » held to its word. */
export function openedAllTitle(count: number): string {
  return `${capitalize(plural(count, "coffret ouvert", "coffrets ouverts"))}\u202f!`;
}

/** Over the chest while the coffrets open. */
export const OPENING_ALL_TITLE = "Les coffrets s'ouvrent";

/** « Niveau 4 », « Niveaux 3 et 5 », « Niveaux 2 à 17 »: where the opened coffrets came from. */
export function openedLevelsLabel(levels: readonly number[]): string {
  const [first] = levels;
  const last = levels[levels.length - 1];
  if (first === undefined || last === undefined) return "";
  if (levels.length === 1) return `Niveau ${first}`;
  if (levels.length === 2) return `Niveaux ${first} et ${last}`;
  return `Niveaux ${first} à ${last}`;
}

/** Why the coffrets stopped opening before the last, and what to do; the others wait. */
export function openAllStopped(stop: ClaimRefusal | "failed", left: number, level: number): string {
  const closed =
    left === 1 ? "1 coffret reste fermé" : `${plural(left, "coffret", "coffrets")} restent fermés`;
  switch (stop) {
    case "reserve_full":
      return `Ta réserve de sachets bonus est pleine, donc ${closed}. Ouvre un sachet bonus pour ${left === 1 ? "le" : "les"} récupérer.`;
    case "failed":
      return `Le serveur ne répond plus, donc ${closed}. Réessaie dans un instant.`;
    default:
      return claimRefusalMessage(stop, level);
  }
}

export interface RewardTally {
  /** One of the rewards counted, to draw them by; écus carry their sum. */
  readonly reward: LevelRewardView;
  readonly count: number;
  readonly item: RewardItem;
}

/** Rewards that add up; titles, avatars and frames are each their own. */
type CountedKind =
  | "bonus_booster"
  | "garni_booster"
  | "precious_garni_booster"
  | "reserve_slot"
  | "pinned_slot"
  | "refill";

function countedItem(kind: CountedKind, count: number): RewardItem {
  switch (kind) {
    case "bonus_booster":
      return {
        icon: "sachet",
        title: capitalize(plural(count, "sachet bonus", "sachets bonus")),
        detail: "À ouvrir quand ton stock gratuit est vide",
      };
    case "garni_booster":
      return {
        icon: "star",
        title: capitalize(plural(count, "sachet garni", "sachets garnis")),
        detail: "Au moins une carte Rare garantie dans chacun",
      };
    case "precious_garni_booster":
      return {
        icon: "star",
        title: capitalize(plural(count, "sachet garni Précieux", "sachets garnis Précieux")),
        detail: "Au moins une carte Précieuse garantie dans chacun",
      };
    case "reserve_slot":
      return {
        icon: "plus",
        title: "Réserve agrandie",
        detail: `Ta réserve garde ${plural(count, "sachet bonus", "sachets bonus")} de plus`,
      };
    case "pinned_slot":
      return {
        icon: "pin",
        title: capitalize(`${plural(count, "épingle", "épingles")} de plus`),
        detail: `${capitalize(plural(count, "carte", "cartes"))} de plus à mettre en avant sur ton profil`,
      };
    case "refill":
      return {
        icon: "bolt",
        title: capitalize(plural(count, "recharge", "recharges")),
        detail: "Ton stock de sachets est rempli",
      };
  }
}

function isCounted(reward: LevelRewardView): reward is LevelRewardView & { kind: CountedKind } {
  return (
    reward.kind === "bonus_booster" ||
    reward.kind === "garni_booster" ||
    reward.kind === "precious_garni_booster" ||
    reward.kind === "reserve_slot" ||
    reward.kind === "pinned_slot" ||
    reward.kind === "refill"
  );
}

/**
 * The rewards of several coffrets, the same ones counted together (« 12 sachets bonus »), in the
 * order they first came.
 */
export function tallyRewards(rewards: readonly LevelRewardView[]): RewardTally[] {
  const tallies: RewardTally[] = [];
  const at = new Map<string, number>();
  for (const reward of rewards) {
    const key = isCounted(reward) || reward.kind === "ecus" ? reward.kind : null;
    const index = key === null ? undefined : at.get(key);
    const before = index === undefined ? undefined : tallies[index];
    if (key === null || index === undefined || before === undefined) {
      if (key !== null) at.set(key, tallies.length);
      tallies.push({ reward, count: 1, item: rewardItem(reward) });
      continue;
    }
    if (reward.kind === "ecus" && before.reward.kind === "ecus") {
      const sum = { kind: "ecus", amount: before.reward.amount + reward.amount } as const;
      tallies[index] = { reward: sum, count: 1, item: rewardItem(sum) };
    } else if (isCounted(reward)) {
      const count = before.count + 1;
      tallies[index] = { reward, count, item: countedItem(reward.kind, count) };
    }
  }
  return tallies;
}
