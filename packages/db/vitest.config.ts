import { defineConfig } from "vitest/config";

try {
  process.loadEnvFile(new URL("../../.env", import.meta.url));
} catch {
  // No .env file: rely on the environment (CI provides DATABASE_URL).
}

export default defineConfig({
  test: {
    include: ["src/**/*.integration.test.ts"],
  },
});
