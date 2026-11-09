"use client";

import { type JoustTournament, LEAGUE_NAMES, tournamentGain } from "@leximon/view-model";
import { Crest } from "./crest";
import styles from "./jousts.module.css";

/** Under a ranked joust's result: the points won and where the player stands in their group. */
export function TournamentGain({ tournament }: { readonly tournament: JoustTournament }) {
  const gain = tournamentGain(tournament);
  return (
    <div className={styles.gainBar}>
      <span className={styles.gainBarLabel}>
        <Crest league={tournament.league} size={26} />
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
