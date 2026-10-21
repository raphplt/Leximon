import Link from "next/link";
import { HeroWord } from "./hero-word";
import { HowToPlay } from "./how-to-play";
import { InsultList } from "./insults";
import styles from "./landing-page.module.css";
import { WaitlistForm } from "./waitlist-form";

/**
 * The public home page: a real word first, what Leximon is and a way to hear when it opens, then
 * a few insults of old, then the rules.
 */
export function LandingPage() {
  return (
    <main className={styles.page}>
      <header className={styles.top}>
        <span className={styles.logo}>Leximon</span>
      </header>

      <section className={styles.hero} aria-labelledby="landing-title">
        <HeroWord />
        <div className={styles.pitch}>
          <h1 id="landing-title" className={styles.title}>
            La langue a jeté des mots superbes. On les a ramassés.
          </h1>
          <p className={styles.lead}>
            Plus de 1 500 vrais mots du français, en cartes à collectionner. Tu les ouvres, tu les
            apprends, et tu les ressors au bon moment.
          </p>
          <WaitlistForm />
        </div>
      </section>

      <InsultList />

      <HowToPlay />

      <footer className={styles.footer}>
        <span className={styles.logoSmall}>Leximon</span>
        <span className={styles.footerLinks}>
          <Link href="/confidentialite">Tes données</Link>
          <a href="mailto:contact@leximon.fr">contact@leximon.fr</a>
        </span>
      </footer>
    </main>
  );
}
