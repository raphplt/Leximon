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
          On garde ton adresse e-mail, et rien d'autre. Elle sert à te prévenir de l'ouverture, puis
          à t'envoyer les nouvelles de Leximon. Chaque e-mail a un lien pour te désinscrire en un
          clic. Sinon, on la garde au plus 3 ans après ton inscription ou ton dernier clic dans un
          de nos e-mails.
        </p>
      </section>

      <section className={styles.section}>
        <h2>Compte de jeu</h2>
        <p>
          Ton adresse e-mail sert à te connecter. Ta partie (cartes, progression, échanges) est
          gardée tant que ton compte existe. Il faut avoir 15 ans ou plus pour créer un compte.
        </p>
        <p>
          Sans compte, tu joues en invité : pas d'adresse, juste une partie liée à ton navigateur.
          Si tu ne reviens pas, la partie devient inaccessible au bout de 7 jours, et on l'efface 6
          mois après ta première visite.
        </p>
        <p>
          Chaque connexion garde l'adresse IP et le navigateur d'où elle vient, pour repérer un
          compte volé ou un abus. On les efface quand la connexion expire, 7 jours après ta dernière
          visite.
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
          réglages. Quand tu signales un pseudo ou un message, on garde qui a signalé qui, pour la
          modération, jusqu'à un an après qu'on l'a traité.
        </p>
        <p>
          Les messages de ton clan sont effacés au bout de 90 jours. Un message signalé est gardé
          jusqu'à ce qu'on l'ait traité.
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
        <h2>Pourquoi on a le droit</h2>
        <p>
          Ton compte, ta partie, les connexions : pour te faire jouer, c'est le contrat que tu
          acceptes en créant ton compte. Les nouvelles, la liste d'attente, la tranche d'âge : parce
          que tu l'as choisi, et tu peux revenir dessus. La sécurité, la modération et la mesure de
          la bêta : notre intérêt légitime à garder un jeu sûr, et à savoir s'il plaît.
        </p>
      </section>

      <section className={styles.section}>
        <h2>Où elles vivent</h2>
        <p>
          La base de données est chez Neon, à Francfort. Le site, l'API, les codes de connexion et
          les journaux techniques (gardés 7 jours) passent par Cloudflare. Les nouvelles passent par
          Lettermint, un service européen.
        </p>
        <p>
          Neon et Cloudflare sont des sociétés américaines : une donnée peut passer par les
          États-Unis. Ces transferts sont encadrés par les clauses types de la Commission
          européenne, et pour Cloudflare par le Data Privacy Framework.
        </p>
        <p>
          Les sauvegardes de la base sont gardées 30 jours au plus. Ce que tu effaces en sort au
          bout de ces 30 jours.
        </p>
      </section>

      <section className={styles.section}>
        <h2>Tes droits</h2>
        <p>
          Réglages, puis « Supprimer mon compte » : ton compte, ta partie et ton adresse, y compris
          sur la liste d'attente, sont effacés sur-le-champ. Tes échanges passés restent chez les
          autres joueurs, signés « Un joueur parti ». Tes messages de clan restent, sans ton nom,
          jusqu'à leurs 90 jours. Les sauvegardes t'oublient en 30 jours. Pour le reste, tu peux
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
