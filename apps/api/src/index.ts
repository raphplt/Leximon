import { createDb } from "@leximon/db";
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
} satisfies ExportedHandler<Env>;
