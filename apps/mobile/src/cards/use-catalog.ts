import type { Catalog } from "@leximon/contract/client";
import { sharedResource } from "@leximon/view-model";
import { useShared } from "@/player/shared";
import { loadCatalog } from "./catalog";

const catalog = sharedResource<Catalog>(loadCatalog);

/** The catalogue, `null` until loaded. */
export function useCatalog(): Catalog | null {
  return useShared(catalog);
}
