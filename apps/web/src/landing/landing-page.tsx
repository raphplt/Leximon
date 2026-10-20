import { capitalize, DEFAULT_PACK_NOUN } from "@/lib/pack-shape";
import styles from "./landing-page.module.css";
import { Showcase } from "./showcase";
import { WaitlistForm } from "./waitlist-form";

const { one, many } = DEFAULT_PACK_NOUN;

/** What the game is, in four moves. Settings still provisional (rhythm, odds) stay unsaid. */
const STEPS = [
  {
    title: `Ouvre tes ${many}`,
    text: `Des ${many} gratuits t'attendent chaque jour et se rechargent tout seuls. Chaque ${one} cache des mots, du plus courant au légendaire.`,
  },
  {
    title: "Fais monter tes mots",
    text: "De petits défis reviennent au bon moment pour que les mots restent, et tes cartes montent de niveau.",
  },
  {
    title: "Échange tes doubles",
    text: "Carte contre carte, avec tes amis, pour compléter tes collections.",
  },
  {
    title: "Des mots vrais",
    text: "Tirés du Littré, avec leur définition, leur histoire et, souvent, une citation d'époque et une gravure ancienne.",
  },
] as const;

/** The public home page: what Leximon is, and a way to be warned when it opens. */
export function LandingPage() {
  return (
    <main className={styles.page}>
      <header className={styles.top}>
        <span className={styles.logo}>Leximon</span>
      </header>

      <section className={styles.hero} aria-labelledby="landing-title">
        <div className={styles.pitch}>
          <p className={styles.kicker}>Jeu de cartes à collectionner</p>
          <h1 id="landing-title" className={styles.title}>
            Collectionne les mots que la langue a oubliés.
          </h1>
          <p className={styles.lead}>
            Lucubrateur, orviétan, charivarieur : plus de 1 500 mots rares et anciens du français, à
            ouvrir, collectionner et échanger. {capitalize(many)} gratuits, et ça le restera.
          </p>
          <WaitlistForm />
        </div>
        <Showcase />
      </section>

      <section className={styles.steps} aria-labelledby="landing-steps">
        <h2 id="landing-steps" className={styles.subtitle}>
          Comment on joue
        </h2>
        <ol className={styles.stepList}>
          {STEPS.map((step, index) => (
            <li key={step.title} className={styles.step}>
              <span className={styles.stepNumber} aria-hidden="true">
                {index + 1}
              </span>
              <h3 className={styles.stepTitle}>{step.title}</h3>
              <p className={styles.stepText}>{step.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <footer className={styles.footer}>
        <p>
          Leximon · <a href="mailto:contact@leximon.fr">contact@leximon.fr</a>
        </p>
      </footer>
    </main>
  );
}
