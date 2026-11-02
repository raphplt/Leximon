import { type BurstSettings, intensity, type ParticleKind, type Range } from "./effects";

/**
 * How particles move, shared by the web's canvas and the phone's Skia. Plain functions over a
 * plain array, mutated in place: the phone runs them on its UI thread as worklets, sixty times a
 * second, where allocating a new array every frame would make the garbage collector stutter.
 */

export interface Particle {
  kind: ParticleKind;
  color: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  gravity: number;
  drag: number;
  sway: number;
  grow: number;
  size: number;
  age: number;
  life: number;
  /** Rotation, in radians, and its speed. */
  turn: number;
  spin: number;
  /** The phase of a leaf turning over, or of a star twinkling, and its speed. */
  flip: number;
  flipSpeed: number;
}

function between([min, max]: Range, random: () => number): number {
  "worklet";
  return min + random() * (max - min);
}

function pick<T>(list: readonly T[], random: () => number): T {
  "worklet";
  return list[Math.floor(random() * list.length) % list.length] as T;
}

/**
 * Adds a burst at a point. `strength` scales the count, the intensity of the look by default;
 * past `cap` particles alive, the rest of the burst is dropped.
 */
export function emit(
  particles: Particle[],
  x: number,
  y: number,
  settings: BurstSettings,
  cap: number,
  strength?: number,
  random: () => number = Math.random,
): void {
  "worklet";
  // Read in the body: a worklet does not carry what a parameter's default refers to.
  const count = Math.min(
    Math.round(settings.count * (strength ?? intensity)),
    cap - particles.length,
  );
  const spread = settings.spread ?? 0;
  const angle = settings.angle ?? [0, Math.PI * 2];
  for (let index = 0; index < count; index++) {
    const direction = between(angle, random);
    const speed = between(settings.speed, random);
    particles.push({
      kind: pick(settings.kinds, random),
      color: pick(settings.colors, random),
      x: x + (random() * 2 - 1) * spread,
      y: y + (random() * 2 - 1) * spread,
      vx: Math.cos(direction) * speed,
      vy: Math.sin(direction) * speed,
      gravity: settings.gravity ?? 0,
      drag: settings.drag ?? 0.97,
      sway: settings.sway ?? 0,
      grow: settings.grow ?? 0,
      size: between(settings.size, random),
      age: 0,
      life: between(settings.life, random),
      turn: random() * Math.PI * 2,
      spin: (random() * 2 - 1) * 8,
      flip: random() * Math.PI * 2,
      flipSpeed: 6 + random() * 8,
    });
  }
}

/** Light converging on a point, as a rare card draws it in before it turns. */
export function drawIn(
  particles: Particle[],
  x: number,
  y: number,
  colors: readonly string[],
  count: number,
  cap: number,
  random: () => number = Math.random,
): void {
  "worklet";
  const room = Math.min(count, cap - particles.length);
  for (let index = 0; index < room; index++) {
    const direction = random() * Math.PI * 2;
    const distance = 90 + random() * 80;
    const life = 0.35 + random() * 0.25;
    particles.push({
      kind: "glow",
      color: pick(colors, random),
      x: x + Math.cos(direction) * distance,
      y: y + Math.sin(direction) * distance,
      vx: (-Math.cos(direction) * distance) / life,
      vy: (-Math.sin(direction) * distance) / life,
      gravity: 0,
      drag: 1,
      sway: 0,
      grow: 0,
      size: 2 + random() * 2,
      age: 0,
      life,
      turn: 0,
      spin: 0,
      flip: 0,
      flipSpeed: 0,
    });
  }
}

/** Moves every particle by `seconds` and drops those whose life is over. */
export function advance(particles: Particle[], seconds: number): void {
  "worklet";
  // Drag is given per sixtieth of a second, whatever the frame rate.
  const frames = seconds * 60;
  let alive = 0;
  for (let index = 0; index < particles.length; index++) {
    const particle = particles[index] as Particle;
    particle.age += seconds;
    if (particle.age >= particle.life) continue;
    const drag = particle.drag ** frames;
    particle.vx *= drag;
    particle.vy = particle.vy * drag + particle.gravity * seconds;
    particle.x += particle.vx * seconds;
    if (particle.sway !== 0) {
      particle.x += Math.sin(particle.age * 3 + particle.turn) * particle.sway * seconds;
    }
    particle.y += particle.vy * seconds;
    particle.turn += particle.spin * seconds;
    particle.flip += particle.flipSpeed * seconds;
    particles[alive] = particle;
    alive++;
  }
  particles.length = alive;
}

/** How visible a particle is: lights fade out as they age, leaves only at the very end. */
export function opacityOf(particle: Particle): number {
  "worklet";
  const age = particle.age / particle.life;
  if (particle.kind === "leaf") return Math.min(1, (1 - age) * 3);
  return 1 - age * age;
}

/** Its size now, grown over its life. */
export function sizeOf(particle: Particle): number {
  "worklet";
  return particle.size * (1 + particle.grow * (particle.age / particle.life));
}
