import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";
import { withRegionalCache } from "@opennextjs/cloudflare/overrides/incremental-cache/regional-cache";
import doQueue from "@opennextjs/cloudflare/overrides/queue/do-queue";

// Next's data cache (catalogue collection files, public profiles kept 60 s) and prerendered pages
// live in R2, with a short copy in each Cloudflare location. Time-based revalidation goes through a Durable Object
// queue so that one stale entry is recomputed once, not by every request at the same moment.
// No tag cache: nothing calls `revalidateTag` or `revalidatePath`.
export default defineCloudflareConfig({
  incrementalCache: withRegionalCache(r2IncrementalCache, { mode: "short-lived" }),
  queue: doQueue,
  // Off: it does not work with `cacheComponents`, which is meant to come back.
  enableCacheInterception: false,
});
