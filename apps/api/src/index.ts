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
import { runMaintenance } from "./maintenance";

const app = createApp();

/** The cron trigger that feeds campaigns to the queue (D-035); the other one is maintenance. */
const CAMPAIGN_PUMP_CRON = "* * * * *";

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
} satisfies ExportedHandler<Env, CampaignJob>;
