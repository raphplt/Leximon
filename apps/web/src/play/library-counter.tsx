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
  sachetContents,
} from "@leximon/view-model";
import { useRouter } from "next/navigation";
import { type ReactNode, type RefObject, useState } from "react";
import type { PackCollection } from "@/booster/pack-looks";
import { CollectionTitle, Desk, InfoBubble, MainAction, SideTile } from "@/library/play-pieces";
import { LibrarySachet, type LibrarySachetState } from "@/library/sachet";
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
  readonly pack: PackCollection;
  readonly stock: StockView | null;
  /** Sachets the player may still open, for the count on the button; null to show none. */
  readonly left: number | null;
  readonly canOpen: boolean;
  readonly moment: CounterMoment;
  /** Where the particles of the opening start: the sachet. */
  readonly sachetRef: RefObject<HTMLDivElement | null>;
  readonly onPick: (next: CollectionChoice) => void;
  readonly onOpen: () => void;
  /** Under the button: the account to create, an error, the last sachet without an account. */
  readonly footer: ReactNode;
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
  pack,
  stock,
  left,
  canOpen,
  moment,
  sachetRef,
  onPick,
  onOpen,
  footer,
}: LibraryCounterProps) {
  const view = usePlayerView();
  const [bubble, setBubble] = useState<{ readonly text: string } | null>(null);
  const say = (text: string) => setBubble({ text });
  const opening = moment !== "waiting";

  const turn = (side: "left" | "right") => {
    const next = neighbours[side];
    if (next === null || opening) return;
    if (next.lock !== null) say(lockedToast("choose_collection", view.now));
    else onPick(next);
  };
  const state: LibrarySachetState =
    moment === "charging"
      ? "charging"
      : moment === "burst"
        ? "burst"
        : canOpen
          ? "sealed"
          : "empty";

  return (
    <section className={styles.screen} data-opening={opening || undefined} aria-label="Ton sachet">
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
          <LibrarySachet
            key={pack.id}
            collection={pack}
            label="Ouvrir le sachet"
            countLabel={view.now === 0 ? "" : sachetContents(view.now)}
            state={state}
            onOpen={onOpen}
          />
        </div>
      </div>
      <div className={`${styles.cta} ${styles.fading}`}>
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
      <InfoBubble message={bubble} />
    </section>
  );
}

/** The tiles on both sides of the sachet; a closed one says the level that opens it. */
function Tiles({ say }: { readonly say: (text: string) => void }) {
  const view = usePlayerView();
  const shell = useShell();
  const router = useRouter();
  const daily = useShared(dailyChallenge);
  if (view.now === 0) return null;
  const { left, right } = playFabs(
    { level: view.progress?.level ?? 1, coffrets: view.coffrets.length, mail: view.mail },
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
        shell.openCoffret();
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
