"use client";

import {
  advance,
  type BurstSettings,
  drawIn,
  easings,
  effects,
  emit,
  intensity,
  opacityOf,
  type Particle,
  particleCap,
  type RevealEffect,
  sizeOf,
} from "@leximon/tokens";
import { createContext, type ReactNode, useContext, useEffect, useMemo, useRef } from "react";
import styles from "./stage.module.css";

/** What a screen may set off over everything else: particles, a flash, a ring, a shake. */
export interface Stage {
  readonly burst: (x: number, y: number, settings: BurstSettings) => void;
  /** Light converging on a point, for `ms`. */
  readonly drawIn: (x: number, y: number, colors: readonly string[], ms: number) => void;
  /** Leaves falling from the top of the screen. */
  readonly rain: (count: number) => void;
  readonly flash: (opacity: number, ms: number) => void;
  /** A ring of light growing from a point, to `scale` times its size. */
  readonly ring: (x: number, y: number, color: string, scale: number) => void;
  readonly shake: (element: HTMLElement, strength: number, ms: number) => void;
  /** Everything a card's face does as it turns, centered on the card. */
  readonly reveal: (
    x: number,
    y: number,
    effect: RevealEffect,
    color: string,
    shaken: HTMLElement,
  ) => void;
}

const StageContext = createContext<Stage | null>(null);

export function useStage(): Stage {
  const stage = useContext(StageContext);
  if (stage === null) throw new Error("useStage outside of a ParticleStage");
  return stage;
}

/** The stage of the screen, or null where none is drawn (the current look). */
export function useOptionalStage(): Stage | null {
  return useContext(StageContext);
}

const CURVE = `cubic-bezier(${easings.settle.join(", ")})`;

function reducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function between([low, high]: readonly [number, number]): number {
  return low + Math.random() * (high - low);
}

/** One mote of dust rising slowly through the lamplight, then gone. */
function floatMote(layer: HTMLElement): void {
  const { burst } = effects.dust;
  const mote = document.createElement("span");
  const size = between(burst.size) * 6;
  const life = between(burst.life) * 1000;
  const angle = between(burst.angle ?? [-Math.PI / 2, -Math.PI / 2]);
  const travel = (between(burst.speed) * life) / 1000;
  const dx = Math.cos(angle) * travel;
  const dy = Math.sin(angle) * travel;
  const sway = (burst.sway ?? 0) * (Math.random() < 0.5 ? -1 : 1);
  mote.style.left = `${20 + Math.random() * 60}%`;
  mote.style.top = `${20 + Math.random() * 50}%`;
  mote.style.width = `${size}px`;
  mote.style.height = `${size}px`;
  mote.style.background = `radial-gradient(closest-side, ${burst.colors[0]} 25%, transparent)`;
  layer.append(mote);
  mote
    .animate(
      [
        { opacity: 0, transform: "translate(0, 0)" },
        { opacity: 1, transform: `translate(${dx / 2 + sway}px, ${dy / 2}px)`, offset: 0.3 },
        { opacity: 0, transform: `translate(${dx}px, ${dy}px)` },
      ],
      { duration: life, easing: "linear" },
    )
    .finished.then(
      () => mote.remove(),
      () => mote.remove(),
    );
}

/** How far a particle's drawing reaches from its centre, to wipe only where it was. */
function reachOf(particle: Particle): number {
  const size = sizeOf(particle);
  if (particle.kind === "glow") return size * 3 + 2;
  if (particle.kind === "spark") return Math.hypot(particle.vx, particle.vy) * 0.045 + size + 2;
  return size + 2;
}

function draw(context: CanvasRenderingContext2D, particle: Particle): void {
  const size = sizeOf(particle);
  context.save();
  context.translate(particle.x, particle.y);
  context.globalAlpha = Math.max(0, opacityOf(particle));
  if (particle.kind === "glow") {
    context.globalCompositeOperation = "lighter";
    const radius = size * 3;
    const gradient = context.createRadialGradient(0, 0, 0, 0, 0, radius);
    gradient.addColorStop(0, particle.color);
    gradient.addColorStop(0.25, particle.color);
    gradient.addColorStop(1, "transparent");
    context.fillStyle = gradient;
    context.beginPath();
    context.arc(0, 0, radius, 0, Math.PI * 2);
    context.fill();
  } else if (particle.kind === "spark") {
    context.globalCompositeOperation = "lighter";
    context.strokeStyle = particle.color;
    context.lineWidth = size;
    context.lineCap = "round";
    context.beginPath();
    context.moveTo(0, 0);
    context.lineTo(-particle.vx * 0.045, -particle.vy * 0.045);
    context.stroke();
  } else if (particle.kind === "star") {
    context.globalCompositeOperation = "lighter";
    context.rotate(particle.turn * 0.3);
    const outer = size * (0.75 + 0.25 * Math.sin(particle.flip));
    context.fillStyle = particle.color;
    context.beginPath();
    for (let point = 0; point < 8; point++) {
      const radius = point % 2 === 1 ? outer * 0.28 : outer;
      const angle = (point / 8) * Math.PI * 2;
      context.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
    }
    context.closePath();
    context.fill();
  } else {
    context.rotate(particle.turn);
    context.scale(Math.cos(particle.flip), 1);
    context.fillStyle = particle.color;
    context.beginPath();
    context.moveTo(-size, 0);
    context.quadraticCurveTo(0, -size * 0.7, size, 0);
    context.quadraticCurveTo(0, size * 0.7, -size, 0);
    context.fill();
  }
  context.restore();
}

/**
 * The layer over the whole window where the light of « La Bibliothèque » is drawn. It runs only
 * while something moves on it, and draws nothing for a player who asks for reduced motion.
 */
export function ParticleStage({
  dust = false,
  children,
}: {
  /** Motes drifting in the lamplight, while this stage is shown. */
  readonly dust?: boolean;
  readonly children: ReactNode;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const flashLayer = useRef<HTMLDivElement>(null);
  const ringLayer = useRef<HTMLDivElement>(null);
  const dustLayer = useRef<HTMLDivElement>(null);
  const engine = useRef<{ wake: () => void; particles: Particle[] } | null>(null);

  useEffect(() => {
    const element = canvas.current;
    const context = element?.getContext("2d");
    if (element === null || element === undefined || context === null || context === undefined) {
      return;
    }
    const particles: Particle[] = [];
    // Where the last frame drew: only these squares are wiped, not the whole window.
    let drawn: { x: number; y: number; reach: number }[] = [];
    let frame = 0;
    let last = 0;
    let width = 0;
    let height = 0;
    const state = { particles, wake };
    engine.current = state;

    function resize() {
      if (element === null) return;
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      element.width = width * ratio;
      element.height = height * ratio;
      context?.setTransform(ratio, 0, 0, ratio, 0, 0);
      drawn = [];
    }

    function tick(now: number) {
      // A frame after a pause would move everything at once.
      const seconds = Math.min((now - last) / 1000, 0.05);
      last = now;
      advance(particles, seconds);
      if (context) {
        for (const spot of drawn) {
          context.clearRect(
            spot.x - spot.reach,
            spot.y - spot.reach,
            spot.reach * 2,
            spot.reach * 2,
          );
        }
        drawn = particles.map((particle) => ({
          x: particle.x,
          y: particle.y,
          reach: reachOf(particle),
        }));
        for (const particle of particles) draw(context, particle);
      }
      frame = particles.length > 0 ? requestAnimationFrame(tick) : 0;
    }

    function wake() {
      if (frame !== 0 || reducedMotion()) return;
      last = performance.now();
      frame = requestAnimationFrame(tick);
    }

    resize();
    window.addEventListener("resize", resize);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      engine.current = null;
    };
  }, []);

  // The motes are elements the compositor moves on its own: drawn on the canvas, a few specks
  // of dust redrew a window-sized layer on every frame and kept the whole screen busy.
  useEffect(() => {
    const layer = dustLayer.current;
    if (!dust || layer === null || reducedMotion()) return;
    const timer = window.setInterval(() => floatMote(layer), 1000 / effects.dust.perSecond);
    return () => {
      window.clearInterval(timer);
      layer.replaceChildren();
    };
  }, [dust]);

  const stage = useMemo<Stage>(() => {
    const burst = (x: number, y: number, settings: BurstSettings) => {
      const state = engine.current;
      if (state === null || reducedMotion()) return;
      emit(state.particles, x, y, settings, particleCap.web);
      state.wake();
    };
    const rain = (count: number) => {
      const half = window.innerWidth / 2;
      burst(half, -20, { ...effects.rain, count, spread: half });
    };
    const flash = (opacity: number, ms: number) => {
      if (reducedMotion()) return;
      flashLayer.current?.animate([{ opacity: opacity * intensity }, { opacity: 0 }], {
        duration: ms,
        easing: "ease-out",
      });
    };
    const ring = (x: number, y: number, color: string, scale: number) => {
      const layer = ringLayer.current;
      if (layer === null || reducedMotion()) return;
      layer.style.left = `${x}px`;
      layer.style.top = `${y}px`;
      layer.style.setProperty("--ring", color);
      layer.animate(
        [
          { transform: "translate(-50%, -50%) scale(.2)", opacity: 1 },
          { transform: `translate(-50%, -50%) scale(${scale})`, opacity: 0 },
        ],
        { duration: 650, easing: CURVE },
      );
    };
    const shake = (element: HTMLElement, strength: number, ms: number) => {
      if (reducedMotion()) return;
      const frames: Keyframe[] = [];
      for (let step = 0; step <= 10; step++) {
        const reach = strength * intensity * (1 - step / 10);
        const dx = (Math.random() * 2 - 1) * reach;
        const dy = (Math.random() * 2 - 1) * reach;
        frames.push({ translate: `${dx}px ${dy}px`, rotate: `${dx * 0.12}deg` });
      }
      frames.push({ translate: "0 0", rotate: "0deg" });
      element.animate(frames, { duration: ms, easing: "linear" });
    };
    return {
      burst,
      rain,
      flash,
      ring,
      shake,
      drawIn: (x, y, colors, ms) => {
        const state = engine.current;
        if (state === null || reducedMotion()) return;
        const timer = window.setInterval(() => {
          drawIn(state.particles, x, y, colors, 3, particleCap.web);
          state.wake();
        }, 60);
        window.setTimeout(() => window.clearInterval(timer), ms);
      },
      reveal: (x, y, effect, color, shaken) => {
        for (const settings of effect.bursts) burst(x, y, settings);
        if (effect.rain > 0) rain(effect.rain);
        if (effect.ring > 0) ring(x, y, color, effect.ring);
        if (effect.flash !== null) flash(effect.flash.opacity, effect.flash.ms);
        if (effect.shake !== null) shake(shaken, effect.shake.strength, effect.shake.ms);
      },
    };
  }, []);

  return (
    <StageContext value={stage}>
      {children}
      <div ref={flashLayer} className={styles.flash} aria-hidden="true" />
      <div ref={ringLayer} className={styles.ring} aria-hidden="true" />
      <div ref={dustLayer} className={styles.dust} aria-hidden="true" />
      <canvas ref={canvas} className={styles.canvas} />
    </StageContext>
  );
}
