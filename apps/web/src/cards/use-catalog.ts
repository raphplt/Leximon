"use client";

import { sharedResource } from "@leximon/view-model";
import { useShared } from "@/player/resource";
import { type Catalog, loadCatalog } from "./catalog";

const catalog = sharedResource<Catalog>(loadCatalog);

/** The catalogue, `null` until loaded: for what only decorates (an avatar, a pinned card). */
export function useCatalog(): Catalog | null {
  return useShared(catalog);
}
