"use client";

import type { ReactNode } from "react";
import styles from "./admin.module.css";
import { Sparkline } from "./charts";
import m from "./measures.module.css";

/** Pieces shared by the dashboards of the back office: figures and panel titles. */

export interface Delta {
  readonly text: string;
  readonly direction: "up" | "down" | "flat";
}

const ARROWS = { up: "▲", down: "▼", flat: "■" } as const;

export function Kpi({
  label,
  value,
  delta,
  note,
  trend,
  color,
}: {
  readonly label: string;
  readonly value: string;
  readonly delta?: Delta | null;
  readonly note?: string;
  readonly trend?: readonly number[];
  readonly color?: string;
}) {
  return (
    <div className={m.kpi}>
      <span className={m.kpiLabel}>{label}</span>
      <div className={m.kpiLine}>
        <span className={m.kpiValue}>{value}</span>
        {delta != null && (
          <span
            className={m.delta}
            data-direction={delta.direction}
            title="Par rapport à la période d'avant"
          >
            <span aria-hidden="true">{ARROWS[delta.direction]}</span> {delta.text}
          </span>
        )}
      </div>
      {note !== undefined && <span className={m.kpiNote}>{note}</span>}
      {trend !== undefined && (
        <Sparkline values={trend} {...(color === undefined ? {} : { color })} />
      )}
    </div>
  );
}

export function PanelHead({
  title,
  hint,
  children,
}: {
  readonly title: string;
  readonly hint?: string;
  readonly children?: ReactNode;
}) {
  return (
    <div className={m.panelHead}>
      <div>
        <h2 className={styles.subtitle}>{title}</h2>
        {hint !== undefined && <p className={m.hint}>{hint}</p>}
      </div>
      {children}
    </div>
  );
}
