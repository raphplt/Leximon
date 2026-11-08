"use client";

import type { LeaveWords } from "@leximon/view-model";
import { useRouter } from "next/navigation";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { MainAction, PaperAction } from "@/library/play-pieces";
import { Dialog } from "./dialog";
import styles from "./leave-guard.module.css";

/** Marks the copy of the page pushed in front of it, which the back button lands on first. */
const GUARD = "__lxLeaveGuard";

/**
 * Asks before a game in progress is left, by a link of the page, the back button or the screen's
 * own way out (`ask`). Closing or reloading the tab gets the browser's own question.
 */
export function useLeaveGuard(
  active: boolean,
  words: LeaveWords,
): {
  readonly ask: (leave: () => void) => void;
  /** The window is open: the screen's own keys wait. */
  readonly asking: boolean;
  readonly dialog: ReactNode;
} {
  const router = useRouter();
  const [leaving, setLeaving] = useState<(() => void) | null>(null);
  // Set once the player chose to leave the page: the guard lets that move go through.
  const released = useRef(false);

  const ask = useCallback(
    (leave: () => void) => {
      if (active) setLeaving(() => leave);
      else leave();
    },
    [active],
  );

  useEffect(() => {
    if (!active) return;
    released.current = false;
    const onUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, [active]);

  // A link to another page of the game asks first, before the router sees the click.
  useEffect(() => {
    if (!active) return;
    const onClick = (event: MouseEvent) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }
      const link = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!(link instanceof HTMLAnchorElement) || link.target === "_blank") return;
      const url = new URL(link.href);
      if (url.origin !== window.location.origin || url.pathname === window.location.pathname) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      // The new page takes the place of the copy pushed for the back button.
      setLeaving(() => () => {
        released.current = true;
        router.replace(`${url.pathname}${url.search}${url.hash}`);
      });
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [active, router]);

  // The back button: a copy of the page stands in front of it, so going back stays here and asks.
  useEffect(() => {
    if (!active) return;
    const guard = () =>
      window.history.pushState(
        { ...window.history.state, [GUARD]: true },
        "",
        window.location.href,
      );
    guard();
    const onPop = () => {
      if (released.current) return;
      guard();
      setLeaving(() => () => {
        released.current = true;
        window.history.go(-2);
      });
    };
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      // The game ended here: the copy goes, so that the back button leaves at once.
      if (!released.current && window.history.state?.[GUARD] === true) window.history.back();
    };
  }, [active]);

  const stay = () => setLeaving(null);
  const leave = () => {
    const go = leaving;
    setLeaving(null);
    go?.();
  };

  const dialog = (
    <Dialog open={leaving !== null} title={words.title} onClose={stay} variant="center">
      <p className={styles.text}>{words.text}</p>
      <div className={styles.actions}>
        <MainAction label={words.stay} onClick={stay} />
        <PaperAction label={words.leave} onClick={leave} />
      </div>
    </Dialog>
  );
  return { ask, asking: leaving !== null, dialog };
}
