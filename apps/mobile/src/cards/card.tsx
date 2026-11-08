import type { CatalogCard } from "@leximon/contract";
import { RARITY_LABELS } from "@leximon/contract";
import type { Rarity } from "@leximon/core";
import { cardSize, rarityStyles, solidColor } from "@leximon/tokens";
import {
  ENGRAVING_SLOT,
  type Engraving,
  engravingBox,
  engravingOf,
  formatOdds,
  hasPlate,
  wordFontSize,
  wordWidthEm,
} from "@leximon/view-model";
import { type ReactNode, useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import Svg, {
  Defs,
  Mask,
  Pattern,
  Rect,
  Image as SvgImage,
  Text as SvgText,
} from "react-native-svg";
import { fonts } from "@/theme";
import { FillGradient, paintOf } from "@/ui/fill";
import { RarityIcon } from "@/ui/rarity-icon";
import { catalogFileUrl } from "./catalog";

/** Room for the word on the reference card: its width less the frame and the paper's margins. */
const TEXT_WIDTH = 258;
const QUOTE_LINE = 1.3;
/** Below this width the paper's chain lines fall under a point: a grid draws them for nothing. */
const CHAIN_LINES_FROM = 180;

/**
 * A card face drawn from the rarity tokens at any width, every measure a multiple of one pixel
 * of the 300 × 420 reference card. Pure display: no state but its own layout, no data access.
 */
export function Card({
  card,
  collectionName,
  width = cardSize.width,
}: {
  readonly card: CatalogCard;
  readonly collectionName: string;
  readonly width?: number;
}) {
  const u = width / cardSize.width;
  const style = rarityStyles[card.rarity];
  const height = cardSize.height * u;
  const engraving = engravingOf(card);
  return (
    <View
      style={[styles.card, { width, height, borderRadius: 16 * u }]}
      accessible
      accessibilityLabel={`${card.word}, ${RARITY_LABELS[card.rarity]}`}
    >
      <CardFrame rarity={card.rarity} width={width} height={height} />
      <View style={[styles.inner, { padding: 7 * u, gap: 6 * u }]}>
        <View style={{ paddingHorizontal: 14 * u, paddingTop: 10 * u, zIndex: 1 }}>
          <Band rarity={card.rarity} u={u} />
        </View>
        <View style={{ paddingHorizontal: 14 * u }}>
          {engraving === null ? (
            <View style={[styles.slot, { height: ENGRAVING_SLOT.height * u, marginTop: 2 * u }]}>
              <Text style={[styles.initial, { fontSize: 88 * u, color: style.ink }]}>
                {card.word.slice(0, 1)}
              </Text>
            </View>
          ) : (
            <EngravingPrint card={card} engraving={engraving} u={u} />
          )}
        </View>
        <View
          style={[styles.body, { paddingHorizontal: 14 * u, paddingBottom: 10 * u, gap: 6 * u }]}
        >
          <Word card={card} u={u} />
          <View style={[styles.chips, { gap: 5 * u }]}>
            <Chip text={card.partOfSpeech} card={card} u={u} />
            {card.era !== null && <Chip text={card.era} card={card} u={u} />}
          </View>
          <Text
            style={[
              styles.definition,
              { fontSize: 14.5 * u, lineHeight: 14.5 * 1.27 * u, color: style.ink },
            ]}
          >
            {card.definition}
          </Text>
          {card.quote !== null && <Quote quote={card.quote} card={card} u={u} />}
          <View style={styles.footer}>
            <Text
              style={[
                styles.collection,
                { fontSize: 10 * u, letterSpacing: 0.4 * u, color: style.muted },
              ]}
              numberOfLines={1}
            >
              {collectionName.toUpperCase()}
            </Text>
            <Text style={[styles.odds, { fontSize: 11 * u, color: style.spot }]}>
              {formatOdds(card.perBillion)}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

/** The frame of a card in its rarity's fill, the paper inside it and the double rule. */
function CardFrame({
  rarity,
  width,
  height,
}: {
  readonly rarity: Rarity;
  readonly width: number;
  readonly height: number;
}) {
  const u = width / cardSize.width;
  const style = rarityStyles[rarity];
  return (
    <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
      <Defs>
        <FillGradient id="frame" fill={style.frame} />
      </Defs>
      <Rect width={width} height={height} rx={16 * u} fill={paintOf("frame", style.frame)} />
      <Rect
        x={7 * u}
        y={7 * u}
        width={width - 14 * u}
        height={height - 14 * u}
        rx={10 * u}
        fill={style.paper}
      />
      {/* Laid paper: sparse chain lines in the ink's tone. */}
      {width >= CHAIN_LINES_FROM &&
        Array.from({ length: 9 }, (_, i) => (
          <Rect
            // biome-ignore lint/suspicious/noArrayIndexKey: a line of the paper is its place.
            key={i}
            x={(7 + 30 * (i + 1)) * u}
            y={7 * u}
            width={0.7 * u}
            height={height - 14 * u}
            fill={style.ink}
            opacity={0.06}
          />
        ))}
      {/* The double rule inside the frame, in the frame's own fill. */}
      <Rect
        x={11.15 * u}
        y={11.15 * u}
        width={width - 22.3 * u}
        height={height - 22.3 * u}
        rx={6 * u}
        fill="none"
        stroke={paintOf("frame", style.frame)}
        strokeWidth={1.3 * u}
      />
      <Rect
        x={13.45 * u}
        y={13.45 * u}
        width={width - 26.9 * u}
        height={height - 26.9 * u}
        rx={3.8 * u}
        fill="none"
        stroke={paintOf("frame", style.frame)}
        strokeWidth={0.5 * u}
      />
    </Svg>
  );
}

/**
 * The face of a card still to guess, as a joust asks it: the frame and gem of its rarity, a « ? »
 * where the engraving and the word would give it away, and the definition in large.
 */
export function QuestionCard({
  rarity,
  width = cardSize.width,
  children,
}: {
  readonly rarity: Rarity;
  readonly width?: number;
  /** The definition, the words of its family hidden. */
  readonly children: ReactNode;
}) {
  const u = width / cardSize.width;
  const style = rarityStyles[rarity];
  const height = cardSize.height * u;
  return (
    <View
      style={[styles.card, { width, height, borderRadius: 16 * u }]}
      accessible
      accessibilityLabel={`Carte ${RARITY_LABELS[rarity]} à deviner`}
    >
      <CardFrame rarity={rarity} width={width} height={height} />
      <View style={[styles.inner, { padding: 7 * u, gap: 6 * u }]}>
        <View style={{ paddingHorizontal: 14 * u, paddingTop: 10 * u }}>
          <Band rarity={rarity} u={u} />
        </View>
        <View style={{ paddingHorizontal: 14 * u }}>
          <View style={[styles.slot, { height: 84 * u, marginTop: 2 * u, borderRadius: 10 * u }]}>
            <Svg style={StyleSheet.absoluteFill}>
              <Defs>
                <Pattern
                  id="mystery-hatch"
                  width={5 * u}
                  height={5 * u}
                  patternUnits="userSpaceOnUse"
                  patternTransform="rotate(35)"
                >
                  <Rect width={1.2 * u} height={5 * u} fill={style.hatch} />
                </Pattern>
              </Defs>
              <Rect width="100%" height="100%" fill="url(#mystery-hatch)" />
            </Svg>
            <Text style={[styles.initial, { fontSize: 88 * u, color: style.ink }]}>?</Text>
          </View>
        </View>
        <View style={[styles.question, { paddingHorizontal: 18 * u }]}>
          <Text
            style={[
              styles.definition,
              {
                fontSize: 21 * u,
                lineHeight: 21 * 1.28 * u,
                color: style.ink,
                textAlign: "center",
              },
            ]}
          >
            {children}
          </Text>
        </View>
        <Text
          style={[
            styles.collection,
            {
              paddingHorizontal: 14 * u,
              paddingBottom: 10 * u,
              fontSize: 10 * u,
              letterSpacing: 0.4 * u,
              color: style.muted,
            },
          ]}
        >
          QUEL EST CE MOT ?
        </Text>
      </View>
    </View>
  );
}

function Band({ rarity, u }: { readonly rarity: Rarity; readonly u: number }) {
  const style = rarityStyles[rarity];
  const size = 32 * u;
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Defs>
          <FillGradient id="band" fill={style.band} />
        </Defs>
        <Rect width={size} height={size} rx={size / 2} fill={paintOf("band", style.band)} />
      </Svg>
      <RarityIcon rarity={rarity} size={22 * u} color={style.bandInk} />
    </View>
  );
}

/**
 * The engraving printed like a two-pass woodcut: the ink in the word's colour over a plate of the
 * rarity colour, slightly out of register. Both files are alpha masks, tinted here.
 */
function EngravingPrint({
  card,
  engraving,
  u,
}: {
  readonly card: CatalogCard;
  readonly engraving: Engraving;
  readonly u: number;
}) {
  const style = rarityStyles[card.rarity];
  const box = engravingBox(engraving);
  const size = { width: box.width * u, height: box.height * u };
  const night = typeof style.word !== "string";
  const place = box.tall
    ? { bottom: 0, left: ENGRAVING_SLOT.width * 0.62 * u - size.width / 2 }
    : {
        top: ((ENGRAVING_SLOT.height - box.height) / 2) * u,
        left: ((ENGRAVING_SLOT.width - box.width) / 2) * u,
      };
  return (
    <View
      style={{ height: ENGRAVING_SLOT.height * u, marginTop: 2 * u }}
      importantForAccessibility="no-hide-descendants"
    >
      <View style={[styles.print, size, place]}>
        {hasPlate(card.rarity) && (
          <Image
            source={{ uri: catalogFileUrl(engraving.fill) }}
            style={[
              StyleSheet.absoluteFill,
              {
                tintColor: solidColor(style.frame),
                opacity: night ? 0.3 : 0.5,
                transform: [{ translateX: 2 * u }, { translateY: 1.5 * u }],
              },
            ]}
            resizeMode="stretch"
          />
        )}
        {typeof style.word === "string" ? (
          <Image
            source={{ uri: catalogFileUrl(engraving.ink) }}
            style={[StyleSheet.absoluteFill, { tintColor: style.word }]}
            resizeMode="stretch"
          />
        ) : (
          // A gradient cannot tint an image: the ink file masks a rectangle painted with it.
          <Svg width={size.width} height={size.height} style={StyleSheet.absoluteFill}>
            <Defs>
              <FillGradient id="ink" fill={style.word} />
              <Mask id="engraving" maskType="alpha">
                <SvgImage
                  href={catalogFileUrl(engraving.ink)}
                  width={size.width}
                  height={size.height}
                  preserveAspectRatio="none"
                />
              </Mask>
            </Defs>
            <Rect
              width={size.width}
              height={size.height}
              fill={paintOf("ink", style.word)}
              mask="url(#engraving)"
            />
          </Svg>
        )}
      </View>
    </View>
  );
}

/** The word on one line, shrunk for long ones; gold and iridescent words are painted in SVG. */
function Word({ card, u }: { readonly card: CatalogCard; readonly u: number }) {
  const style = rarityStyles[card.rarity];
  const size = wordFontSize(card.word) * u;
  const text = { fontFamily: fonts.display, fontSize: size, letterSpacing: -0.015 * size };
  if (typeof style.word === "string") {
    return (
      <Text
        style={[
          styles.word,
          text,
          { lineHeight: size * 0.95, marginTop: 2 * u, color: style.word },
        ]}
      >
        {card.word}
      </Text>
    );
  }
  const room = TEXT_WIDTH * u;
  const natural = wordWidthEm(card.word) * size;
  return (
    <Svg width={room} height={size * 1.05} style={{ marginTop: 2 * u }}>
      <Defs>
        <FillGradient id="word" fill={style.word} />
      </Defs>
      <SvgText
        x={0}
        y={size * 0.8}
        fontFamily={fonts.display}
        fontSize={size}
        letterSpacing={-0.015 * size}
        fill={paintOf("word", style.word)}
        {...(natural > room ? { textLength: room, lengthAdjust: "spacingAndGlyphs" as const } : {})}
      >
        {card.word}
      </SvgText>
    </Svg>
  );
}

function Chip({
  text,
  card,
  u,
}: {
  readonly text: string;
  readonly card: CatalogCard;
  readonly u: number;
}) {
  const style = rarityStyles[card.rarity];
  return (
    <Text
      style={[
        styles.chip,
        {
          fontSize: 10.5 * u,
          paddingHorizontal: 7 * u,
          paddingVertical: 2 * u,
          borderRadius: 8 * u,
          backgroundColor: style.chip,
          color: style.chipInk,
        },
      ]}
    >
      {text}
    </Text>
  );
}

/**
 * The quote takes the room the definition leaves, in whole lines, the last one ending with « … »;
 * it leaves the face when not one line fits.
 */
function Quote({
  quote,
  card,
  u,
}: {
  readonly quote: NonNullable<CatalogCard["quote"]>;
  readonly card: CatalogCard;
  readonly u: number;
}) {
  const style = rarityStyles[card.rarity];
  const lineHeight = 12.5 * QUOTE_LINE * u;
  /** Lines that fit; null while measuring. */
  const [lines, setLines] = useState<number | null>(null);
  return (
    <View
      style={styles.quoteRoom}
      onLayout={(event) => {
        if (lines === null)
          setLines(Math.floor(event.nativeEvent.layout.height / lineHeight + 0.1));
      }}
    >
      {lines !== 0 && (
        <Text
          style={[styles.quote, { fontSize: 12.5 * u, lineHeight, color: style.muted }]}
          {...(lines === null ? {} : { numberOfLines: lines })}
        >
          « {quote.text} » <Text style={[styles.author, { fontSize: 10 * u }]}>{quote.author}</Text>
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
  inner: { flex: 1 },
  question: { flex: 1, justifyContent: "center" },
  slot: { alignItems: "center", justifyContent: "center", overflow: "hidden" },
  print: { position: "absolute" },
  initial: { fontFamily: fonts.display, includeFontPadding: false },
  body: { flex: 1 },
  word: { includeFontPadding: false },
  chips: { flexDirection: "row" },
  chip: { fontFamily: fonts.ui.bold, overflow: "hidden", includeFontPadding: false },
  definition: { fontFamily: fonts.text.medium },
  quoteRoom: { flexShrink: 1, flexGrow: 1, minHeight: 0, overflow: "hidden" },
  quote: { fontFamily: fonts.text.italic },
  author: { fontFamily: fonts.ui.bold },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
    marginTop: "auto",
  },
  collection: { flexShrink: 1, fontFamily: fonts.ui.bold },
  odds: { fontFamily: fonts.ui.extrabold },
});
