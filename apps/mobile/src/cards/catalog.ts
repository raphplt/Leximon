import { type Catalog, fetchCatalog, catalogFileUrl as fileUrl } from "@leximon/contract/client";
import { CATALOG_URL } from "@/config";

/** URL of a file published with the catalogue (an engraving), from its path in a collection file. */
export function catalogFileUrl(path: string): string {
  return fileUrl(path, CATALOG_URL);
}

let loading: Promise<Catalog> | null = null;

/** The catalogue, fetched once while the app runs and shared by every screen. */
export function loadCatalog(): Promise<Catalog> {
  loading ??= fetchCatalog(CATALOG_URL).catch((error: unknown) => {
    loading = null;
    throw error;
  });
  return loading;
}
