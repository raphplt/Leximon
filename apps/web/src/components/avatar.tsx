"use client";

import {
  AVATAR_MEDALLION,
  type AvatarFrame,
  avatarFrame,
  cssUrl,
  type FrameShape,
  frameGradients,
  frameMatters,
  frameOutline,
  framePaint,
  frameSheen,
} from "@leximon/tokens";
import { avatarName } from "@leximon/view-model";
import { type CSSProperties, useId } from "react";
import { useEngravingInk } from "@/cards/use-engraving-ink";
import { Icon } from "@/ui/icon";
import styles from "./avatar.module.css";

/**
 * The player's avatar: a card's engraving printed in a medallion, inside the frame worn.
 * Decorative unless `label` is given; `frame: null` draws none. The silhouette stands in until
 * the engraving is known.
 */
export function Avatar({
  avatar,
  frame,
  size,
  label,
  className,
}: {
  readonly avatar: string | null;
  readonly frame: string | null;
  readonly size: number;
  readonly label?: string | undefined;
  readonly className?: string | undefined;
}) {
  const ink = useEngravingInk(avatar);
  const style = {
    "--size": `${size}px`,
    ...(ink === null ? {} : { "--ink-src": cssUrl(ink) }),
  } as CSSProperties;
  const accessible =
    label === undefined
      ? { "aria-hidden": true }
      : { role: "img", "aria-label": avatar === null ? label : `${label}, ${avatarName(avatar)}` };
  return (
    <span className={`${styles.avatar} ${className ?? ""}`} style={style} {...accessible}>
      {frame !== null && <FrameDrawing frame={avatarFrame(frame)} size={size} />}
      {ink === null ? (
        <Icon name="profil" size={Math.round(size * 0.6)} />
      ) : (
        <span className={styles.ink} />
      )}
    </span>
  );
}

/** The frame around the medallion, in its matters; wide frames spill over the avatar's box. */
function FrameDrawing({ frame, size }: { readonly frame: AvatarFrame; readonly size: number }) {
  const prefix = useId().replace(/[^a-zA-Z0-9]/g, "");
  const box = (size * frame.reach) / AVATAR_MEDALLION;
  const paint = (ink: FrameShape["fill"]) => {
    if (ink === undefined) return "none";
    const used = framePaint(ink);
    return "color" in used ? used.color : `url(#${prefix}${used.matter})`;
  };
  const draw = (shape: FrameShape) => (
    <path
      key={shape.d}
      d={shape.d}
      fill={paint(shape.fill)}
      fillRule="evenodd"
      stroke={paint(shape.stroke)}
      strokeWidth={shape.strokeWidth ?? frameOutline}
      strokeOpacity={shape.stroke === "sheen" ? frameSheen.opacity : 1}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
  return (
    <svg
      className={styles.frame}
      width={box}
      height={box}
      viewBox={`${-frame.reach} ${-frame.reach} ${frame.reach * 2} ${frame.reach * 2}`}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        {frameGradients(frame).map((matter) => (
          <linearGradient key={matter} id={`${prefix}${matter}`} x1="0" y1="0" x2="0" y2="1">
            {frameMatters[matter].stops.map((color, index, stops) => (
              <stop key={color} offset={index / (stops.length - 1)} stopColor={color} />
            ))}
          </linearGradient>
        ))}
      </defs>
      {frame.turning !== undefined && <g className={styles.turning}>{frame.turning.map(draw)}</g>}
      {frame.shapes.map(draw)}
    </svg>
  );
}
