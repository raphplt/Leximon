"use client";

import {
  ecuRules,
  RECYCLE_BUSY,
  RECYCLE_FAILED,
  recycleAction,
  recycledToast,
  recyclePreview,
} from "@leximon/view-model";
import { useMemo, useState } from "react";
import { play } from "@/booster/feedback";
import { useCatalog } from "@/cards/use-catalog";
import { ownedCards } from "@/player/collection";
import { recycleAll } from "@/player/ecus";
import { useShared } from "@/player/resource";
import { Button, type ButtonVariant } from "@/ui/button";
import { useToast } from "@/ui/toast";

/**
 * « Recycler 12 doubles, +34 écus »: says what it does before doing it, from the copies the screen
 * knows; the server recycles what exists when it gets the request. Hidden with nothing to recycle.
 */
export function RecycleButton({
  variant = "secondary",
  small,
  wide,
  className,
}: {
  readonly variant?: ButtonVariant;
  readonly small?: boolean;
  readonly wide?: boolean;
  readonly className?: string;
}) {
  const owned = useShared(ownedCards);
  const catalog = useCatalog();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const plan = useMemo(
    () =>
      owned === null || catalog === null
        ? null
        : recyclePreview(ecuRules(Date.now()), [...catalog.cardsById.values()], owned),
    [owned, catalog],
  );
  const label = plan === null ? null : recycleAction(plan);
  if (label === null) return null;
  const recycle = () => {
    setBusy(true);
    recycleAll()
      .then((result) => {
        if (result.copies > 0) play("coins");
        toast(recycledToast(result));
      })
      .catch(() => toast(RECYCLE_FAILED))
      .finally(() => setBusy(false));
  };
  return (
    <Button
      variant={variant}
      small={small}
      wide={wide}
      className={className}
      disabled={busy}
      onClick={recycle}
    >
      {busy ? RECYCLE_BUSY : label}
    </Button>
  );
}
