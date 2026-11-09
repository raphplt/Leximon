"use client";

import type { DuelistSide, JoustView } from "@leximon/contract";
import {
  duelistMeta,
  joustKindName,
  OPPONENT_FOUND,
  runSize,
  SEARCHING,
  START_JOUST,
  START_LATER,
  searchLine,
  startByLine,
  startLine,
} from "@leximon/view-model";
import { type CSSProperties, useEffect, useState } from "react";
import { CardBack } from "@/booster/card-back";
import { play, vibrate } from "@/booster/feedback";
import { useEngravingInk } from "@/cards/use-engraving-ink";
import { Avatar } from "@/components/avatar";
import { MainAction, PaperAction } from "@/library/play-pieces";
import { Tooling } from "@/ui/ornaments";
import { Lettering } from "@/ui/toy";
import { Crest } from "./crest";
import type { Duelist } from "./pieces";
import styles from "./start-scene.module.css";

/** The print behind the arena, as behind the lice. */
const ARENA_ENGRAVING = "palefroi";
/** The reel turns this long before it stops on the opponent: the server already chose them. */
const SEARCH_MS = 2_200;
const FOUND_MS = 1_100;
const COUNT_MS = 800;
// Faces turning in the reel before the opponent's: the portraits players pick from.
const REEL = ["grimelin", "cassandre", "preopinant", "ricanerie", "metaphraste", "bachelette"];

/**
 * Before the run: the search for an opponent when the game picked them, then both players face to
 * face. Nothing starts before « Commencer »: then 3, 2, 1, and the run's clock with its first word.
 */
export function StartScene({
  view,
  me,
  them,
  search,
  onStart,
  onLater,
}: {
  readonly view: JoustView;
  readonly me: Duelist;
  readonly them: Duelist;
  /** Play the search first: the joust was just launched here. */
  readonly search: boolean;
  readonly onStart: () => void;
  readonly onLater: () => void;
}) {
  const [moment, setMoment] = useState<"search" | "face">(search ? "search" : "face");
  const duel = view.duel;
  if (duel === null) return null;
  return moment === "search" ? (
    <Search view={view} me={me} them={them} side={duel.theirs} onFound={() => setMoment("face")} />
  ) : (
    <FaceToFace view={view} me={me} them={them} duel={duel} onStart={onStart} onLater={onLater} />
  );
}

/** The arena of red leather tooled in gold, the old print behind. */
export function Arena({ children }: { readonly children: React.ReactNode }) {
  const engraving = useEngravingInk(ARENA_ENGRAVING);
  return (
    <section className={styles.arena}>
      {engraving !== null && (
        <span
          className={styles.engraving}
          style={{ "--ink": `url(${engraving})` } as CSSProperties}
          aria-hidden="true"
        />
      )}
      <Tooling />
      {children}
    </section>
  );
}

function Search({
  view,
  me,
  them,
  side,
  onFound,
}: {
  readonly view: JoustView;
  readonly me: Duelist;
  readonly them: Duelist;
  readonly side: DuelistSide;
  readonly onFound: () => void;
}) {
  const [found, setFound] = useState(false);
  useEffect(() => {
    const stop = window.setTimeout(() => {
      setFound(true);
      play("cardSlide");
    }, SEARCH_MS);
    const go = window.setTimeout(onFound, SEARCH_MS + FOUND_MS);
    return () => {
      window.clearTimeout(stop);
      window.clearTimeout(go);
    };
  }, [onFound]);
  const kind = view.summary.kind;
  return (
    <Arena>
      <span className={styles.kicker}>{joustKindName(kind)}</span>
      <Lettering className={styles.title}>{found ? OPPONENT_FOUND : SEARCHING}</Lettering>
      <div className={styles.searchRow}>
        <span className={styles.searchMe}>
          <Avatar avatar={me.avatar} frame={me.frame} size={110} />
          <b>{me.name}</b>
        </span>
        <Lettering className={styles.vsSmall}>VS</Lettering>
        <span className={styles.slot} data-found={found || undefined}>
          <span className={styles.reel}>
            {[...REEL, ...REEL, them.avatar].map((avatar, index) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: a reel of faces, in order
              <Avatar key={index} avatar={avatar} frame={null} size={110} />
            ))}
          </span>
        </span>
      </div>
      <p className={styles.line} aria-live="polite">
        {searchLine(kind, found ? { name: them.name, side } : null)}
      </p>
    </Arena>
  );
}

function FaceToFace({
  view,
  me,
  them,
  duel,
  onStart,
  onLater,
}: {
  readonly view: JoustView;
  readonly me: Duelist;
  readonly them: Duelist;
  readonly duel: NonNullable<JoustView["duel"]>;
  readonly onStart: () => void;
  readonly onLater: () => void;
}) {
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    if (count === null) return;
    if (count === 0) {
      onStart();
      return;
    }
    play("cardSlide");
    const next = window.setTimeout(() => setCount(count - 1), COUNT_MS);
    return () => window.clearTimeout(next);
  }, [count, onStart]);
  const later = startByLine(view.startBy, them.name, Date.now());
  return (
    <Arena>
      <span className={styles.kicker}>{joustKindName(view.summary.kind)}</span>
      <div className={styles.faceRow}>
        <Side duelist={me} side={duel.mine} at="left" />
        <span className={styles.vs}>
          <Lettering>VS</Lettering>
        </span>
        <Side duelist={them} side={duel.theirs} at="right" />
      </div>
      {count === null ? (
        <div className={styles.go}>
          <MainAction
            label={START_JOUST}
            onClick={() => {
              vibrate([20]);
              setCount(3);
            }}
          />
          <p className={styles.line}>{startLine(runSize(Date.now()))}</p>
          <PaperAction label={START_LATER} onClick={onLater} />
          {later !== null && <p className={styles.small}>{later}</p>}
        </div>
      ) : (
        <Lettering className={styles.countdown} key={count}>
          {String(count)}
        </Lettering>
      )}
    </Arena>
  );
}

function Side({
  duelist,
  side,
  at,
}: {
  readonly duelist: Duelist;
  readonly side: DuelistSide;
  readonly at: "left" | "right";
}) {
  return (
    <span className={styles.duelist} data-side={at}>
      <span className={styles.crest}>
        <Crest league={side.league} size={60} />
      </span>
      <Avatar avatar={duelist.avatar} frame={duelist.frame} size={130} />
      <Lettering className={styles.name}>{duelist.name}</Lettering>
      <span className={styles.meta}>{duelistMeta(side)}</span>
      <span className={styles.backs} aria-hidden="true">
        {side.rarities.map((rarity, index) => (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: the run's cards, in order
            key={index}
            className={styles.back}
            style={
              {
                "--i": index,
                "--turn": `${(index - (side.rarities.length - 1) / 2) * 6}deg`,
              } as CSSProperties
            }
          >
            <CardBack rarity={rarity} width={52} tone={at === "left" ? "night" : "burgundy"} />
          </span>
        ))}
      </span>
    </span>
  );
}
