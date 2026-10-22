"use client";

import { useEffect, useState } from "react";
import styles from "@/account/account-screen.module.css";
import { recordInterest } from "@/lib/api";

/**
 * The patron offer, announced before it is sold: opening the page and asking to be told are
 * counted, nothing is sold.
 */
export function PatronScreen() {
  const [asked, setAsked] = useState(false);

  useEffect(() => {
    // A lost signal only skews the count: the page works without it.
    recordInterest("patron_door").catch(() => undefined);
  }, []);

  const ask = () => {
    setAsked(true);
    recordInterest("patron_notify").catch(() => undefined);
  };

  return (
    <main className={styles.screen}>
      <header className={styles.header}>
        <p className={styles.kicker}>Bientôt</p>
        <h1 className={styles.title}>Devenir mécène</h1>
      </header>
      <div className={styles.panel}>
        <p className={styles.text}>
          Leximon reste gratuit, sans pub et sans sachet à vendre. Les mécènes le font vivre, et ça
          se voit.
        </p>
        <ul className={styles.text}>
          <li>Un cosmétique par mois, annoncé d'avance et gardé à vie.</li>
          <li>Le titre de mécène sur ton profil, ton pseudo dans les crédits.</li>
          <li>Le carnet : les statistiques de tes mots et ton album à imprimer.</li>
          <li>Ta voix sur l'ordre des prochaines collections.</li>
        </ul>
        <p className={styles.text}>
          Pas de sachet, pas de carte, pas d'XP : rien qui fasse gagner.
        </p>
        <p className={styles.text}>
          <strong>3,99 € par mois</strong> ou <strong>29,99 € par an</strong>.
        </p>
        {asked ? (
          <p className={styles.text} role="status">
            Noté. Tu seras dans les premiers.
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
