import { RARITY_LABELS, slugSchema } from "@leximon/contract";
import { colors, fonts, rarityStyles, solidColor } from "@leximon/tokens";
import { capitalize, formatOdds, frequencyLine } from "@leximon/view-model";
import { ImageResponse } from "next/og";
import { readCatalogCard } from "@/cards/catalog-server";
import { googleFont } from "@/lib/og-fonts";

export const alt = "Une carte de Leximon";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const DOMAIN = "leximon.fr";

/**
 * The image of a shared card: the card drawn in its rarity's colours, the word's frequency in
 * print beside it. Drawn on demand by Next from the published catalogue, which never changes
 * a published card; nothing goes through the queue.
 */
export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const id = slugSchema.safeParse((await params).id);
  const found = id.success ? await readCatalogCard(id.data).catch(() => null) : null;
  if (found === null) return fallbackImage();

  const { card, collectionName } = found;
  const style = rarityStyles[card.rarity];
  const word = capitalize(card.word);
  const rarity = RARITY_LABELS[card.rarity];
  const odds = formatOdds(card.perBillion);
  const frequency = frequencyLine(card.perBillion);
  const partOfSpeech = card.partOfSpeech;

  const [display, ui, text] = await Promise.all([
    googleFont(
      `${fonts.display.family}:opsz,wght,SOFT@72,${fonts.display.weight},${fonts.display.soft}`,
      `Leximon${word}`,
    ),
    googleFont(
      `${fonts.ui.family}:wght@800`,
      rarity + odds + partOfSpeech + collectionName + DOMAIN,
    ),
    googleFont(`${fonts.text.family}:wght@400`, card.definition + frequency),
  ]);

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        gap: 64,
        padding: "48px 80px",
        backgroundColor: colors.background,
        backgroundImage: "linear-gradient(110deg, #2C3459 0%, #262B40 60%, #1F2337 100%)",
        color: colors.text,
      }}
    >
      <div
        style={{
          width: 360,
          height: 504,
          flexShrink: 0,
          display: "flex",
          flexDirection: "column",
          padding: "26px 28px",
          borderRadius: 20,
          border: `14px solid ${solidColor(style.frame)}`,
          backgroundColor: style.paper,
          color: style.ink,
          transform: "rotate(-3deg)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignSelf: "flex-start",
            padding: "6px 14px",
            borderRadius: 999,
            backgroundColor: solidColor(style.band),
            color: style.bandInk,
            fontFamily: "Ui",
            fontSize: 20,
          }}
        >
          {rarity}
        </div>
        <div
          style={{
            marginTop: 22,
            fontFamily: "Display",
            fontSize: wordSize(word),
            lineHeight: 1.05,
            color: solidColor(style.word),
          }}
        >
          {word}
        </div>
        <div style={{ marginTop: 6, fontFamily: "Ui", fontSize: 20, color: style.muted }}>
          {partOfSpeech}
        </div>
        <div style={{ marginTop: 22, fontFamily: "Text", fontSize: 25, lineHeight: 1.35 }}>
          {card.definition}
        </div>
        <div
          style={{
            marginTop: "auto",
            display: "flex",
            justifyContent: "flex-end",
            fontFamily: "Ui",
            fontSize: 20,
            color: style.spot,
          }}
        >
          {odds}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 22, flex: 1 }}>
        <div style={{ fontFamily: "Display", fontSize: 44 }}>Leximon</div>
        <div style={{ fontFamily: "Text", fontSize: 46, lineHeight: 1.2 }}>{frequency}</div>
        <div style={{ fontFamily: "Ui", fontSize: 26, color: colors.textMuted }}>
          {collectionName}
        </div>
        <div style={{ marginTop: 30, fontFamily: "Ui", fontSize: 24, color: colors.accent }}>
          {DOMAIN}
        </div>
      </div>
    </div>,
    {
      ...size,
      fonts: [
        { name: "Display", data: display, weight: fonts.display.weight, style: "normal" },
        { name: "Ui", data: ui, weight: 800, style: "normal" },
        { name: "Text", data: text, weight: 400, style: "normal" },
      ],
    },
  );
}

/** Inside the card's 276 px, Fraunces Black runs about 0.62 em a letter: long words shrink. */
function wordSize(word: string): number {
  return Math.min(56, Math.floor(276 / (word.length * 0.62)));
}

/** An unknown card still gets an image: the game's name on its background. */
async function fallbackImage() {
  const display = await googleFont(
    `${fonts.display.family}:opsz,wght,SOFT@72,${fonts.display.weight},${fonts.display.soft}`,
    "Leximon",
  );
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.background,
        color: colors.text,
        fontFamily: "Display",
        fontSize: 120,
      }}
    >
      Leximon
    </div>,
    {
      ...size,
      fonts: [{ name: "Display", data: display, weight: fonts.display.weight, style: "normal" }],
    },
  );
}
