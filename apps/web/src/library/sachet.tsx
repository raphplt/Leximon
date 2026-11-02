"use client";

import { sachetCloths } from "@leximon/tokens";
import type { CSSProperties } from "react";
import { type PackCollection, PackSeal, packVariables } from "@/booster/pack-looks";
import { catalogFileUrl } from "@/cards/catalog";
import styles from "./sachet.module.css";

function clothOf(back: string | undefined): readonly [string, string, string] {
  return back !== undefined && Object.hasOwn(sachetCloths, back)
    ? sachetCloths[back as keyof typeof sachetCloths]
    : sachetCloths.night;
}

/**
 * The sachet of « La Bibliothèque »: cloth in the collection's color under a gilt frame, an
 * engraved medallion, a red ribbon with the collection's name and the house's wax seal. It floats
 * on the desk while it waits, trembles with light leaking from its seam while it charges, then
 * loses its top and falls away as it bursts. Empty, it stays grey until the next one.
 */
export type LibrarySachetState = "sealed" | "empty" | "charging" | "burst";

const STATES: Readonly<Record<LibrarySachetState, string | undefined>> = {
  sealed: undefined,
  empty: styles.empty,
  charging: styles.charging,
  burst: styles.burst,
};

export function LibrarySachet({
  collection,
  label,
  countLabel,
  state = "sealed",
  onOpen,
}: {
  readonly collection: PackCollection;
  /** What touching it does, for a screen reader. */
  readonly label: string;
  readonly countLabel: string;
  readonly state?: LibrarySachetState;
  readonly onOpen?: () => void;
}) {
  const [light, middle, dark] = clothOf(collection.back);
  const cloth = {
    ...packVariables(collection),
    "--cloth-light": light,
    "--cloth-middle": middle,
    "--cloth-dark": dark,
  } as CSSProperties;
  return (
    <div className={[styles.zone, STATES[state]].filter(Boolean).join(" ")}>
      <div className={styles.aura} />
      <button
        type="button"
        className={styles.sachet}
        style={cloth}
        aria-label={label}
        disabled={state !== "sealed"}
        onClick={onOpen}
      >
        <span className={styles.top}>
          <span className={styles.tear} />
        </span>
        <span className={styles.body}>
          <span className={styles.brand}>Leximon</span>
          <span className={styles.medallion}>
            {collection.engraving === undefined ? (
              <PackSeal collectionId={collection.id} className={styles.seal} />
            ) : (
              <i
                className={styles.engraving}
                style={
                  { "--ink": `url("${catalogFileUrl(collection.engraving)}")` } as CSSProperties
                }
              />
            )}
          </span>
          <span className={styles.ribbon}>{collection.name}</span>
          <span className={styles.count}>{countLabel}</span>
          {/* biome-ignore lint/performance/noImgElement: a small static SVG, not worth an optimizer */}
          <img className={styles.wax} src="/logo-mark.svg" alt="" width={32} height={32} />
          <span className={styles.shine} />
        </span>
      </button>
      <div className={styles.shadow} />
    </div>
  );
}
