import { alpha, colors, cssFill, type Fill, fonts, rarityStyles } from "@leximon/tokens";
import { frequencyLine } from "@leximon/view-model";
import { ImageResponse } from "next/og";
import { googleFont } from "@/lib/og-fonts";

export const alt = "Leximon, le jeu de cartes des mots rares et oubliés du français.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const TAGLINE = "La langue a jeté des mots superbes. On les a ramassés.";
const DOMAIN = "leximon.fr";

/**
 * One word of the catalogue printed on a dictionary slip, as on the home page. Copied from the
 * published card (lucubrateur, Précieux): the image is rendered at build time, without the API.
 */
const SLIP = {
  word: "lucubrateur",
  meta: "Précieux · n. m.",
  definition:
    "Celui qui travaille intensément à des ouvrages de l'esprit, surtout la nuit, à la lueur de la lampe.",
  frequency: frequencyLine(0.0585),
  style: rarityStyles.precious,
} as const;

/** Shared image of the site, rendered once at build time. */
export default async function Image() {
  const [display, ui, text] = await Promise.all([
    googleFont(
      `${fonts.display.family}:opsz,wght,SOFT@72,${fonts.display.weight},${fonts.display.soft}`,
      `Leximon${TAGLINE}${SLIP.word}`,
    ),
    googleFont(`${fonts.ui.family}:wght@800`, DOMAIN + SLIP.meta + SLIP.frequency),
    googleFont(`${fonts.text.family}:wght@400`, SLIP.definition),
  ]);
  const { style } = SLIP;

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        backgroundColor: colors.page,
        backgroundImage: `radial-gradient(ellipse at 70% 40%, ${colors.pageRaised} 0%, ${colors.page} 70%)`,
        color: colors.pageInk,
      }}
    >
      <div
        style={{
          width: 560,
          height: "100%",
          padding: "60px 0 56px 72px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
        }}
      >
        <div style={{ fontFamily: "Display", fontSize: 48 }}>Leximon</div>
        <div style={{ fontFamily: "Display", fontSize: 58, lineHeight: 1.04 }}>{TAGLINE}</div>
        <div style={{ fontFamily: "Ui", fontSize: 24, color: colors.pageInkMuted }}>{DOMAIN}</div>
      </div>
      <div
        style={{
          width: 520,
          marginLeft: 40,
          padding: "40px 44px",
          display: "flex",
          flexDirection: "column",
          gap: 18,
          borderRadius: 8,
          backgroundColor: style.paper,
          color: style.ink,
          boxShadow: `0 28px 60px ${alpha(colors.shade, 0.45)}`,
          transform: "rotate(-2deg)",
        }}
      >
        <div style={{ fontFamily: "Ui", fontSize: 20, color: style.muted }}>{SLIP.meta}</div>
        <div style={{ fontFamily: "Display", fontSize: 74, lineHeight: 1, ...ink(style.word) }}>
          {SLIP.word}
        </div>
        <div style={{ fontFamily: "Text", fontSize: 26, lineHeight: 1.35 }}>{SLIP.definition}</div>
        <div style={{ fontFamily: "Ui", fontSize: 20, color: style.muted }}>{SLIP.frequency}</div>
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

/** Style inking text with a fill: a plain colour, or a gradient clipped to the letters. */
function ink(
  fill: Fill,
): { color: string } | { backgroundImage: string; backgroundClip: "text"; color: "transparent" } {
  return typeof fill === "string"
    ? { color: fill }
    : { backgroundImage: cssFill(fill), backgroundClip: "text", color: "transparent" };
}
