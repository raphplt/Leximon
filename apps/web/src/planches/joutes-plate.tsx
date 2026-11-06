"use client";

import type { Rarity } from "@leximon/core";
import {
  cssFill,
  rarityLights,
  rarityStyles,
  revealEffects,
  toyMatters,
  toy as toyValues,
} from "@leximon/tokens";
import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from "react";
import { play, vibrate } from "@/booster/feedback";
import { RarityIcon } from "@/components/rarity-icon";
import { MainAction, PaperAction } from "@/library/play-pieces";
import desk from "@/play/desk-columns.module.css";
import { HelpTip } from "@/ui/help-tip";
import { Icon } from "@/ui/icon";
import { ParticleStage, useStage } from "@/ui/stage";
import { Lettering, Toy, ToyBody, ToyIcon } from "@/ui/toy";
import ui from "@/ui/ui.module.css";
import styles from "./joutes-plate.module.css";

/**
 * A plate of the jousts as their next spec settles them: the guided first visit, the jousts'
 * home, the joust itself, the run's summary, the result's reveal, the leagues and their boards.
 * Made-up players and figures: the owner judges the look and the motion before the code.
 */

type Moment = "guide" | "home" | "joust" | "run" | "result" | "leagues";

const MOMENTS: readonly { readonly id: Moment; readonly label: string }[] = [
  { id: "guide", label: "Accueil guidé" },
  { id: "home", label: "Accueil des joutes" },
  { id: "joust", label: "La joute" },
  { id: "run", label: "Ta partie jouée" },
  { id: "result", label: "Le résultat" },
  { id: "leagues", label: "Ligues et classement" },
];

// --- Made-up figures ---------------------------------------------------------------------

interface DeckCard {
  readonly word: string;
  readonly rarity: Rarity;
}

const DECK: readonly DeckCard[] = [
  { word: "gourgandine", rarity: "precious" },
  { word: "aragne", rarity: "epic" },
  { word: "chafouin", rarity: "rare" },
  { word: "amphigouri", rarity: "rare" },
  { word: "billevesée", rarity: "uncommon" },
  { word: "escarcelle", rarity: "uncommon" },
  { word: "barguigner", rarity: "common" },
  { word: "affiquet", rarity: "common" },
  { word: "faquin", rarity: "common" },
  { word: "hurluberlu", rarity: "common" },
];

const COST: Readonly<Record<Rarity, number>> = {
  common: 1,
  uncommon: 2,
  rare: 3,
  precious: 4,
  epic: 5,
  legendary: 6,
};
const BUDGET = 25;
const DECK_SIZE = 10;

interface Question {
  readonly definition: string;
  readonly choices: readonly string[];
  readonly right: string;
  readonly rarity: Rarity;
}

const QUESTIONS: readonly Question[] = [
  {
    definition: "Qui a l'air rusé et sournois, qui cache son jeu.",
    choices: ["faquin", "chafouin", "hurluberlu", "béjaune"],
    right: "chafouin",
    rarity: "rare",
  },
  {
    definition: "Hésiter, avoir du mal à se décider.",
    choices: ["musarder", "lanterner", "barguigner", "atermoyer"],
    right: "barguigner",
    rarity: "common",
  },
  {
    definition: "Discours ou écrit volontairement obscur, où l'on ne comprend rien.",
    choices: ["amphigouri", "billevesée", "affiquet", "escarcelle"],
    right: "amphigouri",
    rarity: "rare",
  },
  {
    definition: "Grande bourse qu'on portait suspendue à la ceinture.",
    choices: ["hanap", "affiquet", "escarcelle", "chausse"],
    right: "escarcelle",
    rarity: "uncommon",
  },
  {
    definition: "Petit ornement de toilette, colifichet.",
    choices: ["aragne", "affiquet", "faquin", "hanap"],
    right: "affiquet",
    rarity: "common",
  },
];

interface Answer {
  readonly word: string;
  readonly right: boolean;
  readonly seconds: number;
}

const MY_RUN: readonly Answer[] = [
  { word: "chafouin", right: true, seconds: 4.2 },
  { word: "barguigner", right: true, seconds: 6.1 },
  { word: "amphigouri", right: false, seconds: 15 },
  { word: "escarcelle", right: true, seconds: 3.8 },
  { word: "affiquet", right: true, seconds: 7.0 },
];

const THEIR_RUN: readonly Answer[] = [
  { word: "gourgandine", right: false, seconds: 12.4 },
  { word: "billevesée", right: true, seconds: 5.2 },
  { word: "aragne", right: true, seconds: 8.9 },
  { word: "faquin", right: true, seconds: 4.4 },
  { word: "hurluberlu", right: false, seconds: 10.3 },
];

const ME = { pseudo: "Raph", initial: "R" };
const THEM = { pseudo: "Hortense", initial: "H" };

const score = (run: readonly Answer[]) => run.filter((answer) => answer.right).length;
const seconds = (run: readonly Answer[]) =>
  Math.round(run.reduce((sum, answer) => sum + answer.seconds, 0));

// --- Leagues -----------------------------------------------------------------------------

type League = "page" | "ecuyer" | "chevalier" | "banneret" | "champion";

const LEAGUES: readonly {
  readonly id: League;
  readonly name: string;
  readonly from: number;
  readonly matter: keyof typeof toyMatters;
  readonly endReward: string;
}[] = [
  { id: "page", name: "Page", from: 0, matter: "paper", endReward: "1 sachet bonus" },
  { id: "ecuyer", name: "Écuyer", from: 300, matter: "green", endReward: "2 sachets bonus" },
  { id: "chevalier", name: "Chevalier", from: 600, matter: "blue", endReward: "1 sachet garni" },
  {
    id: "banneret",
    name: "Banneret",
    from: 900,
    matter: "red",
    endReward: "1 sachet garni Précieux",
  },
  {
    id: "champion",
    name: "Champion",
    from: 1200,
    matter: "gold",
    endReward: "1 sachet garni Précieux et l'emblème de la saison",
  },
];

const NUMERALS = ["III", "II", "I"] as const;

interface Division {
  readonly league: (typeof LEAGUES)[number];
  readonly numeral: string | null;
  readonly from: number;
}

const DIVISIONS: readonly Division[] = LEAGUES.flatMap<Division>((league) =>
  league.id === "champion"
    ? [{ league, numeral: null, from: league.from }]
    : NUMERALS.map((numeral, index) => ({ league, numeral, from: league.from + index * 100 })),
);

function divisionOf(lauriers: number): Division {
  return DIVISIONS.findLast((division) => lauriers >= division.from) ?? (DIVISIONS[0] as Division);
}

const divisionName = (division: Division) =>
  division.numeral === null ? division.league.name : `${division.league.name} ${division.numeral}`;

const LAURIERS_BEFORE = 742;
const LAURIERS_WON = 28;

/** Each leaf rises in turn when the screen appears, as on Jouer. */
const rise = (index: number) => ({ "--rise": index }) as CSSProperties;

// --- The plate ---------------------------------------------------------------------------

export function JoutesPlate() {
  const [moment, setMoment] = useState<Moment>("guide");
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
          {moment === "guide" && <Guide onDone={() => setMoment("home")} />}
          {moment === "home" && <Home onGo={setMoment} />}
          {moment === "joust" && (
            <JoustScene
              questions={QUESTIONS}
              opponent={THEM.pseudo}
              onDone={() => setMoment("run")}
            />
          )}
          {moment === "run" && <RunSummary onGo={setMoment} />}
          {moment === "result" && <Result />}
          {moment === "leagues" && <Leagues />}
        </div>
      </ParticleStage>
    </main>
  );
}

function Note({ children }: { readonly children: ReactNode }) {
  return <p className={styles.note}>{children}</p>;
}

// --- Shared pieces -----------------------------------------------------------------------

/** A league's shield, in its matter, with the division's numeral. */
function Shield({
  league,
  numeral,
  size,
}: {
  readonly league: League;
  readonly numeral: string | null;
  readonly size: number;
}) {
  const entry = LEAGUES.find((candidate) => candidate.id === league) ?? LEAGUES[0];
  const matter = toyMatters[entry?.matter ?? "paper"];
  const gradient = `shield-${league}`;
  return (
    <svg
      className={styles.shield}
      width={size}
      height={size * 1.15}
      viewBox="0 0 40 46"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={matter.top} />
          <stop offset="1" stopColor={matter.bottom} />
        </linearGradient>
      </defs>
      <path
        d="M20 2 L37 8 V22 C37 33 29 40 20 44 C11 40 3 33 3 22 V8 Z"
        fill={matter.edge}
        stroke={toyValues.outline}
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
      <path
        d="M20 4.5 L34.5 9.6 V21.5 C34.5 31 27.6 37 20 40.6 C12.4 37 5.5 31 5.5 21.5 V9.6 Z"
        fill={`url(#${gradient})`}
      />
      <path d="M8 11 L20 7 L32 11" fill="none" stroke={toyMatters.paper.top} strokeOpacity="0.55" />
      {league === "champion" ? (
        <path
          d="M12 26 L14 17 L18 22 L20 15 L22 22 L26 17 L28 26 Z"
          fill={toyMatters.paper.top}
          stroke={toyValues.outline}
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      ) : (
        <text
          x="20"
          y="28"
          textAnchor="middle"
          fontFamily="Georgia, serif"
          fontWeight="700"
          fontSize={numeral === "III" ? 12 : 14}
          fill={toyMatters.paper.top}
          stroke={toyValues.outline}
          strokeWidth="2.2"
          paintOrder="stroke"
        >
          {numeral}
        </text>
      )}
    </svg>
  );
}

function Medallion({
  initial,
  tone = "paper",
  size = 56,
}: {
  readonly initial: string;
  readonly tone?: "paper" | "red" | "blue" | "gold";
  readonly size?: number;
}) {
  return (
    <span
      className={styles.medallion}
      data-tone={tone}
      style={{ "--size": `${size}px` } as CSSProperties}
      aria-hidden="true"
    >
      {initial}
    </span>
  );
}

/** A small card of the deck: the rarity band, its gem and the word. */
function MiniCard({
  card,
  cost = false,
  className,
  style,
}: {
  readonly card: DeckCard;
  readonly cost?: boolean;
  readonly className?: string | undefined;
  readonly style?: CSSProperties | undefined;
}) {
  return (
    <span
      className={`${styles.mini} ${className ?? ""}`}
      style={
        {
          "--band": cssFill(rarityStyles[card.rarity].band),
          "--band-ink": rarityStyles[card.rarity].bandInk,
          ...style,
        } as CSSProperties
      }
    >
      <span className={styles.miniBand}>
        <RarityIcon rarity={card.rarity} size="12px" />
        {cost && <span className={styles.miniCost}>{COST[card.rarity]}</span>}
      </span>
      <span className={styles.miniWord}>{card.word}</span>
    </span>
  );
}

/** Maître Furet in a medallion, and what he says in a bubble beside him. */
function Furet({ children }: { readonly children: ReactNode }) {
  return (
    <div className={styles.furet}>
      <span className={styles.furetFace} aria-hidden="true">
        <ToyIcon name="books" size={44} />
      </span>
      <div className={styles.furetBubble}>
        <span className={styles.furetName}>Maître Furet</span>
        {children}
      </div>
    </div>
  );
}

// --- 1. The guided first visit -----------------------------------------------------------

const GUIDE_STEPS = ["La lice", "Ton deck", "L'entraînement", "La première joute"] as const;

function Guide({ onDone }: { readonly onDone: () => void }) {
  const [step, setStep] = useState(0);
  const next = () => (step === GUIDE_STEPS.length - 1 ? onDone() : setStep(step + 1));
  return (
    <section className={`${ui.leaf} ${styles.guide} ${desk.rising}`} style={rise(0)}>
      <header className={styles.guideHead}>
        <ol className={styles.steps}>
          {GUIDE_STEPS.map((label, index) => (
            <li
              key={label}
              data-on={index === step || undefined}
              data-done={index < step || undefined}
            >
              <button type="button" onClick={() => setStep(index)}>
                <span className={styles.stepNumber}>{index + 1}</span>
                <span className={styles.stepLabel}>{label}</span>
              </button>
            </li>
          ))}
        </ol>
        <button type="button" className={styles.skip} onClick={next}>
          Passer
        </button>
      </header>

      {step === 0 && <GuideLists onNext={next} />}
      {step === 1 && <DeckBuilder onNext={next} />}
      {step === 2 && (
        <div className={styles.training}>
          <Furet>
            <p>
              Essayons sur 3 mots, sans rien gagner ni perdre. Je les ai déjà joués : tu vois mon
              score à côté du tien.
            </p>
          </Furet>
          <JoustScene
            questions={QUESTIONS.slice(0, 3)}
            opponent="Maître Furet"
            training
            onDone={next}
          />
        </div>
      )}
      {step === 3 && (
        <div className={styles.firstJoust}>
          <Furet>
            <p>
              À toi. Le jeu te trouve un adversaire de ta force. Il a 24 heures pour jouer sa partie
              et je te préviens au courrier dès que le résultat tombe.
            </p>
          </Furet>
          <div className={styles.firstJoustAction}>
            <MainAction label="Trouver un adversaire" onClick={onDone} />
          </div>
        </div>
      )}
      <Note>
        L'accueil guidé ne paraît qu'une fois, à la première visite aux joutes, sur le web comme sur
        le téléphone. Chaque temps se passe. Le portrait de Maître Furet reste à dessiner : les
        livres tiennent sa place.
      </Note>
    </section>
  );
}

/** The lists: your five cards cross to the other side, his come to yours. */
function GuideLists({ onNext }: { readonly onNext: () => void }) {
  const mine = DECK.slice(0, 5);
  const theirs = DECK.slice(5, 10);
  return (
    <div className={styles.lists}>
      <Furet>
        <p>
          Bienvenue dans la lice. Chacun apporte un deck de ses mots. Le jeu en tire 5 de chaque
          côté : <strong>tu trouves ses mots, il trouve les tiens.</strong>
        </p>
      </Furet>
      <div className={styles.listsField}>
        <div className={styles.listsSide}>
          <Medallion initial={ME.initial} tone="blue" />
          <span className={styles.listsName}>Ton deck</span>
          <div className={styles.listsCards}>
            {mine.map((card, index) => (
              <MiniCard
                key={card.word}
                card={card}
                className={styles.crossRight}
                style={{ "--i": index } as CSSProperties}
              />
            ))}
          </div>
        </div>
        <Lettering className={styles.versus}>contre</Lettering>
        <div className={styles.listsSide}>
          <Medallion initial={THEM.initial} tone="red" />
          <span className={styles.listsName}>Son deck</span>
          <div className={styles.listsCards}>
            {theirs.map((card, index) => (
              <MiniCard
                key={card.word}
                card={card}
                className={styles.crossLeft}
                style={{ "--i": index } as CSSProperties}
              />
            ))}
          </div>
        </div>
      </div>
      <ul className={styles.ruleIcons}>
        <li>
          <Icon name="clock" size={22} />
          <span>15 s par mot</span>
        </li>
        <li>
          <Icon name="check" size={22} />
          <span>Le plus de mots trouvés gagne</span>
        </li>
        <li>
          <Icon name="bolt" size={22} />
          <span>Égalité : le plus rapide</span>
        </li>
      </ul>
      <div className={styles.guideAction}>
        <PaperAction label="Compris" onClick={onNext} />
      </div>
    </div>
  );
}

/** The deck builder of the guided visit: ten empty places, the gauge, « Compléter pour moi ». */
function DeckBuilder({ onNext }: { readonly onNext: () => void }) {
  const [deck, setDeck] = useState<readonly DeckCard[]>([]);
  const spent = deck.reduce((sum, card) => sum + COST[card.rarity], 0);
  const add = (card: DeckCard) => {
    if (deck.includes(card) || deck.length >= DECK_SIZE) return;
    if (spent + COST[card.rarity] > BUDGET) return;
    setDeck([...deck, card]);
  };
  const remove = (card: DeckCard) => setDeck(deck.filter((entry) => entry !== card));
  const complete = () => {
    let next = [...deck];
    let total = spent;
    // The rarest that still fit, as the game's own deck does.
    for (const card of [...DECK].sort((a, b) => COST[b.rarity] - COST[a.rarity])) {
      if (next.length >= DECK_SIZE) break;
      if (next.includes(card) || total + COST[card.rarity] > BUDGET) continue;
      next = [...next, card];
      total += COST[card.rarity];
    }
    setDeck(next);
    play("cardSlide");
  };
  return (
    <div className={styles.builder}>
      <Furet>
        <p>
          Choisis 10 mots que tu as déjà trouvés. Un mot rare piège mieux, mais il coûte plus : tu
          as <strong>{BUDGET} points</strong>.
        </p>
      </Furet>
      <div className={styles.builderBody}>
        <div className={styles.slots}>
          {Array.from({ length: DECK_SIZE }, (_, index) => {
            const card = deck[index];
            return card === undefined ? (
              // biome-ignore lint/suspicious/noArrayIndexKey: places of the deck, in order
              <span key={index} className={styles.slot}>
                {index + 1}
              </span>
            ) : (
              <button
                key={card.word}
                type="button"
                className={styles.slotFilled}
                onClick={() => remove(card)}
                aria-label={`Retirer ${card.word}`}
              >
                <MiniCard card={card} cost className={styles.dropIn} />
              </button>
            );
          })}
        </div>
        <div className={styles.gauge}>
          <span className={styles.gaugeLabel}>Points</span>
          <span className={styles.gaugeBar} aria-hidden="true">
            <span style={{ width: `${(spent / BUDGET) * 100}%` }} />
          </span>
          <span className={styles.gaugeFigure}>
            {spent} / {BUDGET}
          </span>
        </div>
        <div className={styles.builderActions}>
          <Toy matter="paper" className={styles.control} onClick={complete}>
            Compléter pour moi
          </Toy>
          <Toy
            matter={deck.length >= 5 ? "gold" : "locked"}
            className={styles.control}
            disabled={deck.length < 5}
            onClick={onNext}
          >
            Garder ce deck
          </Toy>
        </div>
        <span className={desk.leafKicker}>Tes mots trouvés</span>
        <ul className={styles.pool}>
          {DECK.map((card) => {
            const taken = deck.includes(card);
            const fits = spent + COST[card.rarity] <= BUDGET && deck.length < DECK_SIZE;
            return (
              <li key={card.word}>
                <button
                  type="button"
                  className={styles.poolCard}
                  data-taken={taken || undefined}
                  disabled={taken || !fits}
                  onClick={() => add(card)}
                >
                  <MiniCard card={card} cost />
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

// --- 2. The jousts' home -----------------------------------------------------------------

function LeagueHeader({ lauriers }: { readonly lauriers: number }) {
  const division = divisionOf(lauriers);
  const next = DIVISIONS[DIVISIONS.indexOf(division) + 1];
  const share = next === undefined ? 1 : (lauriers - division.from) / (next.from - division.from);
  return (
    <div className={styles.leagueHead}>
      <Shield league={division.league.id} numeral={division.numeral} size={58} />
      <div className={styles.leagueText}>
        <Lettering className={styles.leagueName}>{divisionName(division)}</Lettering>
        <span className={styles.lauriers}>
          <Icon name="star" size={16} /> {lauriers} lauriers
        </span>
        <span className={styles.leagueBar} aria-hidden="true">
          <span style={{ width: `${share * 100}%` }} />
        </span>
        {next !== undefined && (
          <span className={styles.leagueNext}>
            Encore {next.from - lauriers} pour {divisionName(next)}
          </span>
        )}
      </div>
      <span className={styles.season}>
        <Icon name="clock" size={14} /> Saison : fin dans 12 jours
      </span>
    </div>
  );
}

function JoustRules() {
  return (
    <HelpTip label="Comment se joue une joute" title="La joute">
      <ul className={styles.helpList}>
        <li>Tu trouves les 5 mots tirés de son deck, il trouve les 5 du tien.</li>
        <li>15 secondes par mot, 4 choix.</li>
        <li>Le plus de mots trouvés gagne ; à égalité, le plus rapide.</li>
        <li>Une joute classée fait gagner ou perdre des lauriers.</li>
      </ul>
      <button type="button" className={styles.helpLink}>
        Revoir l'accueil guidé
      </button>
    </HelpTip>
  );
}

function Home({ onGo }: { readonly onGo: (moment: Moment) => void }) {
  return (
    <div className={styles.home}>
      <section className={`${ui.leaf} ${styles.homeTop} ${desk.rising}`} style={rise(0)}>
        <header className={styles.homeHead}>
          <Lettering className={styles.homeTitle}>Joutes</Lettering>
          <span className={styles.homeTools}>
            <button type="button" className={styles.iconButton} onClick={() => onGo("leagues")}>
              <Icon name="crown" size={18} /> Classement
            </button>
            <JoustRules />
          </span>
        </header>
        <LeagueHeader lauriers={LAURIERS_BEFORE} />
        <div className={styles.launch}>
          <MainAction label="Jouter" onClick={() => onGo("joust")} />
          <Toy matter="paper" className={styles.friendAction}>
            <Icon name="amis" size={18} /> Défier un ami
          </Toy>
        </div>
      </section>

      <section className={`${ui.leaf} ${styles.deckLeaf} ${desk.rising}`} style={rise(1)}>
        <header className={styles.deckHead}>
          <span className={desk.leafKicker}>Ton deck · 23 / 25 points</span>
          <Toy matter="paper" className={styles.control}>
            Modifier
          </Toy>
        </header>
        <div className={styles.fan}>
          {DECK.map((card, index) => (
            <MiniCard
              key={card.word}
              card={card}
              className={styles.fanCard}
              style={{ "--i": index - (DECK.length - 1) / 2 } as CSSProperties}
            />
          ))}
        </div>
      </section>

      <section className={`${ui.leaf} ${styles.list} ${desk.rising}`} style={rise(2)}>
        <JoustGroup title="À toi de jouer">
          <JoustRow name="Alix" tone="red" pulse onClick={() => onGo("joust")}>
            <span className={styles.rowState}>Classée · avant demain 9 h</span>
            <ToyBody matter="gold" className={styles.rowAction}>
              Jouer
            </ToyBody>
          </JoustRow>
        </JoustGroup>
        <JoustGroup title="Résultats à découvrir">
          <JoustRow name="Hortense" tone="blue" sealed onClick={() => onGo("result")}>
            <span className={styles.rowState}>Classée · elle a joué</span>
            <span className={styles.seal}>
              <ToyIcon name="mail" size={38} />
            </span>
          </JoustRow>
        </JoustGroup>
        <JoustGroup title="En attente">
          <JoustRow name="Bertrand" tone="paper">
            <span className={styles.rowState}>
              <Icon name="clock" size={14} /> Il a jusqu'à demain 17 h 20
            </span>
          </JoustRow>
        </JoustGroup>
        <JoustGroup title="Terminées">
          <JoustRow name="Mobilette" tone="gold">
            <span className={styles.outcome} data-won>
              Victoire
            </span>
            <span className={styles.delta} data-up>
              +31
            </span>
          </JoustRow>
          <JoustRow name="Raphtest" tone="paper">
            <span className={styles.outcome}>Défaite</span>
            <span className={styles.delta}>−14</span>
          </JoustRow>
        </JoustGroup>
      </section>
      <Note>
        La règle n'est plus écrite sur l'écran : le « ? » l'ouvre. « Jouter » lance une joute
        classée, « Défier un ami » une amicale. Un résultat pas encore vu reste scellé jusqu'à ce
        qu'on l'ouvre (clique dessus).
      </Note>
    </div>
  );
}

function JoustGroup({ title, children }: { readonly title: string; readonly children: ReactNode }) {
  return (
    <div className={styles.group}>
      <span className={desk.leafKicker}>{title}</span>
      <ul className={styles.rows}>{children}</ul>
    </div>
  );
}

function JoustRow({
  name,
  tone,
  pulse = false,
  sealed = false,
  onClick,
  children,
}: {
  readonly name: string;
  readonly tone: "paper" | "red" | "blue" | "gold";
  readonly pulse?: boolean;
  readonly sealed?: boolean;
  readonly onClick?: () => void;
  readonly children: ReactNode;
}) {
  return (
    <li>
      <button
        type="button"
        className={styles.row}
        data-pulse={pulse || undefined}
        data-sealed={sealed || undefined}
        onClick={onClick}
      >
        <Medallion initial={name[0] ?? "?"} tone={tone} size={40} />
        <span className={styles.rowName}>{name}</span>
        {children}
      </button>
    </li>
  );
}

// --- 3. The joust ------------------------------------------------------------------------

const ANSWER_MS = 15_000;
const COUNTDOWN = [3, 2, 1] as const;

type Phase =
  | { readonly kind: "versus"; readonly count: number }
  | { readonly kind: "question"; readonly index: number }
  | { readonly kind: "answered"; readonly index: number; readonly chosen: string | null }
  | { readonly kind: "done" };

function JoustScene({
  questions,
  opponent,
  training = false,
  onDone,
}: {
  readonly questions: readonly Question[];
  readonly opponent: string;
  readonly training?: boolean;
  readonly onDone: () => void;
}) {
  const stage = useStage();
  const [phase, setPhase] = useState<Phase>({ kind: "versus", count: 0 });
  const [results, setResults] = useState<readonly boolean[]>([]);
  const [flying, setFlying] = useState(0);
  const timers = useRef<number[]>([]);
  const card = useRef<HTMLDivElement>(null);
  const ghost = THEIR_RUN.slice(0, questions.length).map((answer) => answer.right);

  const later = (ms: number, action: () => void) => {
    timers.current.push(window.setTimeout(action, ms));
  };
  const clear = () => {
    timers.current.forEach(window.clearTimeout);
    timers.current = [];
  };
  useEffect(() => () => timers.current.forEach(window.clearTimeout), []);

  const start = () => {
    clear();
    setResults([]);
    setPhase({ kind: "versus", count: 0 });
    COUNTDOWN.forEach((_, index) => {
      later(900 + index * 800, () => {
        setPhase({ kind: "versus", count: index + 1 });
        play("cardSlide");
      });
    });
    later(900 + COUNTDOWN.length * 800, () => ask(0));
  };

  const ask = (index: number) => {
    setPhase({ kind: "question", index });
    play("flip");
    later(ANSWER_MS, () => answer(index, null));
  };

  const answer = (index: number, chosen: string | null, button?: HTMLElement) => {
    clear();
    const question = questions[index];
    if (question === undefined) return;
    const right = chosen === question.right;
    setPhase({ kind: "answered", index, chosen });
    setResults((done) => [...done, right]);
    if (right && button !== undefined) {
      const box = button.getBoundingClientRect();
      stage.ring(box.left + box.width / 2, box.top + box.height / 2, toyMatters.green.top, 1.6);
      for (const burst of revealEffects.uncommon.bursts) {
        stage.burst(box.left + box.width / 2, box.top + box.height / 2, {
          ...burst,
          colors: [toyMatters.gold.top, toyMatters.green.top, toyMatters.paper.top],
        });
      }
      setFlying((value) => value + 1);
      play("answerRight");
      vibrate([18]);
    } else {
      if (card.current !== null) stage.shake(card.current, 6, 320);
      play("answerWrong");
      vibrate([40, 30, 40]);
    }
    later(1300, () => {
      if (index + 1 < questions.length) ask(index + 1);
      else {
        setPhase({ kind: "done" });
        play("recap");
      }
    });
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: starts once, when the scene appears
  useEffect(() => {
    start();
  }, []);

  const index = phase.kind === "question" || phase.kind === "answered" ? phase.index : 0;
  const question = questions[index];

  return (
    <section className={`${ui.leaf} ${styles.joust} ${desk.rising}`} style={rise(0)}>
      <header className={styles.joustHead}>
        <span className={desk.leafKicker}>
          {training ? "Entraînement · sans gain ni lauriers" : "Joute classée"}
        </span>
        <button type="button" className={styles.replay} onClick={start}>
          <Icon name="play" size={14} /> Rejouer la scène
        </button>
      </header>

      <Lanes
        mine={results}
        theirs={ghost.slice(0, phase.kind === "done" ? ghost.length : results.length)}
        total={questions.length}
        opponent={opponent}
      />

      {phase.kind === "versus" && (
        <div className={styles.versusStage}>
          <div className={styles.versusSide} data-side="left">
            <Medallion initial={ME.initial} tone="blue" size={96} />
            <Lettering className={styles.versusName}>{ME.pseudo}</Lettering>
            <Shield league="chevalier" numeral="II" size={36} />
          </div>
          <div className={styles.versusMiddle}>
            {phase.count === 0 ? (
              <Lettering className={styles.versusWord}>contre</Lettering>
            ) : (
              <Lettering key={phase.count} className={styles.countdown}>
                {COUNTDOWN[phase.count - 1]}
              </Lettering>
            )}
          </div>
          <div className={styles.versusSide} data-side="right">
            <Medallion initial={opponent[0] ?? "?"} tone="red" size={96} />
            <Lettering className={styles.versusName}>{opponent}</Lettering>
            {!training && <Shield league="chevalier" numeral="III" size={36} />}
          </div>
        </div>
      )}

      {(phase.kind === "question" || phase.kind === "answered") && question !== undefined && (
        <div className={styles.questionStage}>
          <div className={styles.questionTop}>
            <span className={styles.counter}>
              {index + 1} / {questions.length}
            </span>
            <Ring key={index} running={phase.kind === "question"} />
          </div>
          <div
            key={`card-${index}`}
            ref={card}
            className={styles.definition}
            style={
              {
                "--band": cssFill(rarityStyles[question.rarity].band),
              } as CSSProperties
            }
          >
            <span className={styles.definitionBand}>
              <RarityIcon rarity={question.rarity} size="14px" />
            </span>
            <p>{question.definition}</p>
          </div>
          <div className={styles.choices}>
            {question.choices.map((choice) => {
              const answered = phase.kind === "answered";
              const isRight = choice === question.right;
              const chosen = answered && phase.chosen === choice;
              return (
                <Toy
                  key={choice}
                  matter={answered && isRight ? "green" : chosen ? "red" : "paper"}
                  className={styles.choice}
                  data-dim={(answered && !isRight && !chosen) || undefined}
                  disabled={answered}
                  onClick={(event) => answer(index, choice, event.currentTarget)}
                >
                  {answered && (isRight || chosen) ? <Lettering>{choice}</Lettering> : choice}
                </Toy>
              );
            })}
          </div>
          {flying > 0 && (
            <Lettering key={flying} className={styles.plusOne}>
              +1
            </Lettering>
          )}
        </div>
      )}

      {phase.kind === "done" && (
        <div className={styles.doneStage}>
          <span className={styles.stamp}>Partie jouée</span>
          <Toy matter="gold" className={styles.control} onClick={onDone}>
            {training ? "Continuer" : "Voir le bilan"}
          </Toy>
        </div>
      )}

      {!training && (
        <Note>
          Un toucher passe le face-à-face. Les deux rubans remplacent la phrase du fantôme : en haut
          ta partie, en bas la partie enregistrée de l'adversaire, au même moment de la sienne. Le
          chrono rougit et bat les 5 dernières secondes. Les sons et la vibration suivent les
          réglages du joueur.
        </Note>
      )}
    </section>
  );
}

/** Two ribbons: the player's answers and the opponent's recorded ones, question by question. */
function Lanes({
  mine,
  theirs,
  total,
  opponent,
}: {
  readonly mine: readonly boolean[];
  readonly theirs: readonly boolean[];
  readonly total: number;
  readonly opponent: string;
}) {
  const lane = (name: string, answers: readonly boolean[], side: "me" | "them") => (
    <div className={styles.lane} data-side={side}>
      <span className={styles.laneName}>{name}</span>
      <span className={styles.lanePips}>
        {Array.from({ length: total }, (_, index) => {
          const answer = answers[index];
          return (
            <span
              // biome-ignore lint/suspicious/noArrayIndexKey: one pip per question, in order
              key={index}
              className={styles.pip}
              data-state={answer === undefined ? undefined : answer ? "right" : "wrong"}
            >
              {answer === undefined ? null : <Icon name={answer ? "check" : "close"} size={12} />}
            </span>
          );
        })}
      </span>
      <Lettering className={styles.laneScore}>{answers.filter(Boolean).length}</Lettering>
    </div>
  );
  return (
    <div className={styles.lanes}>
      {lane(ME.pseudo, mine, "me")}
      {lane(opponent, theirs, "them")}
    </div>
  );
}

/** The clock: a ring that empties in 15 seconds, and turns red for the last five. */
function Ring({ running }: { readonly running: boolean }) {
  const [left, setLeft] = useState(15);
  useEffect(() => {
    if (!running) return;
    const started = Date.now();
    const id = window.setInterval(() => {
      const next = Math.max(0, Math.ceil((ANSWER_MS - (Date.now() - started)) / 1000));
      setLeft((previous) => {
        if (next !== previous && next <= 5 && next > 0) play("cardSlide");
        return next;
      });
    }, 100);
    return () => window.clearInterval(id);
  }, [running]);
  return (
    <span
      className={styles.ring}
      data-running={running || undefined}
      data-hot={left <= 5 || undefined}
    >
      <svg viewBox="0 0 44 44" aria-hidden="true">
        <circle className={styles.ringTrack} cx="22" cy="22" r="18" />
        <circle className={styles.ringFill} cx="22" cy="22" r="18" />
      </svg>
      <Lettering className={styles.ringFigure}>{left}</Lettering>
    </span>
  );
}

// --- 4. The run's summary ----------------------------------------------------------------

function useTicker(target: number, startMs: number, stepMs: number): number {
  const [value, setValue] = useState(0);
  useEffect(() => {
    setValue(0);
    const timers = Array.from({ length: target }, (_, index) =>
      window.setTimeout(() => setValue(index + 1), startMs + index * stepMs),
    );
    return () => timers.forEach(window.clearTimeout);
  }, [target, startMs, stepMs]);
  return value;
}

function RunSummary({ onGo }: { readonly onGo: (moment: Moment) => void }) {
  const [round, setRound] = useState(0);
  const found = score(MY_RUN);
  return (
    <div className={styles.run} key={round}>
      <section className={`${ui.leaf} ${styles.runLeaf} ${desk.rising}`} style={rise(0)}>
        <header className={styles.joustHead}>
          <span className={desk.leafKicker}>Joute classée contre {THEM.pseudo}</span>
          <button type="button" className={styles.replay} onClick={() => setRound(round + 1)}>
            <Icon name="play" size={14} /> Rejouer la scène
          </button>
        </header>
        <Lettering className={styles.runTitle}>Ta partie est jouée</Lettering>
        <ol className={styles.answers}>
          {MY_RUN.map((entry, index) => (
            <li
              key={entry.word}
              className={styles.answerCard}
              data-right={entry.right || undefined}
              style={{ "--i": index } as CSSProperties}
            >
              <span className={styles.answerIcon}>
                <Icon name={entry.right ? "check" : "close"} size={18} />
              </span>
              <span className={styles.answerWord}>{entry.word}</span>
              <span className={styles.answerTime}>
                {entry.right ? `${entry.seconds.toLocaleString("fr-FR")} s` : "manqué"}
              </span>
            </li>
          ))}
        </ol>
        <RunScore found={found} total={MY_RUN.length} time={seconds(MY_RUN)} />
        <div className={styles.xp}>
          <span className={styles.xpLabel}>Niveau 12</span>
          <span className={styles.xpBar} aria-hidden="true">
            <span />
          </span>
          <Lettering className={styles.xpGain}>+20 XP</Lettering>
        </div>
      </section>

      <section className={`${ui.leaf} ${styles.trapsLeaf} ${desk.rising}`} style={rise(1)}>
        <span className={desk.leafKicker}>Tes pièges</span>
        <p className={styles.trapsText}>Les 5 mots de ton deck qu'il devra trouver.</p>
        <div className={styles.traps}>
          {THEIR_RUN.map((entry, index) => {
            const card = DECK.find((candidate) => candidate.word === entry.word);
            return card === undefined ? null : (
              <MiniCard
                key={card.word}
                card={card}
                className={styles.trapCard}
                style={{ "--i": index } as CSSProperties}
              />
            );
          })}
        </div>
        <div className={styles.waiting}>
          <Medallion initial={THEM.initial} tone="red" size={52} />
          <span className={styles.hourglass}>
            <Icon name="clock" size={20} />
          </span>
          <p>
            <strong>{THEM.pseudo}</strong> a jusqu'à demain 17 h 20. On te prévient au courrier.
          </p>
        </div>
        <div className={styles.runActions}>
          <MainAction label="Nouvelle joute" onClick={() => onGo("joust")} />
          <PaperAction label="Retour aux joutes" onClick={() => onGo("home")} />
        </div>
      </section>
      <Note>
        Les réponses se retournent une à une, puis le score se compte et les XP remplissent la
        barre. Un toucher montre tout d'un coup.
      </Note>
    </div>
  );
}

function RunScore({
  found,
  total,
  time,
}: {
  readonly found: number;
  readonly total: number;
  readonly time: number;
}) {
  const counted = useTicker(found, MY_RUN.length * 260 + 300, 220);
  return (
    <p className={styles.runScore}>
      <Lettering className={styles.runScoreFigure}>
        {counted} / {total}
      </Lettering>
      <span className={styles.runScoreTime}>
        <Icon name="clock" size={16} /> {time} s
      </span>
    </p>
  );
}

// --- 5. The result -----------------------------------------------------------------------

function Result() {
  const stage = useStage();
  const [opened, setOpened] = useState(false);
  const [shown, setShown] = useState(0);
  const [verdict, setVerdict] = useState(false);
  const [gains, setGains] = useState(false);
  const timers = useRef<number[]>([]);
  const banner = useRef<HTMLDivElement>(null);
  const clear = () => {
    timers.current.forEach(window.clearTimeout);
    timers.current = [];
  };
  useEffect(() => () => timers.current.forEach(window.clearTimeout), []);
  const later = (ms: number, action: () => void) => {
    timers.current.push(window.setTimeout(action, ms));
  };

  const open = () => {
    clear();
    setOpened(true);
    setShown(0);
    setVerdict(false);
    setGains(false);
    play("sealBreak");
    const rows = MY_RUN.length;
    for (let index = 0; index < rows; index += 1) {
      later(900 + index * 650, () => {
        setShown(index + 1);
        play("flip");
      });
    }
    later(900 + rows * 650 + 300, () => {
      setVerdict(true);
      play("fanfareEpic");
      vibrate([30, 40, 60]);
      const box = banner.current?.getBoundingClientRect();
      if (box !== undefined && banner.current !== null) {
        stage.reveal(
          box.left + box.width / 2,
          box.top + box.height / 2,
          revealEffects.epic,
          rarityLights.epic[0] ?? "white",
          banner.current,
        );
      }
    });
    later(900 + rows * 650 + 1500, () => {
      setGains(true);
      play("coins");
    });
  };

  if (!opened) {
    return (
      <section className={`${ui.leaf} ${styles.sealed} ${desk.rising}`} style={rise(0)}>
        <span className={desk.leafKicker}>Joute classée contre {THEM.pseudo}</span>
        <button type="button" className={styles.pli} onClick={open}>
          <span className={styles.pliSeal}>
            <ToyIcon name="mail" size={88} />
          </span>
          <Lettering className={styles.pliLabel}>Résultat à découvrir</Lettering>
          <span className={styles.pliHint}>Touche pour l'ouvrir</span>
        </button>
        <Note>
          Dans la liste, une joute dont le résultat n'est pas vu reste scellée. La révélation se
          joue une fois ; ensuite, « Revoir » la rejoue.
        </Note>
      </section>
    );
  }

  const mine = MY_RUN.slice(0, shown);
  const theirs = THEIR_RUN.slice(0, shown);
  const won = score(MY_RUN) > score(THEIR_RUN);
  return (
    <section className={`${ui.leaf} ${styles.result} ${desk.rising}`} style={rise(0)}>
      <header className={styles.joustHead}>
        <span className={desk.leafKicker}>Joute classée</span>
        <button type="button" className={styles.replay} onClick={open}>
          <Icon name="play" size={14} /> Revoir
        </button>
      </header>
      <div className={styles.board}>
        <div className={styles.boardSide}>
          <Medallion initial={ME.initial} tone="blue" size={64} />
          <Lettering className={styles.boardName}>{ME.pseudo}</Lettering>
          <Lettering className={styles.boardScore}>{score(mine)}</Lettering>
        </div>
        <ol className={styles.boardRows}>
          {MY_RUN.map((entry, index) => {
            const theirsEntry = THEIR_RUN[index];
            const visible = index < shown;
            return (
              <li key={entry.word} className={styles.boardRow} data-visible={visible || undefined}>
                <BoardCell answer={entry} side="me" />
                <span className={styles.boardNumber}>{index + 1}</span>
                {theirsEntry !== undefined && <BoardCell answer={theirsEntry} side="them" />}
              </li>
            );
          })}
        </ol>
        <div className={styles.boardSide}>
          <Medallion initial={THEM.initial} tone="red" size={64} />
          <Lettering className={styles.boardName}>{THEM.pseudo}</Lettering>
          <Lettering className={styles.boardScore}>{score(theirs)}</Lettering>
        </div>
      </div>

      <div
        ref={banner}
        className={styles.banner}
        data-shown={verdict || undefined}
        data-won={won || undefined}
      >
        {verdict && (
          <Lettering className={styles.bannerWord}>{won ? "Victoire !" : "Défaite"}</Lettering>
        )}
      </div>

      {gains && (
        <div className={styles.gains}>
          <span className={styles.gain} style={{ "--i": 0 } as CSSProperties}>
            <ToyIcon name="challenge" size={34} />
            <Lettering>+40 XP</Lettering>
          </span>
          <span className={styles.gain} style={{ "--i": 1 } as CSSProperties}>
            <ToyIcon name="sachet" size={34} />
            <Lettering>+1 sachet</Lettering>
          </span>
          <span className={styles.gain} style={{ "--i": 2 } as CSSProperties}>
            <Shield league="chevalier" numeral="II" size={30} />
            <Lettering>+{LAURIERS_WON} lauriers</Lettering>
          </span>
          <div className={styles.gainBar}>
            <span className={styles.gainBarLabel}>Chevalier II</span>
            <span className={styles.leagueBar} aria-hidden="true">
              <span
                className={styles.gainFill}
                style={
                  {
                    "--from": `${LAURIERS_BEFORE - 700}%`,
                    "--to": `${LAURIERS_BEFORE + LAURIERS_WON - 700}%`,
                  } as CSSProperties
                }
              />
            </span>
            <span className={styles.gainBarLabel}>Chevalier I à 800</span>
          </div>
          <p className={styles.trapped}>
            <ToyIcon name="jousts" size={22} /> Ton mot <em>gourgandine</em> l'a piégée.
          </p>
          <div className={styles.runActions}>
            <MainAction label="Revanche" />
            <PaperAction label="Nouvelle joute" />
          </div>
        </div>
      )}
    </section>
  );
}

function BoardCell({ answer, side }: { readonly answer: Answer; readonly side: "me" | "them" }) {
  return (
    <span className={styles.boardCell} data-side={side} data-right={answer.right || undefined}>
      <Icon name={answer.right ? "check" : "close"} size={14} />
      <span className={styles.boardWord}>{answer.word}</span>
      <span className={styles.boardTime}>
        {answer.right ? `${answer.seconds.toLocaleString("fr-FR")} s` : "—"}
      </span>
    </span>
  );
}

// --- 6. Leagues and boards ---------------------------------------------------------------

type Board = "league" | "friends" | "clan";

const BOARDS: readonly { readonly id: Board; readonly label: string }[] = [
  { id: "league", label: "Ma ligue" },
  { id: "friends", label: "Amis" },
  { id: "clan", label: "Clan" },
];

const STANDINGS: Readonly<
  Record<Board, readonly { readonly name: string; readonly lauriers: number }[]>
> = {
  league: [
    { name: "Mobilette", lauriers: 861 },
    { name: "Alix", lauriers: 815 },
    { name: "Raph", lauriers: 770 },
    { name: "Hortense", lauriers: 655 },
    { name: "Bertrand", lauriers: 640 },
    { name: "Clémence", lauriers: 612 },
    { name: "Gaspard", lauriers: 604 },
  ],
  friends: [
    { name: "Mobilette", lauriers: 861 },
    { name: "Raph", lauriers: 770 },
    { name: "Bertrand", lauriers: 640 },
    { name: "Raphtest", lauriers: 288 },
  ],
  clan: [
    { name: "Mobilette", lauriers: 861 },
    { name: "Alix", lauriers: 815 },
    { name: "Raph", lauriers: 770 },
    { name: "Raphtest", lauriers: 288 },
    { name: "Ysolde", lauriers: 120 },
  ],
};

function Leagues() {
  const [board, setBoard] = useState<Board>("league");
  const current = LAURIERS_BEFORE + LAURIERS_WON;
  const here = divisionOf(current);
  const road = useRef<HTMLOListElement>(null);
  useEffect(() => {
    road.current
      ?.querySelector("[data-here]")
      ?.scrollIntoView({ block: "nearest", inline: "center" });
  }, []);
  return (
    <div className={styles.leagues}>
      <section className={`${ui.leaf} ${styles.roadLeaf} ${desk.rising}`} style={rise(0)}>
        <header className={styles.deckHead}>
          <Lettering className={styles.homeTitle}>La route des lauriers</Lettering>
          <span className={styles.season}>
            <Icon name="clock" size={14} /> Saison : fin dans 12 jours
          </span>
        </header>
        <ol className={styles.road} ref={road}>
          {DIVISIONS.map((division) => {
            const reached = current >= division.from;
            const isHere = division === here;
            const opensLeague = division.numeral === "III" || division.numeral === null;
            return (
              <li
                key={divisionName(division)}
                className={styles.roadStop}
                data-reached={reached || undefined}
                data-here={isHere || undefined}
              >
                <Shield
                  league={division.league.id}
                  numeral={division.numeral}
                  size={isHere ? 54 : 40}
                />
                <span className={styles.roadName}>{divisionName(division)}</span>
                <span className={styles.roadFrom}>{division.from}</span>
                <span className={styles.roadReward}>
                  {division.from === 0 ? (
                    "Départ"
                  ) : opensLeague ? (
                    <>
                      <ToyIcon name="sachet" size={20} /> garni
                    </>
                  ) : (
                    <>
                      <ToyIcon name="ecu" size={18} /> 20
                    </>
                  )}
                  {reached && division.from > 0 && <Icon name="check" size={12} />}
                </span>
                {isHere && <span className={styles.you}>{current}</span>}
              </li>
            );
          })}
        </ol>
        <div className={styles.endRewards}>
          <span className={desk.leafKicker}>En fin de saison, selon ta ligue</span>
          <ul>
            {LEAGUES.map((league) => (
              <li key={league.id} data-here={league.id === here.league.id || undefined}>
                <Shield
                  league={league.id}
                  numeral={league.id === "champion" ? null : "I"}
                  size={26}
                />
                <strong>{league.name}</strong>
                <span>{league.endReward}</span>
              </li>
            ))}
          </ul>
          <p className={styles.trapsText}>
            À la fin de la saison, tu repars une ligue plus bas. Tu ne descends jamais sous le début
            de la ligue atteinte pendant la saison.
          </p>
        </div>
      </section>

      <section className={`${ui.leaf} ${styles.boardLeaf} ${desk.rising}`} style={rise(1)}>
        <header className={styles.deckHead}>
          <Lettering className={styles.homeTitle}>Classement</Lettering>
          <div className={styles.tabs} role="tablist" aria-label="Classement">
            {BOARDS.map((entry) => (
              <button
                key={entry.id}
                type="button"
                role="tab"
                aria-selected={entry.id === board}
                className={styles.tab}
                onClick={() => setBoard(entry.id)}
              >
                {entry.label}
              </button>
            ))}
          </div>
        </header>
        <ol className={styles.standings}>
          {STANDINGS[board].map((entry, index) => {
            const division = divisionOf(entry.lauriers);
            const isMe = entry.name === ME.pseudo;
            return (
              <li key={entry.name} className={styles.standing} data-me={isMe || undefined}>
                <span className={styles.place} data-podium={index < 3 || undefined}>
                  {index + 1}
                </span>
                <Medallion
                  initial={entry.name[0] ?? "?"}
                  tone={isMe ? "blue" : "paper"}
                  size={36}
                />
                <span className={styles.standingName}>{entry.name}</span>
                <Shield league={division.league.id} numeral={division.numeral} size={24} />
                <span className={styles.standingLauriers}>{entry.lauriers}</span>
              </li>
            );
          })}
        </ol>
        <p className={styles.trapsText}>
          Ma ligue : les jouteurs de Chevalier cette saison. Le classement général s'ouvrira quand
          50 joueurs auront fait 5 joutes classées dans le mois.
        </p>
      </section>
      <Note>
        Une division atteinte pour la première fois dans la saison donne 20 écus, une ligue un
        sachet garni. La cote, elle, ne se montre que dans le détail des statistiques de joute.
      </Note>
    </div>
  );
}
