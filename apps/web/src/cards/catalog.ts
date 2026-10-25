import {
  type Catalog,
  fetchCatalog,
  fetchEngravingInks as fetchInks,
  catalogFileUrl as fileUrl,
} from "@leximon/contract/client";

// Dot access only: Next.js inlines NEXT_PUBLIC_ variables at build time, not bracket access.
const CATALOG_URL = process.env.NEXT_PUBLIC_CATALOG_URL ?? "/catalog";

/** URL of a file published with the catalogue (an engraving), from its path in a collection file. */
export function catalogFileUrl(path: string): string {
  return fileUrl(path, CATALOG_URL);
}

export function fetchEngravingInks(): Promise<ReadonlyMap<string, string>> {
  return fetchInks(CATALOG_URL);
}

let loading: Promise<Catalog> | null = null;

/** The catalogue, fetched once per page load and shared by every screen. */
export function loadCatalog(): Promise<Catalog> {
  loading ??= fetchCatalog(CATALOG_URL).catch((error: unknown) => {
    loading = null;
    throw error;
  });
  return loading;
}
