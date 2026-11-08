import {
  type Catalog,
  fetchCatalog,
  fetchFinders,
  fetchEngravingInks as fetchInks,
  catalogFileUrl as fileUrl,
} from "@leximon/contract/client";
import { sharedResource } from "@leximon/view-model";
import { CATALOG_URL } from "@/config";
import { useShared } from "@/player/shared";

/** URL of a file published with the catalogue (an engraving), from its path in a collection file. */
export function catalogFileUrl(path: string): string {
  return fileUrl(path, CATALOG_URL);
}

let loading: Promise<Catalog> | null = null;
let loaded: Catalog | null = null;

/** The catalogue, fetched once while the app runs and shared by every screen. */
export function loadCatalog(): Promise<Catalog> {
  loading ??= fetchCatalog(CATALOG_URL).then(
    (catalog) => {
      loaded = catalog;
      return catalog;
    },
    (error: unknown) => {
      loading = null;
      throw error;
    },
  );
  return loading;
}

/** The catalogue if already fetched: a screen opened later shows it at once, without waiting. */
export function catalogInHand(): Catalog | null {
  return loaded;
}

const inks = sharedResource<ReadonlyMap<string, string>>(() => fetchInks(CATALOG_URL));

/**
 * The address of a card's engraving ink, `null` while the index loads or when the card has none:
 * enough for an avatar or an emblem, without loading the catalogue.
 */
export function useEngravingInk(cardId: string | null): string | null {
  const known = useShared(inks);
  const path = cardId === null ? undefined : known?.get(cardId);
  return path === undefined ? null : catalogFileUrl(path);
}

const finders = sharedResource<ReadonlyMap<string, string>>(() => fetchFinders(CATALOG_URL));

/** The pseudo of the patron who found this card, `null` for most cards and while it loads. */
export function useFinder(cardId: string): string | null {
  return useShared(finders)?.get(cardId) ?? null;
}
