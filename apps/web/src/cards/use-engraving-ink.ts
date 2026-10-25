"use client";

import { sharedResource } from "@leximon/view-model";
import { useShared } from "@/player/resource";
import { catalogFileUrl, fetchEngravingInks } from "./catalog";

const inks = sharedResource<ReadonlyMap<string, string>>(() => fetchEngravingInks());

/**
 * The address of a card's engraving ink, `null` while the index loads or when the card has none:
 * enough for an avatar or an emblem, without loading the catalogue.
 */
export function useEngravingInk(cardId: string | null): string | null {
  const known = useShared(inks);
  const path = cardId === null ? undefined : known?.get(cardId);
  return path === undefined ? null : catalogFileUrl(path);
}
