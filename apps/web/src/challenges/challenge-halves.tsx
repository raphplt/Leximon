"use client";

import {
  CHALLENGE_HALVES,
  type ChallengeHalf,
  joustsHalf,
  trainingHalfLine,
} from "@leximon/view-model";
import Link from "next/link";
import type { ReactNode } from "react";
import { Crest } from "@/jousts/crest";
import { CountBadge } from "@/library/play-pieces";
import { reviewSummary } from "@/player/collection";
import { joustsOverview } from "@/player/jousts";
import { useShared } from "@/player/resource";
import { Lettering, ToyIcon, toyClass } from "@/ui/toy";
import styles from "./challenge-halves.module.css";

const HREFS: Readonly<Record<ChallengeHalf, string>> = { training: "/defis", jousts: "/joutes" };

/**
 * The two halves of Défis, side by side at the top of each: the training on the player's words,
 * and the jousts with their league, their place and what waits there.
 */
export function ChallengeHalves({ current }: { readonly current: ChallengeHalf }) {
  const summary = useShared(reviewSummary);
  const jousts = joustsHalf(useShared(joustsOverview));
  const training = trainingHalfLine(summary?.due ?? null);
  const [trainingLabel, joustsLabel] = CHALLENGE_HALVES.map((half) => half.label) as [
    string,
    string,
  ];
  return (
    <nav className={styles.halves} aria-label="Défis">
      <Half
        id="training"
        current={current}
        label={trainingLabel}
        matter="blue"
        emblem={<ToyIcon name="challenges" size={40} />}
        lines={training === null ? [] : [training]}
        waiting={0}
      />
      <Half
        id="jousts"
        current={current}
        label={joustsLabel}
        matter={jousts.lockedAt === null ? "red" : "locked"}
        emblem={
          jousts.league === null ? (
            <ToyIcon name="jousts" size={40} locked={jousts.lockedAt !== null} />
          ) : (
            <Crest league={jousts.league} size={36} />
          )
        }
        lines={jousts.lines}
        waiting={jousts.waiting}
      />
    </nav>
  );
}

function Half({
  id,
  current,
  label,
  matter,
  emblem,
  lines,
  waiting,
}: {
  readonly id: ChallengeHalf;
  readonly current: ChallengeHalf;
  readonly label: string;
  readonly matter: "blue" | "red" | "locked";
  readonly emblem: ReactNode;
  readonly lines: readonly string[];
  readonly waiting: number;
}) {
  const here = id === current;
  return (
    <Link
      href={HREFS[id]}
      className={toyClass(matter, "box", true, styles.half)}
      aria-current={here ? "page" : undefined}
      data-here={here || undefined}
    >
      <span className={styles.emblem}>{emblem}</span>
      <span className={styles.text}>
        <Lettering className={styles.label}>{label}</Lettering>
        {lines.length > 0 && <span className={styles.line}>{lines.join(" ")}</span>}
      </span>
      {waiting > 0 && <CountBadge count={String(waiting)} className={styles.badge} />}
    </Link>
  );
}
