import { patronPrice } from "@leximon/view-model";
import type { Metadata } from "next";
import Link from "next/link";
import { PUBLISHER } from "@/lib/publisher";
import ui from "@/ui/ui.module.css";
import styles from "../confidentialite/privacy.module.css";

export const metadata: Metadata = {
  title: "Conditions de vente · Leximon",
  description:
    "Les conditions de l'abonnement Mécène : contenu, prix, paiement, résiliation, rétractation et remboursement.",
};

const CONTACT = PUBLISHER.contact;

/**
 * Terms of sale of the patron subscription, next to the terms of use. Draft to be reviewed
 * before sales open.
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
      <h1 className={`${styles.title} ${ui.lettered}`}>Conditions de vente</h1>
      <p className={styles.updated}>Version du 9 novembre 2026.</p>

      <section className={`${styles.section} ${ui.leaf}`}>
        <h2>Le vendeur</h2>
        <p>
          L'abonnement Mécène est vendu par {PUBLISHER.name}, {PUBLISHER.status} (SIREN{" "}
          {PUBLISHER.siren}), {PUBLISHER.address}. Pour toute question, écris à{" "}
          <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.
        </p>
        <p>
          Ces conditions complètent les <Link href="/conditions">conditions d'utilisation</Link> du
          jeu. Tu les acceptes en t'abonnant.
        </p>
      </section>

      <section className={`${styles.section} ${ui.leaf}`}>
        <h2>Ce que tu achètes</h2>
        <p>
          Le jeu reste gratuit en entier. L'abonnement Mécène sert à soutenir Leximon et donne des
          avantages d'apparence et de contenu, décrits sur la page Mécène au moment de l'achat :
        </p>
        <ul>
          <li>le titre et le badge de mécène, tant que l'abonnement court ;</li>
          <li>
            deux cosmétiques par mois (un cadre et un avatar), dévoilés le 1er du mois et jamais
            avant, à réclamer sur la page Mécène pour chaque mois payé ;
          </li>
          <li>
            le droit de choisir un mot à faire entrer dans le jeu : un au premier paiement, puis un
            tous les trois mois d'abonnement ;
          </li>
          <li>
            les éditions de bibliothèque, le cabinet du mot, trois places de cartes épinglées en
            plus, le salon des mécènes sur Discord, le vote sur le thème d'une prochaine collection
            et ton pseudo sur la page des mécènes.
          </li>
        </ul>
        <p>
          L'abonnement ne vend ni sachet, ni carte tirée au hasard, ni monnaie du jeu. Il ne donne
          aucune avance dans les défis, les joutes ou les échanges.
        </p>
      </section>

      <section className={`${styles.section} ${ui.leaf}`}>
        <h2>Prix et paiement</h2>
        <p>
          L'abonnement coûte {monthly} par mois ou {yearly} par an. Ce sont des prix finaux : TVA
          non applicable, article 293 B du Code général des impôts.
        </p>
        <p>
          Tu paies à l'abonnement, puis à chaque renouvellement, sur la page sécurisée de Stripe,
          notre prestataire de paiement. Leximon ne voit jamais ton numéro de carte. Une facture
          t'est envoyée par e-mail à chaque paiement.
        </p>
        <p>
          Si le prix augmente, la hausse ne s'applique qu'aux nouveaux abonnements : tu gardes ton
          prix tant que ton abonnement continue sans interruption.
        </p>
      </section>

      <section className={`${styles.section} ${ui.leaf}`}>
        <h2>Durée et renouvellement</h2>
        <p>
          L'abonnement se renouvelle tout seul à la fin de chaque période (un mois ou un an), au
          même prix, tant que tu ne le résilies pas. Pour la formule annuelle, on t'écrit au moins
          un mois avant le renouvellement.
        </p>
        <p>
          Si un paiement est refusé, Stripe réessaie pendant quelques jours. Si tous les essais
          échouent, l'abonnement s'arrête.
        </p>
      </section>

      <section className={`${styles.section} ${ui.leaf}`}>
        <h2>Résilier</h2>
        <p>
          Tu peux résilier à tout moment depuis la page Mécène, bouton « Gérer mon abonnement ».
          L'abonnement s'arrête à la fin de la période déjà payée, et tu gardes tes avantages
          jusque-là. Aucun autre paiement n'est demandé. Depuis la même page, tu peux changer de
          formule ou de moyen de paiement.
        </p>
        <p>Supprimer ton compte arrête aussi l'abonnement, tout de suite.</p>
      </section>

      <section className={`${styles.section} ${ui.leaf}`}>
        <h2>Droit de rétractation</h2>
        <p>
          Les avantages de l'abonnement sont disponibles dès le paiement. Avant de payer, tu coches
          une case par laquelle tu demandes à en profiter tout de suite et tu renonces à ton droit
          de rétractation de quatorze jours (article L221-28 du Code de la consommation). Sans cette
          case, l'abonnement ne peut pas être acheté. On garde la date à laquelle tu l'as cochée.
        </p>
      </section>

      <section className={`${styles.section} ${ui.leaf}`}>
        <h2>Remboursement</h2>
        <p>Une période commencée n'est pas remboursée, sauf dans ces cas :</p>
        <ul>
          <li>
            un paiement fait par erreur (paiement en double, par exemple) : écris-nous, on le
            rembourse ;
          </li>
          <li>
            un abonnement pris par un joueur de moins de 18 ans sans l'accord d'un parent : le
            parent qui nous écrit obtient le remboursement du dernier paiement et l'arrêt de
            l'abonnement ;
          </li>
          <li>
            si Leximon s'arrête : on te prévient au moins un mois avant, et la part d'un abonnement
            annuel qui n'a pas servi t'est remboursée.
          </li>
        </ul>
        <p>
          Un remboursement arrête l'abonnement. Les cosmétiques du mois remboursé qui n'ont pas été
          réclamés ne peuvent plus l'être ; ceux qui ont été réclamés restent.
        </p>
      </section>

      <section className={`${styles.section} ${ui.leaf}`}>
        <h2>Les mineurs</h2>
        <p>
          Il faut avoir 15 ans pour créer un compte. Entre 15 et 17 ans, tu dois avoir l'accord d'un
          parent avant de t'abonner, et la page Mécène te le rappelle.
        </p>
      </section>

      <section className={`${styles.section} ${ui.leaf}`}>
        <h2>Ton mot dans le jeu</h2>
        <ul>
          <li>
            Tu choisis ton mot dans la réserve des mots que Leximon a présélectionnés. Un mot ne
            peut être choisi qu'une fois : le premier mécène qui le réserve l'obtient.
          </li>
          <li>
            Leximon écrit la carte (définition, étymologie, citation, gravure) et choisit sa rareté.
            Le mot entre dans la prochaine collection où il a sa place, sans date promise.
          </li>
          <li>
            Si le mot ne passe pas le contrôle de qualité, ton droit de choisir un mot t'est rendu,
            même si ton abonnement s'est arrêté entre-temps.
          </li>
          <li>
            La carte porte la mention « Déniché par » suivie de ton pseudo, visible par tous les
            joueurs, tant que ton compte existe. Tu reçois un exemplaire unique de la carte, qui ne
            s'échange pas et ne se recycle pas.
          </li>
          <li>
            Un droit que tu n'as pas utilisé se perd quand l'abonnement s'arrête. Un mot déjà
            réservé paraît quand même.
          </li>
        </ul>
      </section>

      <section className={`${styles.section} ${ui.leaf}`}>
        <h2>Ce que tu gardes à l'arrêt</h2>
        <p>
          Quand l'abonnement s'arrête, tu gardes à vie les cosmétiques réclamés, les éditions de
          bibliothèque, le badge de mécène fondateur si tu l'as obtenu, et les cartes que tu as
          dénichées avec leur mention. Tu perds le titre et le badge de mécène, le cabinet du mot,
          les places épinglées en plus, le rôle sur Discord et les droits de choisir un mot non
          utilisés.
        </p>
        <p>
          Les cosmétiques et les éditions n'ont aucune valeur en argent : ils ne se vendent pas, ne
          s'échangent pas et ne se remboursent pas.
        </p>
      </section>

      <section className={`${styles.section} ${ui.leaf}`}>
        <h2>Le service</h2>
        <p>
          Si Leximon est interrompu plusieurs jours de suite par notre faute, écris-nous : on
          prolonge ton abonnement d'autant. Tu bénéficies aussi des garanties légales de conformité
          des contenus et services numériques (articles L224-25-12 et suivants du Code de la
          consommation).
        </p>
      </section>

      <section className={`${styles.section} ${ui.leaf}`}>
        <h2>En cas de désaccord</h2>
        <p>
          Ces conditions relèvent du droit français. En cas de problème, écris-nous d'abord à{" "}
          <a href={`mailto:${CONTACT}`}>{CONTACT}</a> : on cherche une solution ensemble. À défaut,
          tu peux recourir gratuitement à un médiateur de la consommation, puis saisir les tribunaux
          compétents.
        </p>
      </section>

      <p className={styles.related}>
        <Link href="/conditions">Conditions d'utilisation</Link> ·{" "}
        <Link href="/confidentialite">Tes données</Link> ·{" "}
        <Link href="/mentions">Contact et mentions</Link>
      </p>
    </main>
  );
}
