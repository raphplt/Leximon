import { createDb } from "@leximon/db";
import { createApp } from "./app";
import {
  type CampaignJob,
  campaignJobSchema,
  deliverCampaignJob,
  pumpCampaigns,
} from "./campaigns/delivery";
import { createCampaignMailer } from "./campaigns/mailer";
import { deliveryConfig } from "./campaigns/routes";
import { handleGameEvents } from "./clans/events";
import { errorSummary } from "./error-summary";
import { runMaintenance } from "./maintenance";

const app = createApp();

/** The cron trigger that feeds campaigns to the queue; the other one is maintenance. */
const CAMPAIGN_PUMP_CRON = "* * * * *";
/** The queue of game events; the other one carries campaign e-mails. */
const GAME_EVENTS_QUEUE = "leximon-game-events";

export default {
  fetch: app.fetch,

  async scheduled(controller, env, ctx) {
    const { db, close } = createDb(env.HYPERDRIVE.connectionString, { maxConnections: 1 });
    try {
      if (controller.cron === CAMPAIGN_PUMP_CRON) {
        const report = await pumpCampaigns(db, env.CAMPAIGN_QUEUE, Date.now());
        if (report.queued + report.started + report.completed + report.reclaimed > 0) {
          console.info("Campaign pump", report);
        }
      } else {
        const report = await runMaintenance(db, Date.now());
        console.info("Maintenance done", report);
      }
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
    if (config === null) {
      // Unsigned links cannot be sent: the messages wait, the rows are reclaimed later if needed.
      console.error("Campaign delivery stopped: EMAIL_LINK_SECRET is not set");
      batch.retryAll({ delaySeconds: 300 });
      return;
    }
    const { db, close } = createDb(env.HYPERDRIVE.connectionString, { maxConnections: 1 });
    const mailer = createCampaignMailer(env);
    try {
      for (const message of batch.messages) {
        const job = campaignJobSchema.safeParse(message.body);
        if (!job.success) {
          console.error("Campaign message dropped: invalid body", { id: message.id });
          message.ack();
          continue;
        }
        const report = await deliverCampaignJob(db, mailer, config, job.data, Date.now());
        if (report.kind === "delivered" && report.outcome !== "accepted") {
          console.warn("Campaign batch not fully sent", {
            campaignId: job.data.campaignId,
            outcome: report.outcome,
          });
        }
        message.ack();
      }
    } finally {
      ctx.waitUntil(close());
    }
  },
} satisfies ExportedHandler<Env, CampaignJob | unknown>;
