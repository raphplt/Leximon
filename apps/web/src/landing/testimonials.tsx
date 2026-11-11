import { Leaf, Lettering } from "@/ui/toy";
import styles from "./landing-page.module.css";

interface Testimonial {
  /** The player's words, exactly as they agreed to see them published. */
  readonly quote: string;
  /** The pseudo or first name they chose to sign with. */
  readonly author: string;
}

/**
 * What beta players said, each one published with their agreement only. While the list is empty
 * the section does not show.
 */
const TESTIMONIALS: readonly Testimonial[] = [];

export function Testimonials() {
  if (TESTIMONIALS.length === 0) return null;
  return (
    <section className={styles.section} aria-labelledby="voices-title">
      <div className={styles.sectionHead}>
        <h2 id="voices-title" className={styles.sectionTitle}>
          <Lettering>Ce qu'en disent les joueurs</Lettering>
        </h2>
      </div>
      <ul className={styles.voices}>
        {TESTIMONIALS.map(({ quote, author }) => (
          <li key={author}>
            <Leaf className={styles.voice}>
              <blockquote className={styles.voiceQuote}>« {quote} »</blockquote>
              <p className={styles.voiceAuthor}>{author}, de la bêta fermée</p>
            </Leaf>
          </li>
        ))}
      </ul>
    </section>
  );
}
