import { PATRON_SCHEDULE, RARITIES } from "@leximon/core";
import { describe, expect, it } from "vitest";
import { cardEditions } from "./card-editions";
import { rarityStyles } from "./tokens";

function rgb(hex: string): [number, number, number] {
  return [1, 3, 5].map((start) => Number.parseInt(hex.slice(start, start + 2), 16)) as [
    number,
    number,
    number,
  ];
}

function distance(a: string, b: string): number {
  const [x, y] = [rgb(a), rgb(b)];
  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
}

/** Every colour that tells a rarity above the commonest: frames, gems and words, gradients included. */
const raritySigns = RARITIES.filter((rarity) => rarity !== "common").flatMap((rarity) => {
  const style = rarityStyles[rarity];
  return [style.frame, style.band, style.word].flatMap((fill) =>
    typeof fill === "string" ? [fill] : fill.stops.map(([color]) => color),
  );
});

describe("library editions", () => {
  it("exist for every edition the patron calendar names", () => {
    for (const rules of PATRON_SCHEDULE) {
      for (const id of [...rules.launchEditions, ...Object.values(rules.editions)]) {
        expect(cardEditions[id], id).toBeDefined();
      }
    }
  });

  it("never print in a colour that tells a rarity", () => {
    for (const [id, edition] of Object.entries(cardEditions)) {
      for (const sign of raritySigns) {
        expect(distance(edition.ink, sign), `${id} ink near ${sign}`).toBeGreaterThan(60);
        expect(distance(edition.plate, sign), `${id} plate near ${sign}`).toBeGreaterThan(60);
      }
    }
  });
});
