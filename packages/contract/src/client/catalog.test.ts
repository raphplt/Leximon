import { afterEach, describe, expect, it, vi } from "vitest";
import { cardOrPlaceholder, fetchCatalog, fetchEngravingInks } from "./catalog";

const card = {
  id: "poue",
  word: "poue",
  partOfSpeech: "interj.",
  era: null,
  definition: "Onomatopée d'un coup de pistolet.",
  etymology: null,
  quote: null,
  rarity: "uncommon",
  collectionId: "fondateurs",
  themes: [],
  perBillion: 13,
};
const file = "collections/fondateurs.0123456789ab.json";
const manifest = {
  schemaVersion: 1,
  version: "2026-10-19.1",
  releasedAt: "2026-10-19T20:00:00.000Z",
  collections: [{ id: "fondateurs", name: "Les Fondateurs", cardCount: 1, file }],
};

function serve(files: Record<string, unknown>) {
  const requests: [string, RequestInit | undefined][] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      requests.push([url, init]);
      const path = url.replace("/catalog/", "");
      return path in files
        ? new Response(JSON.stringify(files[path]), { status: 200 })
        : new Response("not found", { status: 404 });
    }),
  );
  return requests;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchCatalog", () => {
  it("reads the manifest, then every collection it lists", async () => {
    const requests = serve({
      "manifest.json": manifest,
      [file]: { id: "fondateurs", name: "Les Fondateurs", cards: [card] },
    });
    const catalog = await fetchCatalog("/catalog");
    expect(catalog.version).toBe("2026-10-19.1");
    expect(catalog.cardsById.get("poue")?.word).toBe("poue");
    // The manifest is revalidated; collection files never change once published.
    expect(requests.map(([url, init]) => [url, init?.cache])).toEqual([
      ["/catalog/manifest.json", "no-cache"],
      [`/catalog/${file}`, "force-cache"],
    ]);
  });

  it("refuses files that break the contract", async () => {
    serve({ "manifest.json": manifest, [file]: { id: "fondateurs", cards: "?" } });
    await expect(fetchCatalog("/catalog")).rejects.toThrow("invalid_collection_fondateurs");
    serve({ "manifest.json": { ...manifest, schemaVersion: 99 } });
    await expect(fetchCatalog("/catalog")).rejects.toThrow("invalid_manifest");
  });

  it("gives an unknown card a placeholder instead of breaking the screen", async () => {
    serve({ "manifest.json": { ...manifest, collections: [] } });
    const catalog = await fetchCatalog("/catalog");
    expect(cardOrPlaceholder(catalog, "palsambleu", "legendary")).toMatchObject({
      word: "palsambleu",
      rarity: "legendary",
    });
  });
});

describe("fetchEngravingInks", () => {
  const ink = "gravures/poue.0123456789ab.ink.webp";

  it("reads the ink of each card, revalidated like the manifest", async () => {
    const requests = serve({ "engravings.json": { version: "2026-10-19.1", inks: { poue: ink } } });
    const inks = await fetchEngravingInks("/catalog");
    expect(inks.get("poue")).toBe(ink);
    expect(requests.map(([url, init]) => [url, init?.cache])).toEqual([
      ["/catalog/engravings.json", "no-cache"],
    ]);
  });

  it("refuses a path that leaves the engravings folder", async () => {
    serve({ "engravings.json": { version: "2026-10-19.1", inks: { poue: "../secret.webp" } } });
    await expect(fetchEngravingInks("/catalog")).rejects.toThrow("invalid_engravings");
  });
});
