"use client";

import {
  lockedToyInks,
  press,
  type ToyIconName,
  type ToyInk,
  type ToyInks,
  type ToyMatterName,
  type ToyShape,
  toyIconGrid,
  toyIconInks,
  toyIconOutline,
  toyIcons,
  toyLights,
  toy as toyValues,
} from "@leximon/tokens";
import type { ButtonHTMLAttributes, PointerEvent, ReactNode } from "react";
import { vibrate } from "@/booster/feedback";
import styles from "./toy.module.css";

export type ToyShapeName = "box" | "tile" | "round" | "tag";

const SHAPES: Readonly<Record<ToyShapeName, string | undefined>> = {
  box: undefined,
  tile: styles.tile,
  round: styles.round,
  tag: styles.tag,
};

function toyClass(
  matter: ToyMatterName,
  shape: ToyShapeName,
  large: boolean,
  extra: string | undefined,
): string {
  return [styles.toy, styles[matter], SHAPES[shape], large && styles.large, extra]
    .filter(Boolean)
    .join(" ");
}

function reducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function sink(event: PointerEvent<HTMLButtonElement>): void {
  const element = event.currentTarget;
  if (event.button !== 0 || element.disabled) return;
  element.dataset.down = "";
  vibrate([press.vibration]);
  const release = () => {
    delete element.dataset.down;
    if (!reducedMotion()) {
      element.animate(
        press.scales.map((scale) => ({ scale: String(scale) })),
        { duration: press.springMs, easing: "ease-out" },
      );
    }
    window.removeEventListener("pointerup", release);
    window.removeEventListener("pointercancel", release);
  };
  window.addEventListener("pointerup", release);
  window.addEventListener("pointercancel", release);
}

/**
 * Something to press, cut from leather, old gold or paper: it sinks by its thickness under the
 * finger and springs back as it is released.
 */
export function Toy({
  matter,
  shape = "box",
  large = false,
  className,
  children,
  onPointerDown,
  ...button
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  readonly matter: ToyMatterName;
  readonly shape?: ToyShapeName;
  readonly large?: boolean;
  readonly children?: ReactNode;
}) {
  return (
    <button
      type="button"
      {...button}
      className={toyClass(matter, shape, large, className)}
      onPointerDown={(event) => {
        sink(event);
        onPointerDown?.(event);
      }}
    >
      {children}
    </button>
  );
}

/** The same body, to show and not to press: a count, a level, a medal. */
export function ToyBody({
  matter,
  shape = "box",
  large = false,
  className,
  children,
}: {
  readonly matter: ToyMatterName;
  readonly shape?: ToyShapeName;
  readonly large?: boolean;
  readonly className?: string | undefined;
  readonly children?: ReactNode;
}) {
  return <span className={toyClass(matter, shape, large, className)}>{children}</span>;
}

/** Cream letters outlined in dark, for titles, buttons, figures and short labels. */
export function Lettering({
  children,
  className,
}: {
  readonly children: ReactNode;
  readonly className?: string | undefined;
}) {
  return (
    <span className={[styles.lettering, className].filter(Boolean).join(" ")}>{children}</span>
  );
}

/** Small capitals in gilt, above a title. */
export function Kicker({ children }: { readonly children: ReactNode }) {
  return <small className={styles.kicker}>{children}</small>;
}

/** A leaf of cream paper, for what is read. */
export function Leaf({
  children,
  className,
}: {
  readonly children: ReactNode;
  readonly className?: string | undefined;
}) {
  return <div className={[styles.leaf, className].filter(Boolean).join(" ")}>{children}</div>;
}

function paint(ink: ToyInk | undefined, inks: ToyInks): string | undefined {
  if (ink === undefined) return undefined;
  if (ink === "outline") return toyValues.outline;
  if (ink === "gloss" || ink === "sheen") return toyLights[ink].color;
  return inks[ink];
}

function ShapePath({ shape, inks }: { readonly shape: ToyShape; readonly inks: ToyInks }) {
  const fill = paint(shape.fill, inks) ?? "none";
  const stroke = paint(shape.stroke, inks);
  const light = shape.fill === "gloss" || shape.fill === "sheen" ? shape.fill : shape.stroke;
  const opacity = light === "gloss" || light === "sheen" ? toyLights[light].opacity : undefined;
  return (
    <path
      d={shape.d}
      fill={fill}
      stroke={stroke}
      strokeWidth={stroke === undefined ? undefined : (shape.strokeWidth ?? toyIconOutline)}
      strokeDasharray={shape.dash}
      strokeLinejoin="round"
      strokeLinecap={shape.dash === undefined ? "round" : "butt"}
      opacity={opacity}
      transform={shape.rotate === undefined ? undefined : `rotate(${shape.rotate.join(" ")})`}
    />
  );
}

/** A filled icon of the toys. Decorative: the toy that holds it carries the name. */
export function ToyIcon({
  name,
  size,
  locked = false,
  inks,
}: {
  readonly name: ToyIconName;
  readonly size: number;
  readonly locked?: boolean;
  readonly inks?: ToyInks;
}) {
  const used = locked ? lockedToyInks : (inks ?? toyIconInks[name]);
  return (
    <svg
      className={styles.icon}
      width={size}
      height={size}
      viewBox={`0 0 ${toyIconGrid} ${toyIconGrid}`}
      aria-hidden="true"
    >
      {toyIcons[name].map((shape, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: a fixed drawing, painted in order
        <ShapePath key={index} shape={shape} inks={used} />
      ))}
    </svg>
  );
}
