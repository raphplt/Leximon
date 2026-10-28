import type { MeasuresCohort, MeasuresDay } from "@leximon/contract";

const DAY_MS = 24 * 60 * 60 * 1000;

/** `day` moved by `days`, both `YYYY-MM-DD`. */
export function addDays(day: string, days: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

/** Days from `from` to `to`, both `YYYY-MM-DD`. */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);
}

/** Monday of the week of `day`, `YYYY-MM-DD`. */
export function weekOf(day: string): string {
  const sinceMonday = (new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7;
  return addDays(day, -sinceMonday);
}

export interface Range {
  readonly from: string;
  readonly to: string;
}

export const PRESETS = [
  { key: "7", label: "7 j", days: 7 },
  { key: "30", label: "30 j", days: 30 },
  { key: "90", label: "90 j", days: 90 },
  { key: "all", label: "Depuis le début", days: null },
] as const;
export type PresetKey = (typeof PRESETS)[number]["key"];

/** The range of a preset, ending today; "since the start" begins on the first day a player came. */
export function presetRange(key: PresetKey, today: string, firstDay: string | null): Range {
  const preset = PRESETS.find((candidate) => candidate.key === key) ?? PRESETS[1];
  if (preset.days === null) return { from: firstDay ?? today, to: today };
  return { from: addDays(today, 1 - preset.days), to: today };
}

/** The preset a range matches, if any. */
export function presetOf(range: Range, today: string, firstDay: string | null): PresetKey | null {
  const match = PRESETS.find((preset) => {
    const candidate = presetRange(preset.key, today, firstDay);
    return candidate.from === range.from && candidate.to === range.to;
  });
  return match?.key ?? null;
}

export type DayMetric = Exclude<keyof MeasuresDay, "day">;

/** Total of a metric over the days of a range. */
export function total(days: readonly MeasuresDay[], metric: DayMetric, range: Range): number {
  return days
    .filter((day) => day.day >= range.from && day.day <= range.to)
    .reduce((sum, day) => sum + day[metric], 0);
}

/** Change from `previous` to `current`, as a ratio; null when there is nothing to compare with. */
export function change(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return (current - previous) / previous;
}

export interface Rate {
  readonly players: number;
  readonly eligible: number;
}

/** A rate as a share, or null when nobody could count yet. */
export function share(rate: Rate): number | null {
  return rate.eligible === 0 ? null : rate.players / rate.eligible;
}

/**
 * Of the players arrived in `range` for whom day N has come, how many played that very day. A
 * cohort arrived yesterday counts for J1 only: recent cohorts are never dragged down by days still
 * to come.
 */
export function retentionOn(
  cohorts: readonly MeasuresCohort[],
  range: Range,
  offset: number,
  today: string,
): Rate {
  let players = 0;
  let eligible = 0;
  for (const cohort of cohorts) {
    if (cohort.day < range.from || cohort.day > range.to) continue;
    if (daysBetween(cohort.day, today) < offset) continue;
    players += cohort.back[offset] ?? 0;
    eligible += cohort.players;
  }
  return { players, eligible };
}

/** Retention on each day from J1 to `last` for the cohorts of `range`. */
export function retentionCurve(
  cohorts: readonly MeasuresCohort[],
  range: Range,
  last: number,
  today: string,
): Rate[] {
  return Array.from({ length: last }, (_, index) => retentionOn(cohorts, range, index + 1, today));
}

export type Grain = "day" | "week";

export interface CohortRow {
  /** The day, or the Monday of the week. */
  readonly key: string;
  readonly players: number;
  /** One rate per offset asked; `eligible` 0 when that day has not come for anyone. */
  readonly rates: readonly Rate[];
}

/** Cohorts of `range` by day or week of arrival, newest first, with their retention on `offsets`. */
export function cohortTable(
  cohorts: readonly MeasuresCohort[],
  range: Range,
  grain: Grain,
  offsets: readonly number[],
  today: string,
): CohortRow[] {
  const groups = new Map<string, MeasuresCohort[]>();
  for (const cohort of cohorts) {
    if (cohort.day < range.from || cohort.day > range.to) continue;
    const key = grain === "day" ? cohort.day : weekOf(cohort.day);
    groups.set(key, [...(groups.get(key) ?? []), cohort]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([key, members]) => ({
      key,
      players: members.reduce((sum, cohort) => sum + cohort.players, 0),
      rates: offsets.map((offset) => retentionOn(members, range, offset, today)),
    }));
}
