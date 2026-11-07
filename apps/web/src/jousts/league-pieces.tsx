"use client";

import type { JoustStanding, LeagueId } from "@leximon/contract";
import { toyMatters, toy as toyValues } from "@leximon/tokens";
import {
  divisionName,
  divisionNumeral,
  divisionShare,
  laurelsDelta,
  standingHeader,
} from "@leximon/view-model";
import type { CSSProperties } from "react";
import { Icon } from "@/ui/icon";
import { Lettering } from "@/ui/toy";
import styles from "./jousts.module.css";

/** Each league in its matter, from paper to gold. */
export const LEAGUE_MATTERS: Readonly<Record<LeagueId, keyof typeof toyMatters>> = {
  page: "paper",
  ecuyer: "green",
  chevalier: "blue",
  banneret: "red",
  champion: "gold",
};

/** A league's shield, in its matter, with the division's numeral; Champion wears a crown. */
export function Shield({
  league,
  numeral,
  size,
}: {
  readonly league: LeagueId;
  readonly numeral: string | null;
  readonly size: number;
}) {
  const matter = toyMatters[LEAGUE_MATTERS[league]];
  const gradient = `shield-${league}`;
  return (
    <svg
      className={styles.shield}
      width={size}
      height={size * 1.15}
      viewBox="0 0 40 46"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={matter.top} />
          <stop offset="1" stopColor={matter.bottom} />
        </linearGradient>
      </defs>
      <path
        d="M20 2 L37 8 V22 C37 33 29 40 20 44 C11 40 3 33 3 22 V8 Z"
        fill={matter.edge}
        stroke={toyValues.outline}
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
      <path
        d="M20 4.5 L34.5 9.6 V21.5 C34.5 31 27.6 37 20 40.6 C12.4 37 5.5 31 5.5 21.5 V9.6 Z"
        fill={`url(#${gradient})`}
      />
      <path d="M8 11 L20 7 L32 11" fill="none" stroke={toyMatters.paper.top} strokeOpacity="0.55" />
      {numeral === null ? (
        <path
          d="M12 26 L14 17 L18 22 L20 15 L22 22 L26 17 L28 26 Z"
          fill={toyMatters.paper.top}
          stroke={toyValues.outline}
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      ) : (
        <text
          x="20"
          y="28"
          textAnchor="middle"
          fontFamily="Georgia, serif"
          fontWeight="700"
          fontSize={numeral === "III" ? 12 : 14}
          fill={toyMatters.paper.top}
          stroke={toyValues.outline}
          strokeWidth="2.2"
          paintOrder="stroke"
        >
          {numeral}
        </text>
      )}
    </svg>
  );
}

/** The player's league at the top of the jousts' home: shield, laurels, the way to the next. */
export function LeagueHeader({
  standing,
  today,
}: {
  readonly standing: JoustStanding;
  readonly today: string;
}) {
  const header = standingHeader(standing, today);
  return (
    <div className={styles.leagueHead}>
      <Shield
        league={standing.division.league}
        numeral={divisionNumeral(standing.division)}
        size={58}
      />
      <div className={styles.leagueText}>
        <Lettering className={styles.leagueName}>{header.name}</Lettering>
        <span className={styles.laurels}>
          <Icon name="star" size={16} /> {header.laurels}
          {header.champion !== null && <span className={styles.emblem}>{header.champion}</span>}
        </span>
        <span className={styles.leagueBar} aria-hidden="true">
          <span style={{ width: `${header.share * 100}%` }} />
        </span>
        <span className={styles.leagueNext}>{header.next}</span>
        {header.streak !== null && <span className={styles.streak}>{header.streak}</span>}
      </div>
      <span className={styles.season}>
        <Icon name="clock" size={14} /> {header.season}
      </span>
    </div>
  );
}

/** Under a ranked joust's result: the laurels won or lost, the bar filling to where they stand. */
export function LaurelsGain({
  laurels,
}: {
  readonly laurels: {
    readonly before: number;
    readonly after: number;
    readonly division: JoustStanding["division"];
    readonly nextDivision: JoustStanding["nextDivision"];
  };
}) {
  const { division, nextDivision } = laurels;
  const from = divisionShare(laurels.before, division, nextDivision);
  const to = divisionShare(laurels.after, division, nextDivision);
  return (
    <div className={styles.gainBar}>
      <span className={styles.gainBarLabel}>
        <Shield league={division.league} numeral={divisionNumeral(division)} size={26} />
        {divisionName(division)}
      </span>
      <span className={styles.leagueBar} aria-hidden="true">
        <span
          className={styles.gainFill}
          style={
            {
              "--from": `${laurels.before < division.from ? 0 : from * 100}%`,
              "--to": `${to * 100}%`,
            } as CSSProperties
          }
        />
      </span>
      <span className={styles.gainBarLabel}>
        {nextDivision === null
          ? laurelsDelta(laurels)
          : `${divisionName(nextDivision)} à ${nextDivision.from}`}
      </span>
    </div>
  );
}
