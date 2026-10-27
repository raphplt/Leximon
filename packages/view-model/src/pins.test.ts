import { describe, expect, it } from "vitest";
import { morePinsLine, movePin, pinCandidates, pinnedSlotsLabel, placePin, unpin } from "./pins";

describe("placing a pin", () => {
  it("takes the first free place, and refuses once every place is taken", () => {
    expect(placePin(["a", "b"], 3, "c", null)).toEqual({ ok: true, cardIds: ["a", "b", "c"] });
    expect(placePin(["a", "b", "c"], 3, "d", null)).toEqual({ ok: false, reason: "full" });
    expect(placePin(["a", "b"], 3, "a", null)).toEqual({ ok: true, cardIds: ["a", "b"] });
  });

  it("replaces the card of a taken place, even with every place taken", () => {
    expect(placePin(["a", "b", "c"], 3, "d", 1)).toEqual({ ok: true, cardIds: ["a", "d", "c"] });
  });

  it("swaps a card already pinned with the one it replaces", () => {
    expect(placePin(["a", "b", "c"], 3, "c", 0)).toEqual({ ok: true, cardIds: ["c", "b", "a"] });
  });
});

describe("ordering the pins", () => {
  it("moves a card one place, and nothing past the ends", () => {
    expect(movePin(["a", "b", "c"], 1, -1)).toEqual(["b", "a", "c"]);
    expect(movePin(["a", "b", "c"], 1, 1)).toEqual(["a", "c", "b"]);
    expect(movePin(["a", "b", "c"], 0, -1)).toEqual(["a", "b", "c"]);
    expect(movePin(["a", "b", "c"], 2, 1)).toEqual(["a", "b", "c"]);
  });

  it("unpins one card and keeps the order of the others", () => {
    expect(unpin(["a", "b", "c"], "b")).toEqual(["a", "c"]);
    expect(pinnedSlotsLabel(3)).toBe("3 places");
  });
});

describe("cards to pin", () => {
  const cards = [
    { id: "abajoue", word: "abajoue", rarity: "common" as const },
    { id: "ecrouelles", word: "écrouelles", rarity: "epic" as const },
    { id: "bacul", word: "bacul", rarity: "rare" as const },
    { id: "zinzolin", word: "zinzolin", rarity: "rare" as const },
    { id: "absent", word: "absent", rarity: "legendary" as const },
  ];
  const owned = new Map([
    ["abajoue", 1],
    ["ecrouelles", 2],
    ["bacul", 1],
    ["zinzolin", 1],
    ["absent", 0],
  ]);

  it("lists the cards owned, rarest first, then alphabetical, the pinned ones last", () => {
    const { items, more } = pinCandidates(cards, owned, ["bacul"], "");
    expect(items.map((c) => [c.cardId, c.pinned])).toEqual([
      ["ecrouelles", false],
      ["zinzolin", false],
      ["abajoue", false],
      ["bacul", true],
    ]);
    expect(more).toBe(0);
  });

  it("finds a word without its accents, and counts what the limit leaves out", () => {
    expect(pinCandidates(cards, owned, [], "ECROU").items.map((c) => c.cardId)).toEqual([
      "ecrouelles",
    ]);
    expect(pinCandidates(cards, owned, [], "", 2)).toMatchObject({ more: 2 });
    expect(morePinsLine(2)).toBe("Et 2 autres cartes de plus. Cherche un mot pour les retrouver.");
  });
});
