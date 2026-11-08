import type { MissingWordRequest, RecycleResponse } from "@leximon/contract";
import type {
  BannerPurchaseResult,
  MissingWordResult,
  RecycleCopyResult,
} from "@leximon/contract/client";
import type { RecycleChoice } from "@leximon/core";
import { copiesAfterRecycle } from "@leximon/view-model";
import { randomUUID } from "expo-crypto";
import { api } from "@/api/client";
import { noteGained, ownedCards, refreshIfRead } from "./collection";
import { missions, profile, publishProgress, wallet } from "./state";

/**
 * Recycling and the missing word: each request has its own key, since a repeated tap after a
 * failure asks again for what exists then, which recycles nothing twice.
 */

function publishRecycled(result: RecycleResponse): void {
  wallet.publish(result.wallet);
  refreshIfRead(missions);
  const current = ownedCards.current();
  if (current !== null && result.cards.length > 0) {
    ownedCards.publish(copiesAfterRecycle(current, result.cards));
  }
}

/** Recycles the copies picked, card by card. */
export async function recycleChosen(choice: readonly RecycleChoice[]): Promise<RecycleResponse> {
  const result = await api.recycleDuplicates(randomUUID(), [...choice]);
  publishRecycled(result);
  return result;
}

/** Recycles one copy of a card, from its sheet. */
export async function recycleCopyOf(cardId: string): Promise<RecycleCopyResult> {
  const result = await api.recycleCopy(cardId, randomUUID());
  if (result.kind === "recycled") publishRecycled(result);
  return result;
}

/** Spends écus on a missing word: the word joins the album at once. */
export async function buyMissingWord(request: MissingWordRequest): Promise<MissingWordResult> {
  const result = await api.buyMissingWord(request, randomUUID());
  if (result.kind === "bought") {
    wallet.publish(result.wallet);
    publishProgress(result.progress);
    const current = ownedCards.current();
    if (current !== null) {
      noteGained([result.cardId], current);
      ownedCards.publish(
        new Map(current).set(result.cardId, (current.get(result.cardId) ?? 0) + 1),
      );
    }
  }
  return result;
}

/** Spends écus on a banner motif: it joins the atelier at once. */
export async function buyBanner(motif: string): Promise<BannerPurchaseResult> {
  const result = await api.buyBanner(motif, randomUUID());
  if (result.kind === "bought") {
    wallet.publish(result.wallet);
    profile.publish(result.profile);
  }
  return result;
}
