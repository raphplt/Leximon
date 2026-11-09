import { BACK_HOME_LABEL } from "@leximon/view-model";
import type { Metadata } from "next";
import Link from "next/link";
import { PUBLISHER } from "@/lib/publisher";
import { ButtonLink } from "@/ui/button";
import ui from "@/ui/ui.module.css";
import styles from "../confidentialite/privacy.module.css";

export const metadata: Metadata = {
  title: "Conditions d'utilisation · Leximon",
  description:
    "Les règles qui s'appliquent entre toi et Leximon pour le compte, les cartes, les échanges et la modération.",
};

/**
 * Terms of use. Draft written for a lawyer's review before the beta: plain words, the
 * game's non-negotiable rules and the moderation the DSA asks for.
 */
export default function TermsPage() {
  return (
    <main className={styles.page}>
      <Link href="/" className={styles.logo}>
        Leximon
      </Link>
      <h1 className={`${styles.title} ${ui.lettered}`}>Conditions d'utilisation</h1>
      <p className={styles.updated}>Version du 9 novembre 2026.</p>

      <section className={`${styles.section} ${ui.leaf}`}>
        <h2>L'éditeur</h2>
        <p>
          Leximon est édité par {PUBLISHER.name}, {PUBLISHER.status} (SIREN {PUBLISHER.siren}),{" "}
          {PUBLISHER.address}. Pour toute question, écris à{" "}
          <a href={`mailto:${PUBLISHER.contact}`}>{PUBLISHER.contact}</a>.
        </p>
        <p>
          En jouant, tu acceptes ces conditions. Elles valent pour le site, l'application iOS et
          l'application Android.
        </p>
      </section>

      <section className={`${styles.section} ${ui.leaf}`}>
        <h2>Le jeu</h2>
        <p>
          Leximon est un jeu de cartes à collectionner autour des mots rares et anciens du français.
          Tu ouvres des sachets gratuits, tu ranges les cartes dans ton album, tu révises les mots
          dans des défis et tu échanges tes doubles avec d'autres joueurs.
        </p>
        <p>
          Le jeu est gratuit. Aucun sachet ne s'achète, ni directement ni avec une monnaie achetée.
          L'abonnement Mécène, facultatif, a un contenu connu avant l'achat ; il suit les{" "}
          <Link href="/conditions-de-vente">conditions de vente</Link>.
        </p>
      </section>

      <section className={`${styles.section} ${ui.leaf}`}>
        <h2>Ton compte</h2>
        <p>
          Tu peux essayer le jeu sans compte, en invité. Pour continuer, tu crées un compte avec ton
          adresse e-mail. Ta partie d'invité passe sur ce compte.
        </p>
        <ul>
          <li>Il faut avoir 15 ans ou plus pour créer un compte.</li>
          <li>Un compte par personne.</li>
          <li>
            Ton compte est personnel : il est interdit de le prêter, de le vendre ou de l'acheter.
          </li>
          <li>Garde l'accès à ton adresse e-mail, car c'est elle qui te permet de te connecter.</li>
        </ul>
      </section>

      <section className={`${styles.section} ${ui.leaf}`}>
        <h2>Les cartes</h2>
        <p>
          Les cartes, les sachets, l'XP et les objets gagnés dans le jeu n'ont aucune valeur en
          argent. Ils ne se vendent pas, ne s'achètent pas et ne se remboursent pas, ni dans le jeu
          ni en dehors. Tu as le droit de t'en servir dans Leximon, tant que ton compte existe.
        </p>
        <p>
          L'équilibrage du jeu peut évoluer (rythme des sachets, récompenses ou défis), et une carte
          peut être corrigée si elle contient une erreur. En revanche, la rareté d'une carte publiée
          ne change jamais.
        </p>
      </section>

      <section className={`${styles.section} ${ui.leaf}`}>
        <h2>Les échanges</h2>
        <p>
          Un échange se fait carte contre carte (jusqu'à trois de chaque côté selon le niveau), par
          une offre, sans message. Une offre acceptée est définitive.
        </p>
        <p>
          Il est interdit de faire payer un échange, en argent ou en quoi que ce soit hors du jeu.
        </p>
      </section>

      <section className={`${styles.section} ${ui.leaf}`}>
        <h2>Ce qui est interdit</h2>
        <ul>
          <li>
            Tricher, par exemple avec des robots, des scripts ou des logiciels qui jouent à ta
            place.
          </li>
          <li>
            Profiter d'un bug. Si tu en trouves un, écris-nous. On le corrige, et on peut retirer ce
            qu'il a rapporté.
          </li>
          <li>Ouvrir d'autres comptes pour s'envoyer des cartes ou contourner une sanction.</li>
          <li>Se faire passer pour un autre joueur ou pour l'équipe de Leximon.</li>
          <li>
            Gêner le service, par exemple en le surchargeant, en s'y introduisant ou en copiant son
            contenu en masse.
          </li>
          <li>
            Écrire quelque chose que la <Link href="/charte">charte de la discussion</Link>{" "}
            interdit, dans un pseudo, un nom de clan ou un message.
          </li>
        </ul>
      </section>

      <section className={`${styles.section} ${ui.leaf}`}>
        <h2>Ce que tu écris</h2>
        <p>
          Ton pseudo, le nom de ton clan et tes messages sont visibles par d'autres joueurs. Tu en
          es responsable. Ils passent par un filtre à l'envoi et suivent la{" "}
          <Link href="/charte">charte de la discussion</Link>. Tu nous autorises à les afficher dans
          le jeu tant que tu ne les as pas effacés.
        </p>
      </section>

      <section className={`${styles.section} ${ui.leaf}`}>
        <h2>Signaler, bloquer</h2>
        <p>
          Depuis le profil d'un joueur, tu peux le bloquer. Vous ne voyez plus vos profils et vous
          ne pouvez plus vous faire d'offre. Tu peux signaler un pseudo ou un message. Pour tout
          contenu qui te paraît illégal, écris à{" "}
          <a href={`mailto:${PUBLISHER.contact}`}>{PUBLISHER.contact}</a> en disant où il se trouve
          et pourquoi. C'est aussi notre point de contact pour les autorités.
        </p>
      </section>

      <section className={`${styles.section} ${ui.leaf}`}>
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
          Chaque sanction est expliquée. Tu sais ce qu'on te reproche et sur quelle règle on
          s'appuie. Tu peux la contester en écrivant à{" "}
          <a href={`mailto:${PUBLISHER.contact}`}>{PUBLISHER.contact}</a> dans les six mois. Une
          personne de l'équipe lit ta demande et te répond.
        </p>
      </section>

      <section className={`${styles.section} ${ui.leaf}`}>
        <h2>Propriété intellectuelle</h2>
        <p>
          Le nom Leximon, son logo, ses écrans et les textes des cartes appartiennent à l'éditeur.
          Les sources (Littré, gravures, fréquences) sont dans le domaine public ou sous licence
          libre, et citées dans <Link href="/mentions">Contact et mentions</Link>. Tu peux partager
          tes cartes et ton profil avec les boutons du jeu.
        </p>
      </section>

      <section className={`${styles.section} ${ui.leaf}`}>
        <h2>Le service</h2>
        <p>
          On fait de notre mieux pour que Leximon fonctionne, sans garantir qu'il soit toujours
          disponible ni sans erreur. Il peut s'interrompre pour une mise à jour ou une panne. Comme
          le jeu est gratuit, une interruption ne donne pas droit à une compensation.
        </p>
        <p>
          Si Leximon devait s'arrêter, on te prévient au moins un mois avant, par e-mail et dans le
          jeu.
        </p>
      </section>

      <section className={`${styles.section} ${ui.leaf}`}>
        <h2>Supprimer ton compte</h2>
        <p>
          Tu peux supprimer ton compte à tout moment depuis les réglages, bouton « Supprimer mon
          compte ». Ton compte et ta partie sont effacés immédiatement. Tes échanges passés restent
          visibles chez les autres joueurs sous le nom « Un joueur parti », et tes messages de clan
          restent anonymisés jusqu'à leur suppression automatique au bout de 90 jours. Plus de
          détails dans <Link href="/confidentialite">Tes données</Link>.
        </p>
      </section>

      <section className={`${styles.section} ${ui.leaf}`}>
        <h2>Si ces conditions changent</h2>
        <p>
          On te prévient dans le jeu au moins quinze jours avant qu'une nouvelle version s'applique.
          Si elle ne te convient pas, tu peux supprimer ton compte.
        </p>
      </section>

      <section className={`${styles.section} ${ui.leaf}`}>
        <h2>En cas de désaccord</h2>
        <p>
          Ces conditions relèvent du droit français. En cas de litige, écris-nous d'abord : on
          cherche une solution ensemble. À défaut, le litige est porté devant les tribunaux
          compétents. Si tu es consommateur, tu peux aussi recourir gratuitement à un médiateur de
          la consommation.
        </p>
      </section>

      <div className={styles.home}>
        <ButtonLink href="/">{BACK_HOME_LABEL}</ButtonLink>
      </div>

      <p className={styles.related}>
        <Link href="/charte">Charte de la discussion</Link> ·{" "}
        <Link href="/confidentialite">Tes données</Link> ·{" "}
        <Link href="/mentions">Contact et mentions</Link>
      </p>
    </main>
  );
}
