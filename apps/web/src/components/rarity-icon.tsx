import { RARITY_LABELS } from "@leximon/contract";
import { RARITIES, type Rarity } from "@leximon/core";
import { cssFill, rarityIconGrid, rarityIcons, rarityStyles } from "@leximon/tokens";
import { type CSSProperties, useId } from "react";
import styles from "./rarity-icon.module.css";

/**
 * The rarity's gem (`@leximon/tokens`), painted in currentColor with its cut lines knocked out.
 * Decorative: the element around it carries the rarity name.
 */
export function RarityIcon({
  rarity,
  size = "1em",
}: {
  readonly rarity: Rarity;
  /** Any CSS length; 1em follows the text around it. */
  readonly size?: string;
}) {
  const maskId = useId();
  const shape = rarityIcons[rarity];
  const box = `0 0 ${rarityIconGrid} ${rarityIconGrid}`;
  return (
    <svg
      className={styles.icon}
      viewBox={box}
      width={size}
      height={size}
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="100%" height="100%">
        <rect width={rarityIconGrid} height={rarityIconGrid} fill="#fff" />
        {shape.cuts.map((cut) =>
          cut.kind === "line" ? (
            <path
              key={cut.d}
              d={cut.d}
              fill="none"
              stroke="#000"
              strokeWidth={cut.width}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : (
            <path key={cut.d} d={cut.d} fill="#000" />
          ),
        )}
      </mask>
      <g mask={`url(#${maskId})`}>
        {shape.body.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
    </svg>
  );
}

/**
 * The gem in its round chip of the rarity colour, followed by the name: how the interface names
 * a rarity outside the card face. `text` replaces the name, e.g. "2 Épique".
 */
export function RarityName({
  rarity,
  text = RARITY_LABELS[rarity],
}: {
  readonly rarity: Rarity;
  readonly text?: string;
}) {
  const style = rarityStyles[rarity];
  const chip = { background: cssFill(style.band), color: style.bandInk } as CSSProperties;
  return (
    <span className={styles.name}>
      <span className={styles.chip} style={chip} aria-hidden="true">
        <RarityIcon rarity={rarity} size="1.1em" />
      </span>
      {text}
    </span>
  );
}

/**
 * The six rarities in order, from Courant to Légendaire, the card's one lit: where it stands,
 * at a glance. Each gem gives its name on hover.
 */
export function RarityLadder({ rarity }: { readonly rarity: Rarity }) {
  const rank = RARITIES.indexOf(rarity);
  return (
    <span
      className={styles.ladder}
      role="img"
      aria-label={`${RARITY_LABELS[rarity]} : ${rank + 1}e rareté sur ${RARITIES.length}, de ${RARITY_LABELS.common} à ${RARITY_LABELS.legendary}`}
    >
      {RARITIES.map((step) => {
        const style = rarityStyles[step];
        return (
          <span
            key={step}
            className={step === rarity ? styles.stepOn : styles.step}
            style={{ background: cssFill(style.band), color: style.bandInk } as CSSProperties}
            title={RARITY_LABELS[step]}
          >
            <RarityIcon rarity={step} size="0.8em" />
          </span>
        );
      })}
    </span>
  );
}
