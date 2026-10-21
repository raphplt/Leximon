"use client";

import { sharedResource, useShared } from "@/player/resource";
import { type Catalog, loadCatalog } from "./catalog";

const catalog = sharedResource<Catalog>(loadCatalog);

/** The catalogue, `null` until loaded: for what only decorates (an avatar, a pinned card). */
export function useCatalog(): Catalog | null {
  return useShared(catalog);
}
