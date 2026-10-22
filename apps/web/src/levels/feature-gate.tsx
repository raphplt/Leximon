"use client";

import { type LockedFeature, lockedScreen, NOT_BUILT_COPY } from "@leximon/view-model";
import type { ReactNode } from "react";
import { useNow } from "@/lib/use-now";
import { useProgress } from "@/progress/use-progress";
import type { IconName } from "@/ui/icon";
import { LockedScreen } from "@/ui/locked-screen";

/**
 * A screen opened by the level (P59, C-06): the locked screen until the level, then `children`.
 * Without children, the feature is open but not built yet.
 */
export function FeatureGate({
  feature,
  icon,
  children,
}: {
  readonly feature: LockedFeature;
  readonly icon: IconName;
  readonly children?: ReactNode;
}) {
  const progress = useProgress();
  const now = useNow(60_000);
  if (progress === null || now === 0) return null;
  const locked = lockedScreen(feature, progress, now);
  if (locked !== null) {
    return (
      <LockedScreen
        icon={icon}
        level={locked.level}
        title={locked.title}
        text={locked.text}
        left={locked.left}
        ratio={locked.ratio}
      />
    );
  }
  if (children !== undefined) return children;
  const copy = feature === "jousts" ? NOT_BUILT_COPY.jousts : null;
  return copy === null ? null : <LockedScreen icon={icon} title={copy.title} text={copy.text} />;
}
