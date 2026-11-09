"use client";

import type { LeagueId } from "@leximon/contract";
import { toyMatters, toy as toyValues } from "@leximon/tokens";
import {
  type JoustTournament,
  LEAGUE_NAMES,
  leagueNumeral,
  tournamentGain,
} from "@leximon/view-model";
import styles from "./jousts.module.css";

/** Each league in its matter, from paper to gold, bronze and silver just below. */
export const LEAGUE_MATTERS: Readonly<Record<LeagueId, keyof typeof toyMatters>> = {
  page: "paper",
  ecuyer: "green",
  chevalier: "blue",
  banneret: "red",
  marechal: "dark",
  connetable: "locked",
  champion: "gold",
};

/** A league's shield, in its matter, with its numeral; Champion wears a crown. */
export function Shield({ league, size }: { readonly league: LeagueId; readonly size: number }) {
  const matter = toyMatters[LEAGUE_MATTERS[league]];
  const numeral = leagueNumeral(league);
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
          fontSize={numeral.length > 2 ? 12 : 14}
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

/** Under a ranked joust's result: the points won and where the player stands in their group. */
export function TournamentGain({ tournament }: { readonly tournament: JoustTournament }) {
  const gain = tournamentGain(tournament);
  return (
    <div className={styles.gainBar}>
      <span className={styles.gainBarLabel}>
        <Shield league={tournament.league} size={26} />
        {LEAGUE_NAMES[tournament.league]}
      </span>
      {gain.place !== null && (
        <span className={styles.gainBarLabel} data-move={gain.move ?? undefined}>
          {gain.place}
        </span>
      )}
    </div>
  );
}
