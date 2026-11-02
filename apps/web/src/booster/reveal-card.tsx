"use client";

import { type CatalogCard, RARITY_LABELS } from "@leximon/contract";
import { rarityLights, rarityStyles, revealBanner, revealEffects } from "@leximon/tokens";
import type { RarityStaging } from "@leximon/view-model";
import { cardRelease, frequencyLine, speechToggleLabel } from "@leximon/view-model";
import {
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { useCardShare } from "@/cards/share-card";
import { type SpokenWord, useSpokenWord } from "@/cards/use-spoken-word";
import { HoloCard } from "@/components/holo-card";
import { useHoloLight } from "@/components/use-holo-light";
import { Aura, RarityBanner, Rays, Sheen } from "@/library/reveal-pieces";
import { Icon } from "@/ui/icon";
import type { Stage } from "@/ui/stage";
import { CardBack } from "./card-back";
import { play, readPreference, speechOn, vibrate, writePreference } from "./feedback";
import styles from "./reveal-card.module.css";

/** A touch during the first moments of an announcement is ignored: it may be a double tap. */
const TOUCH_GUARD_MS = 350;
const EXIT_MS = 180;
/** The word is said as the face settles, just after the « Nouveau ! » chime when there is one. */
const SPEAK_AFTER_CHIME_MS = 220;

interface RevealCardProps {
  readonly card: CatalogCard;
  readonly collectionName: string;
  readonly staging: RarityStaging;
  readonly width: number;
  readonly isNew: boolean;
  /** Copies owned once this one is added. */
  readonly copies: number;
  /** « Ta première carte Légendaire ! », or `null`. */
  readonly firstLabel: string | null;
  readonly onNext: () => void;
  /** The `back` of the pack's collection. */
  readonly backTone?: string | undefined;
  /**
   * In « La Bibliothèque », where its light is drawn: the rarity glows behind the card while it
   * is announced, then sparks, rays and its name come as the face shows.
   */
  readonly stage?: Stage | null;
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
  backTone,
  stage = null,
}: RevealCardProps) {
  const [flipped, setFlipped] = useState(false);
  const [settled, setSettled] = useState(false);
  const [touchable, setTouchable] = useState(false);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [exit, setExit] = useState<-1 | 1 | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const light = useHoloLight(settled);
  const flippedRef = useRef(false);
  const timers = useRef<number[]>([]);
  const word = useSpokenWord(card);
  const flipper = useRef<HTMLButtonElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const [drawing, setDrawing] = useState(false);
  const [sweep, setSweep] = useState(0);
  const [stamp, setStamp] = useState(0);
  const effect = revealEffects[card.rarity];
  const rarityLight = rarityLights[card.rarity][0] ?? "white";
  const banner = revealBanner[card.rarity];

  const center = () => {
    const box = flipper.current?.getBoundingClientRect();
    return box === undefined ? null : { x: box.left + box.width / 2, y: box.top + box.height / 2 };
  };

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
    if (stage !== null) {
      later(staging.flipMs / 2, () => {
        const point = center();
        if (point !== null) {
          stage.reveal(point.x, point.y, effect, rarityLight, root.current ?? document.body);
        }
        setSweep((value) => value + 1);
        if (banner !== undefined) setStamp((value) => value + 1);
      });
    }
    later(staging.flipMs, () => {
      setSettled(true);
      if (isNew) play("newCard");
      if (!speechOn()) return;
      if (isNew) later(SPEAK_AFTER_CHIME_MS, word.play);
      else word.play();
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
      if (staging.flip !== "touch" || !touchable || drawing) return;
      const point = center();
      if (stage === null || effect.drawInMs === 0 || point === null || prefersReducedMotion()) {
        flip();
        return;
      }
      // The light of the room is drawn into the card before it turns.
      setDrawing(true);
      stage.drawIn(point.x, point.y, rarityLights[card.rarity], effect.drawInMs);
      later(effect.drawInMs, () => {
        setDrawing(false);
        flip();
      });
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
    light.onPointerMove(event);
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
  const library = stage !== null;
  const auraStrength = announcing ? 0.9 : !flipped ? 0 : card.rarity === "common" ? 0.25 : 0.6;

  return (
    <div ref={root} className={library ? `${styles.reveal} ${styles.library}` : styles.reveal}>
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
        ref={light.ref}
      >
        {library && <Aura size={width * 2.4} color={rarityLight} strength={auraStrength} />}
        {library && <Rays size={width * 2.8} color={rarityLight} shown={flipped && effect.rays} />}
        {!library && flipped && glow !== null && (
          <div
            className={styles.glow}
            style={{ background: `radial-gradient(ellipse, ${glow} 0%, transparent 65%)` }}
            aria-hidden="true"
          />
        )}
        {!library && flipped && staging.spotlight && (
          <div className={styles.rays} aria-hidden="true" />
        )}
        {!library && announcing && staging.announce === "eclipse" && (
          <div className={styles.halo} aria-hidden="true" />
        )}
        <button
          ref={flipper}
          type="button"
          className={`${styles.flipper} ${announcing ? styles[staging.announce] : ""} ${drawing ? styles.drawing : ""}`}
          style={flipperStyle}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={() => {
            dragRef.current = null;
            setDrag(null);
          }}
          onPointerLeave={light.onPointerLeave}
          onKeyDown={onKeyDown}
          aria-label={flipped ? `${card.word}, carte suivante` : "Retourner la carte"}
        >
          <span className={styles.back}>
            <CardBack
              rarity={card.rarity}
              width={width}
              edge={announcing ? 1 : 0}
              tone={backTone}
            />
            {announcing && staging.announce === "crack" && <Cracks />}
          </span>
          <span className={styles.front}>
            <HoloCard card={card} collectionName={collectionName} width={width} />
            {library && (
              <span className={styles.sheen}>
                <Sheen sweep={sweep} />
              </span>
            )}
          </span>
        </button>
        {!library &&
          flipped &&
          (staging.announce === "crack" || staging.announce === "eclipse") && (
            <Particles kind={staging.announce === "crack" ? "gold" : "sparkle"} />
          )}
        {library && banner !== undefined && (
          <RarityBanner text={RARITY_LABELS[card.rarity]} color={banner} stamp={stamp} />
        )}
        {settled && isNew && <span className={styles.newBadge}>Nouveau !</span>}
        {settled && !isNew && <span className={styles.copies}>×{copies}</span>}
      </div>
      <p className={styles.under}>
        {!flipped && staging.flip === "touch" && touchable && (
          <span className={styles.touchHint}>Touche la carte</span>
        )}
        {settled && word.available && (
          <button
            type="button"
            className={word.playing ? `${styles.listen} ${styles.listening}` : styles.listen}
            onClick={word.play}
            aria-label={`Écouter ${card.word}`}
          >
            <Icon name="play" size={18} />
          </button>
        )}
        {settled && word.available && <SpeechToggle word={word} />}
        {settled && isNew && (
          <span className={styles.frequency}>{frequencyLine(card.perBillion)}</span>
        )}
      </p>
      {settled && staging.spotlight && <ShareButton card={card} />}
    </div>
  );
}

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Stops the words from being said, this one included, through the setting of the same name.
 * With all sounds off nothing is said anyway: nothing to offer.
 */
function SpeechToggle({ word }: { readonly word: SpokenWord }) {
  const [on, setOn] = useState(() => readPreference("speech"));
  if (!readPreference("sound")) return null;
  const toggle = () => {
    writePreference("speech", !on);
    setOn(!on);
    if (on) word.stop();
  };
  return (
    <button
      type="button"
      className={styles.listen}
      onClick={toggle}
      aria-label={speechToggleLabel(on)}
    >
      <Icon name={on ? "sound" : "soundOff"} size={18} />
    </button>
  );
}

/**
 * Shares a Légendaire with the link to its public page: through the phone's share sheet where
 * there is one, or by copying the text and the link.
 */
function ShareButton({ card }: { readonly card: CatalogCard }) {
  const [label, setLabel] = useState("Partager");
  const sharing = useCardShare(card);
  const share = async () => {
    const outcome = await sharing.share();
    if (outcome.kind === "copied") setLabel("Copié");
    if (outcome.kind === "failed") setLabel("Copie refusée");
  };
  return (
    <button
      type="button"
      className={styles.share}
      onPointerEnter={sharing.prepare}
      onPointerDown={sharing.prepare}
      onFocus={sharing.prepare}
      onClick={() => void share()}
    >
      {label}
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
