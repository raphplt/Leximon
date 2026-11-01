import { alpha, colors } from "@leximon/tokens";

("use client");

import {
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import styles from "./charts.module.css";
import { formatNumber } from "./format";

/** Chart colors: tested for color blindness against the panel background. */
export const SERIES = {
  blue: colors.data,
  yellow: colors.rubric,
  gray: colors.pageInkFaint,
} as const;

/** Width of an element, followed as the window resizes. */
function useWidth<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const element = ref.current;
    if (element === null) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry !== undefined) setWidth(Math.floor(entry.contentRect.width));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, width];
}

/**
 * A round top for the axis, with ticks every 1, 2, 2.5 or 5 times a power of ten. Counts keep
 * whole ticks.
 */
function niceScale(max: number, integer: boolean, steps = 4): { top: number; ticks: number[] } {
  if (max <= 0) return { top: 1, ticks: [0, 1] };
  const raw = max / steps;
  const power = 10 ** Math.floor(Math.log10(raw));
  const found =
    [1, 2, 2.5, 5, 10].map((factor) => factor * power).find((candidate) => candidate >= raw) ?? raw;
  const step = integer ? Math.max(1, Math.round(found)) : found;
  const top = step * Math.ceil(max / step - 1e-9);
  const ticks: number[] = [];
  for (let index = 0; index * step <= top + 1e-9; index += 1) ticks.push(index * step);
  return { top, ticks };
}

/** A bar with a rounded data end and a square foot. */
function barPath(x: number, y: number, width: number, height: number, round: boolean): string {
  const r = round ? Math.min(4, width / 2, height) : 0;
  return [
    `M${x},${y + height}`,
    `V${y + r}`,
    r > 0 ? `Q${x},${y} ${x + r},${y}` : "",
    `H${x + width - r}`,
    r > 0 ? `Q${x + width},${y} ${x + width},${y + r}` : "",
    `V${y + height}`,
    "Z",
  ].join("");
}

/** Indexes to label on an axis of `count` positions, at most `most` of them, the last one included. */
function tickIndexes(count: number, most: number): number[] {
  if (count <= most) return Array.from({ length: count }, (_, i) => i);
  const step = Math.ceil(count / most);
  const indexes: number[] = [];
  for (let i = count - 1; i >= 0; i -= step) indexes.unshift(i);
  return indexes;
}

export interface Series {
  readonly key: string;
  readonly label: string;
  readonly color: string;
  readonly values: readonly number[];
}

export function Legend({ items }: { readonly items: readonly { label: string; color: string }[] }) {
  return (
    <div className={styles.legend}>
      {items.map((item) => (
        <span key={item.label} className={styles.legendItem}>
          <span className={styles.swatch} style={{ background: item.color }} />
          {item.label}
        </span>
      ))}
    </div>
  );
}

const MARGIN = { top: 12, right: 12, bottom: 28, left: 44 };

/**
 * Columns, one per position, stacked when there are several series. Hover or arrow keys show
 * every series at that position.
 */
export function ColumnChart({
  labels,
  tickLabel,
  tooltipTitle,
  series,
  height = 260,
}: {
  readonly labels: readonly string[];
  readonly tickLabel: (label: string) => string;
  readonly tooltipTitle: (label: string) => string;
  readonly series: readonly Series[];
  readonly height?: number;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const count = labels.length;
  const totals = labels.map((_, i) => series.reduce((sum, s) => sum + (s.values[i] ?? 0), 0));
  const { top, ticks } = niceScale(Math.max(0, ...totals), true);
  const plotWidth = Math.max(0, width - MARGIN.left - MARGIN.right);
  const plotHeight = height - MARGIN.top - MARGIN.bottom;
  const band = count === 0 ? 0 : plotWidth / count;
  const barWidth = Math.max(1, Math.min(24, band - 2));
  const y = (value: number) => MARGIN.top + plotHeight - (value / top) * plotHeight;
  const xOf = (i: number) => MARGIN.left + i * band + (band - barWidth) / 2;

  const pick = (event: PointerEvent<SVGRectElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const index = Math.floor((event.clientX - box.left) / band);
    setHover(Math.min(count - 1, Math.max(0, index)));
  };
  const keys = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const step = event.key === "ArrowLeft" ? -1 : 1;
    setHover((current) => Math.min(count - 1, Math.max(0, (current ?? count) + step)));
  };

  const hovered = hover === null ? null : labels[hover];
  return (
    <div
      ref={ref}
      className={styles.chart}
      // biome-ignore lint/a11y/noNoninteractiveTabindex: the arrow keys walk through the days.
      tabIndex={0}
      role="img"
      aria-label={series.map((s) => s.label).join(", ")}
      onKeyDown={keys}
      onBlur={() => setHover(null)}
    >
      {width > 0 && (
        <svg width={width} height={height} className={styles.svg} aria-hidden="true">
          {ticks.map((tick) => (
            <g key={tick}>
              <line
                x1={MARGIN.left}
                x2={width - MARGIN.right}
                y1={y(tick)}
                y2={y(tick)}
                className={tick === 0 ? styles.baseline : styles.grid}
              />
              <text x={MARGIN.left - 8} y={y(tick)} className={styles.yTick}>
                {formatNumber(tick)}
              </text>
            </g>
          ))}
          {hover !== null && (
            <rect
              x={MARGIN.left + hover * band}
              y={MARGIN.top}
              width={band}
              height={plotHeight}
              className={styles.wash}
            />
          )}
          {labels.map((label, i) => {
            let base = 0;
            const last = series.findLastIndex((s) => (s.values[i] ?? 0) > 0);
            return (
              <g key={label}>
                {series.map((s, index) => {
                  const value = s.values[i] ?? 0;
                  if (value === 0) return null;
                  const yTop = y(base + value);
                  const gap = base > 0 ? 2 : 0;
                  const segment = Math.max(0, y(base) - yTop - gap);
                  base += value;
                  return (
                    <path
                      key={s.key}
                      d={barPath(xOf(i), yTop, barWidth, segment, index === last)}
                      fill={s.color}
                      opacity={hover === null || hover === i ? 1 : 0.55}
                    />
                  );
                })}
              </g>
            );
          })}
          {tickIndexes(count, Math.max(2, Math.floor(plotWidth / 70))).map((i) => (
            <text
              key={labels[i]}
              x={MARGIN.left + i * band + band / 2}
              y={height - 8}
              className={styles.xTick}
            >
              {tickLabel(labels[i] ?? "")}
            </text>
          ))}
          <rect
            x={MARGIN.left}
            y={MARGIN.top}
            width={plotWidth}
            height={plotHeight}
            fill="transparent"
            onPointerMove={pick}
            onPointerLeave={() => setHover(null)}
          />
        </svg>
      )}
      {hover !== null && hovered != null && (
        <Tooltip
          x={MARGIN.left + hover * band + band / 2}
          width={width}
          title={tooltipTitle(hovered)}
          rows={[
            ...series
              .map((s) => ({
                key: s.key,
                color: s.color,
                label: s.label,
                value: formatNumber(s.values[hover] ?? 0),
              }))
              .reverse(),
            ...(series.length > 1
              ? [
                  {
                    key: "total",
                    color: null,
                    label: "Total",
                    value: formatNumber(totals[hover] ?? 0),
                  },
                ]
              : []),
          ]}
        />
      )}
    </div>
  );
}

export interface LineSeries {
  readonly key: string;
  readonly label: string;
  readonly color: string;
  /** null where there is no value yet: the line stops there. */
  readonly values: readonly (number | null)[];
  /** What the tooltip says beside the value, e.g. "3/12". */
  readonly details?: readonly string[];
}

/** Lines over positions, one scale, with a crosshair that reads every series at once. */
export function LineChart({
  labels,
  series,
  format,
  ticks: tickAt,
  maxValue,
  height = 240,
}: {
  readonly labels: readonly string[];
  readonly series: readonly LineSeries[];
  readonly format: (value: number) => string;
  /** Positions labelled under the axis; evenly spaced by default. */
  readonly ticks?: readonly number[];
  /** The top of the scale at most, e.g. 1 for a share. */
  readonly maxValue?: number;
  readonly height?: number;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const count = labels.length;
  const values = series.flatMap((s) => s.values.filter((v): v is number => v !== null));
  const max = Math.max(0, ...values);
  const scale = niceScale(max > 0 ? max : (maxValue ?? 1), false);
  const top = maxValue === undefined ? scale.top : Math.min(scale.top, maxValue);
  const ticks = scale.ticks.filter((tick) => tick <= top + 1e-9);
  const plotWidth = Math.max(0, width - MARGIN.left - MARGIN.right);
  const plotHeight = height - MARGIN.top - MARGIN.bottom;
  const x = (i: number) =>
    MARGIN.left + (count <= 1 ? plotWidth / 2 : (i / (count - 1)) * plotWidth);
  const y = (value: number) => MARGIN.top + plotHeight - (value / top) * plotHeight;

  const pick = (event: PointerEvent<SVGRectElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientX - box.left) / Math.max(1, box.width);
    setHover(Math.min(count - 1, Math.max(0, Math.round(ratio * (count - 1)))));
  };
  const keys = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const step = event.key === "ArrowLeft" ? -1 : 1;
    setHover((current) => Math.min(count - 1, Math.max(0, (current ?? -1) + step)));
  };

  const hovered = hover === null ? null : labels[hover];
  return (
    <div
      ref={ref}
      className={styles.chart}
      // biome-ignore lint/a11y/noNoninteractiveTabindex: the arrow keys walk through the points.
      tabIndex={0}
      role="img"
      aria-label={series.map((s) => s.label).join(", ")}
      onKeyDown={keys}
      onBlur={() => setHover(null)}
    >
      {width > 0 && (
        <svg width={width} height={height} className={styles.svg} aria-hidden="true">
          {ticks.map((tick) => (
            <g key={tick}>
              <line
                x1={MARGIN.left}
                x2={width - MARGIN.right}
                y1={y(tick)}
                y2={y(tick)}
                className={tick === 0 ? styles.baseline : styles.grid}
              />
              <text x={MARGIN.left - 8} y={y(tick)} className={styles.yTick}>
                {format(tick)}
              </text>
            </g>
          ))}
          {hover !== null && (
            <line
              x1={x(hover)}
              x2={x(hover)}
              y1={MARGIN.top}
              y2={MARGIN.top + plotHeight}
              className={styles.crosshair}
            />
          )}
          {series.map((s) => {
            const points = s.values
              .map((value, i) => (value === null ? null : ([x(i), y(value)] as const)))
              .filter((point) => point !== null);
            const lastIndex = s.values.findLastIndex((value) => value !== null);
            const last = s.values[lastIndex];
            return (
              <g key={s.key}>
                <polyline
                  points={points.map(([px, py]) => `${px},${py}`).join(" ")}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
                {last !== undefined && last !== null && (
                  <circle
                    cx={x(lastIndex)}
                    cy={y(last)}
                    r={4}
                    fill={s.color}
                    className={styles.dot}
                  />
                )}
                {hover !== null && s.values[hover] != null && (
                  <circle
                    cx={x(hover)}
                    cy={y(s.values[hover] ?? 0)}
                    r={5}
                    fill={s.color}
                    className={styles.dot}
                  />
                )}
              </g>
            );
          })}
          {(tickAt ?? tickIndexes(count, Math.max(2, Math.floor(plotWidth / 60)))).map((i) => (
            <text key={labels[i]} x={x(i)} y={height - 8} className={styles.xTick}>
              {labels[i]}
            </text>
          ))}
          <rect
            x={MARGIN.left - 8}
            y={MARGIN.top}
            width={plotWidth + 16}
            height={plotHeight}
            fill="transparent"
            onPointerMove={pick}
            onPointerLeave={() => setHover(null)}
          />
        </svg>
      )}
      {hover !== null && hovered != null && (
        <Tooltip
          x={x(hover)}
          width={width}
          title={hovered}
          rows={series.map((s) => {
            const value = s.values[hover];
            const detail = s.details?.[hover];
            return {
              key: s.key,
              color: s.color,
              label: detail === undefined ? s.label : `${s.label} · ${detail}`,
              value: value == null ? "—" : format(value),
            };
          })}
        />
      )}
    </div>
  );
}

function Tooltip({
  x,
  width,
  title,
  rows,
}: {
  readonly x: number;
  readonly width: number;
  readonly title: string;
  readonly rows: readonly { key: string; color: string | null; label: string; value: string }[];
}) {
  const flip = x > width / 2;
  return (
    <div
      className={styles.tooltip}
      style={{ left: flip ? undefined : x + 12, right: flip ? width - x + 12 : undefined }}
    >
      <div className={styles.tooltipTitle}>{title}</div>
      {rows.map((row) => (
        <div key={row.key} className={styles.tooltipRow}>
          <span className={styles.key} style={{ background: row.color ?? "transparent" }} />
          <strong>{row.value}</strong>
          <span>{row.label}</span>
        </div>
      ))}
    </div>
  );
}

/** A small trend line under a figure, with its last point marked. */
export function Sparkline({
  values,
  color = SERIES.blue,
}: {
  readonly values: readonly number[];
  readonly color?: string;
}) {
  const width = 120;
  const height = 32;
  if (values.length < 2) return null;
  const max = Math.max(1, ...values);
  const points = values.map(
    (value, i) =>
      [
        (i / (values.length - 1)) * (width - 4) + 2,
        height - 3 - (value / max) * (height - 6),
      ] as const,
  );
  const line = points.map(([px, py]) => `${px},${py}`).join(" ");
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={styles.spark}
      aria-hidden="true"
      preserveAspectRatio="none"
    >
      <polygon points={`2,${height} ${line} ${width - 2},${height}`} fill={color} opacity={0.12} />
      <polyline
        points={line}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/** Background of a heat cell: the blue of the charts, stronger as the share grows. */
export function heat(share: number | null): CSSProperties {
  if (share === null) return {};
  const strength = Math.min(1, Math.max(0, share));
  return {
    background: alpha(colors.data, 0.08 + strength * 0.82),
    color: strength > 0.55 ? colors.well : undefined,
  };
}

/** A horizontal bar for a table cell or a funnel step. */
export function Bar({
  share,
  color = SERIES.blue,
  children,
}: {
  readonly share: number;
  readonly color?: string;
  readonly children?: ReactNode;
}) {
  return (
    <div className={styles.barRow}>
      <div className={styles.barTrack}>
        <div
          className={styles.barFill}
          style={{
            width: `${Math.max(share > 0 ? 1 : 0, Math.min(1, share) * 100)}%`,
            background: color,
          }}
        />
      </div>
      {children}
    </div>
  );
}
