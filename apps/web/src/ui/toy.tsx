"use client";

import {
  lettrine,
  lettrineInks,
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
import { type ButtonHTMLAttributes, type PointerEvent, type ReactNode, useId } from "react";
import { vibrate } from "@/booster/feedback";
import styles from "./toy.module.css";

export type ToyShapeName = "box" | "tile" | "round" | "tag";

const SHAPES: Readonly<Record<ToyShapeName, string | undefined>> = {
  box: undefined,
  tile: styles.tile,
  round: styles.round,
  tag: styles.tag,
};

/** The classes of a toy's body, for a link that must look like one. */
export function toyClass(
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

/**
 * The inside of a gold tile as an illuminated initial: a ground in the pigment of `matter`,
 * strewn with pale vines, and the icon in vellum and gold. Closed, it goes grey.
 */
export function Lettrine({
  icon,
  matter,
  size,
  locked = false,
}: {
  readonly icon: ToyIconName;
  readonly matter: ToyMatterName;
  readonly size: number;
  readonly locked?: boolean;
}) {
  // The pattern is referenced by id: React's own ids carry characters `url()` does not like.
  const id = `${useId().replace(/[^\w-]/g, "")}vine`;
  const { vine, inset } = lettrine;
  return (
    <>
      <span
        className={styles.lettrine}
        style={{
          inset: `${inset}px ${inset}px calc(var(--lip) + ${inset}px)`,
          borderRadius: lettrine.radius,
          borderWidth: lettrine.ruleWidth,
          background: lettrine.grounds[locked ? "locked" : matter],
        }}
        aria-hidden="true"
      >
        <svg width="100%" height="100%" aria-hidden="true">
          <defs>
            <pattern id={id} width={vine.size} height={vine.size} patternUnits="userSpaceOnUse">
              <path
                d={vine.d}
                fill="none"
                stroke={vine.color}
                strokeOpacity={vine.opacity}
                strokeWidth={vine.width}
                strokeLinecap="round"
              />
              <circle {...vine.dot} fill={vine.color} fillOpacity={vine.dotOpacity} />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill={`url(#${id})`} />
        </svg>
      </span>
      <span className={styles.lettrineIcon}>
        <ToyIcon name={icon} size={size} locked={locked} inks={lettrineInks(icon)} />
      </span>
    </>
  );
}
