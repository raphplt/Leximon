import Link from "next/link";
import { Logo } from "@/ui/logo";
import { Collections } from "./collections";
import { HeroWord } from "./hero-word";
import { HowToPlay } from "./how-to-play";
import styles from "./landing-page.module.css";
import { WaitlistForm } from "./waitlist-form";

/**
 * The public home page: a real word first, what Leximon is and a way to hear when it opens, then
 * the launch collections, the rules, and the form again for those who read to the end.
 */
export function LandingPage() {
  return (
    <main className={styles.page}>
      <header className={styles.top}>
        <Logo size="md" />
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

      <Collections />

      <HowToPlay />

      <section className={styles.closing} aria-labelledby="closing-title">
        <h2 id="closing-title" className={styles.closingTitle}>
          Les premiers sachets partent bientôt.
        </h2>
        <WaitlistForm />
      </section>

      <footer className={styles.footer}>
        <span className={styles.footerBrand}>
          <Logo size="sm" />
          <span className={styles.sources}>
            Définitions du Littré, gravures de Wikimedia Commons.
          </span>
        </span>
        <span className={styles.footerLinks}>
          <Link href="/confidentialite">Tes données</Link>
          <Link href="/conditions">Conditions</Link>
          <Link href="/mentions">Mentions</Link>
          <a href="mailto:contact@leximon.fr">contact@leximon.fr</a>
        </span>
      </footer>
    </main>
  );
}
