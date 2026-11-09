import { BACK_HOME_LABEL } from "@leximon/view-model";
import type { Metadata } from "next";
import Link from "next/link";
import { AnalyticsOptOut } from "@/analytics/opt-out";
import { PUBLISHER } from "@/lib/publisher";
import { ButtonLink } from "@/ui/button";
import ui from "@/ui/ui.module.css";
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
      <h1 className={`${styles.title} ${ui.lettered}`}>Tes données</h1>

      <section className={`${styles.section} ${ui.leaf}`}>
        <h2>Responsable des données</h2>
        <p>
          {PUBLISHER.name}, {PUBLISHER.status} (SIREN {PUBLISHER.siren}), {PUBLISHER.address}. Pour
          toute question sur tes données : <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.
        </p>
      </section>

      <section className={`${styles.section} ${ui.leaf}`}>
        <h2>Liste d'attente</h2>
        <p>
          On garde ton adresse e-mail, et rien d'autre. Elle sert à te prévenir de l'ouverture, puis
          à t'envoyer les nouvelles de Leximon. Chaque e-mail a un lien pour te désinscrire en un
          clic. Sinon, on la garde au plus 3 ans après ton inscription.
        </p>
      </section>

      <section className={`${styles.section} ${ui.leaf}`}>
        <h2>Compte de jeu</h2>
        <p>
          Ton adresse e-mail sert à te connecter. Ta partie (cartes, progression, échanges) est
          gardée tant que ton compte existe. Il faut avoir 15 ans ou plus pour créer un compte.
        </p>
        <p>
          Tu peux aussi te connecter avec Google. On demande alors à Google ton adresse e-mail et
          rien d'autre : ni ton nom, ni ta photo. On garde l'identifiant que Google donne à ton
          compte, pour te reconnaître la fois suivante. Les jetons d'accès de Google ne sont pas
          gardés : on ne peut rien lire d'autre dans ton compte Google. Google sait que tu t'es
          connecté à Leximon, selon ses propres règles de confidentialité.
        </p>
        <p>
          Sans compte, tu joues en invité. On ne garde aucune adresse, seulement une partie liée à
          ton navigateur. Si tu ne reviens pas, la partie devient inaccessible au bout de 90 jours,
          et on l'efface 6 mois après ta première visite.
        </p>
        <p>
          À chaque connexion, on enregistre l'adresse IP et le navigateur utilisés, pour repérer un
          compte volé ou un abus. On les efface quand la connexion expire, 90 jours après ta
          dernière visite.
        </p>
      </section>

      <section className={`${styles.section} ${ui.leaf}`}>
        <h2>Statistiques de la bêta</h2>
        <p>
          On conserve le lien d'invitation par lequel tu es entré ainsi que le code d'origine du
          lien (par exemple une vidéo ou un post), et les jours où tu ouvres le jeu. Tout est
          calculé directement dans notre base, sans outil d'analyse externe, et supprimé avec ton
          compte.
        </p>
        <p>
          À la création du compte, tu peux donner ta tranche d'âge. C'est facultatif. Elle sert à
          comparer la façon de jouer selon l'âge. Ce que tu écris dans « Écrire à l'équipe » est lu
          par l'équipe, avec l'écran d'où tu l'as envoyé.
        </p>
      </section>

      <section className={`${styles.section} ${ui.leaf}`}>
        <h2>Visites du site</h2>
        <p>
          On compte les pages vues avec Umami, un outil libre installé sur notre propre serveur,
          pour savoir combien de personnes passent sur le site et par quel lien elles arrivent.
          Umami ne dépose aucun cookie et ne garde pas ton adresse IP. Il garde la page vue, ton
          pays, ton navigateur et la taille de ton écran. Il ne reçoit ni ton adresse e-mail, ni les
          codes des liens d'invitation et d'ami. Si ton navigateur demande à ne pas être suivi, tes
          visites ne sont pas comptées.
        </p>
        <div className={styles.optOut}>
          <AnalyticsOptOut />
        </div>
      </section>

      <section className={`${styles.section} ${ui.leaf}`}>
        <h2>Profil</h2>
        <p>
          Ton pseudo, ton avatar, ton niveau, tes cartes épinglées et tes statistiques de jeu
          forment ton profil. Dès le niveau 8, il est visible par un lien et dans la liste des
          joueurs du jeu, sauf si tu le caches dans les réglages. Quand tu signales un pseudo ou un
          message, on garde la trace de l'auteur et de la cible du signalement, pour la modération,
          jusqu'à un an après son traitement.
        </p>
        <p>
          Les messages de ton clan sont effacés au bout de 90 jours. Un message signalé est gardé
          jusqu'à ce qu'on l'ait traité.
        </p>
      </section>

      <section className={`${styles.section} ${ui.leaf}`}>
        <h2>Abonnement Mécène</h2>
        <p>
          Le paiement se fait sur la page de Stripe, notre prestataire de paiement : tu y saisis ta
          carte et ton adresse e-mail, et on ne voit jamais ton numéro de carte. On garde
          l'identifiant de client que Stripe nous donne, l'état de ton abonnement, la date et le
          montant de chaque paiement, et la date à laquelle tu as renoncé au droit de rétractation.
          Stripe garde tes paiements et tes factures selon ses propres règles et ses obligations
          légales (comptabilité, lutte contre la fraude).
        </p>
        <p>
          Si tu relies ton compte Discord depuis la page Mécène, on demande à Discord l'identifiant
          et le nom de ton compte, et rien d'autre. Ils servent à te donner le rôle des mécènes et à
          le retirer quand ton abonnement s'arrête. Tu peux défaire le lien depuis la même page.
        </p>
        <p>
          Si ton profil est public, ton pseudo figure sur la page des mécènes, sauf si tu coches «
          Ne pas me citer ». Une carte que tu as dénichée porte ton pseudo, visible par tous les
          joueurs, tant que ton compte existe.
        </p>
      </section>

      <section className={`${styles.section} ${ui.leaf}`}>
        <h2>E-mails</h2>
        <p>
          Les codes de connexion sont envoyés via Cloudflare uniquement quand tu en demandes un.
          Cloudflare envoie aussi les notifications liées à ta partie (courrier en attente, rappel
          de sachets pleins quand tu t'absentes), au maximum une fois par jour chacune ; tu peux les
          désactiver dans les réglages ou depuis le lien en bas de chaque e-mail. Les nouvelles du
          jeu sont envoyées via Lettermint uniquement si tu as coché « M'écrire quand il y a du
          nouveau », avec un lien de désinscription dans chaque message. Si tu te désinscris d'une
          campagne, on conserve uniquement ton adresse sur la liste d'opposition, et les adresses de
          l'historique d'envoi sont effacées au bout de 30 jours.
        </p>
      </section>

      <section className={`${styles.section} ${ui.leaf}`}>
        <h2>Ce qu'on ne fait pas</h2>
        <p>
          Il n'y a ni publicité, ni revente de données, ni traceur publicitaire, ni dans le site ni
          dans les e-mails (aucun pixel, aucun lien pisté). Le seul cookie est celui qui te garde
          connecté. Tes réglages de son et de vibration et l'adresse de ta dernière connexion
          restent dans ton navigateur, comme ton refus d'être compté, ton lien d'invitation et le
          code de la vidéo ou du post qui t'a amené, jusqu'à ta première partie.
        </p>
      </section>

      <section className={`${styles.section} ${ui.leaf}`}>
        <h2>Bases légales</h2>
        <p>
          La gestion de ton compte, de ta partie, de tes connexions et de ton abonnement repose sur
          l'exécution du contrat (les conditions d'utilisation acceptées à la création du compte, et
          les conditions de vente pour l'abonnement). Les factures sont gardées dix ans, comme la
          loi l'impose. L'envoi des nouvelles, l'inscription sur la liste d'attente et la tranche
          d'âge reposent sur ton consentement, que tu peux retirer à tout moment. La sécurité, la
          modération, les statistiques de la bêta, le comptage des visites et les rappels liés à ta
          partie reposent sur notre intérêt légitime à assurer le bon fonctionnement du jeu ; tu
          peux désactiver ces rappels à tout moment.
        </p>
      </section>

      <section className={`${styles.section} ${ui.leaf}`}>
        <h2>Où tes données sont hébergées</h2>
        <p>
          La base de données est sur notre propre serveur, en France, et ses sauvegardes sont
          gardées chez Cloudflare, dans l'Union européenne. Le site, l'API, les codes de connexion,
          les e-mails sur ta partie et les journaux techniques (gardés 7 jours) passent par
          Cloudflare. Les nouvelles passent par Lettermint, un service européen. Le comptage des
          visites est gardé sur ce même serveur et passe lui aussi par Cloudflare.
        </p>
        <p>
          Cloudflare, Stripe et Discord sont des sociétés américaines : une donnée peut passer par
          les États-Unis. Ces transferts sont encadrés par les clauses types de la Commission
          européenne et par le Data Privacy Framework.
        </p>
        <p>
          Les sauvegardes de la base sont gardées 30 jours au plus. Ce que tu effaces disparaît
          aussi des sauvegardes au bout de ces 30 jours.
        </p>
      </section>

      <section className={`${styles.section} ${ui.leaf}`}>
        <h2>Tes droits</h2>
        <p>
          Depuis les réglages, bouton « Supprimer mon compte », ton compte, ta partie et ton adresse
          e-mail (y compris sur la liste d'attente) sont effacés immédiatement. Tes échanges passés
          restent visibles chez les autres joueurs sous le nom « Un joueur parti », et tes messages
          de clan restent anonymisés jusqu'à leur suppression au bout de 90 jours. Les sauvegardes
          automatiques sont purgées sous 30 jours. Tu peux aussi demander à consulter, corriger ou
          effacer tes données, ou t'opposer à leur traitement en écrivant à{" "}
          <a href={`mailto:${CONTACT}`}>{CONTACT}</a> (réponse sous un mois). En cas de difficulté,
          tu peux saisir la <a href="https://www.cnil.fr/fr/plaintes">CNIL</a>.
        </p>
      </section>

      <div className={styles.home}>
        <ButtonLink href="/">{BACK_HOME_LABEL}</ButtonLink>
      </div>

      <p className={styles.related}>
        <Link href="/conditions">Conditions d'utilisation</Link> ·{" "}
        <Link href="/charte">Charte de la discussion</Link> ·{" "}
        <Link href="/mentions">Contact et mentions</Link>
      </p>
    </main>
  );
}
