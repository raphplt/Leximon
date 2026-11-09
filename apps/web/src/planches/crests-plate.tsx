"use client";

import type { LeagueId } from "@leximon/contract";
import { LEAGUE_NAMES } from "@leximon/view-model";
import { Crest } from "@/jousts/crest";
import { FuretMedallion } from "@/jousts/furet-medallion";
import { Furet } from "@/jousts/pieces";
import { Lettering } from "@/ui/toy";
import ui from "@/ui/ui.module.css";
import styles from "./crests-plate.module.css";

/**
 * Planche of the seven leagues' crests, large, then at the size of the road, reached or not; and
 * Maître Furet's medallion at the sizes the jousts show it.
 */

const LEAGUES: readonly LeagueId[] = [
  "page",
  "ecuyer",
  "chevalier",
  "banneret",
  "marechal",
  "connetable",
  "champion",
];

export function CrestsPlate() {
  return (
    <main className={styles.plate}>
      <section className={`${ui.leaf} ${styles.sheet}`}>
        <Lettering className={styles.title}>Les sept ligues</Lettering>
        <div className={styles.large}>
          {LEAGUES.map((league) => (
            <figure key={league} className={styles.figure}>
              <Crest league={league} size={150} />
              <figcaption className={styles.name}>{LEAGUE_NAMES[league]}</figcaption>
            </figure>
          ))}
        </div>
      </section>
      <section className={styles.leather}>
        {LEAGUES.map((league) => (
          <Crest key={league} league={league} size={110} />
        ))}
      </section>
      <section className={`${ui.leaf} ${styles.sheet}`}>
        <p className={styles.caption}>
          Sur le chemin : la sienne, puis celles à venir, assombries.
        </p>
        <div className={styles.road}>
          {LEAGUES.map((league, index) => (
            <figure key={league} className={styles.figure}>
              <Crest league={league} size={index === 1 ? 62 : 46} dim={index > 1} />
              <figcaption className={styles.small}>{LEAGUE_NAMES[league]}</figcaption>
            </figure>
          ))}
        </div>
      </section>
      <section className={styles.leather}>
        <FuretMedallion size={150} />
        <FuretMedallion size={84} />
        <FuretMedallion size={64} ribbon={false} />
        <FuretMedallion size={48} ribbon={false} />
      </section>
      <section className={`${ui.leaf} ${styles.sheet}`}>
        <Furet>
          <p>Bienvenue dans la lice. Je te montre comment on joute, puis on croise le fer.</p>
        </Furet>
      </section>
    </main>
  );
}
