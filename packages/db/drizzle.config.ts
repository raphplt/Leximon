import { defineConfig } from "drizzle-kit";

try {
  process.loadEnvFile(new URL("../../.env", import.meta.url));
} catch {
  // No .env file: rely on the environment.
}

const url = process.env["DATABASE_URL"];
if (!url) {
  throw new Error("DATABASE_URL is not set. Copy .env.example to .env at the repository root.");
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema/index.ts",
  out: "./migrations",
  casing: "snake_case",
  strict: true,
  dbCredentials: { url },
});
