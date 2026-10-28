"use client";

import styles from "./admin.module.css";
import { PRESETS, type PresetKey, presetOf, presetRange, type Range } from "./measures-model";
import p from "./period-picker.module.css";

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** A day read from the address, `YYYY-MM-DD`, or nothing when it is missing or malformed. */
export function dayParam(value: string | null): string | undefined {
  return value !== null && DAY.test(value) ? value : undefined;
}

/**
 * The period a back-office page covers: presets ending today, or two free dates. "Since the start"
 * needs `firstDay`, and shows only when it is known.
 */
export function PeriodPicker({
  period,
  firstDay,
  busy,
  onChoose,
  onRefresh,
}: {
  readonly period: Range & { readonly today: string };
  readonly firstDay: string | null;
  readonly busy: boolean;
  readonly onChoose: (range: Range) => void;
  readonly onRefresh: () => void;
}) {
  const presets = PRESETS.filter((preset) => preset.days !== null || firstDay !== null);
  const active: PresetKey | null = presetOf(period, period.today, firstDay);
  const pickDay = (key: "from" | "to", value: string) => {
    if (!DAY.test(value)) return;
    const next = { from: period.from, to: period.to, [key]: value };
    if (next.from > next.to) return;
    onChoose(next);
  };
  return (
    <div className={p.picker}>
      <fieldset className={styles.segmented} aria-label="Période">
        {presets.map((preset) => (
          <button
            key={preset.key}
            type="button"
            className={styles.segment}
            aria-pressed={active === preset.key}
            onClick={() => onChoose(presetRange(preset.key, period.today, firstDay))}
          >
            {preset.label}
          </button>
        ))}
      </fieldset>
      <div className={p.dates}>
        <input
          type="date"
          className={styles.input}
          aria-label="Du"
          value={period.from}
          max={period.to}
          onChange={(event) => pickDay("from", event.target.value)}
        />
        <span aria-hidden="true">→</span>
        <input
          type="date"
          className={styles.input}
          aria-label="Au"
          value={period.to}
          min={period.from}
          max={period.today}
          onChange={(event) => pickDay("to", event.target.value)}
        />
      </div>
      <button type="button" className={styles.button} onClick={onRefresh} disabled={busy}>
        {busy ? "Lecture…" : "Actualiser"}
      </button>
    </div>
  );
}
