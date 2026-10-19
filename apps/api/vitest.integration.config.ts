import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.integration.test.ts"],
    globalSetup: ["./vitest.global-setup.ts"],
    // Test files share one database.
    fileParallelism: false,
    testTimeout: 15_000,
  },
});
