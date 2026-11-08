import type { ToyIconName, ToyMatterName } from "@leximon/tokens";
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
  ecu: "ecu",
  lock: "lock",
};

/** Each reward as an illuminated letter: a filled icon and the ground it is painted on. */
export const REWARD_LETTRINES: Readonly<
  Record<RewardIcon | "lock", { readonly icon: ToyIconName; readonly matter: ToyMatterName }>
> = {
  sachet: { icon: "sachet", matter: "red" },
  bolt: { icon: "sachet", matter: "green" },
  star: { icon: "sachet", matter: "gold" },
  plume: { icon: "ink", matter: "red" },
  carte: { icon: "blank", matter: "blue" },
  plus: { icon: "chest", matter: "blue" },
  profil: { icon: "sketch", matter: "green" },
  cadre: { icon: "gilded", matter: "gold" },
  pin: { icon: "album", matter: "red" },
  ecu: { icon: "ecu", matter: "gold" },
  lock: { icon: "lock", matter: "gold" },
};
