import type { ToyIconName, ToyMatterName } from "@leximon/tokens";
import type { RewardIcon } from "@leximon/view-model";

/** Each reward's sign: a filled icon, and the ground it is painted on as a lettrine or a coin. */
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
  cadre: { icon: "gilded", matter: "blue" },
  pin: { icon: "album", matter: "red" },
  ecu: { icon: "ecu", matter: "gold" },
  lock: { icon: "lock", matter: "gold" },
};
