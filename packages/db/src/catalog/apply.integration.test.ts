import { eq, inArray } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { createDb } from "../client";
import { cards, collections } from "../schema/index";
import { testDatabaseUrl } from "../testing";
import { applyCatalog, loadPublishedCards, planCatalog } from "./plan";
import type { Release } from "./release";

const { db, close } = createDb(testDatabaseUrl(), { maxConnections: 1 });
afterAll(close);

function release(ids: readonly [string, "common" | "rare"][]): Release {
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
          themes: [],
          perBillion: null,
        })),
      },
    ],
  };
}

async function publish(ids: readonly [string, "common" | "rare"][], now: Date) {
  const plan = planCatalog(release(ids), await loadPublishedCards(db));
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

  it("refuses to change a published rarity", async () => {
    const plan = planCatalog(release([["pub-poue", "rare"]]), await loadPublishedCards(db));
    expect(plan.rarityConflicts).toHaveLength(1);
    await expect(applyCatalog(db, plan, second)).rejects.toThrow(/rarity/);
  });
});
