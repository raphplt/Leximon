import { fonts, lettering } from "@leximon/tokens";
import { LANDING_TITLE } from "@leximon/view-model";
import { ImageResponse } from "next/og";
import { readShowcase } from "@/landing/showcase-server";
import { googleFont } from "@/lib/og-fonts";
import {
  cardGlyphs,
  lettered,
  OG_DOMAIN,
  OG_SIZE,
  OgBrand,
  OgCard,
  OgDesk,
  OgRoom,
} from "@/lib/og-scene";

export const alt = "Leximon, le jeu de cartes des mots rares et oubliés du français.";
export const size = OG_SIZE;
export const contentType = "image/png";

/** The card on the desk: a word of the home page, read from the published catalogue. */
const SHOWN_WORD = "lucubrateur";

/** Shared image of the site, rendered once at build time. */
export default async function Image() {
  const showcase = await readShowcase();
  const card = showcase.heroWords.find((word) => word.id === SHOWN_WORD) ?? null;
  const collectionName =
    showcase.shelves.find((shelf) => shelf.id === card?.collectionId)?.name ?? "";
  const glyphs =
    card === null ? { display: "", ui: "", text: "" } : cardGlyphs(card, collectionName);

  const [display, ui, text] = await Promise.all([
    googleFont(
      `${fonts.display.family}:opsz,wght,SOFT@72,${fonts.display.weight},${fonts.display.soft}`,
      `Leximon${LANDING_TITLE}${glyphs.display}`,
    ),
    googleFont(`${fonts.ui.family}:wght@800`, OG_DOMAIN + glyphs.ui),
    googleFont(`${fonts.text.family}:wght@400`, glyphs.text || "a"),
  ]);

  return new ImageResponse(
    <OgRoom>
      <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 48, padding: "0 64px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 40, flex: 1 }}>
          <OgBrand size={40} />
          <div style={{ ...lettered(60), lineHeight: 1.08 }}>{LANDING_TITLE}</div>
          <div style={{ fontFamily: "Ui", fontSize: 26, color: lettering.fill }}>{OG_DOMAIN}</div>
        </div>
        {card !== null && (
          <OgDesk width={460} height={540}>
            <div style={{ display: "flex", transform: "rotate(3deg)" }}>
              <OgCard card={card} collectionName={collectionName} width={320} />
            </div>
          </OgDesk>
        )}
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
