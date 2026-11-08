"use client";

import type { CatalogCabinet } from "@leximon/contract";
import { fetchCabinet, fetchCabinetIndex } from "@leximon/contract/client";
import { sharedResource } from "@leximon/view-model";
import { useCallback, useEffect, useState } from "react";
import { useShared, useSharedFailed } from "@/player/resource";

// Dot access only: Next.js inlines NEXT_PUBLIC_ variables at build time, not bracket access.
const CATALOG_URL = process.env.NEXT_PUBLIC_CATALOG_URL ?? "/catalog";

const cabinets = sharedResource<ReadonlyMap<string, string>>(() => fetchCabinetIndex(CATALOG_URL));

export type CabinetState =
  | { readonly kind: "loading" }
  | { readonly kind: "missing" }
  | { readonly kind: "failed" }
  | { readonly kind: "ready"; readonly cabinet: CatalogCabinet };

/** A card's cabinet: the index says which file, the file is cached for good once read. */
export function useCabinet(cardId: string): { state: CabinetState; retry: () => void } {
  const index = useShared(cabinets);
  const indexFailed = useSharedFailed(cabinets);
  const path = index?.get(cardId);
  const [loaded, setLoaded] = useState<{ path: string; cabinet: CatalogCabinet } | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (path === undefined || attempt < 0) return;
    let cancelled = false;
    setFailed(false);
    fetchCabinet(CATALOG_URL, path).then(
      (cabinet) => {
        if (!cancelled) setLoaded({ path, cabinet });
      },
      () => {
        if (!cancelled) setFailed(true);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [path, attempt]);

  const retry = useCallback(() => {
    cabinets.ensure();
    setAttempt((count) => count + 1);
  }, []);

  if (index === null) return { state: { kind: indexFailed ? "failed" : "loading" }, retry };
  if (path === undefined) return { state: { kind: "missing" }, retry };
  if (loaded?.path === path) return { state: { kind: "ready", cabinet: loaded.cabinet }, retry };
  return { state: { kind: failed ? "failed" : "loading" }, retry };
}
