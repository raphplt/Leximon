import type { Metadata } from "next";
import Link from "next/link";
import styles from "../confidentialite/privacy.module.css";

export const metadata: Metadata = {
  title: "Contact et mentions · Leximon",
  description: "Nous écrire, et d'où viennent les mots, les gravures et les voix de Leximon.",
};

const CONTACT = "contact@leximon.fr";

/** Contact and credits (R-09): every source the catalogue draws on, as its licence asks. */
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

      <section className={styles.section}>
        <h2>Tes données</h2>
        <p>
          Ce qu'on garde, pourquoi, et comment tout effacer :{" "}
          <Link href="/confidentialite">Tes données</Link>.
        </p>
      </section>
    </main>
  );
}
