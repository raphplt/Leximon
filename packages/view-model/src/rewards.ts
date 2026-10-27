import type {
  BoosterWalletResponse,
  ClaimRefusal,
  LevelRewardView,
  Progress,
} from "@leximon/contract";
import {
  type EpochMs,
  FIRST_REWARDED_LEVEL,
  featuresOpenedAt,
  LEVEL_REWARD_SCHEDULE,
  type LevelReward,
  levelRewardRulesAt,
  levelRewards,
  unclaimedLevels,
} from "@leximon/core";
import { FEATURE_NAMES, FEATURE_WORDS, levelsOfFeatures, opensAt } from "./features";
import { formatCount, plural } from "./format";
import { xpBefore } from "./level";
import { avatarName, frameName } from "./profile";

/** Level rewards: the coffret, the next rewards of the Jouer screen, the level road. */

/** Icons a reward is drawn with; each platform maps them to its own icon set. */
export type RewardIcon =
  | "sachet"
  | "bolt"
  | "star"
  | "plume"
  | "carte"
  | "plus"
  | "profil"
  | "cadre"
  | "pin";

export interface RewardItem {
  readonly icon: RewardIcon;
  readonly title: string;
  readonly detail: string;
}

export function rewardItem(reward: LevelRewardView | LevelReward): RewardItem {
  switch (reward.kind) {
    case "bonus_booster":
      return { icon: "sachet", title: "Sachet bonus", detail: "Il attend en réserve" };
    // Only in the history of coffrets claimed when levels still gave one.
    case "refill":
      return { icon: "bolt", title: "Recharge", detail: "Ton stock remis au plein" };
    case "garni_booster":
      return { icon: "star", title: "Sachet garni", detail: "Au moins une Rare dedans" };
    case "title":
      return { icon: "plume", title: "Titre", detail: `« ${reward.title} »` };
    case "reserve_slot":
      return {
        icon: "plus",
        title: "Réserve +1",
        detail: "Une place de plus pour tes sachets bonus",
      };
    case "avatar":
      return {
        icon: "profil",
        title: "Avatar gravé",
        detail:
          reward.avatar === undefined
            ? "Pour ton profil"
            : `${avatarName(reward.avatar)}, rangé dans l'atelier`,
      };
    case "frame":
      return {
        icon: "cadre",
        title: "Cadre",
        detail: `${frameName(reward.frame)}, rangé dans l'atelier`,
      };
    case "pinned_slot":
      return {
        icon: "pin",
        title: "Place épinglée +1",
        detail: "Une carte de plus sur ton profil",
      };
  }
}

/** What a level gives, under the rules in force. */
export function rewardsOfLevel(level: number, now: EpochMs): LevelReward[] {
  return levelRewards(levelRewardRulesAt(LEVEL_REWARD_SCHEDULE, now), level);
}

/** « Sachet garni · Titre », « Départ » for level 1. */
export function rewardSummary(level: number, now: EpochMs): string {
  const rewards = rewardsOfLevel(level, now);
  return rewards.length === 0 ? "Départ" : rewards.map((r) => rewardItem(r).title).join(" · ");
}

/** Levels reached and not claimed yet, lowest first: the coffrets waiting. */
export function waitingCoffrets(level: number, claimed: readonly number[]): number[] {
  return unclaimedLevels(level, claimed);
}

/** « 1 coffret », « 3 coffrets ». */
export function coffretsLabel(count: number): string {
  return plural(count, "coffret", "coffrets");
}

/** « Coffret du niveau 4 », « Coffrets des niveaux 3 et 5 », « 3 coffrets, niveaux 3 à 6 ». */
export function coffretsMailTitle(levels: readonly number[]): string {
  const [first] = levels;
  const last = levels[levels.length - 1];
  if (first === undefined || last === undefined) return "";
  if (levels.length === 1) return `Coffret du niveau ${first}`;
  if (levels.length === 2) return `Coffrets des niveaux ${first} et ${last}`;
  return `${levels.length} coffrets, niveaux ${first} à ${last}`;
}

/** Above a closed coffret: where it comes from. */
export function coffretReached(level: number): string {
  return `Niveau ${level} atteint`;
}

/** Under an opened coffret that gave sachets: where they went. */
export function reserveAfterClaim(wallet: Pick<BoosterWalletResponse, "bonus">): string {
  return `Dans ta réserve : ${plural(wallet.bonus, "sachet bonus", "sachets bonus")}`;
}

/** The second button of an opened coffret. */
export const COFFRET_ROAD = "Voir le chemin des niveaux";

/** « 2 récompenses dedans. », under a closed coffret. */
export function coffretHint(level: number, now: EpochMs): string {
  const count = rewardsOfLevel(level, now).length;
  return `${plural(count, "récompense", "récompenses")} dedans.`;
}

/** The toast once a coffret is put away. */
export function claimedToast(rewards: readonly LevelRewardView[]): string {
  return rewards.some((r) => r.kind === "bonus_booster" || r.kind === "garni_booster")
    ? "Rangé dans ta réserve."
    : "Rangé dans ton atelier.";
}

/** The button of an opened coffret: what the player does with it. */
export const COFFRET_ACTION = "Ranger dans ma réserve";

/** Why a coffret stays closed, and what to do; it waits to be claimed later. */
export function claimRefusalMessage(reason: ClaimRefusal, level: number): string {
  switch (reason) {
    case "reserve_full":
      return "Ta réserve de sachets bonus est pleine. Ouvre un sachet bonus pour pouvoir récupérer ce coffret.";
    case "level_not_reached":
      return `Pas encore. Ce coffret s'ouvre au niveau ${level}.`;
    case "guest_archived":
      return "Ta partie est passée sur ton compte. Recharge la page.";
  }
}

/** « 3 / 12 bonus », the reserve and its ceiling, which grows with levels. */
export function reserveLabel(wallet: Pick<BoosterWalletResponse, "bonus" | "bonusCap">): string {
  return `${wallet.bonus} / ${wallet.bonusCap} bonus`;
}

// --- Next rewards -------------------------------------------------------------------------

export interface UpcomingReward {
  readonly level: number;
  readonly icon: RewardIcon | "lock";
  /** Every 5 levels: drawn bigger, in kraft. */
  readonly milestone: boolean;
  /** « Sachet garni », the main thing the level gives. */
  readonly title: string;
  /** « Sachet », « Échanges »: one or two words under the icon, the opening first. */
  readonly word: string;
  /** « Ouvre les clans », when the level opens a part of the game. */
  readonly opens: string | null;
  /** « Niveau 20 : Sachet garni, ouvre les clans ». */
  readonly label: string;
}

/** The reward in one or two words, under its icon. */
function rewardWord(reward: LevelReward): string {
  switch (reward.kind) {
    case "bonus_booster":
      return "Sachet";
    case "refill":
      return "Recharge";
    case "garni_booster":
      return "Sachet garni";
    case "title":
      return "Titre";
    case "reserve_slot":
      return "Réserve";
    case "avatar":
      return "Avatar";
    case "frame":
      return "Cadre";
    case "pinned_slot":
      return "Épingle";
  }
}

/** « un sachet garni », the reward as said in a sentence. */
function rewardPhrase(reward: LevelReward): string {
  switch (reward.kind) {
    case "bonus_booster":
      return "un sachet bonus";
    // No level gives one any more.
    case "refill":
      return "une recharge";
    case "garni_booster":
      return "un sachet garni";
    case "title":
      return `le titre « ${reward.title} »`;
    case "reserve_slot":
      return "une place de plus en réserve";
    case "avatar":
      return "un avatar gravé";
    case "frame":
      return "un cadre";
    case "pinned_slot":
      return "une place épinglée de plus";
  }
}

/**
 * « Au niveau 4, une recharge. », under the XP bar. A level that opens a part of the game says
 * that instead: it is the bigger news.
 */
export function nextRewardLine(level: number, now: EpochMs): string {
  const next = level + 1;
  const opened = featuresOpenedAt(levelsOfFeatures(now), next).map((f) => FEATURE_NAMES[f]);
  if (opened.length > 0) {
    const names =
      opened.length === 1
        ? opened[0]
        : `${opened.slice(0, -1).join(", ")} et ${opened[opened.length - 1]}`;
    return `Au niveau ${next}, ${names}.`;
  }
  const first = rewardsOfLevel(next, now)[0];
  return first === undefined
    ? `Niveau ${next} en vue.`
    : `Au niveau ${next}, ${rewardPhrase(first)}.`;
}

/** The next `count` levels after the player's, with the main thing each gives. */
export function upcomingRewards(level: number, now: EpochMs, count = 4): UpcomingReward[] {
  const rules = levelRewardRulesAt(LEVEL_REWARD_SCHEDULE, now);
  return Array.from({ length: count }, (_, k) => {
    const n = level + 1 + k;
    const first = levelRewards(rules, n)[0];
    const item = first === undefined ? null : rewardItem(first);
    const opens = opensAt(n, now);
    const opening = opens === null ? null : `${opens.charAt(0).toLowerCase()}${opens.slice(1)}`;
    const [feature] = featuresOpenedAt(levelsOfFeatures(now), n);
    return {
      level: n,
      icon: opens !== null ? "lock" : (item?.icon ?? "star"),
      milestone: n % rules.milestoneEvery === 0,
      title: item?.title ?? "Départ",
      word:
        feature !== undefined
          ? FEATURE_WORDS[feature]
          : first === undefined
            ? "Départ"
            : rewardWord(first),
      opens: opening === null ? null : `Ouvre ${opening}`,
      label: `Niveau ${n} : ${item?.title ?? "Départ"}${opening === null ? "" : `, ouvre ${opening}`}`,
    };
  });
}

// --- Level road -------------------------------------------------------------------

/** The road is shown one quarter at a time: ten levels, the last one with a garni. */
export const QUARTER_SIZE = 10;

/** Names of the quarters from level 1 up; past the last one, they are numbered. */
const QUARTER_NAMES = [
  "L'Échoppe",
  "Le Scriptorium",
  "La Bibliothèque",
  "Le Cabinet de curiosités",
  "L'Académie",
  "Les Archives",
  "L'Imprimerie",
  "Le Grenier aux grimoires",
  "L'Observatoire",
  "La Tour des lettrés",
] as const;

export interface Quarter {
  /** 1 for levels 1 to 10. */
  readonly index: number;
  readonly name: string;
  readonly first: number;
  readonly last: number;
  /** « Niveaux 11 à 20 ». */
  readonly range: string;
}

export function quarterAt(index: number): Quarter {
  const first = (index - 1) * QUARTER_SIZE + 1;
  const last = index * QUARTER_SIZE;
  return {
    index,
    name: QUARTER_NAMES[index - 1] ?? `Quartier ${index}`,
    first,
    last,
    range: `Niveaux ${first} à ${last}`,
  };
}

export function quarterOfLevel(level: number): Quarter {
  return quarterAt(Math.max(1, Math.ceil(level / QUARTER_SIZE)));
}

export type RoadState = "claimed" | "claimable" | "next" | "locked";

export interface RoadNode {
  readonly level: number;
  readonly state: RoadState;
  readonly milestone: boolean;
  /** Far ahead of the player: drawn in the fog. */
  readonly fog: boolean;
  readonly summary: string;
  /** « Les échanges », what the level opens. */
  readonly opens: string | null;
  readonly label: string;
}

/** How many levels past the player's stay clear of the fog. */
const CLEAR_AHEAD = 2;

/** The levels of a quarter, from its first one up. */
export function quarterNodes(
  quarter: Quarter,
  level: number,
  claimed: readonly number[],
  now: EpochMs,
): RoadNode[] {
  const rules = levelRewardRulesAt(LEVEL_REWARD_SCHEDULE, now);
  const done = new Set(claimed);
  const nodes: RoadNode[] = [];
  for (let n = quarter.first; n <= quarter.last; n++) {
    const state: RoadState =
      n > level
        ? n === level + 1
          ? "next"
          : "locked"
        : n < FIRST_REWARDED_LEVEL || done.has(n)
          ? "claimed"
          : "claimable";
    const summary = rewardSummary(n, now);
    nodes.push({
      level: n,
      state,
      milestone: n % rules.milestoneEvery === 0,
      fog: n > level + CLEAR_AHEAD,
      summary,
      opens: opensAt(n, now),
      label: `Niveau ${n}, ${summary}${state === "claimable" ? ", à réclamer" : ""}`,
    });
  }
  return nodes;
}

export interface RoadPoint {
  readonly level: number;
  readonly x: number;
  readonly y: number;
}

export interface PlateauLayout {
  readonly width: number;
  readonly height: number;
  /** Size of a tile: its top face, and the depth of its sides. */
  readonly tile: { readonly width: number; readonly height: number; readonly depth: number };
  /** Centre of each tile's top face, from the first level up. */
  readonly points: readonly RoadPoint[];
  /** The stepping stones between two tiles; `done` once the player has walked past them. */
  readonly stones: readonly { readonly x: number; readonly y: number; readonly done: boolean }[];
}

const TILE = { width: 120, height: 60, depth: 24 } as const;
/** Column of each tile, in tile widths: the road zigzags across four columns. */
const ZIGZAG = [0, 1, 2, 3, 2, 1] as const;
const PLATEAU = { width: 660, height: 720, side: 90, bottom: 60 } as const;

/**
 * Where each level of a quarter sits on an isometric plateau, in a fixed space the screen
 * scales: each tile one row up and one column aside from the previous one, a stepping stone
 * between them.
 */
export function plateauLayout(levels: readonly number[], current: number): PlateauLayout {
  const points = levels.map((level, index) => ({
    level,
    x: PLATEAU.side + TILE.width / 2 + (ZIGZAG[index % ZIGZAG.length] ?? 0) * TILE.width,
    y: PLATEAU.height - PLATEAU.bottom - index * TILE.height,
  }));
  const stones = points.slice(1).map((point, index) => {
    const previous = points[index] ?? point;
    return {
      x: (previous.x + point.x) / 2,
      y: (previous.y + point.y) / 2,
      done: point.level <= current,
    };
  });
  return { width: PLATEAU.width, height: PLATEAU.height, tile: TILE, points, stones };
}

export interface LevelDetail {
  readonly level: number;
  readonly title: string;
  readonly items: readonly RewardItem[];
  readonly opens: string | null;
  readonly state: RoadState;
  /** « Encore 1 240 XP. » for a level not reached. */
  readonly xpLeft: string | null;
}

/** The panel beside the road: what a level gives, and whether it waits, is done or ahead. */
export function levelDetail(
  level: number,
  progress: Progress,
  claimed: readonly number[],
  now: EpochMs,
): LevelDetail {
  const state: RoadState =
    level > progress.level
      ? level === progress.level + 1
        ? "next"
        : "locked"
      : level < FIRST_REWARDED_LEVEL || claimed.includes(level)
        ? "claimed"
        : "claimable";
  const rewards = rewardsOfLevel(level, now);
  return {
    level,
    title:
      state === "claimable"
        ? "Un coffret t'attend"
        : state === "claimed"
          ? "Déjà dans ta poche"
          : "Ce qui t'attend",
    items:
      rewards.length === 0
        ? [{ icon: "star", title: "Niveau de départ", detail: "Tes premiers sachets gratuits" }]
        : rewards.map(rewardItem),
    opens: opensAt(level, now),
    state,
    xpLeft:
      state === "next" || state === "locked"
        ? `Encore ${formatCount(xpBefore(progress, level))} XP.`
        : null,
  };
}
