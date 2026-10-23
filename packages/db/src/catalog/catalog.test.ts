import { createHash } from "node:crypto";
import type { CatalogCard } from "@leximon/contract";
import { describe, expect, it } from "vitest";
import { planCatalog } from "./plan";
import {
  engravingFiles,
  engravingIndex,
  engravingProblems,
  parseRelease,
  pronunciationFiles,
  pronunciationProblems,
  type Release,
  staleCollectionFiles,
} from "./release";

const encoder = new TextEncoder();

function card(id: string, overrides: Partial<CatalogCard> = {}): CatalogCard {
  return {
    id,
    word: id,
    partOfSpeech: "n. f.",
    era: null,
    definition: "Une définition.",
    etymology: null,
    quote: null,
    rarity: "common",
    collectionId: "fondateurs",
    themes: [],
    perBillion: null,
    ...overrides,
  };
}

function releaseFiles(
  cards: CatalogCard[],
  options: { cardCount?: number; tamper?: boolean } = {},
) {
  const content = encoder.encode(
    JSON.stringify({ id: "fondateurs", name: "Les Fondateurs", cards }),
  );
  const hash = createHash("sha256").update(content).digest("hex").slice(0, 12);
  const file = `collections/fondateurs.${hash}.json`;
  const manifest = {
    schemaVersion: 1,
    version: "2026-10-19.1",
    releasedAt: "2026-10-19T20:00:00.000Z",
    collections: [
      {
        id: "fondateurs",
        name: "Les Fondateurs",
        cardCount: options.cardCount ?? cards.length,
        file,
      },
    ],
  };
  const tampered = options.tamper
    ? encoder.encode(JSON.stringify({ id: "fondateurs", name: "Les Fondateurs", cards: [] }))
    : content;
  return new Map<string, Uint8Array>([
    ["manifest.json", encoder.encode(JSON.stringify(manifest))],
    [file, tampered],
  ]);
}

describe("parseRelease", () => {
  it("accepts a consistent release", () => {
    const parsed = parseRelease(releaseFiles([card("billevesee"), card("poue")]));
    expect(parsed.ok && parsed.release.collections[0]?.cards.length).toBe(2);
  });

  it("refuses a file whose content no longer matches its name", () => {
    const parsed = parseRelease(releaseFiles([card("billevesee")], { tamper: true }));
    expect(parsed.ok).toBe(false);
    expect(!parsed.ok && parsed.problems.join()).toMatch(/does not match its content/);
  });

  it("refuses wrong counts, foreign cards and duplicates", () => {
    const parsed = parseRelease(
      releaseFiles([card("poue"), card("poue"), card("raclure", { collectionId: "autre" })], {
        cardCount: 2,
      }),
    );
    expect(!parsed.ok && parsed.problems).toEqual([
      expect.stringMatching(/holds 3 cards, the manifest says 2/),
      expect.stringMatching(/poue appears in both/),
      expect.stringMatching(/raclure is in fondateurs but claims autre/),
    ]);
  });

  it("refuses a missing manifest", () => {
    expect(parseRelease(new Map()).ok).toBe(false);
  });
});

describe("engraving files", () => {
  const ink = encoder.encode("ink");
  const inkHash = createHash("sha256").update(ink).digest("hex").slice(0, 12);
  const engraving = {
    ink: `gravures/poue.${inkHash}.ink.webp`,
    fill: "gravures/poue.0123456789ab.fill.webp",
    width: 300,
    height: 480,
    credit: "Anonyme, 1849 · Wikimedia Commons (domaine public)",
    sourceUrl: "https://commons.wikimedia.org/wiki/File:X.jpg",
    licence: "domaine public",
  };

  it("lists the files of the cards that have an engraving", () => {
    const release: Release = {
      manifest: {
        schemaVersion: 1,
        version: "2026-10-19.1",
        releasedAt: "2026-10-19T20:00:00.000Z",
        collections: [],
      },
      collections: [
        {
          id: "fondateurs",
          name: "Les Fondateurs",
          cards: [
            card("poue", { engraving }),
            card("raclure", { engraving: null }),
            card("vergogne"),
          ],
        },
      ],
    };
    expect(engravingFiles(release)).toEqual([engraving.fill, engraving.ink]);
    expect(engravingIndex(release)).toEqual({
      version: "2026-10-19.1",
      inks: { poue: engraving.ink },
    });
  });

  it("refuses a missing file and a file whose content no longer matches its name", () => {
    const problems = engravingProblems(
      new Map<string, Uint8Array | undefined>([
        [engraving.ink, ink],
        [engraving.fill, encoder.encode("fill")],
        ["gravures/raclure.0123456789ab.ink.webp", undefined],
      ]),
    );
    expect(problems).toEqual([
      expect.stringMatching(/poue\.0123456789ab\.fill\.webp does not match its content/),
      expect.stringMatching(/raclure\.0123456789ab\.ink\.webp is referenced by a card but missing/),
    ]);
  });
});

describe("stale collection files", () => {
  const manifest = (version: string, files: string[]) => ({
    schemaVersion: 1 as const,
    version,
    releasedAt: "2026-10-19T20:00:00.000Z",
    collections: files.map((file, index) => ({
      id: `c${index}`,
      name: "Une collection",
      cardCount: 1,
      file,
    })),
  });

  it("keeps the files of the current and the previous manifest, lists the others", () => {
    const stale = staleCollectionFiles(
      [
        "collections/a.000000000003.json",
        "collections/a.000000000001.json",
        "collections/a.000000000002.json",
        "collections/b.000000000001.json",
      ],
      [
        manifest("2026-10-19.2", [
          "collections/a.000000000003.json",
          "collections/b.000000000001.json",
        ]),
        manifest("2026-10-19.1", [
          "collections/a.000000000002.json",
          "collections/b.000000000001.json",
        ]),
      ],
    );
    expect(stale).toEqual(["collections/a.000000000001.json"]);
  });
});

describe("pronunciation files", () => {
  const mp3 = encoder.encode("mp3");
  const mp3Hash = createHash("sha256").update(mp3).digest("hex").slice(0, 12);
  const pronunciation = { ipa: "pu", audio: `prononciation/poue.${mp3Hash}.mp3` };

  it("lists the audio of the cards that have one", () => {
    const release: Release = {
      manifest: {
        schemaVersion: 1,
        version: "2026-10-21.1",
        releasedAt: "2026-10-21T20:00:00.000Z",
        collections: [],
      },
      collections: [
        {
          id: "fondateurs",
          name: "Les Fondateurs",
          cards: [
            card("poue", { pronunciation }),
            card("raclure", { pronunciation: null }),
            card("vergogne"),
          ],
        },
      ],
    };
    expect(pronunciationFiles(release)).toEqual([pronunciation.audio]);
  });

  it("refuses a missing file and a file whose content no longer matches its name", () => {
    const problems = pronunciationProblems(
      new Map<string, Uint8Array | undefined>([
        [pronunciation.audio, mp3],
        ["prononciation/raclure.0123456789ab.mp3", encoder.encode("other")],
        ["prononciation/vergogne.0123456789ab.mp3", undefined],
      ]),
    );
    expect(problems).toEqual([
      expect.stringMatching(/raclure\.0123456789ab\.mp3 does not match its content/),
      expect.stringMatching(
        /vergogne\.0123456789ab\.mp3 is referenced by a card but missing \(run prononciation-audio\)/,
      ),
    ]);
  });
});

describe("planCatalog", () => {
  const release: Release = {
    manifest: {
      schemaVersion: 1,
      version: "2026-10-19.1",
      releasedAt: "2026-10-19T20:00:00.000Z",
      collections: [],
    },
    collections: [
      {
        id: "fondateurs",
        name: "Les Fondateurs",
        cards: [card("poue"), card("raclure", { rarity: "rare" })],
      },
    ],
  };

  it("adds new cards and retires published cards left out of the release", () => {
    const plan = planCatalog(release, [
      { id: "poue", rarity: "common", retiredAt: null },
      { id: "vergogne", rarity: "common", retiredAt: null },
      { id: "faquin", rarity: "rare", retiredAt: new Date() },
    ]);
    expect(plan.cards.map((c) => c.id)).toEqual(["poue", "raclure"]);
    expect(plan.retire).toEqual(["vergogne"]);
    expect(plan.rarityConflicts).toEqual([]);
  });

  it("reports a published card whose rarity would change", () => {
    const plan = planCatalog(release, [{ id: "raclure", rarity: "common", retiredAt: null }]);
    expect(plan.rarityConflicts).toEqual([{ id: "raclure", published: "common", release: "rare" }]);
  });
});
