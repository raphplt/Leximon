import type { Metadata } from "next";
import Link from "next/link";
import styles from "./privacy.module.css";

export const metadata: Metadata = {
  title: "Tes données · Leximon",
  description: "Ce que Leximon garde sur toi, pourquoi, combien de temps, et comment l'effacer.",
};

const CONTACT = "contact@leximon.fr";

/** What the game keeps about a player, in plain words (RGPD, articles 13 and 14). */
export default function PrivacyPage() {
  return (
    <main className={styles.page}>
      <Link href="/" className={styles.logo}>
        Leximon
      </Link>
      <h1 className={styles.title}>Tes données</h1>

      <section className={styles.section}>
        <h2>Liste d'attente</h2>
        <p>
          On garde ton adresse e-mail, et rien d'autre. Elle sert à t'écrire une fois, le jour de
          l'ouverture. Ensuite, on l'efface. Tu nous l'as donnée pour ça, c'est notre seule raison
          de la garder.
        </p>
      </section>

      <section className={styles.section}>
        <h2>Compte de jeu</h2>
        <p>
          Ton adresse e-mail sert à te connecter. Ta partie (cartes, progression, échanges) est
          gardée tant que ton compte existe. Il faut avoir 15 ans ou plus pour créer un compte.
        </p>
      </section>

      <section className={styles.section}>
        <h2>Profil</h2>
        <p>
          Ton pseudo, ton avatar, ton niveau, tes cartes épinglées et tes chiffres de jeu forment
          ton profil. Dès le niveau 8, il est visible par un lien, sauf si tu le caches dans les
          réglages. Quand tu signales un pseudo, on garde qui a signalé qui, pour la modération.
        </p>
      </section>

      <section className={styles.section}>
        <h2>Ce qu'on ne fait pas</h2>
        <p>
          Pas de publicité, pas de revente, pas de traceur. Le seul cookie est celui qui te garde
          connecté. Tes réglages de son et de vibration restent dans ton navigateur.
        </p>
      </section>

      <section className={styles.section}>
        <h2>Où elles vivent</h2>
        <p>
          Le site passe par Cloudflare. La base de données est hébergée dans l'Union européenne.
        </p>
      </section>

      <section className={styles.section}>
        <h2>Tes droits</h2>
        <p>
          Réglages, puis « Supprimer mon compte » : tout est effacé sur-le-champ. Tes échanges
          passés restent chez les autres joueurs, signés « Un joueur parti ». Pour le reste, tu peux
          voir, corriger ou effacer ce qu'on a sur toi, ou t'opposer à son usage. Écris à{" "}
          <a href={`mailto:${CONTACT}`}>{CONTACT}</a>, on répond sous un mois. Si ça ne va pas, tu
          peux saisir la <a href="https://www.cnil.fr/fr/plaintes">CNIL</a>.
        </p>
      </section>
    </main>
  );
}
