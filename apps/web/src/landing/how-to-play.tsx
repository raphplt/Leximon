import type { CatalogCard } from "@leximon/contract";
import { GiltCorners, TitleRule } from "@/ui/ornaments";
import { Kicker, Leaf, Lettering } from "@/ui/toy";
import styles from "./landing-page.module.css";
import type { Showcase, ShowcaseCard } from "./showcase-cards";

const STEPS = [
  {
    num: "I",
    title: "Des sachets gratuits chaque jour",
    text: "Deux sachets t'attendent dès l'arrivée, puis un nouveau toutes les quelques heures. Certains mots sont courants, d'autres n'apparaissent presque jamais.",
  },
  {
    num: "II",
    title: "Des défis qui dorent tes cartes",
    text: "Quelques questions par jour sur les mots de ton album. Chaque mot retenu fait monter sa carte, de l'Esquisse à l'Encre puis à la Dorure.",
  },
  {
    num: "III",
    title: "Des doubles à échanger",
    text: "Propose tes doubles aux autres joueurs, une carte contre une carte, pour compléter tes collections sans aucun hasard payant.",
  },
] as const;

/** How the game is played: three clean parchment leaves. */
export function HowToPlay(_props: {
  readonly pack: Showcase["pack"];
  readonly trade: readonly ShowcaseCard[];
  readonly quiz: readonly CatalogCard[];
}) {
  return (
    <section id="comment-jouer" className={styles.section} aria-labelledby="how-title">
      <div className={styles.sectionHead}>
        <Kicker>Trois gestes</Kicker>
        <h2 id="how-title" className={styles.sectionTitle}>
          <Lettering>Comment on joue</Lettering>
        </h2>
        <TitleRule className={styles.sectionRule} />
      </div>
      <ol className={styles.how}>
        {STEPS.map((step) => (
          <li key={step.num}>
            <Leaf className={styles.howLeaf}>
              <GiltCorners />
              <span className={styles.howStep} aria-hidden="true">
                <Lettering>{step.num}</Lettering>
              </span>
              <Lettering className={styles.howTitle}>{step.title}</Lettering>
              <p className={styles.howText}>{step.text}</p>
            </Leaf>
          </li>
        ))}
      </ol>
    </section>
  );
}
