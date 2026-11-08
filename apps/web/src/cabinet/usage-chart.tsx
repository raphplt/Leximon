"use client";

import { type CabinetUsage, type UsagePoint, usageChart, usagePointAt } from "@leximon/view-model";
import { type PointerEvent, useState } from "react";
import styles from "./cabinet-screen.module.css";

/** The plot's own units: the box stretches to the page, the strokes and labels keep their size. */
const WIDTH = 640;
const HEIGHT = 180;

const across = (x: number) => `${(x / WIDTH) * 100}%`;
const down = (y: number) => `${(y / HEIGHT) * 100}%`;

/**
 * The word's use, decade by decade. A hairline follows the pointer to the nearest decade and
 * reads it; the peak keeps its mark when nothing is pointed.
 */
export function UsageChart({ usage }: { readonly usage: CabinetUsage }) {
  const chart = usageChart(usage, WIDTH, HEIGHT);
  const [pointed, setPointed] = useState<UsagePoint | null>(null);
  if (chart === null) return null;
  const shown = pointed ?? chart.peak;

  const point = (event: PointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    setPointed(usagePointAt(chart, ((event.clientX - box.left) / box.width) * WIDTH));
  };

  return (
    <figure className={styles.chart}>
      <p className={styles.readout} aria-live="polite">
        <strong>{shown.rate}</strong> <span>{shown.decade}</span>
      </p>
      <div
        className={styles.plotBox}
        role="img"
        aria-label={`Courbe d'usage, au plus haut dans les ${chart.peak.decade}`}
        onPointerMove={point}
        onPointerDown={point}
        onPointerLeave={() => setPointed(null)}
      >
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          preserveAspectRatio="none"
          className={styles.plot}
          aria-hidden="true"
        >
          <path d={chart.area} className={styles.wash} />
          <line x1={0} x2={WIDTH} y1={HEIGHT} y2={HEIGHT} className={styles.baseline} />
          <path d={chart.line} className={styles.line} />
          {pointed !== null && (
            <line x1={shown.x} x2={shown.x} y1={0} y2={HEIGHT} className={styles.crosshair} />
          )}
        </svg>
        <span className={styles.dot} style={{ left: across(shown.x), top: down(shown.y) }} />
      </div>
      <div className={styles.ticks} aria-hidden="true">
        {chart.ticks.map((tick) => (
          <span key={tick.label} className={styles.tick} style={{ left: across(tick.x) }}>
            {tick.label}
          </span>
        ))}
      </div>
    </figure>
  );
}
