import { type IconName, type ToyIconName, toyIconInks } from "@leximon/tokens";
import type { RewardIcon } from "@leximon/view-model";
import { colors } from "@/theme";
import { Icon } from "@/ui/icon";
import { ToyBody, ToyIcon } from "@/ui/toy";

type Matter = "gold" | "red" | "green" | "blue";

/** The sachets and écus are drawn; the rest is a coin bearing the reward's sign. */
const LOOKS: Readonly<
  Record<
    RewardIcon | "lock",
    | { readonly toy: ToyIconName; readonly gilt?: true }
    | { readonly line: IconName; readonly matter: Matter }
  >
> = {
  sachet: { toy: "sachet" },
  star: { toy: "sachet", gilt: true },
  bolt: { line: "bolt", matter: "gold" },
  plume: { line: "plume", matter: "red" },
  carte: { line: "carte", matter: "blue" },
  plus: { line: "plus", matter: "blue" },
  profil: { line: "profil", matter: "green" },
  cadre: { line: "palette", matter: "gold" },
  pin: { line: "pin", matter: "red" },
  ecu: { toy: "ecu" },
  lock: { toy: "lock" },
};

/** A reward as a small toy; `dim` greys it out, for the levels still far ahead. */
export function RewardToy({
  icon,
  size,
  dim = false,
}: {
  readonly icon: RewardIcon | "lock";
  readonly size: number;
  readonly dim?: boolean;
}) {
  const look = LOOKS[icon];
  if ("toy" in look) {
    return (
      <ToyIcon
        name={look.toy}
        size={size}
        locked={dim}
        inks={look.gilt ? toyIconInks.gilded : toyIconInks[look.toy]}
      />
    );
  }
  return (
    <ToyBody
      matter={dim ? "locked" : look.matter}
      shape="round"
      style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}
    >
      <Icon name={look.line} size={Math.round(size * 0.48)} color={colors.paper} />
    </ToyBody>
  );
}
