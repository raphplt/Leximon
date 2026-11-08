"use client";

import type { CatalogCard, LeagueId } from "@leximon/contract";
import type { Rarity } from "@leximon/core";
import { effects } from "@leximon/tokens";
import { hideWordIn, LEAGUE_NAMES, trappedText } from "@leximon/view-model";
import { type CSSProperties, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { CardBack } from "@/booster/card-back";
import { useCatalog } from "@/cards/use-catalog";
import { Avatar } from "@/components/avatar";
import { QuestionCard } from "@/components/card";
import { DefinitionText } from "@/components/definition-text";
import { MiniCard } from "@/jousts/pieces";
import { Desk, MainAction, PaperAction } from "@/library/play-pieces";
import { Dialog } from "@/ui/dialog";
import { Icon } from "@/ui/icon";
import { ParticleStage, useStage } from "@/ui/stage";
import { Lettering, Toy, ToyIcon } from "@/ui/toy";
import { Crest } from "./crest";
import styles from "./lice-plate.module.css";

/**
 * Planche of the jousts redesign (docs/cahiers-des-charges/joutes-refonte.md): the hall, the
 * leagues' road, the deck, the search for an opponent, the face-to-face, the run on the green
 * desk, and a climb to the next league. Every figure is made up.
 */

type Moment = "hall" | "search" | "face" | "run" | "climb";

const MOMENTS: readonly { readonly id: Moment; readonly label: string }[] = [
  { id: "hall", label: "Accueil" },
  { id: "search", label: "Recherche" },
  { id: "face", label: "Face-à-face" },
  { id: "run", label: "Partie" },
  { id: "climb", label: "Montée" },
];

const LEAGUES: readonly {
  readonly id: LeagueId;
  readonly ecus: number;
  readonly up: number;
  readonly down: number;
  readonly banner: string | null;
}[] = [
  { id: "page", ecus: 10, up: 10, down: 0, banner: null },
  { id: "ecuyer", ecus: 15, up: 8, down: 3, banner: null },
  { id: "chevalier", ecus: 20, up: 7, down: 5, banner: "Échiqueté" },
  { id: "banneret", ecus: 25, up: 6, down: 5, banner: null },
  { id: "marechal", ecus: 30, up: 5, down: 6, banner: "Écartelé" },
  { id: "connetable", ecus: 35, up: 4, down: 7, banner: null },
  { id: "champion", ecus: 40, up: 0, down: 8, banner: "Drap d'or" },
];

const MINE: LeagueId = "page";
const ME = { pseudo: "raph2", avatar: "metaphraste" };
const THEM = { pseudo: "Hortense", avatar: "bachelette" };

/** The player's neighbours in the week's group: Page sends its first 10 up. */
const NEIGHBOURS: readonly {
  readonly place: number;
  readonly pseudo: string;
  readonly avatar: string;
  readonly points: number;
  readonly bot?: boolean;
}[] = [
  { place: 6, pseudo: "Mobilette", avatar: "grimelin", points: 15 },
  { place: 7, pseudo: "Automate", avatar: "cassandre", points: 12, bot: true },
  { place: 8, pseudo: "Clopin", avatar: "preopinant", points: 12 },
  { place: 9, pseudo: ME.pseudo, avatar: ME.avatar, points: 9 },
  { place: 10, pseudo: "Hortense", avatar: THEM.avatar, points: 9 },
  { place: 11, pseudo: "Automate", avatar: "ricanerie", points: 6, bot: true },
  { place: 12, pseudo: "Bertrade", avatar: "grimelin", points: 3 },
];

const COST: Readonly<Record<Rarity, number>> = {
  common: 1,
  uncommon: 2,
  rare: 3,
  precious: 4,
  epic: 5,
  legendary: 6,
};

export function LicePlate() {
  const [moment, setMoment] = useState<Moment>("hall");
  return (
    <main className={styles.page}>
      <ParticleStage dust>
        <nav className={styles.controls} aria-label="État de la planche">
          <span className={styles.controlsLabel}>Planche Joutes</span>
          {MOMENTS.map((entry) => (
            <Toy
              key={entry.id}
              matter={entry.id === moment ? "gold" : "paper"}
              className={styles.control}
              aria-pressed={entry.id === moment}
              onClick={() => setMoment(entry.id)}
            >
              {entry.label}
            </Toy>
          ))}
        </nav>
        <div className={styles.screen} key={moment}>
          {moment === "hall" && <Hall onLaunch={() => setMoment("search")} />}
          {moment === "search" && <Search onFound={() => setMoment("face")} />}
          {moment === "face" && <FaceToFace onStart={() => setMoment("run")} />}
          {moment === "run" && <Run onDone={() => setMoment("climb")} />}
          {moment === "climb" && <Climb onBack={() => setMoment("hall")} />}
        </div>
      </ParticleStage>
    </main>
  );
}

// --- The hall ----------------------------------------------------------------------------

function Hall({ onLaunch }: { readonly onLaunch: () => void }) {
  const [leaguesOpen, setLeaguesOpen] = useState(false);
  const [deckOpen, setDeckOpen] = useState(false);
  const [howOpen, setHowOpen] = useState(true);
  const deckPoints = useDeck().reduce((sum, card) => sum + COST[card.rarity], 0);
  return (
    <div className={styles.hall}>
      <section className={styles.lice} style={rise(0)}>
        {/* biome-ignore lint/performance/noImgElement: a faint decoration, sized by CSS */}
        <img className={styles.engraving} src={ENGRAVING} alt="" />
        <div className={styles.liceCrest}>
          <span className={styles.crestGlow} aria-hidden="true" />
          <Crest league={MINE} size={150} />
          <span className={styles.ribbon}>
            <Lettering>{LEAGUE_NAMES[MINE]}</Lettering>
          </span>
        </div>
        <div className={styles.liceWeek}>
          <span className={styles.kicker}>Tournoi de la semaine</span>
          <div className={styles.weekFigures}>
            <span className={styles.weekPlace}>
              <Lettering>9e</Lettering>
              <small>sur 30</small>
            </span>
            <span className={styles.weekPoints}>
              <Lettering>9</Lettering>
              <small>points</small>
            </span>
            <span className={styles.zone} data-zone="up">
              <Icon name="chev" size={16} className={styles.zoneUp} />
              Zone de montée
            </span>
          </div>
          <p className={styles.weekLine}>
            Si le tournoi finissait maintenant, tu monterais en Écuyer.
          </p>
          <span className={styles.clock}>
            <Icon name="clock" size={16} />
            Fin dans 2 jours
          </span>
          <div
            className={styles.lances}
            role="img"
            aria-label="Encore 3 joutes classées aujourd'hui"
          >
            {[0, 1, 2, 3, 4].map((lance) => (
              <Lance key={lance} spent={lance >= 3} />
            ))}
            <span className={styles.lancesText}>3 joutes classées aujourd'hui</span>
          </div>
        </div>
        <div className={styles.liceActions}>
          <MainAction label="Joute classée" onClick={onLaunch} />
          <div className={styles.liceMinor}>
            <Toy matter="paper" className={styles.minor} onClick={onLaunch}>
              <Icon name="swap" size={18} /> Joute libre
            </Toy>
            <Toy matter="paper" className={styles.minor}>
              <Icon name="amis" size={18} /> Défier un ami
            </Toy>
          </div>
        </div>
      </section>

      <section className={`${styles.leaf} ${styles.road}`} style={rise(1)}>
        <header className={styles.leafHead}>
          <span className={styles.kicker}>Le chemin des ligues</span>
          <button type="button" className={styles.more} onClick={() => setLeaguesOpen(true)}>
            Voir les ligues <Icon name="chev" size={14} />
          </button>
        </header>
        <button
          type="button"
          className={styles.roadTrack}
          onClick={() => setLeaguesOpen(true)}
          aria-label="Les sept ligues, de Page à Champion"
        >
          <span className={styles.roadLine} aria-hidden="true" />
          {LEAGUES.map((league, index) => {
            const at = LEAGUES.findIndex((l) => l.id === MINE);
            const state = index < at ? "past" : index === at ? "here" : "ahead";
            return (
              <span key={league.id} className={styles.roadStop} data-state={state}>
                {state === "here" && <span className={styles.youTag}>Toi</span>}
                <Crest
                  league={league.id}
                  size={state === "here" ? 64 : 46}
                  dim={state === "ahead"}
                />
                <span className={styles.roadName}>{LEAGUE_NAMES[league.id]}</span>
                <span className={styles.roadGain}>
                  <ToyIcon name="ecu" size={14} /> {league.ecus}
                </span>
              </span>
            );
          })}
        </button>
      </section>

      <section className={`${styles.leaf} ${styles.standing}`} style={rise(2)}>
        <header className={styles.leafHead}>
          <span className={styles.kicker}>Ton groupe · Page</span>
          <button type="button" className={styles.more}>
            Classement <Icon name="chev" size={14} />
          </button>
        </header>
        <ol className={styles.rows}>
          {NEIGHBOURS.map((row) => (
            <li key={row.place} className={styles.rowItem}>
              <span className={styles.row} data-me={row.pseudo === ME.pseudo || undefined}>
                <span className={styles.rowPlace}>{row.place}</span>
                <Avatar avatar={row.avatar} frame={null} size={34} />
                <span className={styles.rowName}>
                  {row.pseudo}
                  {row.bot === true && <small className={styles.botTag}>automate</small>}
                </span>
                <span className={styles.rowPoints}>{row.points} pts</span>
              </span>
              {row.place === 10 && (
                <span className={styles.zoneLine} data-zone="up">
                  <Icon name="chev" size={12} className={styles.zoneUp} /> Les 10 premiers montent
                  en Écuyer dimanche
                </span>
              )}
            </li>
          ))}
        </ol>
      </section>

      {howOpen && (
        <section className={`${styles.leaf} ${styles.how}`} style={rise(3)}>
          <header className={styles.leafHead}>
            <span className={styles.kicker}>Comment ça marche</span>
            <button type="button" className={styles.more} onClick={() => setHowOpen(false)}>
              Replier
            </button>
          </header>
          <ol className={styles.steps}>
            <Step icon="jousts" title="Lance une joute">
              Le jeu te trouve un adversaire de ta ligue.
            </Step>
            <Step icon="candle" title="Trouve 5 mots">
              Une définition, quatre mots, 15 secondes pour chacun.
            </Step>
            <Step icon="ecu" title="Gagne des points">
              3 points la victoire. Les meilleurs montent de ligue chaque dimanche.
            </Step>
          </ol>
        </section>
      )}

      <section className={`${styles.leaf} ${styles.jousts}`} style={rise(4)}>
        <span className={styles.kicker}>Résultats à découvrir</span>
        <div className={styles.letters}>
          <Letter pseudo="Hortense" avatar={THEM.avatar} kind="Classée" />
          <Letter pseudo="Bot Érudit" avatar="cassandre" kind="Amicale" />
        </div>
        <span className={styles.kicker}>En attente de l'adversaire</span>
        <WaitRow pseudo="Clopin" avatar="preopinant" until="demain 10 h 40" />
        <span className={styles.kicker}>Terminées</span>
        <DoneRow pseudo="Bertrade" avatar="grimelin" score="4 à 3" won />
        <DoneRow pseudo="Mobilette" avatar="grimelin" score="2 à 3" won={false} />
      </section>

      <section className={`${styles.leaf} ${styles.deck}`} style={rise(5)}>
        <header className={styles.leafHead}>
          <span className={styles.kicker}>Ton deck · {deckPoints} / 25 points</span>
          <Toy matter="paper" className={styles.minor} onClick={() => setDeckOpen(true)}>
            Modifier
          </Toy>
        </header>
        <p className={styles.leafText}>Tes cartes ont piégé tes adversaires 8 fois.</p>
        <DeckFan />
      </section>

      <Dialog
        open={leaguesOpen}
        title="Les ligues"
        onClose={() => setLeaguesOpen(false)}
        variant="center"
        size="large"
      >
        <LeaguesList />
      </Dialog>
      <Dialog
        open={deckOpen}
        title="Ton deck"
        onClose={() => setDeckOpen(false)}
        variant="center"
        size="large"
      >
        <DeckEditor />
      </Dialog>
    </div>
  );
}

function Lance({ spent }: { readonly spent: boolean }) {
  return (
    <svg
      className={styles.lance}
      data-spent={spent || undefined}
      viewBox="0 0 14 44"
      aria-hidden="true"
    >
      <path d="M7 1 L11 12 H3 Z" />
      <path d="M5.5 12 H8.5 L9 34 H5 Z" />
      <path d="M2 34 H12 L10 40 H4 Z" />
    </svg>
  );
}

function Step({
  icon,
  title,
  children,
}: {
  readonly icon: "jousts" | "candle" | "ecu";
  readonly title: string;
  readonly children: ReactNode;
}) {
  return (
    <li className={styles.step}>
      <span className={styles.stepIcon}>
        <ToyIcon name={icon} size={40} />
      </span>
      <span className={styles.stepText}>
        <b>{title}</b>
        {children}
      </span>
    </li>
  );
}

/** A result to discover: a letter under a wax seal, the opponent's portrait in the wax. */
function Letter({
  pseudo,
  avatar,
  kind,
}: {
  readonly pseudo: string;
  readonly avatar: string;
  readonly kind: string;
}) {
  return (
    <button type="button" className={styles.letter}>
      <span className={styles.letterFlap} aria-hidden="true" />
      <span className={styles.seal}>
        <Avatar avatar={avatar} frame={null} size={46} />
      </span>
      <span className={styles.letterText}>
        <b>{pseudo}</b>
        <small>{kind} · le résultat t'attend</small>
      </span>
      <span className={styles.letterGo}>Ouvrir</span>
    </button>
  );
}

function WaitRow({
  pseudo,
  avatar,
  until,
}: {
  readonly pseudo: string;
  readonly avatar: string;
  readonly until: string;
}) {
  return (
    <div className={styles.listRow}>
      <Avatar avatar={avatar} frame={null} size={38} />
      <b>{pseudo}</b>
      <span className={styles.listMuted}>
        <Icon name="clock" size={14} /> doit jouer avant {until}
      </span>
    </div>
  );
}

function DoneRow({
  pseudo,
  avatar,
  score,
  won,
}: {
  readonly pseudo: string;
  readonly avatar: string;
  readonly score: string;
  readonly won: boolean;
}) {
  return (
    <div className={styles.listRow}>
      <Avatar avatar={avatar} frame={null} size={38} />
      <b>{pseudo}</b>
      <span className={styles.listMuted}>Classée · {score}</span>
      <span className={styles.outcome} data-won={won || undefined}>
        {won ? "Victoire" : "Défaite"}
      </span>
    </div>
  );
}

/** Ten cards of the catalogue standing in for the player's deck. */
function useDeck(): readonly CatalogCard[] {
  const catalog = useCatalog();
  return useMemo(() => {
    if (catalog === null) return [];
    const wanted: readonly Rarity[] = [
      "common",
      "common",
      "common",
      "uncommon",
      "uncommon",
      "uncommon",
      "rare",
      "rare",
      "precious",
      "epic",
    ];
    const cards = catalog.collections.flatMap((collection) => collection.cards);
    return wanted.flatMap((rarity, index) => {
      const card = cards.filter((c) => c.rarity === rarity)[index * 7];
      return card === undefined ? [] : [card];
    });
  }, [catalog]);
}

function DeckFan() {
  const deck = useDeck();
  const shown = deck.slice(0, 10);
  return (
    <div className={styles.fan}>
      {shown.map((card, index) => {
        const middle = (shown.length - 1) / 2;
        const turn = (index - middle) * 4;
        const trapped = [0, 2, 0, 1, 0, 3, 0, 0, 2, 0][index] ?? 0;
        return (
          <span
            key={card.id}
            className={styles.fanCard}
            style={
              {
                "--turn": `${turn}deg`,
                "--lift": `${Math.abs(index - middle) * 4}px`,
              } as CSSProperties
            }
          >
            <MiniCard card={card} width={104} />
            {/* On the card's left strip, the one the next card leaves uncovered. */}
            {trapped > 0 && (
              <span className={styles.fanTrap} role="img" aria-label={trappedText(trapped)}>
                {trapped}
              </span>
            )}
          </span>
        );
      })}
    </div>
  );
}

function DeckEditor() {
  const deck = useDeck();
  const points = deck.reduce((sum, card) => sum + COST[card.rarity], 0);
  return (
    <div className={styles.editor}>
      <div className={styles.gauge}>
        <span className={styles.gaugeFill} style={{ width: `${(points / 25) * 100}%` }} />
        <span className={styles.gaugeText}>{points} / 25 points · 10 cartes sur 10</span>
      </div>
      <div className={styles.editorFan}>
        <DeckFan />
      </div>
      <div className={styles.filters}>
        {["Toutes", "Courantes", "Peu courantes", "Rares", "Précieuses", "Épiques"].map(
          (label, index) => (
            <Toy key={label} matter={index === 0 ? "gold" : "paper"} className={styles.filter}>
              {label}
            </Toy>
          ),
        )}
      </div>
      <div className={styles.pool}>
        {deck.map((card) => (
          <span key={card.id} className={styles.poolCard} data-in>
            <MiniCard card={card} width={110} cost={COST[card.rarity]} />
          </span>
        ))}
      </div>
      <div className={styles.editorActions}>
        <MainAction label="Enregistrer le deck" />
      </div>
    </div>
  );
}

function LeaguesList() {
  return (
    <ol className={styles.leagues}>
      {[...LEAGUES].reverse().map((league) => {
        const here = league.id === MINE;
        const reached =
          LEAGUES.findIndex((l) => l.id === league.id) <= LEAGUES.findIndex((l) => l.id === MINE);
        return (
          <li key={league.id} className={styles.leagueRow} data-here={here || undefined}>
            <Crest league={league.id} size={54} dim={!reached} />
            <span className={styles.leagueText}>
              <b>
                {LEAGUE_NAMES[league.id]}
                {here && <span className={styles.youTagInline}>Toi</span>}
              </b>
              <small>
                {league.up > 0 ? `Les ${league.up} premiers montent` : "La plus haute ligue"}
                {league.down > 0
                  ? `, les ${league.down} derniers descendent.`
                  : ", personne ne descend."}
              </small>
              {league.banner !== null && (
                <small className={styles.leagueBanner}>Motif de bannière : {league.banner}</small>
              )}
            </span>
            <span className={styles.leagueGain}>
              <ToyIcon name="ecu" size={18} /> {league.ecus} par semaine
            </span>
          </li>
        );
      })}
    </ol>
  );
}

// --- The search and the face-to-face -------------------------------------------------------

const REEL = ["grimelin", "cassandre", "preopinant", "ricanerie", "metaphraste", "bachelette"];

function Search({ onFound }: { readonly onFound: () => void }) {
  const [found, setFound] = useState(false);
  useEffect(() => {
    const stop = window.setTimeout(() => setFound(true), 2200);
    const go = window.setTimeout(onFound, 3300);
    return () => {
      window.clearTimeout(stop);
      window.clearTimeout(go);
    };
  }, [onFound]);
  return (
    <section className={styles.arena}>
      {/* biome-ignore lint/performance/noImgElement: a faint decoration, sized by CSS */}
      <img className={styles.arenaEngraving} src={ENGRAVING} alt="" />
      <span className={styles.kickerLight}>Joute classée · ligue Page</span>
      <Lettering className={styles.arenaTitle}>
        {found ? "Adversaire trouvé !" : "Recherche d'un adversaire…"}
      </Lettering>
      <div className={styles.searchRow}>
        <span className={styles.searchMe}>
          <Avatar avatar={ME.avatar} frame={null} size={110} />
          <b>{ME.pseudo}</b>
        </span>
        <Lettering className={styles.vsSmall}>VS</Lettering>
        <span className={styles.slot} data-found={found || undefined}>
          <span className={styles.reel}>
            {[...REEL, ...REEL, THEM.avatar].map((avatar, index) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: a reel of faces, in order
              <Avatar key={index} avatar={avatar} frame={null} size={110} />
            ))}
          </span>
        </span>
      </div>
      <p className={styles.arenaLine}>
        {found ? "Hortense, ligue Page, 10e du groupe." : "Le jeu cherche un jouteur de ta ligue."}
      </p>
    </section>
  );
}

function FaceToFace({ onStart }: { readonly onStart: () => void }) {
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    if (count === null) return;
    if (count === 0) {
      onStart();
      return;
    }
    const next = window.setTimeout(() => setCount(count - 1), 800);
    return () => window.clearTimeout(next);
  }, [count, onStart]);
  return (
    <section className={styles.arena}>
      {/* biome-ignore lint/performance/noImgElement: a faint decoration, sized by CSS */}
      <img className={styles.arenaEngraving} src={ENGRAVING} alt="" />
      <span className={styles.kickerLight}>Joute classée</span>
      <div className={styles.faceRow}>
        <Duelist pseudo={ME.pseudo} avatar={ME.avatar} side="left" />
        <span className={styles.vs}>
          <Lettering>VS</Lettering>
        </span>
        <Duelist pseudo={THEM.pseudo} avatar={THEM.avatar} side="right" />
      </div>
      {count === null ? (
        <div className={styles.faceGo}>
          <MainAction label="Commencer" onClick={() => setCount(3)} />
          <p className={styles.arenaLine}>
            Le chrono démarre quand tu commences : 5 mots, 15 secondes chacun.
          </p>
          <PaperAction label="Plus tard" />
        </div>
      ) : (
        <Lettering className={styles.countdown} key={count}>
          {String(count)}
        </Lettering>
      )}
    </section>
  );
}

function Duelist({
  pseudo,
  avatar,
  side,
}: {
  readonly pseudo: string;
  readonly avatar: string;
  readonly side: "left" | "right";
}) {
  return (
    <span className={styles.duelist} data-side={side}>
      <span className={styles.duelistCrest}>
        <Crest league="page" size={60} />
      </span>
      <Avatar avatar={avatar} frame={null} size={130} />
      <Lettering className={styles.duelistName}>{pseudo}</Lettering>
      <span className={styles.duelistMeta}>Page · 9 points cette semaine</span>
      <span className={styles.backs}>
        {(["common", "uncommon", "rare", "precious", "epic"] as const).map((rarity, index) => (
          <span
            key={rarity}
            className={styles.back}
            style={{ "--i": index, "--turn": `${(index - 2) * 6}deg` } as CSSProperties}
          >
            <CardBack rarity={rarity} width={52} tone={side === "left" ? "night" : "burgundy"} />
          </span>
        ))}
      </span>
    </span>
  );
}

// --- The run ---------------------------------------------------------------------------------

const ANSWER_MS = 15_000;

function useQuestions(): readonly {
  readonly card: CatalogCard;
  readonly choices: readonly string[];
}[] {
  const catalog = useCatalog();
  return useMemo(() => {
    if (catalog === null) return [];
    const cards = catalog.collections.flatMap((collection) => collection.cards);
    return [11, 230, 517, 902, 1311].flatMap((at) => {
      const card = cards[at];
      if (card === undefined) return [];
      const others = cards
        .filter((c) => c.partOfSpeech === card.partOfSpeech && c.id !== card.id)
        .slice(at % 40, (at % 40) + 3)
        .map((c) => c.word);
      const choices = [...others];
      choices.splice(at % 4, 0, card.word);
      return [{ card, choices }];
    });
  }, [catalog]);
}

function Run({ onDone }: { readonly onDone: () => void }) {
  const stage = useStage();
  const questions = useQuestions();
  const [index, setIndex] = useState(0);
  const [chosen, setChosen] = useState<string | null>(null);
  const [mine, setMine] = useState<readonly boolean[]>([]);
  const [started, setStarted] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  const choicesRef = useRef<HTMLDivElement>(null);
  const theirs = [true, false, true, true, false];

  useEffect(() => {
    if (chosen !== null) return;
    const tick = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(tick);
  }, [chosen]);

  const question = questions[index];
  if (question === undefined) return <section className={styles.run} />;
  const left = Math.max(0, ANSWER_MS - (now - started));
  const answer = (word: string) => {
    if (chosen !== null) return;
    setChosen(word);
    const right = word === question.card.word;
    setMine([...mine, right]);
    const box = choicesRef.current?.querySelector("[data-right]")?.getBoundingClientRect();
    if (right && box !== undefined) {
      stage.burst(box.left + box.width / 2, box.top + box.height / 2, effects.right);
    }
    window.setTimeout(() => {
      if (index + 1 >= questions.length) {
        onDone();
        return;
      }
      setIndex(index + 1);
      setChosen(null);
      setStarted(Date.now());
      setNow(Date.now());
    }, 1300);
  };

  return (
    <section className={styles.run}>
      <Desk className={styles.runDesk} />
      <div className={styles.board}>
        <button type="button" className={styles.round} aria-label="Quitter la joute">
          <Icon name="close" size={20} />
        </button>
        <Plaque pseudo={ME.pseudo} avatar={ME.avatar} answers={mine} side="left" />
        <span className={styles.timer}>
          <svg viewBox="0 0 44 44" className={styles.timerRing} aria-hidden="true">
            <circle cx="22" cy="22" r="19" className={styles.timerTrack} />
            <circle
              cx="22"
              cy="22"
              r="19"
              className={styles.timerFill}
              data-hot={left < 5000 || undefined}
              style={{ strokeDashoffset: `${119.4 * (1 - left / ANSWER_MS)}` }}
            />
          </svg>
          <Lettering className={styles.timerFigure}>{String(Math.ceil(left / 1000))}</Lettering>
        </span>
        <Plaque
          pseudo={THEM.pseudo}
          avatar={THEM.avatar}
          answers={theirs.slice(0, mine.length)}
          side="right"
        />
      </div>
      <span className={styles.wordOf}>
        Mot {index + 1} sur {questions.length}
      </span>
      <div className={styles.play}>
        <span className={styles.playCard}>
          <QuestionCard rarity={question.card.rarity} width={250}>
            <DefinitionText text={hideWordIn(question.card.definition, question.card.word)} />
          </QuestionCard>
        </span>
        <div className={styles.choices} ref={choicesRef}>
          {question.choices.map((word, at) => {
            const right = word === question.card.word;
            const state =
              chosen === null ? undefined : right ? "right" : word === chosen ? "wrong" : "out";
            return (
              <Toy
                key={word}
                data-right={right || undefined}
                matter={state === "right" ? "green" : state === "wrong" ? "red" : "paper"}
                className={styles.choice}
                data-state={state}
                onClick={() => answer(word)}
              >
                <span className={styles.choiceLetter}>{String.fromCharCode(97 + at)}</span>
                <span className={styles.choiceWord}>{word}</span>
              </Toy>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function Plaque({
  pseudo,
  avatar,
  answers,
  side,
}: {
  readonly pseudo: string;
  readonly avatar: string;
  readonly answers: readonly boolean[];
  readonly side: "left" | "right";
}) {
  const score = answers.filter(Boolean).length;
  return (
    <span className={styles.plaque} data-side={side}>
      <Avatar avatar={avatar} frame={null} size={54} />
      <span className={styles.plaqueBody}>
        <b>{pseudo}</b>
        <span className={styles.pips}>
          {[0, 1, 2, 3, 4].map((at) => (
            <span
              key={at}
              className={styles.pip}
              data-answer={answers[at] === undefined ? undefined : answers[at] ? "right" : "wrong"}
            />
          ))}
        </span>
      </span>
      <Lettering className={styles.plaqueScore}>{String(score)}</Lettering>
    </span>
  );
}

// --- A league climbed ----------------------------------------------------------------------

function Climb({ onBack }: { readonly onBack: () => void }) {
  const stage = useStage();
  const [phase, setPhase] = useState<"old" | "break" | "new">("old");
  const crest = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const crack = window.setTimeout(() => setPhase("break"), 900);
    const land = window.setTimeout(() => setPhase("new"), 1500);
    return () => {
      window.clearTimeout(crack);
      window.clearTimeout(land);
    };
  }, []);
  useEffect(() => {
    if (phase !== "new") return;
    const fall = window.setTimeout(() => {
      const box = crest.current?.getBoundingClientRect();
      if (box !== undefined)
        stage.burst(box.left + box.width / 2, box.top + box.height / 2, effects.reward);
      stage.rain(40);
    }, 380);
    return () => window.clearTimeout(fall);
  }, [phase, stage]);
  return (
    <section className={styles.arena}>
      <span className={styles.kickerLight}>Fin du tournoi de la semaine</span>
      <div className={styles.climbStage} ref={crest}>
        {phase !== "new" ? (
          <span className={styles.oldCrest} data-break={phase === "break" || undefined}>
            <span className={styles.half} data-half="left">
              <Crest league="page" size={170} />
            </span>
            <span className={styles.half} data-half="right">
              <Crest league="page" size={170} />
            </span>
          </span>
        ) : (
          <span className={styles.newCrest}>
            <span className={styles.crestGlow} aria-hidden="true" />
            <Crest league="ecuyer" size={190} />
          </span>
        )}
      </div>
      {phase === "new" && (
        <div className={styles.climbText}>
          <Lettering className={styles.arenaTitle}>Tu montes en Écuyer !</Lettering>
          <p className={styles.arenaLine}>9e de ton groupe de Page, avec 12 points.</p>
          <div className={styles.climbGains}>
            <span className={styles.gain}>
              <ToyIcon name="ecu" size={28} /> 10 écus
            </span>
            <span className={styles.gain}>
              <ToyIcon name="sachet" size={28} /> Un sachet garni
            </span>
          </div>
          <MainAction label="Réclamer" onClick={onBack} />
        </div>
      )}
    </section>
  );
}

/** Each leaf rises in turn, as on Jouer. */
function rise(index: number): CSSProperties {
  return { "--rise": index } as CSSProperties;
}

/** A rider from the catalogue's engravings, standing in for an old tournament print. */
const ENGRAVING = "/catalog/gravures/palefroi.275801e54eb4.ink.webp";
