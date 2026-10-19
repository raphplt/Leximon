/**
 * Test helpers. Node only: never import this from application code.
 */

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";

// Plain paths rather than URL objects: this file is also type-checked against Workers types.
const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MIGRATIONS_FOLDER = join(PACKAGE_ROOT, "migrations");
const REPOSITORY_ENV_FILE = join(PACKAGE_ROOT, "..", "..", ".env");

/** Reads TEST_DATABASE_URL, loading the repository's `.env` file when present. */
export function testDatabaseUrl(): string {
  try {
    process.loadEnvFile(REPOSITORY_ENV_FILE);
  } catch {
    // No .env file: rely on the environment (CI provides the variable).
  }
  const url = process.env["TEST_DATABASE_URL"];
  if (!url) {
    throw new Error(
      "TEST_DATABASE_URL is not set. Copy .env.example to .env and run `docker compose up -d`.",
    );
  }
  return url;
}

/**
 * Creates the test database if needed, drops everything in it and applies all migrations.
 * Refuses to run on a database whose name does not end with "_test", unless in CI.
 */
export async function resetTestDatabase(url: string): Promise<void> {
  const databaseName = new URL(url).pathname.slice(1);
  if (!databaseName.endsWith("_test") && process.env["CI"] !== "true") {
    throw new Error(`Refusing to reset "${databaseName}": test databases must end with "_test".`);
  }

  await createDatabaseIfMissing(url, databaseName);

  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    await client.query(
      "set client_min_messages = warning; drop schema if exists public cascade; drop schema if exists drizzle cascade; create schema public;",
    );
    await migrate(drizzle(client), { migrationsFolder: MIGRATIONS_FOLDER });
  } finally {
    await client.end();
  }
}

async function createDatabaseIfMissing(url: string, databaseName: string): Promise<void> {
  const maintenanceUrl = new URL(url);
  maintenanceUrl.pathname = "/postgres";
  const admin = new pg.Client({ connectionString: maintenanceUrl.toString() });
  await admin.connect();
  try {
    const existing = await admin.query("select 1 from pg_database where datname = $1", [
      databaseName,
    ]);
    if (existing.rowCount === 0) {
      await admin.query(`create database "${databaseName.replaceAll('"', '""')}"`);
    }
  } finally {
    await admin.end();
  }
}
