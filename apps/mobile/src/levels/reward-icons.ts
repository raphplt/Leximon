import type { IconName } from "@leximon/tokens";
import type { RewardIcon } from "@leximon/view-model";

/** The icon of each reward. */
export const REWARD_ICONS: Readonly<Record<RewardIcon, IconName>> = {
  sachet: "sachet",
  bolt: "bolt",
  star: "star",
  plume: "plume",
  carte: "carte",
  plus: "plus",
  profil: "profil",
  cadre: "palette",
  pin: "pin",
};
