import { RARITIES } from "@leximon/core";
import { describe, expect, it } from "vitest";
import { bookTheme, cssFill, cssRootRule, cssUrl, cssVariables, solidColor } from "./css";
import { icons } from "./icons";
import { levelBadge, levelBadgeText } from "./level-badge";
import { livreDay, livreNight } from "./livre";
import { engravings, framesOf, lettrineFor, tools } from "./ornaments";
import { alpha, backTone, backTones, colors, matter, type Palette, rarityStyles } from "./tokens";

/** WCAG relative luminance of a `#RRGGBB` color. */
function luminance(hex: string): number {
  const channels = [1, 3, 5].map((start) => {
    const value = Number.parseInt(hex.slice(start, start + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  const [r = 0, g = 0, b = 0] = channels;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** `color` under an opaque-to-a-degree `layer`, as a tile's pixel covers its background. */
function under(color: string, layer: string, opacity: number): string {
  const channel = (hex: string, start: number) => Number.parseInt(hex.slice(start, start + 2), 16);
  const mixed = [1, 3, 5].map((start) =>
    Math.round(channel(color, start) * (1 - opacity) + channel(layer, start) * opacity),
  );
  return `#${mixed.map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}

function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return ((light ?? 0) + 0.05) / ((dark ?? 0) + 0.05);
}

describe("rarity styles", () => {
  it("cover every rarity", () => {
    expect(Object.keys(rarityStyles)).toEqual([...RARITIES]);
  });

  it.each(RARITIES)("keep the %s card text readable (WCAG AA)", (rarity) => {
    const style = rarityStyles[rarity];
    expect(contrast(style.ink, style.paper)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(style.muted, style.paper)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(style.chipInk, style.chip)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(style.spot, style.paper)).toBeGreaterThanOrEqual(4.5);
  });

  it("keep the screen text readable", () => {
    expect(contrast(colors.pageInk, colors.page)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(colors.pageInkMuted, colors.page)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(colors.actionInk, colors.action)).toBeGreaterThanOrEqual(4.5);
  });
});

describe("css helpers", () => {
  it("writes a gradient as linear-gradient()", () => {
    expect(
      cssFill({
        angle: 90,
        stops: [
          ["#000000", 0],
          ["#FFFFFF", 1],
        ],
      }),
    ).toBe("linear-gradient(90deg, #000000 0%, #FFFFFF 100%)");
    expect(cssFill("#123456")).toBe("#123456");
  });

  it("falls back to the first stop for a solid color", () => {
    expect(solidColor(rarityStyles.epic.word)).toBe("#B07D1E");
  });

  it("declares global tokens as custom properties", () => {
    expect(cssVariables()["--lx-color-page-ink-muted"]).toBe(colors.pageInkMuted);
    expect(cssVariables()["--lx-radius-card"]).toBe("16px");
    expect(cssVariables()["--lx-size-body"]).toBe("15px");
    expect(cssVariables()["--lx-s6"]).toBe("12px");
    expect(cssRootRule()).toMatch(/^:root\{color-scheme:dark;--lx-color-page:#262B40;/);
  });
});

describe.each<[string, Palette]>([
  ["the day", livreDay],
  ["the night", livreNight],
])("the look of the book, in %s", (_, palette) => {
  it("keeps reading text at 7:1", () => {
    expect(contrast(palette.pageInk, palette.page)).toBeGreaterThanOrEqual(7);
    expect(contrast(palette.pageInk, palette.pageRaised)).toBeGreaterThanOrEqual(7);
    expect(contrast(palette.pageInk, palette.sheet)).toBeGreaterThanOrEqual(7);
  });

  it("keeps reading text at 7:1 on the darkest and the lightest grain of the paper", () => {
    const { dark, darkest, light, lightest } = matter.paper;
    for (const surface of [palette.page, palette.sheet]) {
      expect(contrast(palette.pageInk, under(surface, dark, darkest))).toBeGreaterThanOrEqual(7);
      expect(contrast(palette.pageInk, under(surface, light, lightest))).toBeGreaterThanOrEqual(7);
    }
  });

  it("keeps every other text at 4.5:1", () => {
    const pairs = [
      [palette.pageInkSoft, palette.page],
      [palette.pageInkMuted, palette.page],
      [palette.pageInkMuted, palette.sheet],
      [palette.pageInkFaint, palette.page],
      [palette.rubric, palette.page],
      [palette.rubric, palette.sheet],
      [palette.success, palette.page],
      [palette.danger, palette.page],
      [palette.bindingInk, palette.binding],
      [palette.bindingInkMuted, palette.binding],
      [palette.actionInk, palette.action],
      [palette.pageInk, palette.control],
      [palette.inkOnColor, palette.successDeep],
      [palette.inkOnColor, palette.dangerDeep],
      [palette.inkOnColor, palette.badge],
      [palette.dangerInk, palette.danger],
      [palette.mentionInk, palette.mention],
    ] as const;
    for (const [ink, surface] of pairs) {
      expect(contrast(ink, surface)).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe("alpha", () => {
  it("gives a role an opacity", () => {
    expect(alpha(colors.page, 0.5)).toBe("rgba(38, 43, 64, 0.5)");
  });
});

describe("backTone", () => {
  it("reads a collection's tone, and falls back to night for a name it lacks", () => {
    expect(backTone("burgundy")).toBe(backTones.burgundy);
    expect(backTone(undefined)).toBe(backTones.night);
    expect(backTone("ochre")).toBe(backTones.night);
    expect(backTone("toString")).toBe(backTones.night);
  });
});

describe("cssUrl", () => {
  it("quotes a plain path", () => {
    expect(cssUrl("/catalog/gravures/a.ink.webp")).toBe('url("/catalog/gravures/a.ink.webp")');
  });

  it("escapes what could close the url", () => {
    expect(cssUrl('/a"b\\c\nd')).toBe('url("/a\\22 b\\5c c\\a d")');
  });
});

describe("level badge", () => {
  it("engraves the number dark enough to read on the whole face", () => {
    const { ink, faceTop, faceBottom } = levelBadge.colors;
    expect(contrast(ink, faceTop)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(ink, faceBottom)).toBeGreaterThanOrEqual(4.5);
  });

  it("shrinks three digits to stay inside the face", () => {
    expect(levelBadgeText(9).fontSize).toBeGreaterThan(levelBadgeText(42).fontSize);
    expect(levelBadgeText(42).fontSize).toBeGreaterThan(levelBadgeText(120).fontSize);
  });
});

describe("the ornaments of Le Livre", () => {
  it("engraves every icon", () => {
    expect(Object.keys(engravings).sort()).toEqual(Object.keys(icons).sort());
  });

  it("draws every shape inside its 24 px grid", () => {
    const shapes = [
      ...Object.values(tools),
      ...Object.values(engravings).flatMap(({ shade, hatch }) => [shade ?? "", hatch ?? ""]),
    ];
    for (const shape of shapes) {
      const numbers = shape.replace(/A[^A-Z]*?(?=[A-Z]|$)/g, " ").match(/-?\d*\.?\d+/g) ?? [];
      for (const value of numbers) {
        expect(Number(value)).toBeGreaterThanOrEqual(0);
        expect(Number(value)).toBeLessThanOrEqual(24);
      }
    }
  });

  it("finds the capital of a word, accents and old letters included", () => {
    expect(lettrineFor("abat-faim")).toBe("lr01");
    expect(lettrineFor("Écornifleur")).toBe("lr05");
    expect(lettrineFor("Jouvence")).toBe("lr09");
    expect(lettrineFor("Urbanité")).toBe("lr19");
    expect(lettrineFor("Yeuse")).toBeNull();
    expect(lettrineFor("")).toBeNull();
  });

  it("gives each theme frames in its own colors", () => {
    expect(framesOf(livreDay).gilt).not.toBe(framesOf(livreNight).gilt);
    expect(decodeURIComponent(framesOf(livreDay).ink)).toContain(livreDay.rule);
  });

  it("squares the corners of the interface but not those of the art", () => {
    const theme = bookTheme("light");
    expect(theme["--lx-radius-pill"]).toBe("2px");
    expect(theme["--lx-radius-card"]).toBe("16px");
  });

  it("leaves the current look without frames or square corners", () => {
    const variables = cssVariables();
    expect(variables["--lx-radius-pill"]).toBe("999px");
    expect(variables["--lx-frame-gilt"]).toBeUndefined();
  });
});
