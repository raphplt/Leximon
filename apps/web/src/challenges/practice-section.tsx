"use client";

import type { PracticeScope, PracticeSummaryResponse } from "@leximon/contract";
import { type Catalog, collectionName } from "@leximon/contract/client";
import { PRACTICE_SCHEDULE, practiceRulesAt } from "@leximon/core";
import {
  isFeatureOpen,
  PRACTICE_RULE,
  PRACTICE_THEMES_CLOSED,
  type PracticeChoice,
  practiceEmptyLine,
  practiceView,
} from "@leximon/view-model";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { usePackShape } from "@/lib/use-pack-shape";
import { useProgress } from "@/progress/use-progress";
import ui from "@/ui/ui.module.css";
import styles from "./practice-section.module.css";

/** Series on a scope the player picks. Read on arrival: the screen comes back after each series. */
export function PracticeSection({
  catalog,
  now,
  busy,
  onPick,
}: {
  readonly catalog: Catalog;
  readonly now: number;
  readonly busy: boolean;
  readonly onPick: (scope: PracticeScope) => void;
}) {
  const [summary, setSummary] = useState<PracticeSummaryResponse | null>(null);
  const progress = useProgress();
  const { noun } = usePackShape();
  useEffect(() => {
    api
      .fetchPracticeSummary()
      .then(setSummary)
      // Practice is an extra: the rest of the screen works without it.
      .catch(() => setSummary(null));
  }, []);
  if (summary === null || progress === null || now === 0) return null;

  const themesOpen = isFeatureOpen("practice_choice", progress.level, now);
  const view = practiceView(summary, (id) => collectionName(catalog, id), themesOpen, now);
  const families = [view.mine, view.collections, view.themes].filter((list) => list.length > 0);
  return (
    <section aria-labelledby="practice-title">
      <h2 id="practice-title" className={`${ui.display} ${styles.title}`}>
        S'entraîner
      </h2>
      <div className={`${ui.panel} ${styles.panel}`}>
        {families.length === 0 ? (
          <p className={styles.line}>
            {practiceEmptyLine(practiceRulesAt(PRACTICE_SCHEDULE, now).minWords, noun)}
          </p>
        ) : (
          <>
            <p className={styles.line}>{PRACTICE_RULE}</p>
            {families.map((choices) => (
              <ul key={choices[0]?.key} className={styles.choices}>
                {choices.map((choice) => (
                  <Choice key={choice.key} choice={choice} busy={busy} onPick={onPick} />
                ))}
              </ul>
            ))}
            {!themesOpen && <p className={styles.closed}>{PRACTICE_THEMES_CLOSED}</p>}
            <p className={styles.xp}>{view.xpLine}</p>
          </>
        )}
      </div>
    </section>
  );
}

function Choice({
  choice,
  busy,
  onPick,
}: {
  readonly choice: PracticeChoice;
  readonly busy: boolean;
  readonly onPick: (scope: PracticeScope) => void;
}) {
  return (
    <li>
      <button
        type="button"
        className={styles.choice}
        disabled={busy}
        onClick={() => onPick(choice.scope)}
      >
        <span className={styles.label}>{choice.label}</span>
        <span className={styles.detail}>{choice.detail}</span>
      </button>
    </li>
  );
}
