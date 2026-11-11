"use client";

import type { RiddleResponse } from "@leximon/contract";
import { riddleAction, riddleInvitation, riddleProgressLine } from "@leximon/view-model";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { ButtonLink } from "@/ui/button";
import ui from "@/ui/ui.module.css";
import styles from "./riddle-entry.module.css";

/** The riddle on the Défis screen, read on arrival. */
export function RiddleEntry({ now }: { readonly now: number }) {
  const [riddle, setRiddle] = useState<RiddleResponse | null>(null);
  useEffect(() => {
    api
      .fetchRiddle()
      .then(setRiddle)
      // The riddle is an extra: the rest of the screen works without it.
      .catch(() => setRiddle(null));
  }, []);
  if (riddle === null || now === 0) return null;

  const started = riddle.step > 0 || riddle.outcome !== null;
  return (
    <section className={`${ui.panel} ${styles.panel}`} aria-labelledby="riddle-title">
      <div>
        <h2 id="riddle-title" className={`${ui.display} ${styles.title}`}>
          Énigme du jour
        </h2>
        <p className={styles.line}>
          {started ? riddleProgressLine(riddle) : riddleInvitation(riddle.lastStep, now)}
        </p>
      </div>
      <ButtonLink href="/enigme" variant={riddle.outcome === null ? "primary" : "secondary"} small>
        {riddleAction(riddle)}
      </ButtonLink>
    </section>
  );
}
