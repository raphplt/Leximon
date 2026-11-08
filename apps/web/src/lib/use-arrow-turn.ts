import type { CardRun } from "@leximon/view-model";
import { useEffect } from "react";

/** The left and right arrows turn to the card before or after, unless a field has the keys. */
export function useArrowTurn(run: CardRun | null, onTurn: (cardId: string) => void) {
  useEffect(() => {
    if (run === null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      const { target } = event;
      if (target instanceof Element && target.closest("input, textarea, select, [contenteditable]"))
        return;
      const to = event.key === "ArrowLeft" ? run.previous : run.next;
      if (to === null) return;
      event.preventDefault();
      onTurn(to);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [run, onTurn]);
}
