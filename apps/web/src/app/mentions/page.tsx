import type { Metadata } from "next";
import Link from "next/link";
import { HOST, PUBLISHER } from "@/lib/publisher";
import styles from "../confidentialite/privacy.module.css";

export const metadata: Metadata = {
  title: "Contact et mentions · Leximon",
  description:
    "Qui édite Leximon, comment nous écrire, et d'où viennent les mots, les gravures et la voix.",
};

const CONTACT = PUBLISHER.contact;

/**
 * Legal notice, contact and credits: the publisher and host the LCEN asks for, and every
 * source the catalogue draws on, as its licence asks.
 */
export default function MentionsPage() {
  return (
    <main className={styles.page}>
      <Link href="/" className={styles.logo}>
        Leximon
      </Link>
      <h1 className={styles.title}>Contact et mentions</h1>

      <section className={styles.section}>
        <h2>Nous écrire</h2>
        <p>
          Une question, un mot mal défini, un pseudo qui dérape :{" "}
          <a href={`mailto:${CONTACT}`}>{CONTACT}</a>. On lit tout.
        </p>
      </section>

      <section className={styles.section}>
        <h2>Éditeur</h2>
        <p>
          {PUBLISHER.name}, {PUBLISHER.status}
          <br />
          SIREN {PUBLISHER.siren}
          <br />
          {PUBLISHER.address}
          <br />
          Directeur de la publication : {PUBLISHER.name}
        </p>
      </section>

      <section className={styles.section}>
        <h2>Hébergement</h2>
        <p>
          {HOST.name}
          <br />
          {HOST.address}
          <br />
          {HOST.phone}
        </p>
      </section>

      <section className={styles.section}>
        <h2>Les mots</h2>
        <p>
          Définitions, origines et citations sont rédigées à partir du Dictionnaire de la langue
          française d'Émile Littré (domaine public), dans l'édition numérique XMLittré de François
          Gannaz (littre.org).
        </p>
      </section>

      <section className={styles.section}>
        <h2>La rareté</h2>
        <p>
          La rareté d'un mot vient de sa fréquence dans Google Books Ngram (corpus français 2019,
          Google, CC BY 3.0).
        </p>
      </section>

      <section className={styles.section}>
        <h2>Les gravures</h2>
        <p>
          Les gravures viennent de Wikimedia Commons : domaine public, CC0 ou CC BY 4.0. Le nom de
          l'auteur et la licence de chacune sont sous la carte, dans sa fiche. Les lettrines sont
          tirées de l'édition Marty-Laveaux de Rabelais (Lemerre, 1868, domaine public).
        </p>
      </section>

      <section className={styles.section}>
        <h2>La voix</h2>
        <p>Les mots sont lus par une voix de synthèse, Google Cloud Text-to-Speech.</p>
      </section>

      <p className={styles.related}>
        <Link href="/conditions">Conditions d'utilisation</Link> ·{" "}
        <Link href="/charte">Charte de la discussion</Link> ·{" "}
        <Link href="/confidentialite">Tes données</Link>
      </p>
    </main>
  );
}
