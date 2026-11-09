"use client";

import { type LockedFeature, lockedScreen, NOT_BUILT_COPY } from "@leximon/view-model";
import type { ReactNode } from "react";
import { useNow } from "@/lib/use-now";
import { retryProgress, useProgress, useProgressFailed } from "@/progress/use-progress";
import type { IconName } from "@/ui/icon";
import { LoadFailed } from "@/ui/load-failed";
import { LockedScreen } from "@/ui/locked-screen";
import styles from "./feature-gate.module.css";

/**
 * A screen opened by the level: the locked screen until the level, then `children`.
 * Without children, the feature is open but not built yet. `above` stays over the locked screen:
 * the way to the rest of the place it belongs to.
 */
export function FeatureGate({
  feature,
  icon,
  above,
  children,
}: {
  readonly feature: LockedFeature;
  readonly icon: IconName;
  readonly above?: ReactNode;
  readonly children?: ReactNode;
}) {
  const progress = useProgress();
  const now = useNow(60_000);
  const failed = useProgressFailed();
  if (progress === null && failed) {
    return (
      <main>
        <LoadFailed onRetry={retryProgress} />
      </main>
    );
  }
  if (progress === null || now === 0) return null;
  const locked = lockedScreen(feature, progress, now);
  if (locked !== null) {
    const screen = (
      <LockedScreen
        icon={icon}
        level={locked.level}
        title={locked.title}
        text={locked.text}
        left={locked.left}
        ratio={locked.ratio}
      />
    );
    if (above === undefined) return screen;
    return (
      <div className={styles.gated}>
        {above}
        {screen}
      </div>
    );
  }
  if (children !== undefined) return children;
  const copy = feature === "jousts" ? NOT_BUILT_COPY.jousts : null;
  return copy === null ? null : <LockedScreen icon={icon} title={copy.title} text={copy.text} />;
}
