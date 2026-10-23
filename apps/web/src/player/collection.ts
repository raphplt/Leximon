"use client";

import type { DailyChallengeResponse } from "@leximon/contract";
import { copiesAfterTrade, type WordMemory } from "@leximon/view-model";
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

/**
 * The Jouer screen reuses the copies in hand this long: an open or a trade made here updates
 * them, and only a trade the other player accepted meanwhile could be missing.
 */
export const OWNED_CARDS_MAX_AGE_MS = 10 * 60 * 1000;

/** The player accepted a trade: one copy of each card changed hands, no need to read them all. */
export function publishTraded(gained: readonly string[], given: readonly string[]): void {
  const current = ownedCards.current();
  if (current !== null) ownedCards.publish(copiesAfterTrade(current, gained, given));
}

/** Level, next review, stability and last review of every reviewed word. */
export const wordMemory = sharedResource<ReadonlyMap<string, WordMemory>>(async () => {
  const words = await fetchMastery();
  return new Map(
    words.map((word) => [
      word.cardId,
      {
        level: word.level,
        due: Date.parse(word.due),
        stability: word.stability,
        lastReviewedAt: word.lastReviewedAt === null ? null : Date.parse(word.lastReviewedAt),
      },
    ]),
  );
});

/** Today's answers towards the daily goal. */
export const dailyChallenge = sharedResource<DailyChallengeResponse>(fetchDaily);

/**
 * Reads a resource again after an action changed it on the server (a booster, an answer, a
 * trade), but only if a screen already read it: nobody pays for a list nobody looks at.
 */
export function refreshIfRead<T>(resource: SharedResource<T>): void {
  if (resource.current() !== null) resource.refresh();
}
