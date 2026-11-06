import { hasDoubles, RECYCLE_OPEN } from "@leximon/view-model";
import { ownedCards } from "@/player/collection";
import { useShared } from "@/player/shared";
import { Button } from "@/ui/button";
import { openRecycle } from "./recycle-sheet";

/** Opens the sheet where the player picks the doubles to recycle. Hidden without a double. */
export function RecycleButton({
  secondary = true,
  small = false,
  onOpen,
}: {
  readonly secondary?: boolean;
  readonly small?: boolean;
  /** Closes the sheet the button sits in, so that the two never stack. */
  readonly onOpen?: () => void;
}) {
  const owned = useShared(ownedCards);
  if (owned === null || !hasDoubles(owned)) return null;
  return (
    <Button
      label={RECYCLE_OPEN}
      secondary={secondary}
      small={small}
      onPress={() => {
        onOpen?.();
        openRecycle();
      }}
    />
  );
}
