"use client";

import type { DailyChallengeResponse, OwnedCardsResponse } from "@leximon/contract";
import {
  type CardDate,
  copiesAfterTrade,
  copiesByCard,
  datesAfterGain,
  datesByCard,
  memoriesByCard,
  type SharedResource,
  sharedResource,
  type WordMemory,
} from "@leximon/view-model";
import { api } from "@/lib/api";

type OwnedCopy = OwnedCardsResponse["cards"][number];

/** One request for both resources below, when they are read together. */
let ownedInFlight: Promise<OwnedCopy[]> | null = null;
function fetchOwnedOnce(): Promise<OwnedCopy[]> {
  ownedInFlight ??= api.fetchOwnedCards().finally(() => {
    ownedInFlight = null;
  });
  return ownedInFlight;
}

/** Copies owned, by card id (the album, the card sheet, the trades). */
export const ownedCards = sharedResource<ReadonlyMap<string, number>>(async () => {
  const owned = await fetchOwnedOnce();
  cardDates.publish(datesByCard(owned));
  return copiesByCard(owned);
});

/** When each owned card was first got, and whether its sheet was opened since (the album). */
export const cardDates = sharedResource<ReadonlyMap<string, CardDate>>(async () => {
  const owned = await fetchOwnedOnce();
  ownedCards.publish(copiesByCard(owned));
  return datesByCard(owned);
});

/** Cards just got that the player did not own: new until their sheet is opened. */
export function noteGained(cardIds: readonly string[], ownedBefore: ReadonlyMap<string, number>) {
  const current = cardDates.current();
  if (current === null) return;
  cardDates.publish(datesAfterGain(current, cardIds, ownedBefore, Date.now()));
}

/**
 * The player opened the card's sheet: no longer new, at once on screen. The request is sent only
 * for a card known new, or when nothing is known yet; if it fails, the dates are read again so
 * the screen shows what the server kept.
 */
export function noteCardRead(cardId: string): void {
  const current = cardDates.current();
  const known = current?.get(cardId);
  if (current !== null && (known === undefined || known.read)) return;
  if (current !== null && known !== undefined) {
    cardDates.publish(new Map(current).set(cardId, { ...known, read: true }));
  }
  api.markCardRead(cardId).catch(() => cardDates.refresh());
}

/**
 * The Jouer screen reuses the copies in hand this long: an open or a trade made here updates
 * them, and only a trade the other player accepted meanwhile could be missing.
 */
export const OWNED_CARDS_MAX_AGE_MS = 10 * 60 * 1000;

/** The player accepted a trade: one copy of each card changed hands, no need to read them all. */
export function publishTraded(gained: readonly string[], given: readonly string[]): void {
  const current = ownedCards.current();
  if (current === null) return;
  noteGained(gained, current);
  ownedCards.publish(copiesAfterTrade(current, gained, given));
}

/** Level, next review, stability and last review of every reviewed word. */
export const wordMemory = sharedResource<ReadonlyMap<string, WordMemory>>(async () => {
  return memoriesByCard(await api.fetchMastery());
});

/** Today's answers towards the daily goal. */
export const dailyChallenge = sharedResource<DailyChallengeResponse>(api.fetchDaily);

/**
 * Reads a resource again after an action changed it on the server (a booster, an answer, a
 * trade), but only if a screen already read it: nobody pays for a list nobody looks at.
 */
export function refreshIfRead<T>(resource: SharedResource<T>): void {
  if (resource.current() !== null) resource.refresh();
}
