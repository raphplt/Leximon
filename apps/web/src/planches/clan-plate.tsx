"use client";

import type { Rarity } from "@leximon/core";
import { cssFill, goalChestInks, rarityStyles, type ToyInks } from "@leximon/tokens";
import { type CSSProperties, useState } from "react";
import { RarityIcon } from "@/components/rarity-icon";
import { MainAction } from "@/library/play-pieces";
import desk from "@/play/desk-columns.module.css";
import { Icon } from "@/ui/icon";
import { ParticleStage } from "@/ui/stage";
import { Lettering, Toy, ToyIcon } from "@/ui/toy";
import ui from "@/ui/ui.module.css";
import styles from "./clan-plate.module.css";

/**
 * A plate of the clan's goal, library and members as their spec proposes them, on made-up
 * figures: the owner judges them before the rules are settled. Nothing here reads the game.
 */

type Moment = "first" | "short" | "share" | "gold";

const MOMENTS: readonly { readonly id: Moment; readonly label: string }[] = [
  { id: "first", label: "Première visite" },
  { id: "short", label: "Ta part pas faite" },
  { id: "share", label: "Ta part faite" },
  { id: "gold", label: "Or atteint" },
];

const GOAL: Readonly<Record<Moment, { readonly clan: number; readonly mine: number }>> = {
  first: { clan: 25, mine: 0 },
  short: { clan: 25, mine: 5 },
  share: { clan: 41, mine: 18 },
  gold: { clan: 57, mine: 22 },
};

type Tier = "bronze" | "silver" | "gold" | "illuminated";

const TIERS: readonly {
  readonly tier: Tier;
  readonly name: string;
  readonly target: number;
  readonly sachet: boolean;
  readonly inks: ToyInks;
}[] = [
  {
    tier: "bronze",
    name: "Bronze",
    target: 15,
    sachet: false,
    inks: goalChestInks.bronze,
  },
  {
    tier: "silver",
    name: "Argent",
    target: 30,
    sachet: true,
    inks: goalChestInks.silver,
  },
  {
    tier: "gold",
    name: "Or",
    target: 50,
    sachet: true,
    inks: goalChestInks.gold,
  },
  {
    tier: "illuminated",
    name: "Enluminure",
    target: 60,
    sachet: true,
    inks: goalChestInks.illuminated,
  },
];

const CHEST_NAMES: Readonly<Record<Tier, string>> = {
  bronze: "coffre de bronze",
  silver: "coffre d'argent",
  gold: "coffre d'or",
  illuminated: "coffre enluminé",
};

const capitalized = (text: string) => `${text[0]?.toUpperCase()}${text.slice(1)}`;

/** Where `count` falls on a road whose chests stand at even steps: segment by segment. */
function evenShare(count: number): number {
  let from = 0;
  for (const [index, entry] of TIERS.entries()) {
    if (count < entry.target) {
      return (index + (count - from) / (entry.target - from)) / TIERS.length;
    }
    from = entry.target;
  }
  return 1;
}

const SHARE = 15;
const LAST = 60;

/** Each leaf rises in turn when the screen appears, as on Jouer. */
const rise = (index: number) => ({ "--rise": index }) as CSSProperties;

export function ClanPlate() {
  const [moment, setMoment] = useState<Moment>("short");
  return (
    <main className={styles.page}>
      <ParticleStage dust>
        <nav className={styles.controls} aria-label="État de la planche">
          <span className={styles.controlsLabel}>Planche Clan</span>
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
        <div className={styles.screen}>
          <Lettering className={styles.plateTitle}>1. L'objectif de la semaine</Lettering>
          <div className={styles.goalRow}>
            <Goal moment={moment} />
            <JouerLine moment={moment} />
          </div>
          <Lettering className={styles.plateTitle}>2. La bibliothèque du clan</Lettering>
          <Library />
          <Lettering className={styles.plateTitle}>3. Les membres</Lettering>
          <Members />
        </div>
      </ParticleStage>
    </main>
  );
}

// --- 1. The goal ---------------------------------------------------------------------------

function Goal({ moment }: { readonly moment: Moment }) {
  const { clan, mine } = GOAL[moment];
  const next = TIERS.find((entry) => clan < entry.target) ?? null;
  const shared = mine >= SHARE;
  return (
    <section
      className={`${ui.leaf} ${styles.goal} ${desk.rising}`}
      style={rise(0)}
      aria-label="Objectif du clan"
    >
      <header className={styles.goalHead}>
        <span className={desk.leafKicker}>Objectif du clan, cette semaine</span>
        <span className={styles.ends}>
          <Icon name="clock" size={15} />
          Fin dimanche soir
        </span>
        <span className={styles.help} role="img" aria-label="Comment ça marche">
          <Icon name="help" size={20} />
        </span>
      </header>

      {moment === "first" && <HowItWorks />}

      <p className={styles.goalFigure}>
        <strong>{clan}</strong> bonnes réponses en révision, ensemble
      </p>
      <p className={styles.goalNext}>
        {next === null
          ? "Les quatre coffres sont ouverts !"
          : `Encore ${next.target - clan} pour le ${CHEST_NAMES[next.tier]}`}
      </p>

      <div className={styles.road}>
        <div className={styles.track} aria-hidden="true">
          <span
            className={styles.fill}
            style={
              {
                "--at": `${Math.min(100, (clan / LAST) * 100)}%`,
                "--even": `${evenShare(clan) * 100}%`,
              } as CSSProperties
            }
          />
        </div>
        {TIERS.map((entry, index) => {
          const reached = clan >= entry.target;
          return (
            <div
              key={entry.tier}
              className={styles.stop}
              data-reached={reached || undefined}
              data-next={entry === next || undefined}
              style={
                {
                  "--at": `${(entry.target / LAST) * 100}%`,
                  "--even": `${((index + 1) / TIERS.length) * 100}%`,
                } as CSSProperties
              }
            >
              <span className={styles.chest}>
                <ToyIcon name="chest" size={entry === next ? 48 : 40} inks={entry.inks} />
                {reached && (
                  <span className={styles.tick}>
                    <Icon name="check" size={12} />
                  </span>
                )}
              </span>
              <span className={styles.stopTarget}>{entry.target}</span>
              <span className={styles.stopName}>{entry.name}</span>
              <span
                className={styles.stopReward}
                data-locked={(!shared && entry.sachet) || undefined}
              >
                {entry.sachet ? (
                  <>
                    <ToyIcon name="sachet" size={18} />
                    +1
                    {!shared && <Icon name="lock" size={12} />}
                  </>
                ) : (
                  <>
                    <ToyIcon name="clan" size={18} />
                    XP
                  </>
                )}
              </span>
            </div>
          );
        })}
      </div>

      <div className={styles.share} data-done={shared || undefined}>
        <span className={styles.shareTitle}>Ta part</span>
        <div className={styles.shareBar} aria-hidden="true">
          <span style={{ width: `${Math.min(100, (mine / SHARE) * 100)}%` }} />
        </div>
        <span className={styles.shareFigure}>
          {Math.min(mine, SHARE)} / {SHARE}
        </span>
        <span className={styles.shareLine}>
          {shared ? (
            <>
              <Icon name="check" size={14} /> Tu reçois les sachets des coffres
            </>
          ) : (
            <>
              <Icon name="lock" size={14} /> Encore {SHARE - mine} pour recevoir les sachets
            </>
          )}
        </span>
      </div>

      <div className={styles.goalAction}>
        <MainAction label="Jouer pour le clan" />
        <span className={styles.goalActionNote}>Une révision de 10 questions</span>
      </div>

      <p className={styles.bubbleNote}>
        Le « ? » ouvre la règle complète : chaque bonne réponse en révision compte du lundi au
        dimanche ; un coffre s'ouvre à chaque palier ; le bronze fait monter le clan, l'argent, l'or
        et l'enluminure donnent aussi un sachet bonus ; il faut 15 bonnes réponses dans la semaine
        pour le recevoir ; les paliers suivent le nombre de membres actifs (15, 30, 50 et 60 par
        membre).
      </p>
    </section>
  );
}

/** Shown once, on the first visit to a clan: the goal in three drawn steps. */
function HowItWorks() {
  return (
    <ol className={styles.how}>
      <li>
        <ToyIcon name="challenges" size={34} />
        <span>Chaque bonne réponse en révision compte pour le clan.</span>
      </li>
      <li>
        <ToyIcon name="chest" size={34} />
        <span>Ensemble, vous ouvrez jusqu'à 4 coffres dans la semaine.</span>
      </li>
      <li>
        <ToyIcon name="sachet" size={34} />
        <span>Avec 15 bonnes réponses, tu reçois les sachets des coffres.</span>
      </li>
      <li className={styles.howAction}>
        <Toy matter="paper" className={styles.control}>
          Compris
        </Toy>
      </li>
    </ol>
  );
}

/** The goal's line on Jouer, in the same words. */
function JouerLine({ moment }: { readonly moment: Moment }) {
  const { clan } = GOAL[moment];
  const next = TIERS.find((entry) => clan < entry.target) ?? TIERS[TIERS.length - 1];
  if (next === undefined) return null;
  return (
    <aside className={`${ui.leaf} ${styles.jouer} ${desk.rising}`} style={rise(1)}>
      <span className={desk.leafKicker}>Sur Jouer, la même chose en petit</span>
      <div className={styles.jouerRow}>
        <ToyIcon name="chest" size={44} inks={next.inks} />
        <div>
          <strong className={styles.jouerTitle}>{capitalized(CHEST_NAMES[next.tier])}</strong>
          <span className={styles.jouerCount}>
            {clan} / {next.target}
          </span>
        </div>
      </div>
      <div className={styles.jouerBar} aria-hidden="true">
        <span style={{ width: `${Math.min(100, (clan / next.target) * 100)}%` }} />
      </div>
    </aside>
  );
}

// --- 2. The library ------------------------------------------------------------------------

interface Tile {
  readonly word: string | null;
  readonly number: number;
  readonly rarity: Rarity;
  /** Members who hold it; the first letter of their pseudo stands for them. */
  readonly owners: readonly string[];
  readonly mine: boolean;
  readonly double: boolean;
}

const TILES: readonly Tile[] = [
  {
    word: "abajoue",
    number: 1,
    rarity: "common",
    owners: ["M", "R", "T"],
    mine: true,
    double: true,
  },
  { word: "acariâtre", number: 2, rarity: "uncommon", owners: ["M"], mine: false, double: true },
  { word: null, number: 3, rarity: "rare", owners: [], mine: false, double: false },
  { word: "affiquet", number: 4, rarity: "common", owners: ["R", "A"], mine: true, double: false },
  { word: "alberge", number: 5, rarity: "precious", owners: ["T"], mine: false, double: false },
  { word: "amphigouri", number: 6, rarity: "rare", owners: ["M", "R"], mine: false, double: true },
  { word: null, number: 7, rarity: "common", owners: [], mine: false, double: false },
  {
    word: "anicroche",
    number: 8,
    rarity: "common",
    owners: ["M", "R", "T", "A", "B"],
    mine: true,
    double: true,
  },
  { word: "aragne", number: 9, rarity: "epic", owners: ["B"], mine: false, double: false },
  { word: "bachelette", number: 10, rarity: "uncommon", owners: ["A"], mine: true, double: false },
  { word: null, number: 11, rarity: "uncommon", owners: [], mine: false, double: false },
  {
    word: "barguigner",
    number: 12,
    rarity: "common",
    owners: ["M", "T"],
    mine: false,
    double: false,
  },
];

const LIBRARY_FILTERS = [
  "Toutes",
  "Il te manque, le clan l'a",
  "En double dans le clan",
  "Personne ne l'a",
];

function Library() {
  const [selected, setSelected] = useState(1);
  const tile = TILES[selected];
  return (
    <section className={`${ui.leaf} ${styles.library} ${desk.rising}`} style={rise(2)}>
      <header className={styles.libraryHead}>
        <div>
          <span className={desk.leafKicker}>Bibliothèque du clan</span>
          <h2 className={styles.sectionTitle}>Les Fondateurs</h2>
        </div>
        <div className={styles.collectionTabs}>
          <span data-on>Les Fondateurs · 250 / 519</span>
          <span>Caractères et travers · 177 / 539</span>
          <span>Métiers et objets disparus · 97 / 503</span>
        </div>
      </header>
      <p className={styles.libraryGain}>
        <ToyIcon name="trades" size={26} />
        <span>
          <strong>64 mots</strong> qui te manquent sont dans le clan, dont <strong>21</strong> en
          double.
        </span>
      </p>
      <div className={styles.chips}>
        {LIBRARY_FILTERS.map((filter, index) => (
          <span key={filter} className={styles.chip} data-on={index === 1 || undefined}>
            {filter}
          </span>
        ))}
        <span className={styles.search}>
          <Icon name="search" size={16} /> Chercher un mot
        </span>
      </div>
      <div className={styles.libraryBody}>
        <ul className={styles.tiles}>
          {TILES.map((entry, index) => (
            <li key={entry.number}>
              <button
                type="button"
                className={styles.tile}
                data-missing={entry.word === null || undefined}
                data-selected={index === selected || undefined}
                style={
                  {
                    "--band": cssFill(rarityStyles[entry.rarity].band),
                    "--band-ink": rarityStyles[entry.rarity].bandInk,
                  } as CSSProperties
                }
                onClick={() => setSelected(index)}
              >
                <span className={styles.tileGem}>
                  <RarityIcon rarity={entry.rarity} size="12px" />
                </span>
                <span className={styles.tileWord}>{entry.word ?? `n° ${entry.number}`}</span>
                {entry.word !== null && (
                  <span className={styles.owners}>
                    {entry.owners.slice(0, 3).map((owner) => (
                      <span key={owner} className={styles.owner}>
                        {owner}
                      </span>
                    ))}
                    {entry.owners.length > 3 && (
                      <span className={styles.ownerMore}>+{entry.owners.length - 3}</span>
                    )}
                  </span>
                )}
                {entry.mine && <span className={styles.mine}>à toi</span>}
                {entry.double && <span className={styles.double}>×2</span>}
              </button>
            </li>
          ))}
        </ul>
        {tile !== undefined && (
          <aside className={styles.detail}>
            <span className={desk.leafKicker}>Dans ton clan</span>
            <h3 className={styles.detailWord}>{tile.word ?? `Mot n° ${tile.number}`}</h3>
            {tile.word === null ? (
              <p className={styles.detailNote}>Personne dans le clan n'a encore ce mot.</p>
            ) : (
              <>
                <p className={styles.detailNote}>
                  {tile.mine ? "Tu l'as." : "Tu ne l'as pas encore."}
                </p>
                <ul className={styles.ownerList}>
                  {tile.owners.map((owner, index) => (
                    <li key={owner}>
                      <span className={styles.owner}>{owner}</span>
                      <span className={styles.ownerName}>{MEMBER_NAMES[owner] ?? owner}</span>
                      {tile.double && index === 0 ? (
                        <>
                          <span className={styles.double}>×2</span>
                          {!tile.mine && (
                            <Toy matter="paper" className={styles.offer}>
                              Proposer un échange
                            </Toy>
                          )}
                        </>
                      ) : null}
                    </li>
                  ))}
                </ul>
                {tile.mine && (
                  <Toy matter="paper" className={styles.offer}>
                    Voir la carte
                  </Toy>
                )}
              </>
            )}
          </aside>
        )}
      </div>
    </section>
  );
}

const MEMBER_NAMES: Readonly<Record<string, string>> = {
  M: "Mobilette",
  R: "Recette",
  T: "Raphtest",
  A: "Alix",
  B: "Bertrand",
};

// --- 3. The members ------------------------------------------------------------------------

interface Member {
  readonly name: string;
  readonly role: "chef" | "adjoint" | null;
  readonly level: number;
  readonly seen: string;
  readonly online: boolean;
  readonly week: number;
  readonly since: string;
}

const MEMBERS: readonly Member[] = [
  {
    name: "Mobilette",
    role: "adjoint",
    level: 13,
    seen: "en ligne",
    online: true,
    week: 22,
    since: "depuis le 21 oct.",
  },
  {
    name: "raph2",
    role: null,
    level: 8,
    seen: "en ligne",
    online: true,
    week: 18,
    since: "depuis le 2 nov.",
  },
  {
    name: "Recette",
    role: null,
    level: 17,
    seen: "vu il y a 2 h",
    online: false,
    week: 12,
    since: "depuis le 22 oct.",
  },
  {
    name: "Alix",
    role: null,
    level: 6,
    seen: "vu hier",
    online: false,
    week: 7,
    since: "depuis le 4 nov.",
  },
  {
    name: "Raphtest",
    role: "chef",
    level: 11,
    seen: "vu il y a 3 j",
    online: false,
    week: 0,
    since: "depuis le 20 oct.",
  },
  {
    name: "Bertrand",
    role: null,
    level: 9,
    seen: "vu il y a 9 j",
    online: false,
    week: 0,
    since: "depuis le 25 oct.",
  },
];

const SORTS = ["Cette semaine", "Dernière visite", "Arrivée", "Nom"];
const MEMBER_FILTERS = ["En ligne", "Chef et adjoints", "Part pas encore faite"];

function Members() {
  return (
    <div className={styles.membersRow}>
      <section className={`${ui.leaf} ${styles.membersCard} ${desk.rising}`} style={rise(3)}>
        <span className={desk.leafKicker}>Sur la page du clan</span>
        <h2 className={styles.sectionTitle}>Membres</h2>
        <ul className={styles.memberMini}>
          {MEMBERS.slice(0, 4).map((member) => (
            <li key={member.name}>
              <span className={styles.avatar} data-online={member.online || undefined}>
                {member.name[0]}
              </span>
              <span className={styles.memberName}>{member.name}</span>
              <span className={styles.memberWeek}>{member.week}</span>
            </li>
          ))}
        </ul>
        <Toy matter="paper" className={styles.offer}>
          Voir les 24 membres
        </Toy>
      </section>

      <section className={`${ui.leaf} ${styles.members} ${desk.rising}`} style={rise(4)}>
        <header className={styles.membersHead}>
          <h2 className={styles.sectionTitle}>Les 24 membres</h2>
          <span className={styles.close}>
            <Icon name="close" size={18} />
          </span>
        </header>
        <div className={styles.membersTools}>
          <span className={styles.search}>
            <Icon name="search" size={16} /> Chercher un pseudo
          </span>
          <div className={styles.sorts} role="tablist" aria-label="Trier">
            {SORTS.map((sort, index) => (
              <span key={sort} className={styles.sort} data-on={index === 0 || undefined}>
                {sort}
              </span>
            ))}
          </div>
          <div className={styles.chips}>
            {MEMBER_FILTERS.map((filter) => (
              <span key={filter} className={styles.chip}>
                {filter}
              </span>
            ))}
          </div>
        </div>
        <ul className={styles.memberList}>
          {MEMBERS.map((member) => (
            <li key={member.name} className={styles.memberRow}>
              <span className={styles.avatar} data-online={member.online || undefined}>
                {member.name[0]}
              </span>
              <span className={styles.memberText}>
                <span className={styles.memberName}>
                  {member.name}
                  {member.role !== null && (
                    <span className={styles.role} data-chief={member.role === "chef" || undefined}>
                      {member.role === "chef" ? "Chef" : "Adjoint"}
                    </span>
                  )}
                </span>
                <span className={styles.memberMeta}>
                  niv. {member.level} · {member.seen} · {member.since}
                </span>
              </span>
              <span className={styles.memberShare} data-done={member.week >= SHARE || undefined}>
                <span className={styles.memberShareFigure}>
                  {member.week >= SHARE && <Icon name="check" size={13} />}
                  {member.week}
                </span>
                <span className={styles.memberShareBar}>
                  <span style={{ width: `${Math.min(100, (member.week / SHARE) * 100)}%` }} />
                </span>
              </span>
              <span className={styles.more} role="img" aria-label="Gérer">
                <Icon name="dots" size={18} />
              </span>
            </li>
          ))}
        </ul>
        <p className={styles.bubbleNote}>
          Le « … » d'une ligne n'apparaît qu'au chef et aux adjoints : nommer adjoint, rendre muet,
          exclure. Un clic sur la ligne ouvre le profil.
        </p>
      </section>
    </div>
  );
}
