import type { RetentionRow } from "@leximon/contract";

/** One player as the measures see them: the day they arrived and the days they came back. */
export interface PlayerTrace {
  /** `YYYY-MM-DD`, Paris time. */
  readonly firstDay: string;
  readonly d1: boolean;
  readonly d7: boolean;
  readonly d30: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Days from `from` to `to`, both `YYYY-MM-DD`. */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);
}

/** Monday of the week of `day`, `YYYY-MM-DD`. */
export function weekOf(day: string): string {
  const date = new Date(`${day}T00:00:00Z`);
  const sinceMonday = (date.getUTCDay() + 6) % 7;
  return new Date(date.getTime() - sinceMonday * DAY_MS).toISOString().slice(0, 10);
}

/**
 * Retention of each group: of the players for whom day N has come, how many played that very
 * day. A player who arrived yesterday counts for J1, not yet for J7: recent cohorts are never
 * dragged down by days still to come.
 */
export function retentionBy<T extends PlayerTrace>(
  players: readonly T[],
  keyOf: (player: T) => string,
  today: string,
): RetentionRow[] {
  const groups = new Map<string, RetentionRow>();
  for (const player of players) {
    const key = keyOf(player);
    const row = groups.get(key) ?? {
      key,
      players: 0,
      d1: { players: 0, eligible: 0 },
      d7: { players: 0, eligible: 0 },
      d30: { players: 0, eligible: 0 },
    };
    const age = daysBetween(player.firstDay, today);
    groups.set(key, {
      key,
      players: row.players + 1,
      d1: tally(row.d1, age >= 1, player.d1),
      d7: tally(row.d7, age >= 7, player.d7),
      d30: tally(row.d30, age >= 30, player.d30),
    });
  }
  return [...groups.values()];
}

function tally(rate: RetentionRow["d1"], eligible: boolean, back: boolean): RetentionRow["d1"] {
  if (!eligible) return rate;
  return { players: rate.players + (back ? 1 : 0), eligible: rate.eligible + 1 };
}

/** `day` moved by `days`, both `YYYY-MM-DD`. */
export function addDays(day: string, days: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

export interface MeasuresPeriod {
  readonly from: string;
  readonly to: string;
  readonly previousFrom: string;
  readonly previousTo: string;
}

const DEFAULT_DAYS = 30;

/**
 * The period the measures cover, and the one of the same length just before it. Without bounds,
 * the last 30 days; a period ending after today stops at today. `null` when the bounds are
 * reversed or the period too long.
 */
export function resolvePeriod(
  query: { readonly from?: string | undefined; readonly to?: string | undefined },
  today: string,
  maxDays: number,
): MeasuresPeriod | null {
  const to = query.to === undefined || query.to > today ? today : query.to;
  const from = query.from ?? addDays(to, 1 - DEFAULT_DAYS);
  if (from > to) return null;
  const length = daysBetween(from, to) + 1;
  if (length > maxDays) return null;
  return { from, to, previousFrom: addDays(from, -length), previousTo: addDays(from, -1) };
}

/** Each cohort's size and returns, from rows of (arrival day, days since arrival, players). */
export function cohortsFrom(
  rows: readonly { readonly day: string; readonly offset: number; readonly players: number }[],
  days: number,
): { day: string; players: number; back: number[] }[] {
  const cohorts = new Map<string, number[]>();
  for (const row of rows) {
    if (row.offset < 0 || row.offset >= days) continue;
    const back = cohorts.get(row.day) ?? new Array<number>(days).fill(0);
    back[row.offset] = row.players;
    cohorts.set(row.day, back);
  }
  return [...cohorts.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, back]) => ({ day, players: back[0] ?? 0, back }));
}
