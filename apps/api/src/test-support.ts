/**
 * Shared helpers for API integration tests. Test-only: never import from application code.
 */
import { RARITIES } from "@leximon/core";
import { type Database, schema } from "@leximon/db";
import { expect } from "vitest";
import type { createApp } from "./app";
import { TEST_ORIGIN } from "./test-env";

/** Two published collections and one in preparation, three cards per rarity each. */
export const TEST_COLLECTIONS = [
  { id: "test-a", name: "Test A", published: true },
  { id: "test-b", name: "Test B", published: true },
  { id: "test-hidden", name: "Test cachée", published: false },
] as const;

export async function seedTestCatalog(db: Database): Promise<void> {
  await db
    .insert(schema.collections)
    .values(
      TEST_COLLECTIONS.map(({ id, name, published }) => ({
        id,
        name,
        publishedAt: published ? new Date("2026-01-01T00:00:00Z") : null,
      })),
    )
    .onConflictDoNothing();
  await db
    .insert(schema.cards)
    .values(
      TEST_COLLECTIONS.flatMap(({ id: collectionId }) =>
        RARITIES.flatMap((rarity) =>
          [1, 2, 3].map((n) => ({
            id: `${collectionId}-${rarity}-${n}`,
            lemma: `${rarity} ${n}`,
            rarity,
            collectionId,
          })),
        ),
      ),
    )
    .onConflictDoNothing();
}

export interface Guest {
  readonly cookie: string;
  readonly userId: string;
}

export async function signInAsGuest(app: ReturnType<typeof createApp>, env: Env): Promise<Guest> {
  const response = await app.request(
    "/api/auth/sign-in/anonymous",
    {
      method: "POST",
      headers: { origin: TEST_ORIGIN, "content-type": "application/json" },
      body: "{}",
    },
    env,
  );
  expect(response.status).toBe(200);
  const cookie = response.headers
    .getSetCookie()
    .map((header) => header.split(";")[0])
    .join("; ");
  const body = (await response.json()) as { user: { id: string } };
  return { cookie, userId: body.user.id };
}
