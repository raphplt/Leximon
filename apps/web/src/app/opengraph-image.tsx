import { colors, cssFill, type Fill, fonts, type RarityStyle, rarityStyles } from "@leximon/tokens";
import { ImageResponse } from "next/og";

export const alt =
  "Leximon, jeu de cartes à collectionner : « Collectionne les mots que la langue a oubliés. »";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const KICKER = "JEU DE CARTES À COLLECTIONNER";
const TAGLINE = "Collectionne les mots que la langue a oubliés.";
const DOMAIN = "leximon.fr";

/** Words of the published catalogue, already quoted by the landing page. The last one is on top. */
const FAN = [
  { word: "orviétan", style: rarityStyles.uncommon, angle: -9, x: 0, y: 30 },
  { word: "charivarieur", style: rarityStyles.rare, angle: 8, x: 320, y: 30 },
  { word: "lucubrateur", style: rarityStyles.epic, angle: 0, x: 160, y: 0 },
] as const;

const CARD = { width: 190, height: 266 } as const;

/** Shared image of the site, rendered once at build time. */
export default async function Image() {
  const displayText = ["Leximon", TAGLINE, ...FAN.map((card) => card.word)].join("");
  const [display, ui] = await Promise.all([
    googleFont(
      `${fonts.display.family}:opsz,wght,SOFT@72,${fonts.display.weight},${fonts.display.soft}`,
      displayText,
    ),
    googleFont(`${fonts.ui.family}:wght@800`, KICKER + DOMAIN),
  ]);

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        position: "relative",
        backgroundColor: colors.background,
        backgroundImage: `radial-gradient(ellipse at 70% 40%, ${colors.backgroundRaised} 0%, ${colors.background} 70%)`,
        color: colors.text,
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          backgroundImage: `radial-gradient(circle, ${colors.backgroundDot} 1.5px, transparent 2px)`,
          backgroundSize: "22px 22px",
        }}
      />
      <div
        style={{
          width: 640,
          padding: "60px 0 56px 72px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
        }}
      >
        <div style={{ fontFamily: "Display", fontSize: 52 }}>Leximon</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div style={{ fontFamily: "Ui", fontSize: 22, letterSpacing: 1.8, color: colors.accent }}>
            {KICKER}
          </div>
          <div style={{ fontFamily: "Display", fontSize: 70, lineHeight: 1.04 }}>{TAGLINE}</div>
        </div>
        <div style={{ fontFamily: "Ui", fontSize: 24, color: colors.textMuted }}>{DOMAIN}</div>
      </div>
      <div
        style={{
          flex: 1,
          paddingRight: 40,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ display: "flex", position: "relative", width: 510, height: 300 }}>
          {FAN.map((card) => (
            <FanCard key={card.word} {...card} />
          ))}
        </div>
      </div>
    </div>,
    {
      ...size,
      fonts: [
        { name: "Display", data: display, weight: fonts.display.weight, style: "normal" },
        { name: "Ui", data: ui, weight: 800, style: "normal" },
      ],
    },
  );
}

/** A card reduced to its silhouette: frame, rarity chip, word, and bars in place of the text. */
function FanCard(props: { word: string; style: RarityStyle; angle: number; x: number; y: number }) {
  const { style } = props;
  return (
    <div
      style={{
        position: "absolute",
        left: props.x,
        top: props.y,
        width: CARD.width,
        height: CARD.height,
        padding: 10,
        display: "flex",
        borderRadius: 16,
        ...paint(style.frame),
        transform: `rotate(${props.angle}deg)`,
        boxShadow: "0 18px 40px rgba(0, 0, 0, 0.45)",
      }}
    >
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "16px 14px",
          gap: 12,
          borderRadius: 10,
          backgroundColor: style.paper,
        }}
      >
        <div style={{ width: 26, height: 26, borderRadius: 13, ...paint(style.band) }} />
        <div
          style={{
            fontFamily: "Display",
            fontSize: props.word.length > 10 ? 22 : 27,
            color: style.spot,
          }}
        >
          {props.word}
        </div>
        <div style={{ width: "100%", height: 84, borderRadius: 6, backgroundColor: style.chip }} />
        {[100, 86, 64].map((width) => (
          <div
            key={width}
            style={{
              width: `${width}%`,
              height: 7,
              borderRadius: 4,
              backgroundColor: style.muted,
              opacity: 0.45,
            }}
          />
        ))}
      </div>
    </div>
  );
}

/** Style painting a fill: a plain background color, or a gradient image. */
function paint(fill: Fill): { backgroundColor: string } | { backgroundImage: string } {
  return typeof fill === "string" ? { backgroundColor: fill } : { backgroundImage: cssFill(fill) };
}

/**
 * TrueType file of a Google font, cut down to the glyphs of `text`. The renderer reads neither
 * woff2 nor variable axes, so the CSS API is asked for a static instance in a format it reads.
 */
async function googleFont(family: string, text: string): Promise<ArrayBuffer> {
  const query = new URLSearchParams({ family, text: [...new Set(text)].join("") });
  const css = await (await fetchOk(`https://fonts.googleapis.com/css2?${query}`)).text();
  const url = css.match(/src: url\((.+?)\) format\('(?:opentype|truetype)'\)/)?.[1];
  if (url === undefined) throw new Error(`No TrueType file for the font ${family}`);
  return (await fetchOk(url)).arrayBuffer();
}

async function fetchOk(url: string): Promise<Response> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Font download failed (${response.status}): ${url}`);
  return response;
}
