"use client";

import type { ProfileBanner as Banner } from "@leximon/contract";
import {
  type BannerShape,
  bannerInks,
  bannerMotif,
  bannerRelief,
  bannerTint,
} from "@leximon/tokens";
import { useId } from "react";

function paint(shape: BannerShape) {
  return {
    fill: shape.fill === undefined ? "none" : bannerInks[shape.fill],
    ...(shape.stroke === undefined
      ? {}
      : { stroke: bannerInks[shape.stroke], strokeWidth: shape.strokeWidth ?? 1 }),
  };
}

/** The cloth at the top of a profile: the tint, the motif repeated over it, then its relief. */
export function ProfileBanner({
  banner,
  className,
}: {
  readonly banner: Banner;
  readonly className?: string | undefined;
}) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const motif = bannerMotif(banner.motif);
  return (
    <svg className={className} width="100%" height="100%" aria-hidden="true" focusable="false">
      <defs>
        <pattern
          id={`${id}motif`}
          width={motif.tile.width}
          height={motif.tile.height}
          patternUnits="userSpaceOnUse"
        >
          {motif.shapes.map((shape) => (
            <path key={shape.d} d={shape.d} opacity={shape.opacity} {...paint(shape)} />
          ))}
        </pattern>
        <linearGradient id={`${id}relief`} x1="0" y1="0" x2="0" y2="1">
          <stop
            offset="0"
            stopColor={bannerRelief.top.color}
            stopOpacity={bannerRelief.top.opacity}
          />
          <stop offset="0.45" stopColor={bannerRelief.top.color} stopOpacity={0} />
          <stop
            offset="1"
            stopColor={bannerRelief.bottom.color}
            stopOpacity={bannerRelief.bottom.opacity}
          />
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill={bannerTint(banner.tint)} />
      <rect width="100%" height="100%" fill={`url(#${id}motif)`} />
      <rect width="100%" height="100%" fill={`url(#${id}relief)`} />
    </svg>
  );
}
