import { eq, inArray } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { createDb } from "../client";
import { cards, cardThemes, collections, riddleWords } from "../schema/index";
import { testDatabaseUrl } from "../testing";
import { applyCatalog, loadPublishedCards, planCatalog } from "./plan";
import type { Release } from "./release";

const { db, close } = createDb(testDatabaseUrl(), { maxConnections: 1 });
afterAll(close);

function release(
  ids: readonly [string, "common" | "rare"][],
  cardTheme: string | null = null,
): Release {
  return {
    manifest: {
      schemaVersion: 1,
      version: "2026-10-19.1",
      releasedAt: "2026-10-19T20:00:00.000Z",
      collections: [],
    },
    collections: [
      {
        id: "publish-tests",
        name: "Publish tests",
        cards: ids.map(([id, rarity]) => ({
          id,
          word: id,
          partOfSpeech: "n. f.",
          era: null,
          definition: "Une définition.",
          etymology: null,
          quote: null,
          rarity,
          collectionId: "publish-tests",
          themes: cardTheme === null ? [] : [cardTheme],
          perBillion: null,
        })),
      },
    ],
  };
}

async function publish(
  ids: readonly [string, "common" | "rare"][],
  now: Date,
  cardTheme: string | null = null,
) {
  const plan = planCatalog(release(ids, cardTheme), await loadPublishedCards(db));
  await applyCatalog(db, plan, now);
  return plan;
}

const rows = (ids: string[]) =>
  db
    .select({ id: cards.id, retiredAt: cards.retiredAt })
    .from(cards)
    .where(inArray(cards.id, ids))
    .orderBy(cards.id);

describe("catalog publication", () => {
  const first = new Date("2026-10-19T20:00:00.000Z");
  const second = new Date("2026-10-26T20:00:00.000Z");

  it("publishes the collection and its cards", async () => {
    await publish(
      [
        ["pub-poue", "common"],
        ["pub-raclure", "rare"],
      ],
      first,
    );
    const [collection] = await db
      .select()
      .from(collections)
      .where(eq(collections.id, "publish-tests"));
    expect(collection?.publishedAt).toEqual(first);
    expect(await rows(["pub-poue", "pub-raclure"])).toEqual([
      { id: "pub-poue", retiredAt: null },
      { id: "pub-raclure", retiredAt: null },
    ]);
    const [poue] = await db
      .select({ partOfSpeech: cards.partOfSpeech })
      .from(cards)
      .where(eq(cards.id, "pub-poue"));
    expect(poue?.partOfSpeech).toBe("n. f.");
  });

  it("retires a card left out, keeps the first publication date, and brings a card back", async () => {
    await publish([["pub-poue", "common"]], second);
    expect(await rows(["pub-raclure"])).toEqual([{ id: "pub-raclure", retiredAt: second }]);
    const [collection] = await db
      .select()
      .from(collections)
      .where(eq(collections.id, "publish-tests"));
    expect(collection?.publishedAt).toEqual(first);

    await publish(
      [
        ["pub-poue", "common"],
        ["pub-raclure", "rare"],
      ],
      second,
    );
    expect(await rows(["pub-raclure"])).toEqual([{ id: "pub-raclure", retiredAt: null }]);
  });

  it("gives the cards the themes of the release, and replaces their old ones", async () => {
    const themesOf = () =>
      db
        .select({ themeId: cardThemes.themeId })
        .from(cardThemes)
        .where(eq(cardThemes.cardId, "pub-poue"));
    await publish([["pub-poue", "common"]], second, "publish-theme-a");
    expect(await themesOf()).toEqual([{ themeId: "publish-theme-a" }]);
    await publish([["pub-poue", "common"]], second, "publish-theme-b");
    expect(await themesOf()).toEqual([{ themeId: "publish-theme-b" }]);
  });

  it("refuses to change a published rarity", async () => {
    const plan = planCatalog(release([["pub-poue", "rare"]]), await loadPublishedCards(db));
    expect(plan.rarityConflicts).toHaveLength(1);
    await expect(applyCatalog(db, plan, second)).rejects.toThrow(/rarity/);
  });

  it("replaces the riddle words with those of the release", async () => {
    const riddle = release([["pubralingue", "common"]]);
    const [card] = riddle.collections[0]?.cards ?? [];
    if (card === undefined) throw new Error("Fixture without a card");
    const fit = {
      ...card,
      definition: "Cordage cousu en ourlet sur le pourtour d'une voile.",
      etymology: "Mot que l'on retrouve en italien.",
    };
    const fitRelease = {
      ...riddle,
      collections: riddle.collections.map((c) => ({ ...c, cards: [fit] })),
    };
    await applyCatalog(db, planCatalog(fitRelease, await loadPublishedCards(db)), new Date());
    expect(await db.select().from(riddleWords)).toEqual([
      {
        cardId: "pubralingue",
        clues: {
          partOfSpeech: "n. f.",
          opening: "Cordage cousu en ourlet…",
          definition: fit.definition,
          etymology: fit.etymology,
        },
      },
    ]);
    await applyCatalog(db, planCatalog(riddle, await loadPublishedCards(db)), new Date());
    expect(await db.select().from(riddleWords)).toEqual([]);
  });
});
