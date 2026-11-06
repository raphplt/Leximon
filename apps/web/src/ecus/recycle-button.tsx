"use client";

import { hasDoubles, RECYCLE_OPEN } from "@leximon/view-model";
import { ownedCards } from "@/player/collection";
import { useShared } from "@/player/resource";
import { useShell } from "@/shell/shell-context";
import { Button, type ButtonVariant } from "@/ui/button";

/** Opens the window where the player picks the doubles to recycle. Hidden without a double. */
export function RecycleButton({
  variant = "secondary",
  small,
  wide,
  className,
  onOpen,
}: {
  readonly variant?: ButtonVariant;
  readonly small?: boolean;
  readonly wide?: boolean;
  readonly className?: string;
  /** Closes the window the button sits in, so that the two never stack. */
  readonly onOpen?: () => void;
}) {
  const owned = useShared(ownedCards);
  const { openRecycle } = useShell();
  if (owned === null || !hasDoubles(owned)) return null;
  return (
    <Button
      variant={variant}
      small={small}
      wide={wide}
      className={className}
      onClick={() => {
        onOpen?.();
        openRecycle();
      }}
    >
      {RECYCLE_OPEN}
    </Button>
  );
}
