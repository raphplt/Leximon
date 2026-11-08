import type { BannerPurchaseRefusal, BoosterWalletResponse } from "@leximon/contract";
import {
  BANNER_SCHEDULE,
  type BannerProgress,
  type BannerRules,
  bannerMotifsOwned,
  bannerPurchaseRefusal,
  bannerRulesAt,
  type EpochMs,
  type League,
  levelOf,
} from "@leximon/core";
import { type Database, type EcuMovementDetails, schema } from "@leximon/db";
import { eq, sql } from "drizzle-orm";
import { lockWallet, walletView } from "../levels/rewards";

const { boosterWallets, ecuMovements, guestLinks, userBanners, userProgress, users } = schema;

type Reader = Pick<Database, "select">;

/** Published collections the player holds every card of, retired cards aside. */
export function completeCollectionsSql(userId: string) {
  return sql<number>`(select count(*)::int from collections c
    where c.published_at is not null and not exists (
      select 1 from cards k where k.collection_id = c.id and k.retired_at is null
      and not exists (select 1 from user_cards uc
        where uc.user_id = ${userId} and uc.card_id = k.id and uc.quantity > 0)))`;
}

/** The motifs bought with écus. */
async function readBought(db: Reader, userId: string): Promise<string[]> {
  const rows = await db
    .select({ motif: userBanners.motif })
    .from(userBanners)
    .where(eq(userBanners.userId, userId));
  return rows.map((row) => row.motif);
}

/** The motifs a player may wear, from what the profile already read. */
export async function bannersOwned(
  db: Reader,
  input: {
    readonly userId: string;
    readonly level: number;
    readonly completeCollections: number;
    readonly bestLeague: League | null;
    readonly now: EpochMs;
  },
): Promise<{ readonly rules: BannerRules; readonly owned: Set<string> }> {
  const rules = bannerRulesAt(BANNER_SCHEDULE, input.now);
  const progress: BannerProgress = {
    level: input.level,
    bestLeague: input.bestLeague,
    completeCollections: input.completeCollections,
    bought: await readBought(db, input.userId),
  };
  return { rules, owned: bannerMotifsOwned(rules, progress) };
}

/** The level and the complete collections, for a check that has not read the profile. */
export async function readBannerFigures(
  db: Reader,
  userId: string,
): Promise<{ readonly level: number; readonly completeCollections: number }> {
  const [row] = await db
    .select({
      xp: sql<number>`coalesce((select ${userProgress.xp} from ${userProgress}
        where ${userProgress.userId} = ${userId}), 0)`,
      completeCollections: completeCollectionsSql(userId),
    })
    .from(sql`(select 1) as one`);
  if (row === undefined) throw new Error("Banner figures query returned no row");
  return { level: levelOf(row.xp).level, completeCollections: row.completeCollections };
}

export type BannerPurchaseResult =
  | { readonly kind: "bought"; readonly wallet: BoosterWalletResponse }
  | { readonly kind: "refused"; readonly reason: BannerPurchaseRefusal }
  | { readonly kind: "guest_archived" };

/**
 * `POST /me/banners/:motif`: a motif sold at a fixed price, bought once. One transaction that
 * locks the wallet first, so that two purchases never spend the same écus: lock, look up the key,
 * the account and the motifs bought, one combined write. A retry with the same key answers as
 * the first purchase did.
 */
export async function buyBanner(
  db: Database,
  input: {
    readonly userId: string;
    readonly motif: string;
    readonly idempotencyKey: string;
    readonly now: EpochMs;
  },
): Promise<BannerPurchaseResult> {
  const { userId, motif, idempotencyKey, now } = input;
  const rules = bannerRulesAt(BANNER_SCHEDULE, now);
  return db.transaction(async (tx): Promise<BannerPurchaseResult> => {
    const locked = await lockWallet(tx, userId, now);
    const [state] = await tx
      .select({
        archived: sql<boolean>`exists (select 1 from ${guestLinks}
          where ${guestLinks.guestId} = ${userId})`,
        guest: sql<boolean>`coalesce((select ${users.isAnonymous} from ${users}
          where ${users.id} = ${userId}), true)`,
        previous: sql<EcuMovementDetails | null>`(select ${ecuMovements.details}
          from ${ecuMovements} where ${ecuMovements.userId} = ${userId}
          and ${ecuMovements.idempotencyKey} = ${idempotencyKey})`,
      })
      .from(sql`(select 1) as one`);
    if (state === undefined) throw new Error("Banner purchase lookup returned no row");
    if (state.archived) return { kind: "guest_archived" };
    if (state.previous?.kind === "banner")
      return { kind: "bought", wallet: walletView(locked, now) };
    if (state.guest) return { kind: "refused", reason: "account_required" };

    // Motifs for sale are never earned otherwise: what was bought is enough to tell.
    const owned = new Set([rules.startingMotif, ...(await readBought(tx, userId))]);
    const refusal = bannerPurchaseRefusal(rules, owned, motif, locked.ecus);
    if (refusal !== null) return { kind: "refused", reason: refusal };
    const price = rules.forEcus[motif] ?? 0;

    const bannerInsert = tx.$with("banner_insert").as(
      tx
        .insert(userBanners)
        .values({ userId, motif, boughtAt: new Date(now) })
        .returning({ motif: userBanners.motif }),
    );
    const details: EcuMovementDetails = { kind: "banner", motif };
    const movementInsert = tx.$with("movement_insert").as(
      tx
        .insert(ecuMovements)
        .values({
          id: crypto.randomUUID(),
          userId,
          kind: "banner",
          amount: -price,
          idempotencyKey,
          details,
          createdAt: new Date(now),
        })
        .returning({ id: ecuMovements.id }),
    );
    await tx
      .with(bannerInsert, movementInsert)
      .update(boosterWallets)
      .set({ ecus: sql`${boosterWallets.ecus} - ${price}` })
      .where(eq(boosterWallets.userId, userId));
    return { kind: "bought", wallet: walletView({ ...locked, ecus: locked.ecus - price }, now) };
  });
}
