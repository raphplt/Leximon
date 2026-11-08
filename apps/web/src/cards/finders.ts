import { fetchFinders } from "@leximon/contract/client";
import { sharedResource } from "@leximon/view-model";
import { useShared } from "@/player/resource";

// Dot access only: Next.js inlines NEXT_PUBLIC_ variables at build time, not bracket access.
const CATALOG_URL = process.env.NEXT_PUBLIC_CATALOG_URL ?? "/catalog";

const finders = sharedResource<ReadonlyMap<string, string>>(() => fetchFinders(CATALOG_URL));

/** The pseudo of the patron who found this card, `null` for most cards and while it loads. */
export function useFinder(cardId: string): string | null {
  return useShared(finders)?.get(cardId) ?? null;
}
