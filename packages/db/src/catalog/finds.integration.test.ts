import { and, eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { createDb } from "../client";
import { players, reserveWords, userCards, users, wordFinds } from "../schema/index";
import { testDatabaseUrl } from "../testing";
import { FINDER_VARIANT, publishFinds, publishReserve, readFinders } from "./finds";
import { applyCatalog, loadPublishedCards, planCatalog } from "./plan";

const { db, close } = createDb(testDatabaseUrl(), { maxConnections: 1 });
afterAll(close);

const suffix = () => crypto.randomUUID().replace(/-/g, "").slice(0, 10);

async function patron(pseudo: string) {
  const id = `finder-${suffix()}`;
  await db.insert(users).values({ id, name: pseudo, email: `${id}@example.test` });
  await db.insert(players).values({
    userId: id,
    code: suffix().toUpperCase().slice(0, 8),
    pseudo,
    pseudoKey: pseudo.toLowerCase(),
    pseudoChangedAt: new Date(),
  });
  return id;
}

const reserveWord = (id: string) => ({
  id,
  word: id,
  definition: "Un mot de la réserve.",
  theme: null,
  partOfSpeech: "s. m.",
});

describe("words found by patrons", () => {
  it("leave the reserve when it no longer lists them, and come back when it does", async () => {
    const kept = `kept-${suffix()}`;
    const dropped = `dropped-${suffix()}`;
    await publishReserve(
      db,
      { version: "2026-11-08.1", words: [reserveWord(kept), reserveWord(dropped)] },
      new Date(),
    );
    await publishReserve(db, { version: "2026-11-08.2", words: [reserveWord(kept)] }, new Date());
    const [row] = await db.select().from(reserveWords).where(eq(reserveWords.id, dropped));
    expect(row?.removedAt).not.toBeNull();
    await publishReserve(
      db,
      { version: "2026-11-08.3", words: [reserveWord(dropped)] },
      new Date(),
    );
    const [back] = await db.select().from(reserveWords).where(eq(reserveWords.id, dropped));
    expect(back?.removedAt).toBeNull();
  });

  it("give their finder a copy of their own once the card is published, and sign it", async () => {
    const word = `found-${suffix()}`;
    const pseudo = `Mecene${suffix().slice(0, 6)}`;
    const userId = await patron(pseudo);
    await publishReserve(db, { version: "2026-11-09.1", words: [reserveWord(word)] }, new Date());
    await db
      .insert(wordFinds)
      .values({ wordId: word, userId, state: "reserved", foundAt: new Date() });

    const plan = planCatalog(
      {
        manifest: {
          schemaVersion: 1,
          version: "2026-11-09.1",
          releasedAt: "2026-11-09T20:00:00.000Z",
          collections: [],
        },
        collections: [
          {
            id: "finds-tests",
            name: "Finds tests",
            cards: [
              {
                id: word,
                word,
                partOfSpeech: "s. m.",
                era: null,
                definition: "Une définition.",
                etymology: null,
                quote: null,
                rarity: "rare",
                collectionId: "finds-tests",
                themes: [],
                perBillion: null,
              },
            ],
          },
        ],
      },
      await loadPublishedCards(db),
    );
    const now = new Date();
    await applyCatalog(db, plan, now);
    expect(await publishFinds(db, [word], now)).toBe(1);
    expect(await publishFinds(db, [word], now)).toBe(0);

    const copies = await db
      .select({ variant: userCards.variant, quantity: userCards.quantity })
      .from(userCards)
      .where(and(eq(userCards.userId, userId), eq(userCards.cardId, word)));
    expect(copies).toEqual([{ variant: FINDER_VARIANT, quantity: 1 }]);
    const [find] = await db.select().from(wordFinds).where(eq(wordFinds.wordId, word));
    expect(find?.state).toBe("published");
    expect((await readFinders(db)).cards[word]).toBe(pseudo);
  });
});
