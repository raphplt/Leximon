import type { PatronThanksResponse } from "@leximon/contract";
import { type EpochMs, xpToReach } from "@leximon/core";
import { type Database, schema } from "@leximon/db";
import { and, asc, eq, gte, inArray, isNotNull, sql } from "drizzle-orm";
import { notLocked } from "../friends/friends";
import { publicLevel } from "../profile/profile";

const { patronSubscriptions, players, userProgress, users } = schema;

type Reader = Pick<Database, "select">;

/**
 * `GET /patrons`: who the public page thanks. A paying patron, never during the trial, with a
 * profile anyone may read, who did not ask to stay off it; never a suspended or closed account.
 * The list is as long as the patrons are few, and the CDN keeps it a few minutes.
 */
export async function readPatronThanks(db: Reader, now: EpochMs): Promise<PatronThanksResponse> {
  const rows = await db
    .select({ pseudo: players.pseudo, founderAt: patronSubscriptions.founderAt })
    .from(patronSubscriptions)
    .innerJoin(players, eq(players.userId, patronSubscriptions.userId))
    .innerJoin(users, eq(users.id, patronSubscriptions.userId))
    .innerJoin(userProgress, eq(userProgress.userId, patronSubscriptions.userId))
    .where(
      and(
        inArray(patronSubscriptions.status, ["active", "past_due"]),
        isNotNull(patronSubscriptions.firstPaidAt),
        sql`not ${patronSubscriptions.thanksHidden}`,
        sql`${players.profilePublic}`,
        isNotNull(players.pseudo),
        sql`${users.isAnonymous} is not true`,
        gte(userProgress.xp, xpToReach(publicLevel(now))),
        notLocked(patronSubscriptions.userId, now),
      ),
    )
    .orderBy(
      sql`${patronSubscriptions.founderAt} is null`,
      asc(patronSubscriptions.firstPaidAt),
      asc(players.code),
    );
  return {
    patrons: rows.flatMap((row) =>
      row.pseudo === null ? [] : [{ pseudo: row.pseudo, founder: row.founderAt !== null }],
    ),
  };
}

/** `PUT /me/patron/thanks`: « Ne pas me citer », or back on the page. */
export async function setPatronThanks(
  db: Database,
  input: { readonly userId: string; readonly listed: boolean },
): Promise<void> {
  await db
    .update(patronSubscriptions)
    .set({ thanksHidden: !input.listed, updatedAt: new Date() })
    .where(eq(patronSubscriptions.userId, input.userId));
}
