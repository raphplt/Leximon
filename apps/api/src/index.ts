import { createDb } from "@leximon/db";
import { storeAnalytics } from "./analytics/store";
import { createApp } from "./app";
import { runMaintenance } from "./maintenance";

const app = createApp();

export default {
  fetch: app.fetch,

  async scheduled(_controller, env, ctx) {
    const { db, close } = createDb(env.HYPERDRIVE.connectionString, { maxConnections: 1 });
    try {
      const report = await runMaintenance(db, Date.now());
      console.info("Maintenance done", report);
    } finally {
      ctx.waitUntil(close());
    }
  },

  /** Consumer of the analytics queue (D-030): batches of events written to Postgres. */
  async queue(batch, env, ctx) {
    const { db, close } = createDb(env.HYPERDRIVE.connectionString, { maxConnections: 1 });
    try {
      const report = await storeAnalytics(
        db,
        batch.messages.map((message) => message.body),
      );
      if (report.rejected > 0) console.warn("Analytics messages rejected", report);
      batch.ackAll();
    } finally {
      ctx.waitUntil(close());
    }
  },
} satisfies ExportedHandler<Env>;
