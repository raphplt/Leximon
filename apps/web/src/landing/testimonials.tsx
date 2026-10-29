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
    <section className={styles.voices} aria-labelledby="voices-title">
      <h2 id="voices-title" className={styles.voicesTitle}>
        Ce qu'en disent les joueurs
      </h2>
      <ul className={styles.voicesList}>
        {TESTIMONIALS.map(({ quote, author }) => (
          <li key={author} className={styles.voice}>
            <blockquote className={styles.voiceQuote}>« {quote} »</blockquote>
            <p className={styles.voiceAuthor}>{author}, de la bêta fermée</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
