import { type Database, schema } from "@leximon/db";
import { eq, sql } from "drizzle-orm";

const { userProgress } = schema;

type Writer = Pick<Database, "$with" | "insert">;

/**
 * Data-modifying CTE adding XP to a player, creating their row on the first gain. An atomic
 * increment: it needs no lock of its own, and runs in the statement of the action that earns it.
 */
export function addXp(tx: Writer, name: string, userId: string, amount: number) {
  return addXpToPlayers(tx, name, [{ userId, amount }]);
}

/**
 * The same for several players at once (both sides of a trade). Rows are written in user id order,
 * so that two statements touching the same players never lock them in opposite orders.
 */
export function addXpToPlayers(
  tx: Writer,
  name: string,
  gains: readonly { readonly userId: string; readonly amount: number }[],
) {
  const sorted = [...gains].sort((a, b) =>
    a.userId < b.userId ? -1 : a.userId > b.userId ? 1 : 0,
  );
  return tx.$with(name).as(
    tx
      .insert(userProgress)
      .values(sorted.map(({ userId, amount }) => ({ userId, xp: amount })))
      .onConflictDoUpdate({
        target: userProgress.userId,
        set: { xp: sql`${userProgress.xp} + excluded.xp` },
      })
      .returning({ userId: userProgress.userId, xp: userProgress.xp }),
  );
}

/** Total XP of a player: 0 until their first gain. */
export async function readXp(db: Pick<Database, "select">, userId: string): Promise<number> {
  const [row] = await db
    .select({ xp: userProgress.xp })
    .from(userProgress)
    .where(eq(userProgress.userId, userId));
  return row?.xp ?? 0;
}
