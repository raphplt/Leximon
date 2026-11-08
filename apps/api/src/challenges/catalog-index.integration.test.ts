import { buildQuestion, createSeededRandom } from "@leximon/core";
import { createDb, schema } from "@leximon/db";
import { testDatabaseUrl } from "@leximon/db/testing";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { seedTestCatalog } from "../test-support";
import { choicePools, createCatalogIndexLoader } from "./catalog-index";
import { scopeChoicePools } from "./practice";

const { db, close } = createDb(testDatabaseUrl(), { maxConnections: 1 });
const COLLECTION = "test-classes";
const THEME = "test-classes-theme";
const VERBS = ["v1", "v2", "v3"].map((id) => `${COLLECTION}-${id}`);
const NOUNS = ["n1", "n2", "n3", "n4", "n5", "n6"].map((id) => `${COLLECTION}-${id}`);
const [v1, v2, v3] = VERBS as [string, string, string];
const [n1, n2, n3] = NOUNS as [string, string, string];

beforeAll(async () => {
  await seedTestCatalog(db);
  await db
    .insert(schema.collections)
    .values({ id: COLLECTION, name: "Classes", publishedAt: new Date("2026-01-01T00:00:00Z") });
  await db.insert(schema.cards).values(
    [
      ...VERBS.map((id) => ({
        id,
        lemma: id,
        partOfSpeech: "v. tr.",
        rarity: "common" as const,
      })),
      ...NOUNS.map((id) => ({ id, lemma: id, partOfSpeech: "n. f.", rarity: "common" as const })),
    ].map((card) => ({ ...card, collectionId: COLLECTION })),
  );
  await db.insert(schema.themes).values({ id: THEME, name: THEME });
  await db
    .insert(schema.cardThemes)
    .values([n1, n2, n3, v1].map((cardId) => ({ cardId, themeId: THEME })));
});

afterAll(async () => {
  await db.delete(schema.cards).where(eq(schema.cards.collectionId, COLLECTION));
  await db.delete(schema.collections).where(eq(schema.collections.id, COLLECTION));
  await db.delete(schema.themes).where(eq(schema.themes.id, THEME));
  await close();
});

const seeds = Array.from({ length: 20 }, (_, n) => n.toString(16).padStart(32, "0"));

describe("the wrong choices of a question", () => {
  it("are words of the same class, then of another class once the class runs out", async () => {
    const catalog = await createCatalogIndexLoader()(db, Date.now());
    expect(catalog.classOf.get(v1)).toBe("verb");
    for (const seed of seeds) {
      const question = buildQuestion(createSeededRandom(seed), v1, choicePools(catalog, v1));
      const choices = question?.choices ?? [];
      expect(choices).toEqual(expect.arrayContaining([v1, v2, v3]));
      expect(choices.filter((id) => NOUNS.includes(id))).toHaveLength(1);
    }
  });

  it("come from the theme reviewed first, then from the collection", async () => {
    const catalog = await createCatalogIndexLoader()(db, Date.now());
    const nearest = scopeChoicePools({ kind: "theme", id: THEME }, catalog);
    for (const seed of seeds) {
      const pools = choicePools(catalog, n1, nearest);
      const choices = buildQuestion(createSeededRandom(seed), n1, pools)?.choices ?? [];
      expect(choices).toEqual(expect.arrayContaining([n1, n2, n3]));
      expect(choices.every((id) => NOUNS.includes(id))).toBe(true);
    }
  });
});
