import { describe, expect, it } from "vitest";
import { effects, particleCap } from "./effects";
import { advance, drawIn, emit, opacityOf, type Particle } from "./particles";

/** Always the middle of every range, so that a burst is the same from one run to the next. */
const middle = () => 0.5;

describe("particles", () => {
  it("scale a burst by the strength of the look", () => {
    const particles: Particle[] = [];
    emit(particles, 0, 0, effects.reward, particleCap.web, 0.5, middle);
    expect(particles).toHaveLength(9);
  });

  it("drop what goes past the cap", () => {
    const particles: Particle[] = [];
    emit(particles, 0, 0, effects.burst[0], 40, 1, middle);
    emit(particles, 0, 0, effects.burst[0], 40, 1, middle);
    expect(particles).toHaveLength(40);
  });

  it("fall under gravity and die at the end of their life", () => {
    const particles: Particle[] = [];
    emit(particles, 100, 100, { ...effects.reward, count: 1, angle: [0, 0] }, 10, 1, middle);
    const [first] = particles;
    const before = { x: first?.x ?? 0, vy: first?.vy ?? 0 };
    advance(particles, 0.1);
    expect(particles[0]?.x).toBeGreaterThan(before.x);
    expect(particles[0]?.vy).toBeGreaterThan(before.vy);
    advance(particles, 5);
    expect(particles).toHaveLength(0);
  });

  it("draw the light into the point they surround", () => {
    const particles: Particle[] = [];
    drawIn(particles, 0, 0, ["#FFFFFF"], 3, 10, middle);
    const [glow] = particles;
    if (glow === undefined) throw new Error("No glow");
    const distance = Math.hypot(glow.x, glow.y);
    advance(particles, glow.life * 0.9);
    expect(Math.hypot(glow.x, glow.y)).toBeLessThan(distance * 0.2);
  });

  it("fade out as they age", () => {
    const particles: Particle[] = [];
    emit(particles, 0, 0, { ...effects.reward, count: 1 }, 10, 1, middle);
    const [star] = particles;
    if (star === undefined) throw new Error("No star");
    const fresh = opacityOf(star);
    advance(particles, star.life * 0.8);
    expect(opacityOf(star)).toBeLessThan(fresh);
  });
});
