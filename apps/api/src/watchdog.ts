import { createDb } from "@leximon/db";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { postToDiscord } from "./digest/digest";
import { errorSummary } from "./error-summary";

/** The watchdog's trigger, as written in `wrangler.jsonc`. */
export const WATCHDOG_CRON = "*/5 * * * *";

const MINUTE_MS = 60_000;
const DATABASE_TIMEOUT_MS = 8_000;
/** Two runs in a row: a reboot of the home server takes two minutes and is no incident. */
const FAILURES_BEFORE_ALERT = 2;
/** Dumps are hourly: three missed ones mean the job is broken, not late. */
const BACKUP_MAX_AGE_MS = 180 * MINUTE_MS;

const watchSchema = z.object({
  failures: z.number(),
  since: z.number().nullable(),
  alerted: z.boolean(),
});
export type Watch = z.infer<typeof watchSchema>;

const HEALTHY: Watch = { failures: 0, since: null, alerted: false };

export type WatchNotice = "down" | "up";

/** One run of a check: the next state, and what to tell the owner, once per incident. */
export function nextWatch(
  watch: Watch,
  healthy: boolean,
  now: number,
): { watch: Watch; notice: WatchNotice | null } {
  if (healthy) return { watch: HEALTHY, notice: watch.alerted ? "up" : null };
  const failures = watch.failures + 1;
  const alert = !watch.alerted && failures >= FAILURES_BEFORE_ALERT;
  return {
    watch: { failures, since: watch.since ?? now, alerted: watch.alerted || alert },
    notice: alert ? "down" : null,
  };
}

export type WatchedService = "database" | "backup";

/** The Discord post of a notice; `minutes` is the time since the first failed check. */
export function watchMessage(
  service: WatchedService,
  notice: WatchNotice,
  minutes: number,
): string {
  const duration = minutes > 1 ? `${minutes} minutes` : "1 minute";
  if (service === "database") {
    return notice === "down"
      ? `🔴 La base de données ne répond plus depuis ${duration}, le jeu est sans doute coupé. Regarde le serveur maison, la box et le tunnel. Si le serveur ne revient pas, suis la section 15 bis de docs/mise-en-ligne.md.`
      : `🟢 La base de données répond de nouveau, après ${duration} de coupure.`;
  }
  return notice === "down"
    ? `🟠 Aucune sauvegarde n'est arrivée sur R2 depuis plus de 3 heures. Le jeu tourne, mais la dernière copie vieillit : regarde \`leximon-backup.timer\` dans le conteneur leximon-db.`
    : `🟢 Les sauvegardes arrivent de nouveau sur R2, après ${duration} de panne.`;
}

interface WatchdogDeps {
  readonly store: {
    get(key: string): Promise<string | null>;
    put(key: string, value: string): Promise<void>;
  };
  readonly notify: (content: string) => Promise<boolean>;
}

/**
 * Moves one check forward. The state is only saved once the owner has been told: a post that
 * Discord refused goes out again at the next run. It lives in KV because the database is
 * precisely what may be down.
 */
export async function recordCheck(
  deps: WatchdogDeps,
  service: WatchedService,
  healthy: boolean,
  now: number,
): Promise<void> {
  const raw = await deps.store.get(`watch:${service}`);
  const watch = raw === null ? HEALTHY : watchSchema.parse(JSON.parse(raw));
  const next = nextWatch(watch, healthy, now);
  if (next.notice !== null) {
    const since = next.watch.since ?? watch.since ?? now;
    const minutes = Math.max(1, Math.round((now - since) / MINUTE_MS));
    const delivered = await deps.notify(watchMessage(service, next.notice, minutes));
    if (!delivered) {
      console.error("Watchdog notice refused by Discord", { service, notice: next.notice });
      return;
    }
  }
  if (JSON.stringify(next.watch) !== JSON.stringify(watch)) {
    await deps.store.put(`watch:${service}`, JSON.stringify(next.watch));
  }
}

async function databaseAnswers(connectionString: string): Promise<boolean> {
  const { db, close } = createDb(connectionString, { maxConnections: 1 });
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      db.execute(sql`select 1`),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("timed out")), DATABASE_TIMEOUT_MS);
      }),
    ]);
    return true;
  } catch (error) {
    console.error("Watchdog: database unreachable", errorSummary(error));
    return false;
  } finally {
    clearTimeout(timer);
    await close().catch(() => undefined);
  }
}

export function backupIsFresh(uploads: readonly Date[], now: number): boolean {
  const newest = Math.max(0, ...uploads.map((uploaded) => uploaded.getTime()));
  return now - newest < BACKUP_MAX_AGE_MS;
}

/** Runs from Cloudflare, outside the home network, so that a dead server still gets reported. */
export async function runWatchdog(env: Env, now: number): Promise<void> {
  const webhookUrl = env.DISCORD_WEBHOOK_URL?.trim();
  if (webhookUrl === undefined || webhookUrl === "") return;
  const deps: WatchdogDeps = {
    store: env.WATCHDOG,
    notify: (content) => postToDiscord(webhookUrl, content),
  };
  await recordCheck(deps, "database", await databaseAnswers(env.HYPERDRIVE.connectionString), now);
  const hourly = await env.BACKUPS.list({ prefix: "hourly/" });
  await recordCheck(
    deps,
    "backup",
    backupIsFresh(
      hourly.objects.map((object) => object.uploaded),
      now,
    ),
    now,
  );
}
