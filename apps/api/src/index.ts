import type { GameEvent } from "@leximon/contract";
import { createDb } from "@leximon/db";
import { createApp } from "./app";
import {
  type CampaignQueueMessage,
  campaignMessageSchema,
  campaignPumpNeeded,
  deliverCampaignJob,
  pumpAndReschedule,
  startCampaignPump,
} from "./campaigns/delivery";
import { createCampaignMailer } from "./campaigns/mailer";
import { deliveryConfig } from "./campaigns/routes";
import { handleGameEvents } from "./clans/events";
import { sendDailyDigest } from "./digest/send";
import { errorSummary } from "./error-summary";
import { runMaintenance } from "./maintenance";
import {
  deliverNews,
  deliverReminders,
  isReminderHour,
  newsChecks,
  notifyContext,
  remindersDue,
} from "./notifications/notifications";
import { runWatchdog, WATCHDOG_CRON } from "./watchdog";

const app = createApp();

/**
 * The queue of game events; the other one carries campaign e-mails. Staging adds a suffix to
 * both names, so that its messages never reach the production consumers.
 */
const GAME_EVENTS_QUEUE = "leximon-game-events";
/** The evening reminders' triggers, as written in `wrangler.jsonc`; any other runs maintenance. */
const REMINDER_CRONS: ReadonlySet<string> = new Set(["0 16 * * *", "0 17 * * *"]);
/** The most messages Queues takes in one `sendBatch`. */
const SEND_BATCH_MAX = 100;

/** Sends follow-up messages; a failure is logged, the daily runs catch up. */
async function sendFollowUps(
  queue: Queue,
  messages: readonly MessageSendRequest<GameEvent>[],
  what: string,
): Promise<void> {
  for (let i = 0; i < messages.length; i += SEND_BATCH_MAX) {
    await queue.sendBatch(messages.slice(i, i + SEND_BATCH_MAX)).catch((error: unknown) => {
      console.error(`${what} not sent`, errorSummary(error));
    });
  }
}

export default {
  fetch: app.fetch,

  async scheduled(controller, env, ctx) {
    if (controller.cron === WATCHDOG_CRON) {
      await runWatchdog(env, controller.scheduledTime);
      return;
    }
    if (REMINDER_CRONS.has(controller.cron)) {
      // The evening reminders: two triggers, one per offset of Paris from UTC. The one that does
      // not strike 18:00 in Paris stops here, before waking the database.
      const now = controller.scheduledTime;
      if (!isReminderHour(now)) return;
      const { db, close } = createDb(env.HYPERDRIVE.connectionString, { maxConnections: 1 });
      try {
        if (notifyContext(env, db) === null) return;
        const messages = await remindersDue(db, now);
        await sendFollowUps(
          env.GAME_EVENTS,
          messages.map((body) => ({ body })),
          "Reminders",
        );
        console.info("Reminders queued", { messages: messages.length });
      } finally {
        ctx.waitUntil(close());
      }
      return;
    }
    const { db, close } = createDb(env.HYPERDRIVE.connectionString, { maxConnections: 1 });
    try {
      const now = Date.now();
      const report = await runMaintenance(db, now);
      console.info("Maintenance done", report);
      // Restarts the campaign pump in case its last message was lost.
      if (await campaignPumpNeeded(db, now)) await startCampaignPump(env.CAMPAIGN_QUEUE);
      // The summary never fails the maintenance.
      const digest = await sendDailyDigest(db, env, now).catch((error: unknown) => {
        console.error("Daily digest failed", errorSummary(error));
        return "failed";
      });
      if (digest === "not_delivered") console.error("Daily digest refused by Discord");
    } finally {
      ctx.waitUntil(close());
    }
  },

  async queue(batch, env, ctx) {
    if (batch.queue.startsWith(GAME_EVENTS_QUEUE)) {
      const { db, close } = createDb(env.HYPERDRIVE.connectionString, { maxConnections: 1 });
      try {
        const report = await handleGameEvents(
          db,
          batch.messages.map((message) => message.body),
          batch.messages.map((message) => message.timestamp.getTime()),
          Date.now(),
        );
        if (report.invalid > 0) console.error("Game events dropped: invalid body", report);
        // Not sent: the daily maintenance recounts the library anyway.
        await sendFollowUps(
          env.GAME_EVENTS,
          report.deferred.map(({ clanId, delaySeconds }) => ({
            body: { type: "library_due", clanId } satisfies GameEvent,
            delaySeconds,
          })),
          "Library recounts",
        );
        const notify = notifyContext(env, db);
        if (notify !== null) {
          const now = Date.now();
          // Not sent: the letters stay in the game, and the evening reminder names them.
          await sendFollowUps(env.GAME_EVENTS, newsChecks(report.news, now), "News checks");
          if (report.newsDue.length > 0) {
            const news = await deliverNews(notify, report.newsDue, now);
            if (news.deferred !== null) {
              const { userIds, delaySeconds } = news.deferred;
              await sendFollowUps(
                env.GAME_EVENTS,
                userIds.map((userId) => ({ body: { type: "news_due", userId }, delaySeconds })),
                "News checks",
              );
            }
            if (news.sent + news.failed + news.capped > 0) console.info("News e-mails", news);
          }
          if (report.remindersDue.length > 0) {
            console.info(
              "Reminder e-mails",
              await deliverReminders(notify, report.remindersDue, now),
            );
          }
        }
        batch.ackAll();
      } catch (error) {
        // Recounts are idempotent: the whole batch is tried again.
        console.error("Game events failed", errorSummary(error));
        batch.retryAll({ delaySeconds: 30 });
      } finally {
        ctx.waitUntil(close());
      }
      return;
    }
    const config = deliveryConfig(env);
    const { db, close } = createDb(env.HYPERDRIVE.connectionString, { maxConnections: 1 });
    const mailer = createCampaignMailer(env);
    try {
      for (const message of batch.messages) {
        const parsed = campaignMessageSchema.safeParse(message.body);
        if (!parsed.success) {
          console.error("Campaign message dropped: invalid body", { id: message.id });
          message.ack();
          continue;
        }
        const job = parsed.data;
        if ("kind" in job) {
          const report = await pumpAndReschedule(db, env.CAMPAIGN_QUEUE, Date.now());
          if (report.queued + report.started + report.completed + report.reclaimed > 0) {
            console.info("Campaign pump", report);
          }
          message.ack();
          continue;
        }
        if (config === null) {
          // Unsigned links cannot be sent: the message waits, its rows are reclaimed if needed.
          console.error("Campaign delivery stopped: EMAIL_LINK_SECRET is not set");
          message.retry({ delaySeconds: 300 });
          continue;
        }
        const report = await deliverCampaignJob(db, mailer, config, job, Date.now());
        if (report.kind === "delivered" && report.outcome !== "accepted") {
          console.warn("Campaign batch not fully sent", {
            campaignId: job.campaignId,
            outcome: report.outcome,
          });
        }
        message.ack();
      }
    } finally {
      ctx.waitUntil(close());
    }
  },
} satisfies ExportedHandler<Env, CampaignQueueMessage | unknown>;
