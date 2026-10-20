/**
 * Reading the opening gestures (docs/cahiers-des-charges/ouverture.md): tearing the strip,
 * peeking at the stack, swiping a card away. Pure functions of pointer distances in px.
 */

/** The tear finishes on its own past this share of the strip; below, the strip sticks back. */
export const TEAR_COMPLETE_AT = 0.6;

/**
 * The booster request leaves as soon as the tear really begins, so that the server answers
 * while the player is still tearing.
 */
export const TEAR_STARTED_AT = 0.05;

/** Below this distance, a press on the stack or a card is a tap, not a drag. */
const TAP_SLOP = 8;

/** A swipe up of this length on the stack reveals the first card. */
const SWIPE_UP_DISTANCE = 40;

/** Distance of a full peek: the stack is fanned out as far as it goes. */
const PEEK_DISTANCE = 120;

/** A card dragged sideways past this share of its width leaves the screen. */
const SWIPE_AWAY_SHARE = 0.3;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Share of the strip torn, from 0 to 1. The strip tears from either end. */
export function tearProgress(dx: number, stripWidth: number): number {
  if (stripWidth <= 0) return 0;
  return clamp(Math.abs(dx) / stripWidth, 0, 1);
}

/**
 * How far the stack is fanned out, from 0 to 1. Only a diagonal drag peeks: a mostly
 * vertical or horizontal one is something else.
 */
export function peekAmount(dx: number, dy: number): number {
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  if (ax < TAP_SLOP || ay < TAP_SLOP) return 0;
  const ratio = ax / ay;
  if (ratio < 0.35 || ratio > 2.9) return 0;
  return clamp(Math.hypot(dx, dy) / PEEK_DISTANCE, 0, 1);
}

/** What releasing the stack does: reveal the first card, or nothing (a peek springs back). */
export function stackRelease(dx: number, dy: number): "reveal" | "none" {
  if (Math.hypot(dx, dy) < TAP_SLOP) return "reveal";
  if (-dy >= SWIPE_UP_DISTANCE && Math.abs(dx) < -dy / 2) return "reveal";
  return "none";
}

/** What releasing a revealed card does: show the next one, or nothing (it springs back). */
export function cardRelease(dx: number, dy: number, cardWidth: number): "next" | "none" {
  if (Math.hypot(dx, dy) < TAP_SLOP) return "next";
  return Math.abs(dx) >= cardWidth * SWIPE_AWAY_SHARE ? "next" : "none";
}
