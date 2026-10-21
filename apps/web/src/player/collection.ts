"use client";

import type { DailyChallengeResponse } from "@leximon/contract";
import type { WordMemory } from "@leximon/view-model";
import { fetchDaily, fetchMastery, fetchOwnedCards } from "@/lib/api";
import { type SharedResource, sharedResource } from "./resource";

/** Copies owned, by card id (the album, the card sheet, the trades). */
export const ownedCards = sharedResource<ReadonlyMap<string, number>>(async () => {
  const byCard = new Map<string, number>();
  for (const card of await fetchOwnedCards()) {
    byCard.set(card.cardId, (byCard.get(card.cardId) ?? 0) + card.quantity);
  }
  return byCard;
});

/** Level, next review and stability of every reviewed word (D-025). */
export const wordMemory = sharedResource<ReadonlyMap<string, WordMemory>>(async () => {
  const words = await fetchMastery();
  return new Map(
    words.map((word) => [
      word.cardId,
      { level: word.level, due: Date.parse(word.due), stability: word.stability },
    ]),
  );
});

/** Today's answers towards the daily goal (D-01, J-04). */
export const dailyChallenge = sharedResource<DailyChallengeResponse>(fetchDaily);

/**
 * Reads a resource again after an action changed it on the server (a booster, an answer, a
 * trade), but only if a screen already read it: nobody pays for a list nobody looks at.
 */
export function refreshIfRead<T>(resource: SharedResource<T>): void {
  if (resource.current() !== null) resource.refresh();
}
