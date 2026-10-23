import type { Database } from "@leximon/db";
import { readOverview } from "../admin/queries";
import { composeDigest, postToDiscord } from "./digest";
import { type ErrorReport, readErrors } from "./errors";

export type DigestOutcome = "sent" | "not_configured" | "not_delivered";

type DigestEnv = Pick<Env, "DISCORD_WEBHOOK_URL" | "CLOUDFLARE_ACCOUNT_ID" | "OBSERVABILITY_TOKEN">;

/**
 * The morning summary, after the daily maintenance: the database is awake anyway. Without a
 * webhook, nothing is sent; without the observability token, the post says errors are unread.
 */
export async function sendDailyDigest(
  db: Database,
  env: DigestEnv,
  now: number,
  fetcher: typeof fetch = fetch,
): Promise<DigestOutcome> {
  const webhookUrl = configured(env.DISCORD_WEBHOOK_URL);
  if (webhookUrl === null) return "not_configured";
  const accountId = configured(env.CLOUDFLARE_ACCOUNT_ID);
  const token = configured(env.OBSERVABILITY_TOKEN);
  const errors: ErrorReport =
    accountId === null || token === null
      ? { kind: "unavailable", status: null }
      : await readErrors({ accountId, token }, now, fetcher);
  const content = composeDigest({ now, errors, overview: await readOverview(db, now) });
  return (await postToDiscord(webhookUrl, content, fetcher)) ? "sent" : "not_delivered";
}

function configured(value: string | undefined): string | null {
  return value === undefined || value.trim() === "" ? null : value.trim();
}
