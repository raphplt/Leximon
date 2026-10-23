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
import { errorSummary } from "./error-summary";
import { runMaintenance } from "./maintenance";

const app = createApp();

/** The queue of game events; the other one carries campaign e-mails. */
const GAME_EVENTS_QUEUE = "leximon-game-events";

export default {
  fetch: app.fetch,

  async scheduled(_controller, env, ctx) {
    const { db, close } = createDb(env.HYPERDRIVE.connectionString, { maxConnections: 1 });
    try {
      const now = Date.now();
      const report = await runMaintenance(db, now);
      console.info("Maintenance done", report);
      // Restarts the campaign pump in case its last message was lost.
      if (await campaignPumpNeeded(db, now)) await startCampaignPump(env.CAMPAIGN_QUEUE);
    } finally {
      ctx.waitUntil(close());
    }
  },

  async queue(batch, env, ctx) {
    if (batch.queue === GAME_EVENTS_QUEUE) {
      const { db, close } = createDb(env.HYPERDRIVE.connectionString, { maxConnections: 1 });
      try {
        const report = await handleGameEvents(
          db,
          batch.messages.map((message) => message.body),
          batch.messages.map((message) => message.timestamp.getTime()),
          Date.now(),
        );
        if (report.invalid > 0) console.error("Game events dropped: invalid body", report);
        if (report.deferred.length > 0) {
          // Not sent: the daily maintenance recounts the library anyway.
          await env.GAME_EVENTS.sendBatch(
            report.deferred.map(({ clanId, delaySeconds }) => ({
              body: { type: "library_due", clanId } satisfies GameEvent,
              delaySeconds,
            })),
          ).catch((error: unknown) => {
            console.error("Library recounts not put off", errorSummary(error));
          });
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
