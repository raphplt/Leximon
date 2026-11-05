import type { EpochMs } from "@leximon/core";
import { type Database, type EcuMovementDetails, schema } from "@leximon/db";
import { type SQL, sql } from "drizzle-orm";

const { boosterWallets, ecuMovements } = schema;

type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

/** The écus a perfect start gave to the answer of `key`, 0 if none: what a retry replays. */
export function perfectStartOf(userId: string, key: string): SQL<number> {
  return sql<number>`coalesce((select ${ecuMovements.amount} from ${ecuMovements}
    where ${ecuMovements.userId} = ${userId} and ${ecuMovements.idempotencyKey} = ${key}
      and ${ecuMovements.kind} = 'perfect_start'), 0)`;
}

/**
 * Gives the écus of a perfect start, under the wallet lock the answer already holds: one
 * statement that logs the movement and adds it to the wallet. The answer's key makes it happen
 * once. Only the one answer of a day that completes a perfect start comes here.
 */
export async function creditPerfectStart(
  tx: Transaction,
  input: {
    readonly userId: string;
    readonly key: string;
    readonly ecus: number;
    readonly day: string;
    readonly now: EpochMs;
  },
): Promise<void> {
  const details: EcuMovementDetails = { kind: "perfect_start", day: input.day };
  await tx.execute(sql`
    with movement as (
      insert into ${ecuMovements} (id, user_id, kind, amount, idempotency_key, details, created_at)
      values (${crypto.randomUUID()}, ${input.userId}, 'perfect_start', ${input.ecus}, ${input.key},
        ${JSON.stringify(details)}::jsonb, ${new Date(input.now)})
      on conflict do nothing
      returning amount
    )
    update ${boosterWallets} set ecus = ${boosterWallets.ecus} + movement.amount
    from movement where ${boosterWallets.userId} = ${input.userId}
  `);
}
