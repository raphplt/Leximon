import { describe, expect, it } from "vitest";
import {
  collectionChoices,
  neighbourChoices,
  openAgainLabel,
  openButtonLabel,
  pickCollection,
  playFabs,
  reserveView,
  sachetContents,
  shortName,
  stockView,
  wordUnderCounter,
} from "./play";

const NOW = Date.UTC(2026, 9, 22, 12);
const wallet = (stored: number, bonus = 0) => ({
  stored,
  bonus,
  garni: 0,
  bonusCap: 10,
  capacity: 6,
  nextRefillAt: stored >= 6 ? null : new Date(NOW + 18 * 60_000).toISOString(),
});
const collections = [
  { id: "caracteres", name: "Caractères et travers", tagline: "Manies, défauts et tempéraments." },
  { id: "fondateurs", name: "Les Fondateurs" },
  { id: "metiers", name: "Métiers oubliés" },
];

describe("reserve", () => {
  it("counts the bonus sachets, the garnis first, and says when they open", () => {
    expect(reserveView(wallet(4, 1))).toMatchObject({
      headline: "1 sachet bonus",
      garni: null,
      places: "1 place prise sur 10.",
      openNow: false,
    });
    expect(reserveView({ ...wallet(0, 3), garni: 2 })).toMatchObject({
      headline: "3 sachets bonus",
      garni: "Dont 2 garnis, ouverts en premier.",
      places: "3 places prises sur 10.",
      openNow: true,
    });
    expect(reserveView({ ...wallet(0, 1), garni: 1 }).garni).toBe(
      "Dont 1 garni, ouvert en premier.",
    );
  });
});

describe("stock", () => {
  it("says what is left and what the button does", () => {
    expect(stockView(wallet(4), NOW)).toMatchObject({
      note: "+1 dans 18 min",
      action: "Ouvrir le sachet",
      refillShort: "18 min",
      empty: false,
    });
    expect(stockView(wallet(6), NOW)).toMatchObject({
      note: "plein",
      refillShort: "plein",
    });
    expect(stockView(wallet(0, 2), NOW)).toMatchObject({
      note: "2 bonus",
      action: "Ouvrir un sachet bonus",
    });
    expect(stockView(wallet(0), NOW)).toMatchObject({
      empty: true,
      action: "Prochain dans 18 min",
      note: "+1 dans 18 min",
    });
    expect(openAgainLabel(wallet(0), NOW)).toBe("Plus de sachet, 18 min");
  });

  it("counts on the button what is left to open", () => {
    expect(openButtonLabel(stockView(wallet(4), NOW), null)).toBe("Ouvrir le sachet · 4 restants");
    expect(openButtonLabel(stockView(wallet(1), NOW), null)).toBe("Ouvrir le sachet · 1 restant");
    expect(openButtonLabel(stockView(wallet(0, 2), NOW), null)).toBe(
      "Ouvrir un sachet bonus · 2 en réserve",
    );
    expect(openButtonLabel(stockView(wallet(0), NOW), null)).toBe("Prochain dans 18 min");
  });

  it("counts for a guest only the sachets it may open without an account", () => {
    expect(openButtonLabel(stockView(wallet(6), NOW), 1)).toBe("Ouvrir le sachet · 1 restant");
  });

  it("measures how much of the wait for the next sachet is gone", () => {
    expect(stockView(wallet(0), NOW).refill).toBeCloseTo(0.4);
    expect(stockView(wallet(6), NOW).refill).toBeNull();
  });
});

describe("collection of the sachet", () => {
  it("offers only the starter sachet before level 3, first", () => {
    const choices = collectionChoices(collections, 2, NOW);
    expect(choices.map((c) => [c.short, c.lock])).toEqual([
      ["Fondateurs", null],
      ["Caractères", "Niv. 3"],
      ["Métiers", "Niv. 3"],
    ]);
    expect(pickCollection(choices, "metiers").id).toBe("fondateurs");
    expect(choices.map((c) => c.tagline)).toEqual([null, "Manies, défauts et tempéraments.", null]);
  });

  it("lets the player choose from level 3", () => {
    const choices = collectionChoices(collections, 3, NOW);
    expect(choices.every((c) => c.lock === null)).toBe(true);
    expect(pickCollection(choices, "metiers").source).toEqual({
      kind: "collection",
      collectionId: "metiers",
    });
    expect(pickCollection(choices, "gone").id).toBe("fondateurs");
  });
});

describe("short collection name", () => {
  it("keeps the first word that is not an article", () => {
    expect(shortName("Les Fondateurs")).toBe("Fondateurs");
    expect(shortName("Caractères et travers")).toBe("Caractères");
  });
});

describe("floating buttons", () => {
  it("shows closed features with their level and what waits", () => {
    const { left, right } = playFabs({ level: 7, coffrets: 2, mail: 0 }, NOW);
    expect(left.map((f) => f.lock)).toEqual(["Niv. 10", "Niv. 10", "Niv. 15"]);
    expect(right.find((f) => f.id === "coffrets")).toMatchObject({ badge: 2, glow: true });
    const later = playFabs({ level: 15, coffrets: 0, mail: 0 }, NOW);
    expect(later.left.every((f) => f.lock === null)).toBe(true);
    expect(later.right.find((f) => f.id === "coffrets")?.glow).toBe(false);
  });
});

describe("sachet", () => {
  it("prints how many cards it holds", () => {
    expect(sachetContents(NOW)).toBe("5 cartes");
  });
});

describe("sachets behind the counter", () => {
  it("puts the previous collection on the left and the next on the right, going round", () => {
    const choices = collectionChoices(collections, 5, NOW);
    const [first, second] = choices;
    if (first === undefined || second === undefined) throw new Error("two collections at least");
    const around = neighbourChoices(choices, first);
    expect(around.right?.id).toBe(second.id);
    expect(around.left?.id).toBe(choices[choices.length - 1]?.id);
    expect(neighbourChoices(choices.slice(0, 2), first)).toEqual({ left: null, right: second });
    expect(neighbourChoices(choices.slice(0, 1), first)).toEqual({ left: null, right: null });
  });
});

describe("word under the counter", () => {
  const now = 10_000;
  const none = () => false;
  const owned = new Map([
    ["a", 1],
    ["b", 2],
    ["c", 1],
    ["gone", 0],
  ]);

  it("shows the words due, most overdue first, another at each visit", () => {
    const memory = new Map([
      ["a", { due: now - 10 }],
      ["b", { due: now - 500 }],
      ["c", { due: now + 1 }],
    ]);
    expect(wordUnderCounter(memory, owned, none, now, 0)).toEqual({
      cardId: "b",
      kind: "slipping",
      fresh: false,
    });
    expect(wordUnderCounter(memory, owned, none, now, 1)).toEqual({
      cardId: "a",
      kind: "slipping",
      fresh: false,
    });
    expect(wordUnderCounter(memory, owned, none, now, 2)).toEqual({
      cardId: "b",
      kind: "slipping",
      fresh: false,
    });
  });

  it("leaves out a word due that the player no longer owns", () => {
    const memory = new Map([["gone", { due: now - 10 }]]);
    expect(wordUnderCounter(memory, owned, none, now, 0)?.kind).toBe("owned");
  });

  it("falls back on one of the player's words when none is due", () => {
    const shown = [0, 1, 2, 3].map((visit) => wordUnderCounter(new Map(), owned, none, now, visit));
    expect(shown.map((word) => word?.cardId)).toEqual(["a", "b", "c", "a"]);
    expect(shown.every((word) => word?.kind === "owned")).toBe(true);
  });

  it("prefers the words never read when none is due", () => {
    const unread = (id: string) => id === "c";
    expect(wordUnderCounter(new Map(), owned, unread, now, 0)).toEqual({
      cardId: "c",
      kind: "owned",
      fresh: true,
    });
    expect(wordUnderCounter(new Map(), owned, unread, now, 1)?.cardId).toBe("c");
  });

  it("shows nothing without a card", () => {
    expect(wordUnderCounter(new Map(), new Map(), none, now, 0)).toBeNull();
  });
});
