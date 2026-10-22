import type { Metadata } from "next";
import Link from "next/link";
import { PUBLISHER } from "@/lib/publisher";
import styles from "../confidentialite/privacy.module.css";

export const metadata: Metadata = {
  title: "Conditions d'utilisation · Leximon",
  description: "Les règles du jeu entre toi et Leximon : compte, cartes, échanges, modération.",
};

/**
 * Terms of use (R-09). Draft written for a lawyer's review before the beta: plain words, the
 * game's non-negotiable rules (N1 to N5) and the moderation the DSA asks for.
 */
export default function TermsPage() {
  return (
    <main className={styles.page}>
      <Link href="/" className={styles.logo}>
        Leximon
      </Link>
      <h1 className={styles.title}>Conditions d'utilisation</h1>
      <p className={styles.updated}>Version du 22 octobre 2026.</p>

      <section className={styles.section}>
        <h2>Qui est derrière Leximon</h2>
        <p>
          Leximon est édité par {PUBLISHER.name}, {PUBLISHER.status} (SIREN {PUBLISHER.siren}),{" "}
          {PUBLISHER.address}. Pour tout :{" "}
          <a href={`mailto:${PUBLISHER.contact}`}>{PUBLISHER.contact}</a>.
        </p>
        <p>
          En jouant, tu acceptes ces conditions. Elles valent pour le site, l'application iOS et
          l'application Android.
        </p>
      </section>

      <section className={styles.section}>
        <h2>Le jeu</h2>
        <p>
          Leximon est un jeu de cartes à collectionner autour des mots rares et anciens du français.
          Tu ouvres des sachets, tu ranges les cartes dans ton album, tu fais monter les mots par
          des défis, tu échanges tes doubles avec d'autres joueurs.
        </p>
        <p>
          Le jeu est gratuit. Aucun sachet ne s'achète, ni directement ni avec une monnaie achetée.
          Si une offre payante arrive un jour (abonnement, objets d'apparence), son contenu sera
          connu avant l'achat, et ces conditions le diront.
        </p>
      </section>

      <section className={styles.section}>
        <h2>Ton compte</h2>
        <p>
          Tu peux essayer le jeu sans compte, en invité. Pour continuer, tu crées un compte avec ton
          adresse e-mail. Ta partie d'invité passe sur ce compte.
        </p>
        <ul>
          <li>Il faut avoir 15 ans ou plus pour créer un compte.</li>
          <li>Un compte par personne.</li>
          <li>
            Ton compte est à toi seul. Tu ne le prêtes pas, tu ne le vends pas, tu ne l'achètes pas.
          </li>
          <li>Tu gardes l'accès à ton adresse e-mail : c'est elle qui t'ouvre ton compte.</li>
        </ul>
      </section>

      <section className={styles.section}>
        <h2>Les cartes</h2>
        <p>
          Les cartes, les sachets, l'XP et les objets gagnés dans le jeu n'ont aucune valeur en
          argent. Ils ne se vendent pas, ne s'achètent pas et ne se remboursent pas, ni dans le jeu
          ni en dehors. Tu as le droit de t'en servir dans Leximon, tant que ton compte existe.
        </p>
        <p>
          Le jeu évolue : le rythme des sachets, les récompenses ou les défis peuvent changer. Une
          carte peut être corrigée, par exemple une définition fausse. Sa rareté, elle, ne change
          jamais.
        </p>
      </section>

      <section className={styles.section}>
        <h2>Les échanges</h2>
        <p>
          Un échange, c'est une carte contre une carte (jusqu'à trois de chaque côté selon le
          niveau), proposé par une offre, sans message. Une offre acceptée est définitive : il n'y a
          pas de retour en arrière.
        </p>
        <p>
          Il est interdit de faire payer un échange, en argent ou en quoi que ce soit hors du jeu.
        </p>
      </section>

      <section className={styles.section}>
        <h2>Ce qui est interdit</h2>
        <ul>
          <li>Tricher : robots, scripts, logiciels qui jouent à ta place.</li>
          <li>
            Profiter d'un bug. Si tu en trouves un, écris-nous : on corrige, et on peut retirer ce
            qu'il a rapporté.
          </li>
          <li>Ouvrir d'autres comptes pour s'envoyer des cartes ou contourner une sanction.</li>
          <li>Se faire passer pour un autre joueur ou pour l'équipe de Leximon.</li>
          <li>Gêner le service : le surcharger, s'y introduire, en copier le contenu en masse.</li>
          <li>
            Écrire quelque chose que la <Link href="/charte">charte de la discussion</Link>{" "}
            interdit, dans un pseudo, un nom de clan ou un message.
          </li>
        </ul>
      </section>

      <section className={styles.section}>
        <h2>Ce que tu écris</h2>
        <p>
          Ton pseudo, le nom de ton clan et tes messages sont visibles par d'autres joueurs. Tu en
          es responsable. Ils passent par un filtre à l'envoi et suivent la{" "}
          <Link href="/charte">charte de la discussion</Link>. Tu nous autorises à les afficher dans
          le jeu tant qu'ils y sont.
        </p>
      </section>

      <section className={styles.section}>
        <h2>Signaler, bloquer</h2>
        <p>
          Depuis le profil d'un joueur, tu peux le bloquer : vous ne vous voyez plus, et vous ne
          pouvez plus vous faire d'offre. Tu peux signaler un pseudo, et plus tard un message. Pour
          tout contenu qui te paraît illégal, écris à{" "}
          <a href={`mailto:${PUBLISHER.contact}`}>{PUBLISHER.contact}</a> en disant où il se trouve
          et pourquoi. C'est aussi notre point de contact pour les autorités.
        </p>
      </section>

      <section className={styles.section}>
        <h2>Sanctions</h2>
        <p>Si tu enfreins ces conditions ou la charte, on peut, selon la gravité :</p>
        <ul>
          <li>masquer ou effacer ce que tu as écrit</li>
          <li>remplacer ton pseudo</li>
          <li>t'empêcher d'écrire ou d'échanger pour un temps</li>
          <li>retirer ce qu'une triche t'a rapporté</li>
          <li>suspendre ou fermer ton compte</li>
        </ul>
        <p>
          Chaque sanction est motivée : tu sais ce qu'on te reproche et sur quoi on se fonde. Tu
          peux la contester en écrivant à{" "}
          <a href={`mailto:${PUBLISHER.contact}`}>{PUBLISHER.contact}</a> dans les six mois. Une
          personne relit ta demande et te répond.
        </p>
      </section>

      <section className={styles.section}>
        <h2>Les mots, les images, le nom</h2>
        <p>
          Le nom Leximon, son logo, ses écrans et les textes des cartes sont à nous. Les sources
          (Littré, gravures, fréquences) sont dans le domaine public ou sous licence libre, et
          citées dans <Link href="/mentions">Contact et mentions</Link>. Tu peux partager tes cartes
          et ton profil avec les boutons du jeu.
        </p>
      </section>

      <section className={styles.section}>
        <h2>Le service</h2>
        <p>
          On fait tourner Leximon du mieux qu'on peut, sans garantir qu'il soit toujours disponible
          ni sans erreur. Il peut s'interrompre pour une mise à jour ou une panne. Comme le jeu est
          gratuit, une interruption ne donne pas droit à une compensation.
        </p>
        <p>
          Si Leximon devait s'arrêter, on te prévient au moins un mois avant, par e-mail et dans le
          jeu.
        </p>
      </section>

      <section className={styles.section}>
        <h2>Partir</h2>
        <p>
          Tu peux supprimer ton compte quand tu veux : Réglages, puis « Supprimer mon compte ». Tout
          est effacé sur-le-champ. Tes échanges passés restent chez les autres joueurs, signés « Un
          joueur parti ». Ce qu'on garde et pourquoi :{" "}
          <Link href="/confidentialite">Tes données</Link>.
        </p>
      </section>

      <section className={styles.section}>
        <h2>Si ces conditions changent</h2>
        <p>
          On te prévient dans le jeu au moins quinze jours avant qu'une nouvelle version s'applique.
          Si elle ne te convient pas, tu peux supprimer ton compte.
        </p>
      </section>

      <section className={styles.section}>
        <h2>En cas de désaccord</h2>
        <p>
          Ces conditions relèvent du droit français. En cas de litige, écris-nous d'abord : on
          cherche une solution ensemble. À défaut, le litige est porté devant les tribunaux
          compétents. Si tu es consommateur, tu peux aussi recourir gratuitement à un médiateur de
          la consommation.
        </p>
      </section>

      <p className={styles.related}>
        <Link href="/charte">Charte de la discussion</Link> ·{" "}
        <Link href="/confidentialite">Tes données</Link> ·{" "}
        <Link href="/mentions">Contact et mentions</Link>
      </p>
    </main>
  );
}
