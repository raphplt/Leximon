"use client";

import { useEffect, useState } from "react";
import styles from "@/account/account-screen.module.css";
import { api } from "@/lib/api";

/**
 * The patron offer, announced before it is sold: opening the page and asking to be told are
 * counted, nothing is sold.
 */
export function PatronScreen() {
  const [asked, setAsked] = useState(false);

  useEffect(() => {
    // A lost signal only skews the count: the page works without it.
    api.recordInterest("patron_door").catch(() => undefined);
  }, []);

  const ask = () => {
    setAsked(true);
    api.recordInterest("patron_notify").catch(() => undefined);
  };

  return (
    <main className={styles.screen}>
      <header className={styles.header}>
        <p className={styles.kicker}>Bientôt</p>
        <h1 className={styles.title}>Devenir mécène</h1>
      </header>
      <div className={styles.panel}>
        <p className={styles.text}>
          Leximon est gratuit, sans publicité et sans sachet à acheter. Avec l'abonnement mécène, tu
          soutiens le jeu.
        </p>
        <ul className={styles.text}>
          <li>
            Un avatar, un cadre ou un titre exclusif chaque mois, annoncé à l'avance et gardé à vie.
          </li>
          <li>Le titre de mécène sur ton profil, ton pseudo dans les crédits.</li>
          <li>Un carnet avec les statistiques de tes mots et ton album à imprimer.</li>
          <li>Ta voix sur l'ordre des prochaines collections.</li>
        </ul>
        <p className={styles.text}>
          Aucun avantage dans le jeu. Un mécène n'a ni sachet, ni carte, ni XP en plus.
        </p>
        <p className={styles.text}>
          <strong>3,99 € par mois</strong> ou <strong>29,99 € par an</strong>.
        </p>
        {asked ? (
          <p className={styles.text} role="status">
            C'est noté. On te préviendra à l'ouverture des abonnements.
          </p>
        ) : (
          <button type="button" className={styles.primary} onClick={ask}>
            Préviens-moi
          </button>
        )}
      </div>
    </main>
  );
}
