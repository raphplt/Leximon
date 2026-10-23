import type { CatalogCard } from "@leximon/contract";
import { describe, expect, it } from "vitest";
import { ALL_COLLECTIONS, type AlbumState, albumView, foldSearch, themeLabel } from "./album";

const NOW = Date.parse("2026-10-21T12:00:00Z");
const DAY = 24 * 60 * 60 * 1000;

function card(id: string, rarity: CatalogCard["rarity"], themes: string[] = []): CatalogCard {
  return {
    id,
    word: id,
    partOfSpeech: "n. m.",
    era: null,
    definition: "Définition.",
    etymology: null,
    quote: null,
    rarity,
    collectionId: "a",
    themes,
    perBillion: 1,
  };
}

const collections = [
  {
    id: "a",
    name: "Les Fondateurs",
    cards: [
      card("écrouelles", "common", ["corps"]),
      card("bélître", "rare", ["insultes"]),
      card("grigou", "common", ["insultes"]),
      card("talpinette", "legendary", ["nature"]),
    ],
  },
  { id: "b", name: "Métiers", cards: [card("fouacier", "uncommon", ["metiers"])] },
];

const STATE: AlbumState = {
  collectionId: "a",
  rarity: null,
  filter: "all",
  theme: null,
  search: "",
};

const input = {
  collections,
  owned: new Map([
    ["grigou", 3],
    ["bélître", 1],
    ["fouacier", 1],
  ]),
  memory: new Map([
    ["grigou", { level: "gilded" as const, due: NOW + 1000, stability: 40, lastReviewedAt: NOW }],
    [
      "bélître",
      { level: "sketch" as const, due: NOW - 1000, stability: 1, lastReviewedAt: NOW - 2000 },
    ],
  ]),
  dates: new Map([
    ["grigou", { firstObtainedAt: NOW - 3 * DAY, read: true }],
    ["bélître", { firstObtainedAt: NOW - 3 * DAY, read: false }],
    ["fouacier", { firstObtainedAt: NOW - 60_000, read: true }],
  ]),
  now: NOW,
};

describe("album", () => {
  it("counts every collection and the whole catalogue", () => {
    const view = albumView(input, STATE);
    expect(view.headline).toEqual({ owned: "3", total: "5" });
    expect(view.tabs.map((tab) => tab.count)).toEqual(["3/5", "2/4", "1/1"]);
    expect(view.tabs[0]).toMatchObject({ id: ALL_COLLECTIONS, name: "Tout" });
  });

  it("gathers every collection under Tout, each card with its own collection's name", () => {
    const view = albumView(input, { ...STATE, collectionId: ALL_COLLECTIONS });
    const owned = view.items.flatMap((item) =>
      item.kind === "owned" ? [`${item.card.id} · ${item.collectionName}`] : [],
    );
    expect(owned).toEqual([
      "bélître · Les Fondateurs",
      "fouacier · Métiers",
      "grigou · Les Fondateurs",
    ]);
    expect(view.items.find((item) => item.kind === "more")).toMatchObject({ left: 2 });
    expect(view.themes.map((theme) => theme.id)).toContain("metiers");
  });

  it("shows owned cards rarest first, then the tile, then the missing slots", () => {
    const view = albumView(input, STATE);
    expect(view.items.map((item) => (item.kind === "owned" ? item.card.id : item.kind))).toEqual([
      "bélître",
      "grigou",
      "more",
      "missing",
      "missing",
    ]);
    const more = view.items.find((item) => item.kind === "more");
    expect(more).toMatchObject({ left: 2, label: "mots à trouver" });
  });

  it("counts by rarity, rarest first, only the rarities present", () => {
    expect(albumView(input, STATE).rarities.map((chip) => chip.count)).toEqual([
      "0/1",
      "1/1",
      "1/2",
    ]);
  });

  it("tags the cards whose sheet was never opened, and counts them on their filter", () => {
    const view = albumView(input, { ...STATE, collectionId: ALL_COLLECTIONS });
    const fresh = view.items.flatMap((item) =>
      item.kind === "owned" && item.fresh ? [item.card.id] : [],
    );
    expect(fresh).toEqual(["bélître"]);
    expect(view.filters.find((filter) => filter.id === "new")?.count).toBe(1);
    expect(view.filters.find((filter) => filter.id === "all")?.count).toBeNull();
  });

  it("filters the new cards, and those first got today in Paris", () => {
    const ids = (filter: AlbumState["filter"], now = NOW) =>
      albumView({ ...input, now }, { ...STATE, collectionId: ALL_COLLECTIONS, filter }).items.map(
        (item) => (item.kind === "owned" ? item.card.id : item.kind),
      );
    expect(ids("new")).toEqual(["bélître"]);
    expect(ids("today")).toEqual(["fouacier"]);
    // 23 h 30 in Paris the next day, 21 h 30 in UTC: no longer today.
    expect(ids("today", Date.parse("2026-10-22T21:30:00Z"))).toEqual([]);
  });

  it("knows nothing new before the dates are read", () => {
    const view = albumView({ ...input, dates: new Map() }, { ...STATE, filter: "new" });
    expect(view.items).toEqual([]);
  });

  it("filters doubles, words to review, gilded words, missing ones, rarity and theme", () => {
    const ids = (state: Partial<AlbumState>) =>
      albumView(input, { ...STATE, ...state }).items.map((item) =>
        item.kind === "owned" ? item.card.id : item.kind,
      );
    expect(ids({ filter: "doubles" })).toEqual(["grigou"]);
    expect(ids({ filter: "review" })).toEqual(["bélître"]);
    expect(ids({ filter: "gilded" })).toEqual(["grigou"]);
    expect(ids({ filter: "missing" })).toEqual(["missing", "missing"]);
    expect(ids({ rarity: "rare" })).toEqual(["bélître"]);
    expect(ids({ theme: "insultes" })).toEqual(["bélître", "grigou"]);
  });

  it("searches owned words in every collection, without accents", () => {
    expect(foldSearch(" Écrou ")).toBe("ecrou");
    const view = albumView(input, { ...STATE, search: "belit" });
    expect(view.searching).toBe(true);
    expect(view.items.map((item) => item.kind === "owned" && item.card.id)).toEqual(["bélître"]);
    expect(albumView(input, { ...STATE, search: "ecrou" }).empty).toBe(
      "Rien de ce côté. Pas pour longtemps.",
    );
    expect(albumView(input, { ...STATE, search: "fouac" }).items).toHaveLength(1);
  });

  it("names the themes", () => {
    expect(themeLabel("vie-quotidienne")).toBe("Vie quotidienne");
    expect(themeLabel("marine")).toBe("Marine");
  });
});
