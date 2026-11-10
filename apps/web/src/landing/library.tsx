import type { ToyMatterName } from "@leximon/tokens";
import { formatCount } from "@leximon/view-model";
import Link from "next/link";
import type { CSSProperties } from "react";
import { CollectionSeal } from "@/components/collection-seal";
import desk from "@/play/desk-columns.module.css";
import { GiltCorners, TitleRule, Tooling } from "@/ui/ornaments";
import { Kicker, Lettering } from "@/ui/toy";
import ui from "@/ui/ui.module.css";
import styles from "./landing-page.module.css";
import type { Shelf } from "./showcase-cards";

const BOOK_MATTERS: readonly ToyMatterName[] = ["blue", "red", "green"];
const BOOK_NOTES: Readonly<Record<string, string>> = {
  fondateurs: "Les grands mots rares et précieux de la langue française.",
  caracteres: "Portraits mordants, travers humains et vieilles piques.",
  metiers: "Les gestes, outils et savoir-faire d'autrefois.",
};

function displayCount(value: number): string {
  return formatCount(value).replaceAll("\u202f", "\u00a0");
}

/** The collections as bound tomes, and the daily riddle game board beside them. */
export function Library({ shelves }: { readonly shelves: readonly Shelf[] }) {
  if (shelves.length === 0) return null;
  const total = shelves.reduce((sum, shelf) => sum + shelf.count, 0);
  return (
    <section
      id="collections"
      className={`${styles.cabinet} ${styles.section}`}
      data-tone="acajou"
      aria-labelledby="library-title"
    >
      <Tooling />
      <div className={styles.sectionHead}>
        <Kicker>Le catalogue de lancement</Kicker>
        <h2 id="library-title" className={styles.sectionTitle}>
          <Lettering>{`${displayCount(total)} mots en ${shelves.length} collections`}</Lettering>
        </h2>
        <p className={styles.sectionLead}>
          Chaque collection possède sa reliure, son sceau gravé et ses centaines de mots tirés du
          dictionnaire d'Émile Littré.
        </p>
        <TitleRule className={styles.sectionRule} />
      </div>

      <div className={styles.library}>
        <ul className={styles.books}>
          {shelves.map((shelf, at) => {
            const matter = BOOK_MATTERS[at % BOOK_MATTERS.length] ?? "blue";
            const note = BOOK_NOTES[shelf.id] ?? shelf.tagline;
            return (
              <li key={shelf.id}>
                <span
                  className={styles.book}
                  style={
                    {
                      "--cover-top": `var(--lx-toy-${matter}-top)`,
                      "--cover-bottom": `var(--lx-toy-${matter}-bottom)`,
                      "--cover-edge": `var(--lx-toy-${matter}-edge)`,
                    } as CSSProperties
                  }
                >
                  <CollectionSeal
                    collection={{ id: shelf.id, name: shelf.name, back: shelf.back }}
                    size={76}
                  />
                  <span className={styles.bookText}>
                    <Lettering className={styles.bookName}>{shelf.name}</Lettering>
                    {note !== undefined && <span className={styles.bookNote}>{note}</span>}
                    <span className={styles.bookWords}>{formatCount(shelf.count)} mots</span>
                  </span>
                </span>
              </li>
            );
          })}
        </ul>

        <Link href="/enigme" className={`${ui.leaf} ${desk.leaf} ${styles.riddle}`}>
          <GiltCorners />
          <span className={desk.leafKicker}>Énigme du jour · Accès libre</span>
          <span className={styles.riddleTitle}>Un mot mystère à débusquer chaque jour</span>
          <span
            className={desk.type}
            style={{ "--letters": 8 } as CSSProperties}
            aria-hidden="true"
          >
            {["S", null, null, null, null, null, null, null].map((letter, at) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: one block per letter, in order
              <span key={at} className={letter === null ? desk.blockHollow : desk.block}>
                {letter}
              </span>
            ))}
          </span>
          <span className={styles.riddleText}>
            Tu as 7 essais, et chaque erreur dévoile un indice de plus. L'énigme se joue sans
            compte.
          </span>
          <span className={desk.go}>Jouer l'énigme du jour ›</span>
        </Link>
      </div>
    </section>
  );
}
