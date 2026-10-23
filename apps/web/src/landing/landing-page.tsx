import Link from "next/link";
import { Logo } from "@/ui/logo";
import { Collections } from "./collections";
import { DISCORD_URL, DiscordLink } from "./discord";
import { HeroWord } from "./hero-word";
import { HowToPlay } from "./how-to-play";
import styles from "./landing-page.module.css";
import { Closing, JoinOrResume, TopAction } from "./player-access";
import { readShowcase } from "./showcase-server";

/**
 * The public home page: a real word first, what Leximon is and a way to hear when it opens, then
 * the launch collections, the rules, and the form again for those who read to the end. Someone
 * who already plays finds the way back to the game instead of the form.
 */
export async function LandingPage() {
  const showcase = await readShowcase();
  return (
    <main className={styles.page}>
      <header className={styles.top}>
        <Logo size="md" />
        <TopAction />
      </header>

      <section className={styles.hero} aria-labelledby="landing-title">
        <HeroWord words={showcase.heroWords} />
        <div className={styles.pitch}>
          <h1 id="landing-title" className={styles.title}>
            La langue a jeté des mots superbes. On les a ramassés.
          </h1>
          <p className={styles.lead}>
            Plus de 1 500 vrais mots du français, en cartes à collectionner. Tu les ouvres, tu les
            apprends, et tu les ressors au bon moment.
          </p>
          <JoinOrResume keepRoom />
          <DiscordLink className={styles.discord} />
        </div>
      </section>

      <Collections ladder={showcase.ladder} shelves={showcase.shelves} />

      <HowToPlay pack={showcase.pack} trade={showcase.trade} />

      <Closing />

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
          <a href={DISCORD_URL} target="_blank" rel="noopener noreferrer">
            Discord
          </a>
          <a href="mailto:contact@leximon.fr">contact@leximon.fr</a>
        </span>
      </footer>
    </main>
  );
}
