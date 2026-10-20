"use client";

import type { CatalogCard } from "@leximon/contract";
import { rarityStyles } from "@leximon/tokens";
import {
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { Card } from "@/components/card";
import { CardBack } from "./card-back";
import { play, vibrate } from "./feedback";
import { cardRelease } from "./gesture";
import styles from "./reveal-card.module.css";
import type { RarityStaging } from "./staging";

/** A touch during the first moments of an announcement is ignored: it may be a double tap. */
const TOUCH_GUARD_MS = 350;
const EXIT_MS = 180;

interface RevealCardProps {
  readonly card: CatalogCard;
  readonly collectionName: string;
  readonly staging: RarityStaging;
  readonly width: number;
  readonly isNew: boolean;
  /** Copies owned once this one is added. */
  readonly copies: number;
  /** « Ta première Légendaire ! », or `null`. */
  readonly firstLabel: string | null;
  readonly onNext: () => void;
}

interface Drag {
  readonly pointerId: number;
  readonly startX: number;
  readonly startY: number;
  readonly dx: number;
  readonly dy: number;
}

/**
 * One card of the pack: its announcement on the back, then its face, then a swipe to the next.
 * Each rarity gets its own staging (staging.ts).
 */
export function RevealCard({
  card,
  collectionName,
  staging,
  width,
  isNew,
  copies,
  firstLabel,
  onNext,
}: RevealCardProps) {
  const [flipped, setFlipped] = useState(false);
  const [settled, setSettled] = useState(false);
  const [touchable, setTouchable] = useState(false);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [exit, setExit] = useState<-1 | 1 | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const flippedRef = useRef(false);
  const timers = useRef<number[]>([]);

  const later = (ms: number, action: () => void) => {
    timers.current.push(window.setTimeout(action, ms));
  };

  // Mount-time choreography only: each card is a fresh component (keyed by its position).
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs once per card on purpose
  useEffect(() => {
    if (staging.flip === "instant") {
      const frame = requestAnimationFrame(() => flip());
      return () => {
        cancelAnimationFrame(frame);
        for (const timer of timers.current) clearTimeout(timer);
      };
    }
    play(staging.announceCue);
    vibrate(staging.announceHaptic);
    if (staging.flip === "auto") later(staging.announceMs, flip);
    else later(Math.min(staging.announceMs, TOUCH_GUARD_MS), () => setTouchable(true));
    return () => {
      for (const timer of timers.current) clearTimeout(timer);
    };
  }, []);

  function flip() {
    if (flippedRef.current) return;
    flippedRef.current = true;
    setFlipped(true);
    play(staging.revealCue);
    vibrate(staging.revealHaptic);
    later(staging.flipMs, () => {
      setSettled(true);
      if (isNew) play("newCard");
    });
  }

  const leave = (direction: -1 | 1) => {
    if (exit !== null) return;
    play("cardSlide");
    setExit(direction);
    later(EXIT_MS, onNext);
  };

  const press = () => {
    if (!flipped) {
      if (staging.flip === "touch" && touchable) flip();
      return;
    }
    if (settled) leave(1);
  };

  const onPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (dragRef.current !== null) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const next = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY };
    dragRef.current = { ...next, dx: 0, dy: 0 };
  };

  const onPointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const current = dragRef.current;
    if (current === null || current.pointerId !== event.pointerId) return;
    const next = {
      ...current,
      dx: event.clientX - current.startX,
      dy: event.clientY - current.startY,
    };
    dragRef.current = next;
    if (settled) setDrag(next);
  };

  const onPointerUp = (event: PointerEvent<HTMLButtonElement>) => {
    const current = dragRef.current;
    if (current === null || current.pointerId !== event.pointerId) return;
    dragRef.current = null;
    setDrag(null);
    const release = cardRelease(current.dx, current.dy, width);
    if (release === "none") return;
    if (Math.abs(current.dx) < 8) press();
    else if (settled) leave(current.dx < 0 ? -1 : 1);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    press();
  };

  const turns = flipped ? (staging.spotlight ? 540 : 180) : 0;
  const shift = exit !== null ? exit * width * 1.4 : (drag?.dx ?? 0);
  const flipperStyle = {
    transform: `perspective(1100px) translateX(${shift}px) rotate(${shift / 20}deg) rotateY(${turns}deg) scale(${flipped && staging.spotlight ? 1.05 : 1})`,
    transitionDuration:
      exit !== null ? `${EXIT_MS}ms` : drag !== null ? "0ms" : `${staging.flipMs}ms`,
  } as CSSProperties;
  const glow = rarityStyles[card.rarity].glow;
  const announcing = !flipped && staging.announce !== "none";
  const height = (width * 420) / 300;

  return (
    <div className={styles.reveal}>
      {staging.dim && (
        <div
          className={staging.announce === "eclipse" ? styles.dimDeep : styles.dim}
          aria-hidden="true"
        />
      )}
      <p className={firstLabel !== null && settled ? styles.first : styles.firstHidden}>
        {firstLabel}
      </p>
      <div
        className={
          announcing && staging.announce === "eclipse"
            ? `${styles.stage} ${styles.floating}`
            : styles.stage
        }
        style={{ width, height }}
      >
        {flipped && glow !== null && (
          <div
            className={styles.glow}
            style={{ background: `radial-gradient(ellipse, ${glow} 0%, transparent 65%)` }}
            aria-hidden="true"
          />
        )}
        {flipped && staging.spotlight && <div className={styles.rays} aria-hidden="true" />}
        {announcing && staging.announce === "eclipse" && (
          <div className={styles.halo} aria-hidden="true" />
        )}
        <button
          type="button"
          className={`${styles.flipper} ${announcing ? styles[staging.announce] : ""}`}
          style={flipperStyle}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={() => {
            dragRef.current = null;
            setDrag(null);
          }}
          onKeyDown={onKeyDown}
          aria-label={flipped ? `${card.word}, carte suivante` : "Retourner la carte"}
        >
          <span className={styles.back}>
            <CardBack rarity={card.rarity} width={width} edge={announcing ? 1 : 0} />
            {announcing && staging.announce === "crack" && <Cracks />}
          </span>
          <span className={styles.front}>
            <Card card={card} collectionName={collectionName} width={width} />
          </span>
        </button>
        {flipped && (staging.announce === "crack" || staging.announce === "eclipse") && (
          <Particles kind={staging.announce === "crack" ? "gold" : "sparkle"} />
        )}
        {settled && isNew && <span className={styles.newBadge}>Nouveau !</span>}
        {settled && !isNew && <span className={styles.copies}>×{copies}</span>}
      </div>
      {!flipped && staging.flip === "touch" && touchable && (
        <p className={styles.touchHint}>Touche la carte</p>
      )}
      {settled && staging.spotlight && <ShareButton word={card.word} />}
    </div>
  );
}

/**
 * Shares a Légendaire: through the phone's share sheet where there is one, or by copying the
 * text. A link to the card's own public page will replace the site's address once it exists.
 */
function ShareButton({ word }: { readonly word: string }) {
  const [copied, setCopied] = useState(false);
  const share = async () => {
    const text = `J'ai trouvé une carte Légendaire sur Leximon : « ${word} » !`;
    const url = window.location.origin;
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title: "Leximon", text, url });
        return;
      }
      await navigator.clipboard.writeText(`${text} ${url}`);
      setCopied(true);
    } catch {
      // Share sheet closed by the player, or clipboard refused: nothing to report.
    }
  };
  return (
    <button type="button" className={styles.share} onClick={() => void share()}>
      {copied ? "Copié !" : "Partager"}
    </button>
  );
}

/** Gold cracks drawn on the back of an Épique before it turns. */
function Cracks() {
  return (
    <svg className={styles.cracks} viewBox="0 0 300 420" aria-hidden="true">
      <polyline points="150,210 128,168 136,130 112,92 118,40" />
      <polyline points="150,210 184,188 206,150 246,138 280,96" />
      <polyline points="150,210 170,252 160,296 188,340 180,392" />
      <polyline points="150,210 110,236 82,232 52,270 20,282" />
      <polyline points="136,130 168,112" />
      <polyline points="170,252 214,262" />
    </svg>
  );
}

const PARTICLE_COUNT = 18;

/** Gold dust or sparkles around the card. Positions are fixed, so every render matches. */
function Particles({ kind }: { readonly kind: "gold" | "sparkle" }) {
  return (
    <div className={styles.particles} aria-hidden="true">
      {Array.from({ length: PARTICLE_COUNT }, (_, index) => {
        const style = {
          left: `${(index * 53) % 100}%`,
          top: `${(index * 31 + 7) % 90}%`,
          animationDelay: `${(index * 97) % 900}ms`,
          scale: `${0.6 + ((index * 17) % 10) / 10}`,
        } as CSSProperties;
        return (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed set of decorative particles
            key={index}
            className={kind === "gold" ? styles.dust : styles.sparkle}
            style={style}
          />
        );
      })}
    </div>
  );
}
