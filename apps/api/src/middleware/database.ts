import { createDb } from "@leximon/db";
import { createMiddleware } from "hono/factory";
import type { EmailSenderFactory } from "../account/email-sender";
import { createAuth } from "../auth";
import type { AppEnv } from "../context";

/**
 * Opens a database client (through Hyperdrive) and Better Auth for the current request, and
 * closes the client when the request ends: nothing outlives a request.
 */
export function databaseMiddleware(createEmailSender: EmailSenderFactory) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const { db, close } = createDb(c.env.HYPERDRIVE.connectionString);
    c.set("db", db);
    c.set("auth", createAuth(c.env, db, createEmailSender(c.env)));
    try {
      await next();
    } finally {
      const closing = close();
      if (hasExecutionContext(c)) {
        c.executionCtx.waitUntil(closing);
      } else {
        await closing;
      }
    }
  });
}

/** Tests call the app directly, without a Workers execution context. */
function hasExecutionContext(c: { executionCtx: unknown }): boolean {
  try {
    return c.executionCtx !== undefined;
  } catch {
    return false;
  }
}
