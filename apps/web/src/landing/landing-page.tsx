import Link from "next/link";
import { Logo } from "@/ui/logo";
import { ParticleStage } from "@/ui/stage";
import { DISCORD_URL } from "./discord";
import { LANDING_DOOR } from "./door";
import { Guess } from "./guess";
import { Hero } from "./hero";
import { HowToPlay } from "./how-to-play";
import { Ladder } from "./ladder";
import styles from "./landing-page.module.css";
import { Library } from "./library";
import { Closing, TopAction } from "./player-access";
import { readShowcase } from "./showcase-server";
import { Testimonials } from "./testimonials";

/**
 * The public home page, in the room of the game: a sachet to tear on the desk first, then words
 * to guess, the six rarities, how the game is played, the collections and the riddle, and the
 * door again for those who read to the end. Someone who already plays finds the way back.
 */
export async function LandingPage() {
  const showcase = await readShowcase();
  const collectionNames = Object.fromEntries(
    showcase.shelves.map((shelf) => [shelf.id, shelf.name]),
  );
  return (
    <ParticleStage dust>
      <main className={styles.page}>
        <header className={styles.top}>
          <Logo size="md" />
          <TopAction />
        </header>

        <Hero
          door={LANDING_DOOR}
          words={showcase.heroWords}
          collectionNames={collectionNames}
          pack={showcase.pack}
        />
        <Guess cards={showcase.guess} />
        <Ladder ladder={showcase.ladder} />
        <HowToPlay pack={showcase.pack} trade={showcase.trade} quiz={showcase.heroWords} />
        <Library shelves={showcase.shelves} />
        <Testimonials />
        <Closing door={LANDING_DOOR} />

        <footer className={styles.footer}>
          <span className={styles.footerBrand}>
            <Logo size="sm" />
            <span>Définitions du Littré, gravures de Wikimedia Commons.</span>
          </span>
          <span className={styles.footerLinks}>
            <Link href="/confidentialite">Tes données</Link>
            <Link href="/conditions">Conditions</Link>
            <Link href="/mentions">Mentions</Link>
            <Link href="/nouveautes">Nouveautés</Link>
            <a href={DISCORD_URL} target="_blank" rel="noopener noreferrer">
              Discord
            </a>
            <a href="mailto:contact@leximon.fr">contact@leximon.fr</a>
          </span>
        </footer>
      </main>
    </ParticleStage>
  );
}
