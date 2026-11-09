"use client";

import { stockToyInks, type ToyIconName, type ToyMatterName } from "@leximon/tokens";
import { type MouseEvent, type ReactNode, useEffect, useRef } from "react";
import { LevelMedal } from "@/ui/level-bits";
import { Tooling } from "@/ui/ornaments";
import { Kicker, Lettering, Lettrine, Toy, ToyBody, ToyIcon } from "@/ui/toy";
import styles from "./play-pieces.module.css";

/**
 * The pieces of the Jouer screen in « La Bibliothèque ». They know nothing of the game: each
 * screen gives them their words and figures, so that the same pieces serve every state.
 */

export type DeskTone = "emeraude" | "nuit" | "velours" | "ardoise" | "acajou" | "ambre";

const COLLECTION_TONES: Readonly<Record<string, DeskTone>> = {
  fondateurs: "nuit",
  "betes-plantes": "emeraude",
  metiers: "ardoise",
  caracteres: "velours",
};

/**
 * The tooled desk under the lamp, with aged 3D two-tone diamonds whose hue matches the
 * collection on the counter.
 */
export function Desk({
  className,
  collectionId,
}: {
  readonly className?: string | undefined;
  readonly collectionId?: string | undefined;
}) {
  const tone: DeskTone =
    (collectionId !== undefined ? COLLECTION_TONES[collectionId] : undefined) ?? "emeraude";
  return (
    <div
      className={[styles.desk, className].filter(Boolean).join(" ")}
      data-tone={tone}
      aria-hidden="true"
    >
      <Tooling />
    </div>
  );
}

/** A red count of what waits for the player, which nudges now and then. */
export function CountBadge({
  count,
  className,
}: {
  readonly count: string;
  readonly className?: string | undefined;
}) {
  return (
    <ToyBody
      matter="alert"
      shape="tag"
      className={[styles.badge, className].filter(Boolean).join(" ")}
    >
      <Lettering>{count}</Lettering>
    </ToyBody>
  );
}

/** The player's portrait, which opens their profile. */
export function PortraitButton({
  label,
  children,
  onClick,
}: {
  readonly label: string;
  readonly children: ReactNode;
  readonly onClick?: () => void;
}) {
  return (
    <Toy matter="paper" className={styles.portrait} aria-label={label} onClick={onClick}>
      <span className={styles.portraitFrame}>{children}</span>
    </Toy>
  );
}

/** The level as its gilt medal, and the experience toward the next one as a gilt bar. */
export function LevelGauge({
  level,
  progress,
  label,
}: {
  readonly level: number;
  /** From 0 to 1. */
  readonly progress: number;
  readonly label: string;
}) {
  const filled = Math.min(1, Math.max(0, progress));
  return (
    <div className={styles.level}>
      <span className={styles.medal}>
        <LevelMedal level={level} size={46} />
      </span>
      <span className={styles.xp}>
        <span className={styles.xpFill} style={{ width: `${filled * 100}%` }} />
        <Lettering className={styles.xpText}>{label}</Lettering>
      </span>
    </div>
  );
}

/** Sachets in stock, which opens their detail. */
export function StockButton({
  label,
  figure,
  onClick,
}: {
  readonly label: string;
  readonly figure: string;
  readonly onClick?: () => void;
}) {
  return (
    <Toy matter="paper" className={styles.stock} aria-label={label} onClick={onClick}>
      <ToyIcon name="sachet" size={30} inks={stockToyInks} />
      <Lettering className={styles.stockFigure}>{figure}</Lettering>
    </Toy>
  );
}

/** The player's écus, which opens what they are for. */
export function EcusButton({
  label,
  figure,
  onClick,
}: {
  readonly label: string;
  readonly figure: string;
  readonly onClick?: () => void;
}) {
  return (
    <Toy matter="paper" className={styles.stock} aria-label={label} onClick={onClick}>
      <ToyIcon name="ecu" size={30} />
      <Lettering className={styles.stockFigure}>{figure}</Lettering>
    </Toy>
  );
}

/** The mail, with what waits in it. */
export function MailButton({
  label,
  count,
  onClick,
}: {
  readonly label: string;
  readonly count: number;
  readonly onClick?: () => void;
}) {
  return (
    <Toy matter="red" className={styles.mail} aria-label={label} onClick={onClick}>
      <ToyIcon name="mail" size={30} />
      {count > 0 && <CountBadge count={String(count)} className={styles.corner} />}
    </Toy>
  );
}

/** One of the tiles beside the sachet: its leather, its icon, and a lock until its level. */
export function SideTile({
  icon,
  matter,
  label,
  badge,
  lockedAt,
  onClick,
}: {
  readonly icon: ToyIconName;
  readonly matter: ToyMatterName;
  readonly label: string;
  readonly badge?: string | undefined;
  /** The level that opens it, while it is closed. */
  readonly lockedAt?: string | undefined;
  readonly onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
}) {
  const locked = lockedAt !== undefined;
  return (
    <div className={styles.side}>
      <Toy
        matter={locked ? "locked" : "gold"}
        shape="tile"
        className={styles.tile}
        aria-label={locked ? `${label}, ${lockedAt}` : label}
        onClick={onClick}
      >
        <Lettrine icon={icon} matter={matter} size={34} locked={locked} />
        {locked && (
          <span className={styles.lockPin}>
            <ToyIcon name="lock" size={26} />
          </span>
        )}
        {!locked && badge !== undefined && <CountBadge count={badge} className={styles.corner} />}
      </Toy>
      {locked && (
        <ToyBody matter="dark" shape="tag" className={styles.levelTag}>
          <Lettering>{lockedAt}</Lettering>
        </ToyBody>
      )}
      <Lettering className={styles.sideLabel}>{label}</Lettering>
    </div>
  );
}

/**
 * The collection on the desk, with arrows to the others and a dot for each. `pager={false}` leaves
 * the arrows and the dots to a `CollectionPager` placed elsewhere.
 */
export function CollectionTitle({
  kicker,
  name,
  tagline,
  index,
  count,
  previousLabel,
  nextLabel,
  onPrevious,
  onNext,
  pager = true,
}: {
  readonly kicker: string;
  readonly name: string;
  readonly tagline: string;
  readonly index: number;
  readonly count: number;
  readonly previousLabel: string;
  readonly nextLabel: string;
  readonly onPrevious?: () => void;
  readonly onNext?: () => void;
  readonly pager?: boolean;
}) {
  return (
    <div className={styles.collection}>
      <div className={styles.collectionRow}>
        {pager && <PagerArrow label={previousLabel} onClick={onPrevious} />}
        <div className={styles.collectionName}>
          <Kicker>{kicker}</Kicker>
          <Lettering className={styles.name}>{name}</Lettering>
          {pager && <PagerDots index={index} count={count} />}
        </div>
        {pager && <PagerArrow label={nextLabel} next onClick={onNext} />}
      </div>
      <p className={styles.tagline}>{tagline}</p>
    </div>
  );
}

/** The arrows to the other collections and a dot for each, apart from the collection's name. */
export function CollectionPager({
  index,
  count,
  previousLabel,
  nextLabel,
  onPrevious,
  onNext,
}: {
  readonly index: number;
  readonly count: number;
  readonly previousLabel: string;
  readonly nextLabel: string;
  readonly onPrevious?: () => void;
  readonly onNext?: () => void;
}) {
  return (
    <div className={styles.pager}>
      <PagerArrow label={previousLabel} onClick={onPrevious} />
      <PagerDots index={index} count={count} />
      <PagerArrow label={nextLabel} next onClick={onNext} />
    </div>
  );
}

function PagerArrow({
  label,
  next = false,
  onClick,
}: {
  readonly label: string;
  readonly next?: boolean;
  readonly onClick?: (() => void) | undefined;
}) {
  return (
    <Toy matter="paper" className={styles.arrow} aria-label={label} onClick={onClick}>
      {next ? (
        <span className={styles.flipped}>
          <ToyIcon name="arrow" size={26} />
        </span>
      ) : (
        <ToyIcon name="arrow" size={26} />
      )}
    </Toy>
  );
}

function PagerDots({ index, count }: { readonly index: number; readonly count: number }) {
  return (
    <span className={styles.dots} aria-hidden="true">
      {Array.from({ length: count }, (_, dot) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: one dot per place, which never moves
        <i key={dot} className={dot === index ? styles.dotOn : styles.dot} />
      ))}
    </span>
  );
}

/** The main action, in old gold, which invites a press every few seconds while it waits. */
export function MainAction({
  label,
  count,
  inviting = true,
  disabled = false,
  onClick,
}: {
  readonly label: string;
  readonly count?: string | undefined;
  readonly inviting?: boolean;
  readonly disabled?: boolean;
  readonly onClick?: () => void;
}) {
  return (
    <Toy
      matter="gold"
      large
      className={inviting && !disabled ? `${styles.main} ${styles.inviting}` : styles.main}
      disabled={disabled}
      onClick={onClick}
    >
      <Lettering className={styles.mainLabel}>{label}</Lettering>
      {count !== undefined && (
        <ToyBody matter="red" shape="round" className={styles.mainCount}>
          <Lettering>{count}</Lettering>
        </ToyBody>
      )}
    </Toy>
  );
}

/** A secondary action, in paper. */
export function PaperAction({
  label,
  onClick,
}: {
  readonly label: string;
  readonly onClick?: () => void;
}) {
  return (
    <Toy matter="paper" className={styles.paperAction} onClick={onClick}>
      <Lettering>{label}</Lettering>
    </Toy>
  );
}

export interface Tab {
  readonly icon: ToyIconName;
  readonly label: string;
  readonly badge?: string | undefined;
  /** Why it is closed, said when it is touched. */
  readonly lockedAt?: string | undefined;
}

/**
 * The shelf of tabs: two on each side and Jouer in the middle, higher than the others, in gold.
 */
export function TabBar({
  tabs,
  playLabel,
  current = null,
  onTab,
  onPlay,
  className,
}: {
  readonly tabs: readonly [Tab, Tab, Tab, Tab];
  readonly playLabel: string;
  /** The tab of the screen shown, `play` for Jouer; null on a screen that is no tab. */
  readonly current?: number | "play" | null;
  readonly onTab?: (index: number) => void;
  readonly onPlay?: () => void;
  readonly className?: string | undefined;
}) {
  const [first, second, third, fourth] = tabs;
  const tab = (item: Tab, index: number) => (
    <button
      key={item.label}
      type="button"
      className={styles.tab}
      aria-label={item.lockedAt === undefined ? item.label : `${item.label}, ${item.lockedAt}`}
      aria-current={current === index ? "page" : undefined}
      onClick={() => onTab?.(index)}
    >
      <span className={item.lockedAt === undefined ? styles.tabIcon : styles.tabIconLocked}>
        <ToyIcon name={item.icon} size={34} />
        {item.lockedAt !== undefined && (
          <span className={styles.tabLock}>
            <ToyIcon name="lock" size={19} />
          </span>
        )}
        {item.badge !== undefined && <CountBadge count={item.badge} className={styles.tabBadge} />}
      </span>
      <Lettering className={styles.tabLabel}>{item.label}</Lettering>
    </button>
  );
  return (
    <nav
      aria-label="Navigation principale"
      className={[styles.tabs, className].filter(Boolean).join(" ")}
    >
      {tab(first, 0)}
      {tab(second, 1)}
      <div className={styles.playTab}>
        <Toy
          matter="gold"
          large
          className={styles.playDisc}
          aria-label={playLabel}
          aria-current={current === "play" ? "page" : undefined}
          onClick={onPlay}
        >
          <ToyIcon name="sachet" size={46} />
        </Toy>
        <Lettering className={`${styles.tabLabel} ${styles.playLabel}`}>{playLabel}</Lettering>
      </div>
      {tab(third, 2)}
      {tab(fourth, 3)}
    </nav>
  );
}

/**
 * A short message on a slip of paper, which pops in and leaves on its own. A new `message`
 * object shows it again, even with the same words.
 */
export function InfoBubble({ message }: { readonly message: { readonly text: string } | null }) {
  const bubble = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (message === null) return;
    bubble.current?.animate(
      [
        { opacity: 0, scale: 0.6 },
        { opacity: 1, scale: 1.08, offset: 0.08 },
        { opacity: 1, scale: 1, offset: 0.14 },
        { opacity: 1, scale: 1, offset: 0.85 },
        { opacity: 0, scale: 0.9 },
      ],
      { duration: 2200, easing: "ease-out" },
    );
  }, [message]);
  return (
    <p ref={bubble} className={styles.bubble} role="status">
      {message?.text}
    </p>
  );
}
