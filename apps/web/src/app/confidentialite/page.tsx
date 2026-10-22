import type { Metadata } from "next";
import Link from "next/link";
import { PUBLISHER } from "@/lib/publisher";
import styles from "./privacy.module.css";

export const metadata: Metadata = {
  title: "Tes données · Leximon",
  description: "Ce que Leximon garde sur toi, pourquoi, combien de temps, et comment l'effacer.",
};

const CONTACT = PUBLISHER.contact;

/** What the game keeps about a player, in plain words (RGPD, articles 13 and 14). */
export default function PrivacyPage() {
  return (
    <main className={styles.page}>
      <Link href="/" className={styles.logo}>
        Leximon
      </Link>
      <h1 className={styles.title}>Tes données</h1>

      <section className={styles.section}>
        <h2>Qui en répond</h2>
        <p>
          {PUBLISHER.name}, {PUBLISHER.status} (SIREN {PUBLISHER.siren}), {PUBLISHER.address}. Pour
          toute question sur tes données : <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.
        </p>
      </section>

      <section className={styles.section}>
        <h2>Liste d'attente</h2>
        <p>
          On garde ton adresse e-mail, et rien d'autre. Elle sert à t'écrire une fois, le jour de
          l'ouverture. Ensuite, la liste est close et on l'efface. Tu nous l'as donnée pour ça,
          c'est notre seule raison de la garder.
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
        <h2>Bêta et mesure</h2>
        <p>
          On garde le lien d'invitation par lequel tu es entré, et le code du lien qui t'a amené
          (une vidéo, un post), pour savoir ce qui fait venir les joueurs. On note les jours où tu
          ouvres le jeu, pour savoir si les joueurs reviennent. Tout se calcule dans notre base,
          sans outil extérieur, et part avec ton compte.
        </p>
        <p>
          À la création du compte, tu peux donner ta tranche d'âge. C'est facultatif. Elle sert à
          comparer comment chaque âge joue. Ce que tu écris dans « Un retour ? » est lu par
          l'équipe, avec l'écran d'où tu l'as envoyé.
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
        <h2>E-mails</h2>
        <p>
          Les codes de connexion partent par Cloudflare, seulement quand tu en demandes un. Les
          nouvelles du jeu partent par Lettermint, et seulement si tu as coché « M'écrire quand il y
          a du nouveau ». Chaque nouvelle porte un lien pour arrêter, et la case se décoche dans ton
          compte. Si tu te désinscris, on garde ton adresse sur la liste des gens à ne plus
          contacter, rien de plus. L'historique d'un envoi perd les adresses 30 jours après.
        </p>
      </section>

      <section className={styles.section}>
        <h2>Ce qu'on ne fait pas</h2>
        <p>
          Pas de publicité, pas de revente, pas de traceur, ni dans le site ni dans les e-mails (pas
          de pixel, pas de lien pisté). Le seul cookie est celui qui te garde connecté. Tes réglages
          de son et de vibration restent dans ton navigateur, comme ton lien d'invitation et ton
          code d'arrivée jusqu'à ta première partie.
        </p>
      </section>

      <section className={styles.section}>
        <h2>Où elles vivent</h2>
        <p>
          Le site et les codes de connexion passent par Cloudflare. Les nouvelles passent par
          Lettermint, un service européen. La base de données est hébergée dans l'Union européenne.
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

      <p className={styles.related}>
        <Link href="/conditions">Conditions d'utilisation</Link> ·{" "}
        <Link href="/charte">Charte de la discussion</Link> ·{" "}
        <Link href="/mentions">Contact et mentions</Link>
      </p>
    </main>
  );
}
