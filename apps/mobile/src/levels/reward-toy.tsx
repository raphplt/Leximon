import { lettrineInks, toyIconInks } from "@leximon/tokens";
import type { RewardIcon } from "@leximon/view-model";
import { ToyBody, ToyIcon } from "@/ui/toy";
import { REWARD_SIGNS } from "./reward-icons";

/** The rewards drawn as they are; the rest is a coin bearing the reward's sign. */
const DRAWN: ReadonlySet<RewardIcon | "lock"> = new Set(["sachet", "star", "ecu", "lock"]);

/**
 * A reward's sign in its own inks, for a cell that is already its ground (a case, a day, a
 * coffret). A garnished sachet is gilt.
 */
export function RewardSign({
  icon,
  size,
  locked = false,
}: {
  readonly icon: RewardIcon | "lock";
  readonly size: number;
  readonly locked?: boolean;
}) {
  const name = REWARD_SIGNS[icon].icon;
  return (
    <ToyIcon
      name={name}
      size={size}
      locked={locked}
      inks={icon === "star" ? toyIconInks.gilded : toyIconInks[name]}
    />
  );
}

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
  if (DRAWN.has(icon)) return <RewardSign icon={icon} size={size} locked={dim} />;
  const look = REWARD_SIGNS[icon];
  return (
    <ToyBody
      matter={dim ? "locked" : look.matter}
      shape="round"
      style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}
    >
      <ToyIcon
        name={look.icon}
        size={Math.round(size * 0.56)}
        locked={dim}
        inks={lettrineInks(look.icon)}
      />
    </ToyBody>
  );
}
