import type { RewardIcon } from "@leximon/view-model";
import type { IconName } from "@/ui/icon";

/** The web icon of each reward. */
export const REWARD_ICONS: Readonly<Record<RewardIcon | "lock", IconName>> = {
  sachet: "sachet",
  bolt: "bolt",
  star: "star",
  plume: "plume",
  carte: "carte",
  plus: "plus",
  profil: "profil",
  cadre: "palette",
  pin: "pin",
  lock: "lock",
};
