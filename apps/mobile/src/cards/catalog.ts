import { type Catalog, fetchCatalog, catalogFileUrl as fileUrl } from "@leximon/contract/client";
import { CATALOG_URL } from "@/config";

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
