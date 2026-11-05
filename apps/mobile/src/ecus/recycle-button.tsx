import {
  ecuRules,
  RECYCLE_BUSY,
  RECYCLE_FAILED,
  recycleAction,
  recycledToast,
  recyclePreview,
} from "@leximon/view-model";
import { useMemo, useState } from "react";
import { useCatalog } from "@/cards/use-catalog";
import { play } from "@/feedback/feedback";
import { ownedCards } from "@/player/collection";
import { recycleAll } from "@/player/ecus";
import { useShared } from "@/player/shared";
import { Button } from "@/ui/button";
import { toast } from "@/ui/toast";

/**
 * « Recycler 12 doubles, +34 écus »: says what it does before doing it, from the copies the screen
 * knows; the server recycles what exists when it gets the request. Hidden with nothing to recycle.
 */
export function RecycleButton({ secondary = true }: { readonly secondary?: boolean }) {
  const owned = useShared(ownedCards);
  const catalog = useCatalog();
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
      label={busy ? RECYCLE_BUSY : label}
      secondary={secondary}
      disabled={busy}
      onPress={recycle}
    />
  );
}
