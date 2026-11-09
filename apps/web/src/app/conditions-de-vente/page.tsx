import { BACK_HOME_LABEL, patronPrice } from "@leximon/view-model";
import type { Metadata } from "next";
import Link from "next/link";
import { PUBLISHER } from "@/lib/publisher";
import { ButtonLink } from "@/ui/button";
import ui from "@/ui/ui.module.css";
import styles from "../confidentialite/privacy.module.css";

export const metadata: Metadata = {
  title: "Conditions générales de vente · Leximon",
  description:
    "Les conditions de l'abonnement Mécène : contenu, prix, paiement, résiliation, rétractation et remboursement.",
};

const CONTACT = PUBLISHER.contact;

/**
 * Terms of sale of the patron subscription, next to the terms of use. Written in the formal
 * register of a contract, unlike the game's own pages.
 */
export default function SalesTermsPage() {
  const now = Date.now();
  const monthly = patronPrice("monthly", now);
  const yearly = patronPrice("yearly", now);
  return (
    <main className={styles.page}>
      <Link href="/" className={styles.logo}>
        Leximon
      </Link>
      <h1 className={`${styles.title} ${ui.lettered}`}>Conditions générales de vente</h1>
      <p className={styles.updated}>Abonnement Mécène · version du 9 novembre 2026.</p>

      <section className={`${styles.section} ${ui.leaf}`}>
        <h2>1. Objet et vendeur</h2>
        <p>
          Les présentes conditions régissent la vente de l'abonnement Mécène du jeu Leximon, proposé
          sur le site leximon.fr par {PUBLISHER.name}, {PUBLISHER.status} (SIREN {PUBLISHER.siren}
          ), {PUBLISHER.address}, joignable à <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.
        </p>
        <p>
          Elles complètent les <Link href="/conditions">conditions d'utilisation</Link> du jeu.
          Toute souscription vaut acceptation des présentes conditions.
        </p>
      </section>

      <section className={`${styles.section} ${ui.leaf}`}>
        <h2>2. Contenu de l'abonnement</h2>
        <p>
          L'abonnement est facultatif : le jeu reste entièrement gratuit. Il donne accès aux
          avantages décrits sur la page Mécène au jour de la souscription, notamment :
        </p>
        <ul>
          <li>le titre et le badge de mécène, pendant la durée de l'abonnement ;</li>
          <li>deux cosmétiques par mois payé (un cadre et un avatar), dévoilés le 1er du mois ;</li>
          <li>
            le droit de faire entrer un mot dans le jeu, à la souscription puis tous les trois mois
            d'abonnement (article 7) ;
          </li>
          <li>
            les éditions de bibliothèque, le cabinet du mot, des places supplémentaires de cartes
            épinglées, l'accès au salon réservé du serveur Discord, la participation au vote des
            mécènes et la mention du pseudo sur la page des mécènes.
          </li>
        </ul>
        <p>
          L'abonnement ne donne accès à aucun contenu aléatoire, à aucune monnaie du jeu, ni à aucun
          avantage dans les défis, les joutes ou les échanges.
        </p>
      </section>

      <section className={`${styles.section} ${ui.leaf}`}>
        <h2>3. Prix</h2>
        <p>
          L'abonnement est proposé au prix de {monthly} par mois ou de {yearly} par an. TVA non
          applicable, article 293 B du Code général des impôts.
        </p>
        <p>
          Une hausse de prix ne s'applique qu'aux nouvelles souscriptions. L'abonné conserve son
          prix tant que son abonnement n'est pas interrompu.
        </p>
      </section>

      <section className={`${styles.section} ${ui.leaf}`}>
        <h2>4. Paiement</h2>
        <p>
          Le paiement est exigible à la souscription, puis à chaque échéance. Il est traité par la
          société Stripe ; l'éditeur n'a pas accès aux données de carte bancaire. Une facture est
          adressée par e-mail à chaque paiement.
        </p>
        <p>En cas d'échec définitif du paiement, l'abonnement prend fin.</p>
      </section>

      <section className={`${styles.section} ${ui.leaf}`}>
        <h2>5. Durée, reconduction et résiliation</h2>
        <p>
          L'abonnement est souscrit pour un mois ou pour un an, et reconduit tacitement pour la même
          durée. Pour la formule annuelle, l'abonné en est informé par e-mail au moins un mois avant
          l'échéance.
        </p>
        <p>
          L'abonné peut résilier à tout moment depuis la page Mécène. La résiliation prend effet à
          la fin de la période en cours, jusqu'à laquelle les avantages restent acquis. La
          suppression du compte met fin à l'abonnement immédiatement.
        </p>
      </section>

      <section className={`${styles.section} ${ui.leaf}`}>
        <h2>6. Droit de rétractation</h2>
        <p>
          Les avantages étant fournis dès le paiement, l'abonné demande, avant de payer, leur
          exécution immédiate et renonce expressément à son droit de rétractation, conformément à
          l'article L221-28 du Code de la consommation. Sans cet accord, la souscription n'est pas
          possible.
        </p>
      </section>

      <section className={`${styles.section} ${ui.leaf}`}>
        <h2>7. Mot proposé par l'abonné</h2>
        <p>
          Le mot est choisi dans une liste établie par l'éditeur, et chaque mot ne peut être
          attribué qu'une fois. L'éditeur rédige la carte et en fixe la rareté. Elle paraît dans une
          collection ultérieure, sans date garantie, avec la mention « Déniché par » suivie du
          pseudo de l'abonné.
        </p>
        <p>
          Si le mot n'est pas retenu, le droit est restitué. Un droit non utilisé à la fin de
          l'abonnement est perdu.
        </p>
      </section>

      <section className={`${styles.section} ${ui.leaf}`}>
        <h2>8. Fin de l'abonnement</h2>
        <p>
          À la fin de l'abonnement, l'abonné conserve les cosmétiques obtenus, les éditions de
          bibliothèque, le badge de mécène fondateur le cas échéant et les cartes dénichées. Les
          autres avantages prennent fin.
        </p>
        <p>
          Les avantages n'ont aucune valeur monétaire et ne peuvent être ni cédés ni remboursés.
        </p>
      </section>

      <section className={`${styles.section} ${ui.leaf}`}>
        <h2>9. Remboursement</h2>
        <p>Une période commencée n'est pas remboursée, sauf dans les cas suivants :</p>
        <ul>
          <li>paiement effectué par erreur ;</li>
          <li>souscription par un mineur sans l'accord d'un parent, sur demande de ce dernier ;</li>
          <li>
            arrêt définitif du jeu, annoncé au moins un mois à l'avance : la part non utilisée d'un
            abonnement annuel est remboursée.
          </li>
        </ul>
        <p>Le remboursement met fin à l'abonnement.</p>
      </section>

      <section className={`${styles.section} ${ui.leaf}`}>
        <h2>10. Mineurs</h2>
        <p>
          Les utilisateurs âgés de 15 à 17 ans doivent obtenir l'accord d'un parent avant de
          souscrire.
        </p>
      </section>

      <section className={`${styles.section} ${ui.leaf}`}>
        <h2>11. Disponibilité et garanties</h2>
        <p>
          En cas d'interruption du service de plusieurs jours imputable à l'éditeur, l'abonnement
          est prolongé d'une durée équivalente, sur demande de l'abonné. L'abonné bénéficie des
          garanties légales de conformité des contenus et services numériques (articles L224-25-12
          et suivants du Code de la consommation).
        </p>
      </section>

      <section className={`${styles.section} ${ui.leaf}`}>
        <h2>12. Litiges</h2>
        <p>
          Les présentes conditions sont soumises au droit français. Toute réclamation est adressée
          en premier lieu à <a href={`mailto:${CONTACT}`}>{CONTACT}</a>. À défaut de solution
          amiable, l'abonné peut recourir gratuitement à un médiateur de la consommation, puis
          saisir les tribunaux compétents.
        </p>
      </section>

      <div className={styles.home}>
        <ButtonLink href="/">{BACK_HOME_LABEL}</ButtonLink>
      </div>

      <p className={styles.related}>
        <Link href="/conditions">Conditions d'utilisation</Link> ·{" "}
        <Link href="/confidentialite">Tes données</Link> ·{" "}
        <Link href="/mentions">Contact et mentions</Link>
      </p>
    </main>
  );
}
