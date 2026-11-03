import type { Metadata } from "next";
import Link from "next/link";
import { PUBLISHER } from "@/lib/publisher";
import ui from "@/ui/ui.module.css";
import styles from "../confidentialite/privacy.module.css";

export const metadata: Metadata = {
  title: "Charte de la discussion · Leximon",
  description: "Ce qu'on peut écrire dans Leximon, et ce qui arrive en cas d'abus.",
};

/**
 * Charter for everything players write: pseudo, clan name, clan discussion. Draft
 * written for a lawyer's review before the beta.
 */
export default function CharterPage() {
  return (
    <main className={styles.page}>
      <Link href="/" className={styles.logo}>
        Leximon
      </Link>
      <h1 className={`${styles.title} ${ui.lettered}`}>Charte de la discussion</h1>
      <p className={styles.updated}>Version du 22 octobre 2026.</p>

      <section className={`${styles.section} ${ui.leaf}`}>
        <h2>Où elle s'applique</h2>
        <p>
          Elle s'applique partout où un joueur écrit, c'est-à-dire son pseudo, le nom de son clan et
          la discussion du clan. Le jeu est ouvert à partir de 15 ans, et chacun doit pouvoir y lire
          et y écrire tranquillement.
        </p>
      </section>

      <section className={`${styles.section} ${ui.leaf}`}>
        <h2>L'esprit</h2>
        <p>
          On est là pour le plaisir des mots. Les vieilles insultes du catalogue font sourire parce
          qu'elles décrivent des travers d'un autre siècle, mais elles ne doivent jamais servir à
          s'en prendre à un joueur.
        </p>
      </section>

      <section className={`${styles.section} ${ui.leaf}`}>
        <h2>Ce qui est interdit</h2>
        <ul>
          <li>Insulter, humilier ou harceler un joueur, même sans le nommer.</li>
          <li>
            Les propos haineux, comme le racisme, l'antisémitisme, le sexisme, l'homophobie, la
            transphobie, ou la moquerie d'un handicap ou d'une religion.
          </li>
          <li>Menacer, ou encourager la violence, contre autrui ou contre soi.</li>
          <li>Tout contenu sexuel, et toute approche d'un joueur dans ce sens.</li>
          <li>
            Donner des coordonnées, les tiennes ou celles d'un autre : adresse, téléphone, e-mail,
            réseaux sociaux, lieu de vie.
          </li>
          <li>Inviter un joueur à continuer la discussion ailleurs.</li>
          <li>Publicité, liens, messages répétés.</li>
          <li>Vendre ou acheter des cartes ou des comptes contre de l'argent.</li>
          <li>Se faire passer pour un autre joueur, une personne connue ou l'équipe de Leximon.</li>
          <li>
            Tout ce que la loi interdit, comme l'apologie de crimes, le trafic de drogues ou le
            partage de contenus piratés.
          </li>
        </ul>
      </section>

      <section className={`${styles.section} ${ui.leaf}`}>
        <h2>Le pseudo et le nom de clan</h2>
        <p>
          Ils suivent les mêmes règles, avec une de plus : ils ne contiennent ni le vrai nom d'une
          autre personne, ni « Leximon », ni rien qui ressemble à un rôle de l'équipe (modérateur,
          admin). Un pseudo refusé par le filtre automatique ne peut pas être enregistré, et un
          pseudo validé peut quand même être signalé puis remplacé par la modération.
        </p>
      </section>

      <section className={`${styles.section} ${ui.leaf}`}>
        <h2>Ce que tu peux faire</h2>
        <ul>
          <li>Bloquer un joueur. Vous ne voyez plus ni le profil ni les offres de l'autre.</li>
          <li>
            Signaler un pseudo ou un message. Celui que tu signales ne sait pas que c'est toi.
          </li>
          <li>
            Pour un contenu illégal ou une urgence, écrire à{" "}
            <a href={`mailto:${PUBLISHER.contact}`}>{PUBLISHER.contact}</a>.
          </li>
        </ul>
      </section>

      <section className={`${styles.section} ${ui.leaf}`}>
        <h2>Ce qui se passe ensuite</h2>
        <p>
          Un filtre arrête certains mots à l'envoi. Dans un clan, le chef et ses adjoints peuvent
          effacer un message et rendre muet un membre pour un temps. Chaque signalement est lu par
          une personne de l'équipe.
        </p>
        <p>
          Selon la gravité, on efface le texte, on remplace le pseudo, on empêche d'écrire pour un
          temps, on suspend ou on ferme le compte. Un contenu illégal grave peut être transmis aux
          autorités. Chaque sanction est expliquée et peut être contestée, comme le disent les{" "}
          <Link href="/conditions">conditions d'utilisation</Link>.
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
