"use client";

import type { CatalogCard } from "@leximon/contract";
import { cardSize, effects, openingTimes, rarityLights, type ToyMatterName } from "@leximon/tokens";
import { formatCount, frequencyLine, stagingFor } from "@leximon/view-model";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type CSSProperties, type FormEvent, useEffect, useRef, useState } from "react";
import { CardBack } from "@/booster/card-back";
import { play } from "@/booster/feedback";
import { RevealCard } from "@/booster/reveal-card";
import { Sachet } from "@/booster/sachet";
import { Card } from "@/components/card";
import { RarityName } from "@/components/rarity-icon";
import type { Shelf, Showcase, ShowcaseCard } from "@/landing/showcase-cards";
import { Desk, MainAction, PaperAction } from "@/library/play-pieces";
import desk from "@/play/desk-columns.module.css";
import { Logo } from "@/ui/logo";
import { ParticleStage, useStage } from "@/ui/stage";
import { Kicker, Leaf, Lettering, Toy, ToyBody } from "@/ui/toy";
import ui from "@/ui/ui.module.css";
import styles from "./accueil-plate.module.css";

/**
 * A plate of the public home page as its spec settles it, on the real pieces of the game and the
 * published catalogue: the owner judges it before the page is rebuilt. The sachet opens for show,
 * nothing is asked of the server.
 */

type Door = "open" | "waitlist";

const DOORS: readonly { readonly id: Door; readonly label: string }[] = [
  { id: "open", label: "Ouverture publique" },
  { id: "waitlist", label: "Bêta fermée" },
];

/** Where the seam of the sachet runs, from its top: the sparks of the charge leak from there. */
const SEAM_AT = 0.13;
const CHARGE_SPARKS_MAX = 6;

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** True on a phone: the pieces of the page take their phone sizes. */
function useNarrow(): boolean {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(max-width: 759px)");
    const update = () => setNarrow(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return narrow;
}

export function AccueilPlate({ showcase }: { readonly showcase: Showcase }) {
  const [door, setDoor] = useState<Door>("open");
  return (
    <ParticleStage dust>
      <main className={styles.page}>
        <nav className={styles.controls} aria-label="État de la planche">
          <span className={styles.controlsLabel}>Planche Accueil</span>
          {DOORS.map((entry) => (
            <Toy
              key={entry.id}
              matter={entry.id === door ? "gold" : "paper"}
              className={styles.control}
              aria-pressed={entry.id === door}
              onClick={() => setDoor(entry.id)}
            >
              {entry.label}
            </Toy>
          ))}
        </nav>

        <header className={styles.top}>
          <Logo size="md" />
          {door === "open" ? (
            <Toy matter="gold" className={styles.topAction}>
              <Lettering>Jouer</Lettering>
            </Toy>
          ) : (
            <Toy matter="paper" className={styles.topAction}>
              <Lettering>J'ai une invitation</Lettering>
            </Toy>
          )}
        </header>

        <Hero door={door} words={showcase.heroWords} pack={showcase.pack} />
        <Guess cards={showcase.guess} />
        <Ladder ladder={showcase.ladder} />
        <HowToPlay pack={showcase.pack} trade={showcase.trade} quiz={showcase.heroWords} />
        <Library shelves={showcase.shelves} />
        <Closing door={door} />

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
            <a href="mailto:contact@leximon.fr">contact@leximon.fr</a>
          </span>
        </footer>
      </main>
    </ParticleStage>
  );
}

// --- The door: the game, or the waitlist while the beta is closed ----------------------

function DoorAction({ door }: { readonly door: Door }) {
  const router = useRouter();
  const [noted, setNoted] = useState(false);
  if (door === "open") {
    return (
      <div className={styles.door}>
        <MainAction label="Jouer" onClick={() => router.push("/jouer")} />
        <span className={styles.doorNote}>Gratuit, sans compte pour commencer.</span>
      </div>
    );
  }
  const submit = (event: FormEvent) => {
    event.preventDefault();
    setNoted(true);
  };
  return (
    <form className={styles.waitlist} onSubmit={submit}>
      {noted ? (
        <p className={styles.noted}>Noté. On se revoit à l'ouverture.</p>
      ) : (
        <>
          <label className={styles.waitlistLabel} htmlFor="plate-email">
            Laisse ton adresse pour être prévenu de l'ouverture.
          </label>
          <div className={styles.waitlistRow}>
            <input
              id="plate-email"
              className={styles.field}
              type="email"
              placeholder="ton@adresse.fr"
              autoComplete="email"
            />
            <Toy matter="gold" type="submit" className={styles.waitlistButton}>
              <Lettering>Me prévenir</Lettering>
            </Toy>
          </div>
        </>
      )}
    </form>
  );
}

// --- The first screen: a sachet to tear on the desk -------------------------------------

type HeroPhase =
  | { readonly name: "sealed" }
  | { readonly name: "opening"; readonly card: CatalogCard }
  | { readonly name: "revealing"; readonly card: CatalogCard }
  | { readonly name: "revealed"; readonly card: CatalogCard };

type Moment = "waiting" | "arriving" | "charging" | "burst";

function Hero({
  door,
  words,
  pack,
}: {
  readonly door: Door;
  readonly words: readonly CatalogCard[];
  readonly pack: Showcase["pack"];
}) {
  const stage = useStage();
  const narrow = useNarrow();
  const [phase, setPhase] = useState<HeroPhase>({ name: "sealed" });
  const [moment, setMoment] = useState<Moment>("waiting");
  const [round, setRound] = useState(0);
  const sachetRef = useRef<HTMLDivElement>(null);
  const deskRef = useRef<HTMLDivElement>(null);
  const timers = useRef<number[]>([]);

  useEffect(
    () => () => {
      for (const timer of timers.current) window.clearTimeout(timer);
    },
    [],
  );

  const later = (ms: number, action: () => void) => {
    timers.current.push(window.setTimeout(action, ms));
  };

  const open = () => {
    if (phase.name !== "sealed" || words.length === 0) return;
    const card = words[Math.floor(Math.random() * words.length)];
    if (card === undefined) return;
    play("tearFinish");
    setPhase({ name: "opening", card });
    if (prefersReducedMotion()) {
      setPhase({ name: "revealing", card });
      return;
    }
    setMoment("arriving");
    let beats = 0;
    let sparks = 0;
    later(openingTimes.arriveMs, () => {
      setMoment("charging");
      sparks = window.setInterval(() => {
        const box = sachetRef.current?.getBoundingClientRect();
        if (box === undefined) return;
        beats++;
        stage.burst(box.left + box.width / 2, box.top + box.height * SEAM_AT, {
          ...effects.charge.burst,
          count: Math.min(CHARGE_SPARKS_MAX, 1 + Math.floor(beats / 4)),
        });
      }, effects.charge.everyMs);
    });
    later(openingTimes.arriveMs + openingTimes.chargeMs, () => {
      window.clearInterval(sparks);
      setMoment("burst");
      const box = sachetRef.current?.getBoundingClientRect();
      if (box !== undefined) {
        const x = box.left + box.width / 2;
        const y = box.top + box.height / 2;
        for (const settings of effects.burst) stage.burst(x, y, settings);
        stage.ring(x, y, rarityLights.epic[0] ?? "white", 6);
        stage.flash(1, 500);
      }
      if (deskRef.current !== null) stage.shake(deskRef.current, 10, 450);
    });
    later(openingTimes.arriveMs + openingTimes.chargeMs + openingTimes.burstMs, () => {
      play("cardSlide");
      setMoment("waiting");
      setPhase({ name: "revealing", card });
    });
  };

  const again = () => {
    setPhase({ name: "sealed" });
    setRound((value) => value + 1);
  };

  const cardWidth = narrow ? 168 : 228;
  return (
    <section className={styles.hero} aria-labelledby="plate-title">
      <div className={styles.pitch}>
        <h1 id="plate-title" className={styles.title}>
          <Lettering>La langue a jeté des mots superbes. On les a ramassés.</Lettering>
        </h1>
        <Leaf className={styles.lead}>
          <p>
            Plus de 1 500 vrais mots du français, en cartes à collectionner. Ouvre tes sachets
            gratuits du jour, complète ton album et échange tes doubles.
          </p>
        </Leaf>
        <DoorAction door={door} />
      </div>

      <div ref={deskRef} className={styles.counter}>
        <Desk className={styles.desk} />
        {phase.name === "sealed" || phase.name === "opening" ? (
          <>
            <div ref={sachetRef} className={styles.sachet} data-moment={moment}>
              {pack !== null && (
                <Sachet
                  key={round}
                  collection={pack}
                  state={moment === "burst" ? "opening" : "sealed"}
                  onTearStart={() => undefined}
                  onOpen={open}
                />
              )}
            </div>
            <p className={styles.deskHint} data-gone={phase.name === "opening" || undefined}>
              <Kicker>Un sachet t'attend. Déchire-le.</Kicker>
            </p>
          </>
        ) : phase.name === "revealing" ? (
          <div className={styles.reveal}>
            <RevealCard
              card={phase.card}
              collectionName={collectionOf(phase.card)}
              backTone={pack?.back}
              staging={stagingFor(phase.card.rarity, {
                reducedMotion: prefersReducedMotion(),
                hurried: false,
              })}
              width={cardWidth}
              isNew
              copies={1}
              firstLabel={null}
              stage={stage}
              onNext={() => setPhase({ name: "revealed", card: phase.card })}
            />
          </div>
        ) : (
          <div className={styles.revealed}>
            <Card
              card={phase.card}
              collectionName={collectionOf(phase.card)}
              width={narrow ? 138 : 188}
            />
            <div className={styles.revealedText}>
              <span className={styles.revealedRarity}>
                <RarityName rarity={phase.card.rarity} />
              </span>
              <span>{frequencyLine(phase.card.perBillion)}</span>
              <PaperAction label="Un autre sachet" onClick={again} />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

/** The showcase cards carry their collection's id; the plate names the three it knows. */
function collectionOf(card: CatalogCard): string {
  return COLLECTION_NAMES[card.collectionId] ?? "";
}

const COLLECTION_NAMES: Readonly<Record<string, string>> = {
  fondateurs: "Les Fondateurs",
  caracteres: "Caractères et travers",
  metiers: "Métiers et objets disparus",
};

// --- Words to guess before the card turns -------------------------------------------------

function Guess({ cards }: { readonly cards: readonly ShowcaseCard[] }) {
  const narrow = useNarrow();
  const [turned, setTurned] = useState<ReadonlySet<string>>(new Set());
  if (cards.length === 0) return null;
  const width = narrow ? 148 : 196;
  const height = Math.round((width * cardSize.height) / cardSize.width);
  const turn = (id: string) => {
    play("cardSlide");
    setTurned((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  return (
    <section className={styles.section} aria-labelledby="guess-title">
      <div className={styles.sectionHead}>
        <h2 id="guess-title" className={styles.sectionTitle}>
          <Lettering>Tu sais ce que c'est ?</Lettering>
        </h2>
        <p className={styles.sectionLead}>
          On traitait les gens de tout ça, autrefois. Touche une carte pour la retourner.
        </p>
      </div>
      <ul className={styles.guess}>
        {cards.map(({ card, collectionName }) => {
          const shown = turned.has(card.id);
          return (
            <li key={card.id}>
              <button
                type="button"
                className={styles.flip}
                data-turned={shown || undefined}
                style={{ width, height } as CSSProperties}
                aria-pressed={shown}
                aria-label={shown ? `${card.word}, retourner la carte` : `${card.word} ?`}
                onClick={() => turn(card.id)}
              >
                <span className={styles.flipFront}>
                  <CardBack rarity={card.rarity} width={width} />
                  <span className={styles.flipWord}>
                    <Lettering>{card.word} ?</Lettering>
                  </span>
                </span>
                <span className={styles.flipBack}>
                  <Card card={card} collectionName={collectionName} width={width} />
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// --- The six rarities on a shelf ----------------------------------------------------------

function Ladder({ ladder }: { readonly ladder: readonly ShowcaseCard[] }) {
  const narrow = useNarrow();
  if (ladder.length === 0) return null;
  return (
    <section className={styles.section} aria-labelledby="ladder-title">
      <div className={styles.sectionHead}>
        <h2 id="ladder-title" className={styles.sectionTitle}>
          <Lettering>Six raretés, selon la fréquence du mot dans les livres.</Lettering>
        </h2>
        <p className={styles.sectionLead}>
          De Courant, pour les mots qu'on croise encore, jusqu'à Légendaire, pour ceux qui ont
          presque disparu.
        </p>
      </div>
      <ol className={styles.ladder}>
        {ladder.map(({ card, collectionName }, at) => (
          <li key={card.id} className={styles.rung} style={{ "--at": at } as CSSProperties}>
            <Card card={card} collectionName={collectionName} width={narrow ? 150 : 158} />
            <span className={styles.rungTag}>
              <span className={styles.rungRarity}>
                <RarityName rarity={card.rarity} />
              </span>
              <span className={styles.rungFrequency}>{frequencyLine(card.perBillion)}</span>
            </span>
          </li>
        ))}
      </ol>
      <div className={styles.plank} aria-hidden="true" />
    </section>
  );
}

// --- How the game is played, in three leaves ----------------------------------------------

function HowToPlay({
  pack,
  trade,
  quiz,
}: {
  readonly pack: Showcase["pack"];
  readonly trade: readonly ShowcaseCard[];
  readonly quiz: readonly CatalogCard[];
}) {
  return (
    <section className={styles.section} aria-labelledby="how-title">
      <div className={styles.sectionHead}>
        <h2 id="how-title" className={styles.sectionTitle}>
          <Lettering>Comment on joue</Lettering>
        </h2>
      </div>
      <ol className={styles.how}>
        <li>
          <Leaf className={styles.howLeaf}>
            <div className={styles.howArt}>
              <div className={styles.howSachet}>
                {pack !== null && (
                  <Sachet
                    collection={pack}
                    state="sealed"
                    onTearStart={() => undefined}
                    onOpen={() => undefined}
                  />
                )}
              </div>
            </div>
            <Lettering className={styles.howTitle}>Des sachets chaque jour</Lettering>
            <p className={styles.howText}>
              Tes sachets se remplissent tout seuls, gratuitement. Certains mots sont courants,
              d'autres n'apparaissent presque jamais.
            </p>
          </Leaf>
        </li>
        <li>
          <Leaf className={styles.howLeaf}>
            <div className={styles.howArt}>
              <QuizFigure words={quiz} />
            </div>
            <Lettering className={styles.howTitle}>Des mots qui montent</Lettering>
            <p className={styles.howText}>
              Quelques questions par jour sur tes mots. Un mot que tu retiens fait monter sa carte,
              de l'Esquisse jusqu'à la Dorure.
            </p>
          </Leaf>
        </li>
        <li>
          <Leaf className={styles.howLeaf}>
            <div className={styles.howArt}>
              <TradeFigure trade={trade} />
            </div>
            <Lettering className={styles.howTitle}>Des doubles à échanger</Lettering>
            <p className={styles.howText}>
              Tu échanges tes doubles avec d'autres joueurs, une carte contre une carte, pour finir
              tes collections.
            </p>
          </Leaf>
        </li>
      </ol>
    </section>
  );
}

/** A question of the review on its tiles: the right word turns green, again and again. */
function QuizFigure({ words }: { readonly words: readonly CatalogCard[] }) {
  const [answered, setAnswered] = useState(false);
  useEffect(() => {
    if (prefersReducedMotion()) {
      setAnswered(true);
      return;
    }
    const timer = window.setInterval(() => setAnswered((value) => !value), 1800);
    return () => window.clearInterval(timer);
  }, []);
  const asked = words.find((card) => card.id === "lucubrateur") ?? words[0];
  if (asked === undefined) return null;
  const others = words.filter((card) => card.id !== asked.id).slice(0, 2);
  const choices = [others[0], asked, others[1]].filter(
    (card): card is CatalogCard => card !== undefined,
  );
  return (
    <div className={styles.quiz}>
      <p className={styles.quizPrompt}>{shortDefinition(asked.definition)}</p>
      {choices.map((card) => {
        const right = card.id === asked.id;
        const matter: ToyMatterName = answered && right ? "green" : "paper";
        return (
          <ToyBody key={card.id} matter={matter} className={styles.quizChoice}>
            <Lettering>{card.word}</Lettering>
          </ToyBody>
        );
      })}
    </div>
  );
}

/** The first sentence of a definition, for a figure that has little room. */
function shortDefinition(definition: string): string {
  const cut = definition.search(/[.;]/);
  return cut === -1 ? definition : `${definition.slice(0, cut)}.`;
}

/** Two cards crossing over, each to the other player. */
function TradeFigure({ trade }: { readonly trade: readonly ShowcaseCard[] }) {
  const [left, right] = trade;
  if (left === undefined || right === undefined) return null;
  return (
    <div className={styles.trade}>
      <span className={styles.tradeLeft}>
        <Card card={left.card} collectionName={left.collectionName} width={104} />
      </span>
      <span className={styles.tradeRight}>
        <Card card={right.card} collectionName={right.collectionName} width={104} />
      </span>
    </div>
  );
}

// --- The collections as books, and the riddle of the day ------------------------------------

const BOOK_MATTERS: readonly ToyMatterName[] = ["blue", "red", "green"];

/** The lettering has no narrow space: at display size, thousands take a full no-break space. */
function displayCount(value: number): string {
  return formatCount(value).replaceAll("\u202f", "\u00a0");
}

function Library({ shelves }: { readonly shelves: readonly Shelf[] }) {
  if (shelves.length === 0) return null;
  const total = shelves.reduce((sum, shelf) => sum + shelf.count, 0);
  return (
    <section className={styles.section} aria-labelledby="library-title">
      <div className={styles.sectionHead}>
        <h2 id="library-title" className={styles.sectionTitle}>
          <Lettering>{`${displayCount(total)} mots, en trois collections`}</Lettering>
        </h2>
      </div>
      <div className={styles.library}>
        <ul className={styles.books}>
          {shelves.map((shelf, at) => {
            const matter = BOOK_MATTERS[at % BOOK_MATTERS.length] ?? "blue";
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
                  <ToyBody matter="gold" shape="round" className={styles.bookMark}>
                    <Lettering>{shelf.name.replace(/^Les /, "").slice(0, 1)}</Lettering>
                  </ToyBody>
                  <span className={styles.bookText}>
                    <Lettering className={styles.bookName}>{shelf.name}</Lettering>
                    <span className={styles.bookWords}>{formatCount(shelf.count)} mots</span>
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
        <Link href="/enigme" className={`${ui.leaf} ${desk.leaf} ${styles.riddle}`}>
          <span className={desk.leafKicker}>Énigme du jour</span>
          <span className={styles.riddleTitle}>Un mot à trouver, indice après indice</span>
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
          <span className={styles.riddleText}>Une par jour, pour tout le monde, sans compte.</span>
          <span className={desk.go}>Jouer à l'énigme</span>
        </Link>
      </div>
    </section>
  );
}

// --- The end of the page ------------------------------------------------------------------

function Closing({ door }: { readonly door: Door }) {
  return (
    <section className={styles.closing} aria-labelledby="closing-title">
      <Desk className={styles.closingDesk} />
      <h2 id="closing-title" className={styles.closingTitle}>
        <Lettering>
          {door === "open" ? "Tes sachets sont prêts." : "L'ouverture approche."}
        </Lettering>
      </h2>
      <DoorAction door={door} />
    </section>
  );
}
