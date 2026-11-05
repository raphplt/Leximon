"use client";

import type { ToyIconName, ToyMatterName } from "@leximon/tokens";
import {
  type CollectionChoice,
  dailyView,
  type FabId,
  type Fab as FabModel,
  lockedToast,
  playFabs,
  type StockView,
} from "@leximon/view-model";
import { useRouter } from "next/navigation";
import { type ReactNode, type RefObject, useEffect, useRef, useState } from "react";
import { CollectionTitle, Desk, InfoBubble, MainAction, SideTile } from "@/library/play-pieces";
import { dailyChallenge } from "@/player/collection";
import { useShared } from "@/player/resource";
import { useShell } from "@/shell/shell-context";
import { usePlayerView } from "@/shell/use-player-view";
import styles from "./library-counter.module.css";

const TILES: Readonly<
  Record<Exclude<FabId, "mail">, { readonly icon: ToyIconName; readonly matter: ToyMatterName }>
> = {
  clan: { icon: "clan", matter: "blue" },
  chat: { icon: "discussion", matter: "green" },
  jousts: { icon: "jousts", matter: "red" },
  daily: { icon: "challenge", matter: "red" },
  friends: { icon: "friends", matter: "green" },
  coffrets: { icon: "chest", matter: "blue" },
  settings: { icon: "settings", matter: "gold" },
};

/** Where the opening stands, as the counter shows it. */
export type CounterMoment = "waiting" | "arriving" | "charging" | "burst";

export interface LibraryCounterProps {
  readonly choices: readonly CollectionChoice[];
  readonly choice: CollectionChoice;
  readonly neighbours: {
    readonly left: CollectionChoice | null;
    readonly right: CollectionChoice | null;
  };
  /** The sachet itself, which the screen opens: the counter only moves it and makes it charge. */
  readonly sachet: ReactNode;
  /** The sachets of the collections on either side, behind it: only a wide screen shows them. */
  readonly beside: ReactNode;
  readonly stock: StockView | null;
  /** Sachets the player may still open, for the count on the button; null to show none. */
  readonly left: number | null;
  readonly canOpen: boolean;
  readonly moment: CounterMoment;
  /** Where the particles of the opening start: the sachet. */
  readonly sachetRef: RefObject<HTMLDivElement | null>;
  /** The side the sachet on the desk came in from, on the last change; null for none to play. */
  readonly entry: "left" | "right" | null;
  /** `from`: the side the new sachet comes in from. */
  readonly onPick: (next: CollectionChoice, from: "left" | "right") => void;
  readonly onOpen: () => void;
  /** Under the button: the account to create, an error, the last sachet without an account. */
  readonly footer: ReactNode;
  /** Left of the desk, on a wide screen: what the day holds. */
  readonly today?: ReactNode;
  /** Right of the desk, on a wide screen: the level, the clan, the rest of the room. */
  readonly standing?: ReactNode;
  /** Under the button, below a wide screen: a word of the album to read again, or one slipping away. */
  readonly word?: ReactNode;
}

/**
 * The Jouer screen of « La Bibliothèque »: the collection's sachet on the desk under the lamp,
 * the tiles of the other places on both sides, and the gold button that opens it. While it
 * opens, everything but the sachet fades away.
 */
export function LibraryCounter({
  choices,
  choice,
  neighbours,
  sachet,
  beside,
  stock,
  left,
  canOpen,
  moment,
  sachetRef,
  entry,
  onPick,
  onOpen,
  footer,
  today = null,
  standing = null,
  word = null,
}: LibraryCounterProps) {
  const view = usePlayerView();
  const [bubble, setBubble] = useState<{ readonly text: string } | null>(null);
  const say = (text: string) => setBubble({ text });
  const opening = moment !== "waiting";

  const turn = (side: "left" | "right") => {
    const next = neighbours[side];
    if (next === null || opening) return;
    if (next.lock !== null) say(lockedToast("choose_collection", view.now));
    else onPick(next, side);
  };
  const leaving = useLeavingSachet(choice.id, sachet, entry);

  return (
    <section className={styles.screen} data-opening={opening || undefined} aria-label="Ton sachet">
      {today !== null && <div className={`${styles.today} ${styles.fading}`}>{today}</div>}
      <div className={styles.stage}>
        <div className={styles.play}>
          <Desk className={styles.desk} />
          <div className={`${styles.title} ${styles.fading}`}>
            <CollectionTitle
              kicker="Sachet"
              name={choice.name}
              tagline={choice.tagline ?? ""}
              index={Math.max(
                0,
                choices.findIndex((c) => c.id === choice.id),
              )}
              count={choices.length}
              previousLabel="Collection précédente"
              nextLabel="Collection suivante"
              onPrevious={() => turn("left")}
              onNext={() => turn("right")}
            />
          </div>
          <Tiles say={say} />
          <div ref={sachetRef} className={styles.sachet} data-moment={moment}>
            <div className={`${styles.beside} ${styles.fading}`}>{beside}</div>
            <div className={styles.glow} aria-hidden="true" />
            <div className={styles.charge}>
              {leaving !== null && (
                <div
                  key={leaving.id}
                  className={`${styles.front} ${styles.leaving} ${leaving.to === "left" ? styles.toLeft : styles.toRight}`}
                  inert
                >
                  {leaving.node}
                </div>
              )}
              <div
                key={choice.id}
                className={`${styles.front} ${entry === "right" ? styles.fromRight : entry === "left" ? styles.fromLeft : ""}`}
              >
                {sachet}
              </div>
            </div>
          </div>
        </div>
        <div className={`${styles.cta} ${styles.fading}`}>
          <div className={styles.main}>
            {stock !== null && (
              <MainAction
                label={opening ? "Ouverture…" : stock.action}
                count={left === null || left === 0 ? undefined : String(left)}
                disabled={!canOpen || opening}
                onClick={onOpen}
              />
            )}
            {footer}
          </div>
          {word !== null && <div className={styles.word}>{word}</div>}
        </div>
      </div>
      {standing !== null && <div className={`${styles.standing} ${styles.fading}`}>{standing}</div>}
      <InfoBubble message={bubble} />
    </section>
  );
}

/** How long the sachet put back takes to leave, as `--swap-out` in the styles. */
const LEAVE_MS = 380;

/**
 * The sachet put back on a change of collection, as it was last drawn, while it slides away on
 * the side opposite to the new one. Only a phone shows it: on a wide screen it becomes the
 * sachet behind, which plays its own way back.
 */
function useLeavingSachet(
  id: string,
  sachet: ReactNode,
  entry: "left" | "right" | null,
): { readonly id: string; readonly node: ReactNode; readonly to: "left" | "right" } | null {
  const last = useRef({ id, node: sachet });
  const [shown, setShown] = useState(id);
  const [leaving, setLeaving] = useState<{
    readonly id: string;
    readonly node: ReactNode;
    readonly to: "left" | "right";
  } | null>(null);
  if (shown !== id) {
    setShown(id);
    setLeaving(
      entry === null
        ? null
        : {
            id: last.current.id,
            node: last.current.node,
            to: entry === "right" ? "left" : "right",
          },
    );
  }
  useEffect(() => {
    last.current = { id, node: sachet };
  });
  useEffect(() => {
    if (leaving === null) return;
    const timer = window.setTimeout(() => setLeaving(null), LEAVE_MS);
    return () => clearTimeout(timer);
  }, [leaving]);
  return leaving;
}

/** The tiles on both sides of the sachet; a closed one says the level that opens it. */
function Tiles({ say }: { readonly say: (text: string) => void }) {
  const view = usePlayerView();
  const shell = useShell();
  const router = useRouter();
  const daily = useShared(dailyChallenge);
  if (view.now === 0) return null;
  const { left, right } = playFabs(
    { level: view.progress?.level ?? 1, coffrets: view.rewardsWaiting, mail: view.mail },
    view.now,
  );
  const dailyLeft = daily !== null && dailyView(daily).ratio < 1;

  const act = (fab: FabModel) => {
    if (fab.lock !== null) {
      say(lockedToast(fab.id === "jousts" ? "jousts" : "join_clan", view.now));
      return;
    }
    switch (fab.id) {
      case "clan":
        router.push("/clan");
        return;
      case "jousts":
        router.push("/joutes");
        return;
      case "chat":
        shell.openChat();
        return;
      case "friends":
        router.push("/amis");
        return;
      case "daily":
        router.push("/defis");
        return;
      case "coffrets":
        shell.openRewards();
        return;
      case "mail":
        shell.openMail();
        return;
      case "settings":
        shell.openSettings();
        return;
    }
  };

  const column = (fabs: readonly FabModel[], className: string | undefined) => (
    <div className={`${className} ${styles.fading}`}>
      {fabs
        .filter((fab): fab is FabModel & { id: Exclude<FabId, "mail"> } => fab.id !== "mail")
        .map((fab) => (
          <SideTile
            key={fab.id}
            icon={TILES[fab.id].icon}
            matter={TILES[fab.id].matter}
            label={fab.label}
            badge={
              fab.badge > 0 ? String(fab.badge) : fab.id === "daily" && dailyLeft ? "!" : undefined
            }
            lockedAt={fab.lock ?? undefined}
            onClick={() => act(fab)}
          />
        ))}
    </div>
  );
  return (
    <>
      {column(left, styles.left)}
      {column(right, styles.right)}
    </>
  );
}
