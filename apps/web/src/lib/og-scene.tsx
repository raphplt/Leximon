import { type CatalogCard, RARITY_LABELS } from "@leximon/contract";
import {
  cardSize,
  cssFill,
  type Fill,
  lettering,
  oldGold,
  rarityStyles,
  room,
  toy,
} from "@leximon/tokens";
import { formatOdds, wordFontSize } from "@leximon/view-model";
import type { CSSProperties, ReactNode } from "react";
import { SEAL_URL } from "./og-seal";

/**
 * The pieces of the share images, in the room of the game: its dark and its lamp, the green
 * desk framed in old gold, the card drawn as in the game, cream letters outlined in ink. The
 * renderer knows flexbox and a few properties only, so each piece is drawn here again in plain
 * styles, from the same tokens as the game.
 */

export const OG_SIZE = { width: 1200, height: 630 } as const;
export const OG_DOMAIN = "leximon.fr";

/** The room: the floor's dark, the lamp over the middle, the edges closing in. */
export function OgRoom({ children }: { readonly children: ReactNode }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        backgroundColor: room.floor,
        backgroundImage: `radial-gradient(ellipse 70% 60% at 50% 40%, ${room.lamp}, transparent 70%), radial-gradient(ellipse 90% 90% at 50% 50%, transparent 55%, ${room.vignette} 100%)`,
      }}
    >
      {children}
    </div>
  );
}

/** The green desk under the lamp, framed in old gold and ringed in ink. */
export function OgDesk({
  width,
  height,
  children,
}: {
  readonly width: number;
  readonly height: number;
  readonly children: ReactNode;
}) {
  const { desk } = room;
  return (
    <div
      style={{
        width,
        height,
        flexShrink: 0,
        display: "flex",
        padding: 10,
        borderRadius: desk.radius + 6,
        border: `4px solid ${toy.outline}`,
        backgroundImage: cssFill(oldGold),
        boxShadow: `0 28px 50px ${toy.drop}`,
      }}
    >
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: desk.radius,
          backgroundImage: `radial-gradient(ellipse 80% 60% at 50% 40%, ${desk.center} 0%, ${desk.middle} 55%, ${desk.edge} 100%)`,
          boxShadow: `inset 0 0 60px ${desk.hollow}`,
        }}
      >
        <div
          style={{
            flex: 1,
            alignSelf: "stretch",
            margin: desk.ruleInset + 4,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: desk.radius - desk.ruleInset,
            border: `2px solid ${desk.rule}`,
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

/** Cream letters outlined in ink with a short drop, as the titles of the game. */
export function lettered(size: number): CSSProperties {
  const reach = Math.max(lettering.minOutline / 2, (lettering.outlineRatio * size) / 2);
  const ring = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
    [0.7, 0.7],
    [-0.7, 0.7],
    [0.7, -0.7],
    [-0.7, -0.7],
  ]
    .map(([x = 0, y = 0]) => `${x * reach}px ${y * reach}px 0 ${lettering.outline}`)
    .join(", ");
  return {
    fontFamily: "Display",
    fontSize: size,
    color: lettering.fill,
    textShadow: `${ring}, 0 ${reach + lettering.drop}px 0 ${lettering.outline}`,
  };
}

/** The seal and the name, as at the top of every screen. */
export function OgBrand({ size = 44 }: { readonly size?: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: Math.round(size * 0.35) }}>
      {/* biome-ignore lint/performance/noImgElement: the image renderer draws plain img only */}
      <img src={SEAL_URL} width={size * 1.25} height={size * 1.25} alt="" />
      <div style={{ ...lettered(size), lineHeight: 1 }}>Leximon</div>
    </div>
  );
}

/** Style inking text with a fill: a plain colour, or a gradient clipped to the letters. */
function ink(
  fill: Fill,
): { color: string } | { backgroundImage: string; backgroundClip: "text"; color: "transparent" } {
  return typeof fill === "string"
    ? { color: fill }
    : { backgroundImage: cssFill(fill), backgroundClip: "text", color: "transparent" };
}

/**
 * A card face as the game draws it, at `width` px: frame, paper, rarity, the hatched slot of the
 * engraving with the word's initial, the word, its chips, the definition, collection and odds.
 * The engraving itself stays out: the renderer reads none of the catalogue's image files.
 */
export function OgCard({
  card,
  collectionName,
  width,
}: {
  readonly card: CatalogCard;
  readonly collectionName: string;
  readonly width: number;
}) {
  const u = width / cardSize.width;
  const style = rarityStyles[card.rarity];
  return (
    <div
      style={{
        width,
        height: cardSize.height * u,
        display: "flex",
        padding: 7 * u,
        borderRadius: 16 * u,
        backgroundImage: cssFill(style.frame),
        boxShadow: `0 ${16 * u}px ${36 * u}px rgba(0, 0, 0, 0.5)`,
        color: style.ink,
      }}
    >
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          gap: 6 * u,
          padding: `${10 * u}px ${14 * u}px`,
          borderRadius: 10 * u,
          backgroundColor: style.paper,
        }}
      >
        <div
          style={{
            display: "flex",
            alignSelf: "flex-start",
            padding: `${3 * u}px ${10 * u}px`,
            borderRadius: 999,
            backgroundImage: cssFill(style.band),
            color: style.bandInk,
            fontFamily: "Ui",
            fontSize: 12 * u,
          }}
        >
          {RARITY_LABELS[card.rarity]}
        </div>
        <div
          style={{
            height: 118 * u,
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 10 * u,
            backgroundImage: `repeating-linear-gradient(35deg, ${style.hatch} 0px, ${style.hatch} ${1.2 * u}px, transparent ${1.2 * u}px, transparent ${5 * u}px)`,
          }}
        >
          <div
            style={{
              fontFamily: "Display",
              fontSize: 88 * u,
              lineHeight: 1,
              color: style.paper,
              WebkitTextStroke: `${2.5 * u}px ${style.ink}`,
            }}
          >
            {card.word.slice(0, 1)}
          </div>
        </div>
        <div
          style={{
            marginTop: 2 * u,
            fontFamily: "Display",
            fontSize: wordFontSize(card.word) * u,
            lineHeight: 0.95,
            ...ink(style.word),
          }}
        >
          {card.word}
        </div>
        <div style={{ display: "flex", gap: 5 * u }}>
          {[card.partOfSpeech, card.era].flatMap((chip) =>
            chip === null
              ? []
              : [
                  <div
                    key={chip}
                    style={{
                      display: "flex",
                      padding: `${2 * u}px ${7 * u}px`,
                      borderRadius: 8 * u,
                      backgroundColor: style.chip,
                      color: style.chipInk,
                      fontFamily: "Ui",
                      fontSize: 10 * u,
                    }}
                  >
                    {chip}
                  </div>,
                ],
          )}
        </div>
        <div style={{ fontFamily: "Text", fontSize: 14.5 * u, lineHeight: 1.27 }}>
          {card.definition}
        </div>
        <div
          style={{
            marginTop: "auto",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontFamily: "Ui",
            fontSize: 10 * u,
            letterSpacing: 0.4 * u,
            textTransform: "uppercase",
            color: style.muted,
          }}
        >
          <div>{collectionName}</div>
          <div style={{ fontSize: 11 * u, textTransform: "none", color: style.spot }}>
            {formatOdds(card.perBillion)}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Every letter an `OgCard` prints, for the fonts cut down to what the image uses. */
export function cardGlyphs(card: CatalogCard, collectionName: string) {
  return {
    display: card.word,
    ui:
      RARITY_LABELS[card.rarity] +
      card.partOfSpeech +
      (card.era ?? "") +
      collectionName.toUpperCase() +
      formatOdds(card.perBillion),
    text: card.definition,
  };
}
