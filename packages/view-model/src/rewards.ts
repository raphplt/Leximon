import type {
  BoosterWalletResponse,
  ClaimRefusal,
  LevelRewardView,
  Progress,
} from "@leximon/contract";
import {
  type EpochMs,
  FIRST_REWARDED_LEVEL,
  LEVEL_REWARD_SCHEDULE,
  type LevelReward,
  levelRewardRulesAt,
  levelRewards,
  unclaimedLevels,
} from "@leximon/core";
import { opensAt } from "./features";
import { formatCount, plural } from "./format";
import { xpBefore } from "./level";

/** Level rewards (P58): the coffret, the next rewards of the Jouer screen, the level road. */

/** Icons a reward is drawn with; each platform maps them to its own icon set. */
export type RewardIcon = "sachet" | "bolt" | "star" | "plume" | "carte" | "plus" | "profil" | "pin";

export interface RewardItem {
  readonly icon: RewardIcon;
  readonly title: string;
  readonly detail: string;
}

export function rewardItem(reward: LevelRewardView | LevelReward): RewardItem {
  switch (reward.kind) {
    case "bonus_booster":
      return { icon: "sachet", title: "Sachet bonus", detail: "Il attend en réserve" };
    case "refill":
      return { icon: "bolt", title: "Recharge", detail: "Ton stock remis au plein" };
    case "garni_booster":
      return { icon: "star", title: "Sachet garni", detail: "Au moins une Rare dedans" };
    case "title":
      return { icon: "plume", title: "Titre", detail: `« ${reward.title} »` };
    case "card_choice":
      return {
        icon: "carte",
        title: "Carte au choix",
        detail: "Une Courante ou Peu courante qui te manque",
      };
    case "reserve_slot":
      return {
        icon: "plus",
        title: "Réserve +1",
        detail: "Une place de plus pour tes sachets bonus",
      };
    case "avatar":
      return { icon: "profil", title: "Avatar gravé", detail: "Pour ton profil" };
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

/** « 2 récompenses dedans. », under a closed coffret. */
export function coffretHint(level: number, now: EpochMs): string {
  const count = rewardsOfLevel(level, now).length;
  return `${plural(count, "récompense", "récompenses")} dedans.`;
}

/** The toast once a coffret is put away (N-06). */
export function claimedToast(rewards: readonly LevelRewardView[]): string {
  if (rewards.some((r) => r.kind === "refill")) return "Stock remis au plein.";
  return "Rangé dans ta réserve.";
}

/** The button of an opened coffret: what the player does with it. */
export function coffretAction(rewards: readonly LevelRewardView[]): string {
  if (rewards.some((r) => r.kind === "card_choice")) return "Choisir ma carte";
  if (rewards.every((r) => r.kind === "refill")) return "Remplir mon stock";
  return "Ranger dans ma réserve";
}

/** Why a coffret stays closed, and what to do; it waits to be claimed later. */
export function claimRefusalMessage(reason: ClaimRefusal, level: number): string {
  switch (reason) {
    case "reserve_full":
      return "Ta réserve est pleine. Ouvre un sachet bonus, le coffret t'attend.";
    case "stock_full":
      return "Ton stock est plein, la recharge serait perdue. Ouvre un sachet, le coffret t'attend.";
    case "level_not_reached":
      return `Pas encore. Ce coffret s'ouvre au niveau ${level}.`;
    case "guest_archived":
      return "Ta partie est passée sur ton compte. Recharge la page.";
  }
}

/** « 3 / 12 bonus », the reserve and its ceiling, which grows with levels (N-09). */
export function reserveLabel(wallet: Pick<BoosterWalletResponse, "bonus" | "bonusCap">): string {
  return `${wallet.bonus} / ${wallet.bonusCap} bonus`;
}

// --- Next rewards (J-02) -------------------------------------------------------------------------

export interface UpcomingReward {
  readonly level: number;
  readonly icon: RewardIcon | "lock";
  /** Every 5 levels: drawn bigger, in kraft. */
  readonly milestone: boolean;
  /** « Niveau 20 : Carte au choix, ouvre les clans ». */
  readonly label: string;
}

/** The next `count` levels after the player's, with the main thing each gives. */
export function upcomingRewards(level: number, now: EpochMs, count = 4): UpcomingReward[] {
  const rules = levelRewardRulesAt(LEVEL_REWARD_SCHEDULE, now);
  return Array.from({ length: count }, (_, k) => {
    const n = level + 1 + k;
    const first = levelRewards(rules, n)[0];
    const item = first === undefined ? null : rewardItem(first);
    const opens = opensAt(n, now);
    return {
      level: n,
      icon: opens !== null ? "lock" : (item?.icon ?? "star"),
      milestone: n % rules.milestoneEvery === 0,
      label: `Niveau ${n} : ${item?.title ?? "Départ"}${opens === null ? "" : `, ouvre ${opens.charAt(0).toLowerCase()}${opens.slice(1)}`}`,
    };
  });
}

// --- Level road (N-01 to N-03) -------------------------------------------------------------------

export type RoadState = "claimed" | "claimable" | "next" | "locked";

export interface RoadNode {
  readonly level: number;
  readonly state: RoadState;
  readonly milestone: boolean;
  readonly summary: string;
  /** « Les échanges », what the level opens (P59). */
  readonly opens: string | null;
  readonly label: string;
}

/** The road from the top down to level 1: at least to level 30, and a dozen levels ahead. */
export function roadNodes(
  level: number,
  claimed: readonly number[],
  now: EpochMs,
  options: { readonly minTop?: number; readonly ahead?: number } = {},
): RoadNode[] {
  const rules = levelRewardRulesAt(LEVEL_REWARD_SCHEDULE, now);
  const done = new Set(claimed);
  const top = Math.max(options.minTop ?? 30, level + (options.ahead ?? 12));
  const nodes: RoadNode[] = [];
  for (let n = top; n >= 1; n--) {
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

export interface RoadLayout {
  readonly width: number;
  readonly height: number;
  readonly points: readonly RoadPoint[];
  /** SVG path through every level, top to bottom. */
  readonly path: string;
  /** SVG path from the player's level down to level 1: the part already travelled. */
  readonly donePath: string;
}

/** Sway of the road, level by level, as a share of the amplitude: it winds every 8 levels. */
const SWAY = [0, 0.6, 0.95, 0.6, 0, -0.6, -0.95, -0.6] as const;

/** Where each level sits on a winding road, highest first. */
export function roadLayout(
  levels: readonly number[],
  current: number,
  size: { readonly width: number; readonly rowHeight: number; readonly amplitude: number },
): RoadLayout {
  const center = size.width / 2;
  const points = levels.map((level, index) => ({
    level,
    x: center + (SWAY[level % SWAY.length] ?? 0) * size.amplitude,
    y: index * size.rowHeight + size.rowHeight / 2,
  }));
  const half = size.rowHeight / 2;
  const pathOf = (list: readonly RoadPoint[]) =>
    list
      .map((p, i) => {
        const previous = list[i - 1];
        return previous === undefined
          ? `M${p.x} ${p.y}`
          : `C${previous.x} ${previous.y + half} ${p.x} ${p.y - half} ${p.x} ${p.y}`;
      })
      .join(" ");
  const from = Math.max(
    0,
    points.findIndex((p) => p.level === current),
  );
  return {
    width: size.width,
    height: levels.length * size.rowHeight,
    points,
    path: pathOf(points),
    donePath: pathOf(points.slice(from)),
  };
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
        ? [{ icon: "star", title: "Bienvenue", detail: "Tout commence ici" }]
        : rewards.map(rewardItem),
    opens: opensAt(level, now),
    state,
    xpLeft:
      state === "next" || state === "locked"
        ? `Encore ${formatCount(xpBefore(progress, level))} XP.`
        : null,
  };
}
