"use client";

import {
  illumination,
  type ToyIconName,
  type ToyInk,
  type ToyMatterName,
  type ToyShape,
  toyIconGrid,
  toyIconInks,
  toyIconOutline,
  toyIcons,
  toyLights,
} from "@leximon/tokens";
import { useId } from "react";
import { Kicker, Lettering, ToyBody, ToyIcon } from "@/ui/toy";
import ui from "@/ui/ui.module.css";
import styles from "./icones-plate.module.css";

/** The icons of the room, each with the matter of its tile on the Jouer screen. */
const SAMPLES: readonly { readonly icon: ToyIconName; readonly matter: ToyMatterName }[] = [
  { icon: "missions", matter: "gold" },
  { icon: "challenge", matter: "red" },
  { icon: "clan", matter: "blue" },
  { icon: "discussion", matter: "green" },
  { icon: "jousts", matter: "red" },
  { icon: "friends", matter: "green" },
  { icon: "chest", matter: "blue" },
  { icon: "settings", matter: "gold" },
  { icon: "album", matter: "red" },
  { icon: "trades", matter: "blue" },
  { icon: "ecu", matter: "gold" },
  { icon: "mail", matter: "red" },
];

const DOORS: readonly { readonly icon: ToyIconName; readonly matter: ToyMatterName }[] = [
  { icon: "friends", matter: "green" },
  { icon: "jousts", matter: "red" },
  { icon: "settings", matter: "gold" },
];

const DOOR_LABELS: Readonly<Partial<Record<ToyIconName, string>>> = {
  friends: "Amis",
  jousts: "Joutes",
  settings: "Réglages",
};

type Look = "current" | "lettrine" | "pigments" | "gravure";

const LOOKS: readonly { readonly id: Look; readonly title: string; readonly text: string }[] = [
  {
    id: "current",
    title: "Aujourd'hui",
    text: "Les icônes « jouet » : trois aplats, un gros contour brun, un reflet blanc, sur une tuile de couleur vernie.",
  },
  {
    id: "lettrine",
    title: "A · Lettrine",
    text: "La tuile devient une lettrine : cadre à la feuille d'or, fond de couleur semé de rinceaux blancs. L'icône est peinte en vélin et en or.",
  },
  {
    id: "pigments",
    title: "B · Pigments",
    text: "L'icône garde ses couleurs mais en pigments de manuscrit (vermillon, lapis, vert-de-gris), l'or en feuille, un trait d'encre plus fin. La tuile est un carré de parchemin à double filet rouge.",
  },
  {
    id: "gravure",
    title: "C · Gravure",
    text: "Comme les gravures des cartes : encre sépia, ombres en hachures, une seule touche d'or. La plus sobre, la plus proche des cartes.",
  },
];

/** The ground of a lettrine, by the matter of the tile it replaces. */
const GROUNDS: Readonly<Record<ToyMatterName, string>> = {
  gold: illumination.pigments.madder,
  red: illumination.pigments.vermilion,
  green: illumination.pigments.verdigris,
  blue: illumination.pigments.lapis,
  paper: illumination.pigments.umber,
  locked: illumination.sepia,
  alert: illumination.pigments.vermilion,
  dark: illumination.ink,
};

/**
 * Trial of an illuminated look for the toy icons: the same drawings, painted three ways, alone
 * and on the pieces of the Jouer screen. Nothing changes in the game before a choice.
 */
export function IconesPlate() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Kicker>Planche</Kicker>
        <Lettering className={styles.title}>Icônes enluminées</Lettering>
        <p className={styles.intro}>
          Les mêmes dessins, peints de trois façons. Chaque piste se lit seule, puis sur un feuillet
          et sur les portes de l'écran Jouer.
        </p>
      </header>
      {LOOKS.map((look) => (
        <section key={look.id} className={styles.look}>
          <div className={styles.lookHead}>
            <h2 className={styles.lookTitle}>{look.title}</h2>
            <p className={styles.lookText}>{look.text}</p>
          </div>
          <div className={styles.grid}>
            {SAMPLES.map((sample) => (
              <Tile key={sample.icon} look={look.id} {...sample} size={64} />
            ))}
          </div>
          <div className={styles.context}>
            <div className={`${ui.leaf} ${styles.leaf}`}>
              <span className={styles.leafHead}>
                <Tile look={look.id} icon="challenge" matter="red" size={46} />
                <span className={styles.leafTitles}>
                  <span className={styles.leafKicker}>Défi du jour</span>
                  <span className={styles.leafTitle}>3 bonnes réponses sur 5</span>
                </span>
              </span>
              <span className={styles.leafHead}>
                <Tile look={look.id} icon="clan" matter="blue" size={46} />
                <span className={styles.leafTitles}>
                  <span className={styles.leafKicker}>Clan</span>
                  <span className={styles.leafTitle}>Trouver un clan</span>
                </span>
              </span>
            </div>
            <div className={styles.doors}>
              {DOORS.map((door) => (
                <span key={door.icon} className={styles.door}>
                  <Tile look={look.id} {...door} size={56} />
                  <span className={styles.doorLabel}>{DOOR_LABELS[door.icon]}</span>
                </span>
              ))}
            </div>
          </div>
        </section>
      ))}
    </main>
  );
}

function Tile({
  look,
  icon,
  matter,
  size,
}: {
  readonly look: Look;
  readonly icon: ToyIconName;
  readonly matter: ToyMatterName;
  readonly size: number;
}) {
  if (look === "current") {
    return (
      <span className={styles.toySlot} style={{ width: size, height: size }}>
        <ToyBody matter={matter} shape="tile" className={styles.toy}>
          <ToyIcon name={icon} size={Math.round(size * 0.56)} />
        </ToyBody>
      </span>
    );
  }
  return <IlluminatedTile look={look} icon={icon} matter={matter} size={size} />;
}

/** The tile and its icon in one drawing, on a grid of 64. */
function IlluminatedTile({
  look,
  icon,
  matter,
  size,
}: {
  readonly look: Exclude<Look, "current">;
  readonly icon: ToyIconName;
  readonly matter: ToyMatterName;
  readonly size: number;
}) {
  const id = useId().replace(/[^\w-]/g, "");
  const gold = `url(#${id}gold)`;
  const ground = GROUNDS[matter];
  const inks = inksFor(look, icon, ground, gold, `url(#${id}hatch)`);
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={styles.svg} aria-hidden="true">
      <defs>
        <linearGradient id={`${id}gold`} x1="0" y1="0" x2="1" y2="1">
          {illumination.goldLeaf.map(([color, offset]) => (
            <stop key={offset} offset={offset} stopColor={color} />
          ))}
        </linearGradient>
        <pattern id={`${id}hatch`} width="3" height="3" patternUnits="userSpaceOnUse">
          <rect width="3" height="3" fill={illumination.parchment} />
          <path d="M-1 1l2-2M0 3l3-3M2 4l2-2" stroke={illumination.sepia} strokeWidth="0.9" />
        </pattern>
        <pattern id={`${id}vine`} width="16" height="16" patternUnits="userSpaceOnUse">
          <path
            d="M2 14c0-6 6-6 6-2s-4 3-4 0M10 6c0-4 5-4 5-1s-3 2-3 0"
            fill="none"
            stroke={illumination.vellum}
            strokeOpacity="0.32"
            strokeWidth="0.9"
            strokeLinecap="round"
          />
          <circle cx="13" cy="13" r="0.9" fill={illumination.vellum} fillOpacity="0.45" />
        </pattern>
      </defs>
      {look === "lettrine" && (
        <LettrineFrame gold={gold} ground={ground} vine={`url(#${id}vine)`} />
      )}
      {look === "pigments" && <RubricFrame gold={gold} />}
      {look === "gravure" && <EngravedFrame />}
      <svg
        x="13"
        y="13"
        width="38"
        height="38"
        viewBox={`0 0 ${toyIconGrid} ${toyIconGrid}`}
        aria-hidden="true"
      >
        {toyIcons[icon].map((shape, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: a fixed drawing, painted in order
          <IlluminatedPath key={index} shape={shape} inks={inks} look={look} />
        ))}
      </svg>
    </svg>
  );
}

function LettrineFrame({
  gold,
  ground,
  vine,
}: {
  readonly gold: string;
  readonly ground: string;
  readonly vine: string;
}) {
  return (
    <>
      <rect
        x="2"
        y="2"
        width="60"
        height="60"
        rx="7"
        fill={gold}
        stroke={illumination.ink}
        strokeWidth="2"
      />
      <rect
        x="8"
        y="8"
        width="48"
        height="48"
        rx="3"
        fill={ground}
        stroke={illumination.ink}
        strokeWidth="1.4"
      />
      <rect x="8" y="8" width="48" height="48" rx="3" fill={vine} />
      {[
        [5, 5],
        [59, 5],
        [5, 59],
        [59, 59],
      ].map(([cx, cy]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="1.3" fill={illumination.ink} />
      ))}
    </>
  );
}

function RubricFrame({ gold }: { readonly gold: string }) {
  return (
    <>
      <rect
        x="2"
        y="2"
        width="60"
        height="60"
        rx="9"
        fill={illumination.vellum}
        stroke={illumination.ink}
        strokeWidth="2"
      />
      <rect
        x="6"
        y="6"
        width="52"
        height="52"
        rx="6"
        fill="none"
        stroke={illumination.rubric}
        strokeWidth="1.3"
      />
      <rect
        x="8.5"
        y="8.5"
        width="47"
        height="47"
        rx="4.5"
        fill="none"
        stroke={illumination.rubric}
        strokeWidth="0.7"
      />
      {[
        [32, 4],
        [32, 60],
        [4, 32],
        [60, 32],
      ].map(([cx, cy]) => (
        <circle
          key={`${cx}-${cy}`}
          cx={cx}
          cy={cy}
          r="1.8"
          fill={gold}
          stroke={illumination.ink}
          strokeWidth="0.6"
        />
      ))}
    </>
  );
}

function EngravedFrame() {
  return (
    <>
      <rect
        x="2"
        y="2"
        width="60"
        height="60"
        rx="9"
        fill={illumination.parchment}
        stroke={illumination.sepia}
        strokeWidth="1.6"
      />
      <rect
        x="6"
        y="6"
        width="52"
        height="52"
        rx="6"
        fill="none"
        stroke={illumination.sepia}
        strokeWidth="0.6"
      />
    </>
  );
}

function IlluminatedPath({
  shape,
  inks,
  look,
}: {
  readonly shape: ToyShape;
  readonly inks: Readonly<Record<"f1" | "f2" | "f3", string>>;
  readonly look: Exclude<Look, "current">;
}) {
  const outline = look === "gravure" ? illumination.sepia : illumination.ink;
  const paint = (ink: ToyInk | undefined) =>
    ink === undefined
      ? undefined
      : ink === "outline"
        ? outline
        : ink === "gloss" || ink === "sheen"
          ? toyLights[ink].color
          : inks[ink];
  const fill = paint(shape.fill) ?? "none";
  const stroke = paint(shape.stroke);
  const light = shape.fill === "gloss" || shape.fill === "sheen" ? shape.fill : shape.stroke;
  // The varnish of a toy has no place on vellum: its lights fade to a glint.
  const opacity =
    light === "gloss" || light === "sheen"
      ? look === "gravure"
        ? 0
        : toyLights[light].opacity * 0.6
      : undefined;
  const width = (shape.strokeWidth ?? toyIconOutline) * (look === "gravure" ? 0.8 : 0.75);
  return (
    <path
      d={shape.d}
      fill={fill}
      stroke={stroke}
      strokeWidth={stroke === undefined ? undefined : width}
      strokeDasharray={shape.dash}
      strokeLinejoin="round"
      strokeLinecap={shape.dash === undefined ? "round" : "butt"}
      opacity={opacity}
      transform={shape.rotate === undefined ? undefined : `rotate(${shape.rotate.join(" ")})`}
    />
  );
}

/**
 * Each ink of the toy icon, sorted by what it paints. A pale ink is vellum everywhere. On a
 * lettrine the rest is gold. In pigments, the body takes the pigment of its tile and the accent
 * (`f3`) stays gold leaf; in an engraving, the body is hatched and only the accent is gilt.
 * A coin stays gold whatever the look.
 */
function inksFor(
  look: Exclude<Look, "current">,
  icon: ToyIconName,
  ground: string,
  gold: string,
  hatch: string,
): Readonly<Record<"f1" | "f2" | "f3", string>> {
  const source = toyIconInks[icon];
  const remap = (hex: string, accent: boolean): string => {
    const kind = inkKind(hex);
    if (kind === "pale") return illumination.vellum;
    if (look === "lettrine" || accent || icon === "ecu") return gold;
    if (look === "gravure") return hatch;
    return kind === "gold" ? ground : pigmentOf(hex, ground);
  };
  return {
    f1: remap(source.f1, false),
    f2: remap(source.f2, false),
    f3: remap(source.f3, true),
  };
}

function inkKind(hex: string): "pale" | "gold" | "pigment" {
  const { h, s, l } = hsl(hex);
  if (l > 0.82) return "pale";
  if (h >= 35 && h <= 55 && s > 0.5 && l > 0.5) return "gold";
  return "pigment";
}

function pigmentOf(hex: string, fallback: string): string {
  const { h, s } = hsl(hex);
  if (s < 0.15) return fallback;
  if (h < 20 || h >= 330) return illumination.pigments.vermilion;
  if (h < 60) return illumination.pigments.umber;
  if (h < 170) return illumination.pigments.verdigris;
  return illumination.pigments.lapis;
}

function hsl(hex: string): { readonly h: number; readonly s: number; readonly l: number } {
  const value = Number.parseInt(hex.slice(1), 16);
  const r = ((value >> 16) & 255) / 255;
  const g = ((value >> 8) & 255) / 255;
  const b = (value & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h =
    max === r
      ? ((g - b) / d + (g < b ? 6 : 0)) * 60
      : max === g
        ? ((b - r) / d + 2) * 60
        : ((r - g) / d + 4) * 60;
  return { h, s, l };
}
