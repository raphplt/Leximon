import { RARITY_LABELS, slugSchema } from "@leximon/contract";
import { fonts, lettering } from "@leximon/tokens";
import { frequencyLine } from "@leximon/view-model";
import { ImageResponse } from "next/og";
import { readCatalogCard } from "@/cards/catalog-server";
import { googleFont } from "@/lib/og-fonts";
import { cardGlyphs, OG_DOMAIN, OG_SIZE, OgBrand, OgCard, OgDesk, OgRoom } from "@/lib/og-scene";

export const alt = "Une carte de Leximon";
export const size = OG_SIZE;
export const contentType = "image/png";

const DISPLAY = `${fonts.display.family}:opsz,wght,SOFT@72,${fonts.display.weight},${fonts.display.soft}`;

/**
 * The image of a shared card: the card as the game draws it, lying on the desk, and beside it
 * how rare its word is in print. Drawn on demand by Next from the published catalogue, which
 * never changes a published card; nothing goes through the queue.
 */
export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const id = slugSchema.safeParse((await params).id);
  const found = id.success ? await readCatalogCard(id.data).catch(() => null) : null;
  if (found === null) return fallbackImage();

  const { card, collectionName } = found;
  const rarity = RARITY_LABELS[card.rarity];
  const frequency = frequencyLine(card.perBillion);
  const glyphs = cardGlyphs(card, collectionName);

  const [display, ui, text] = await Promise.all([
    googleFont(DISPLAY, `Leximon${glyphs.display}${card.word.slice(0, 1)}`),
    googleFont(`${fonts.ui.family}:wght@800`, glyphs.ui + rarity + collectionName + OG_DOMAIN),
    googleFont(`${fonts.text.family}:wght@400`, glyphs.text + frequency),
  ]);

  return new ImageResponse(
    <OgRoom>
      <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 56, padding: "0 64px" }}>
        <OgDesk width={500} height={560}>
          <div style={{ display: "flex", transform: "rotate(-3deg)" }}>
            <OgCard card={card} collectionName={collectionName} width={330} />
          </div>
        </OgDesk>
        <div style={{ display: "flex", flexDirection: "column", gap: 26, flex: 1 }}>
          <OgBrand size={40} />
          <div
            style={{ fontFamily: "Text", fontSize: 48, lineHeight: 1.18, color: lettering.fill }}
          >
            {frequency}
          </div>
          <div style={{ fontFamily: "Ui", fontSize: 26, color: lettering.kicker }}>
            {`${rarity} · ${collectionName}`}
          </div>
          <div style={{ marginTop: 18, fontFamily: "Ui", fontSize: 24, color: lettering.fill }}>
            {OG_DOMAIN}
          </div>
        </div>
      </div>
    </OgRoom>,
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

/** An unknown card still gets an image: the seal and the game's name, in the room. */
async function fallbackImage() {
  const display = await googleFont(DISPLAY, "Leximon");
  return new ImageResponse(
    <OgRoom>
      <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
        <OgBrand size={110} />
      </div>
    </OgRoom>,
    {
      ...size,
      fonts: [{ name: "Display", data: display, weight: fonts.display.weight, style: "normal" }],
    },
  );
}
