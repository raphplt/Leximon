import { describe, expect, it } from "vitest";
import { createApp } from "./app";
import { TEST_ORIGIN, testEnv } from "./test-env";

describe("api", () => {
  it("answers the health check", async () => {
    const response = await createApp().request("/health", {}, testEnv());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
  });

  it("sets security headers", async () => {
    const response = await createApp().request("/health", {}, testEnv());
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  });

  it("allows credentialed requests from trusted origins only", async () => {
    const trusted = await createApp().request(
      "/health",
      { headers: { origin: TEST_ORIGIN } },
      testEnv(),
    );
    expect(trusted.headers.get("access-control-allow-origin")).toBe(TEST_ORIGIN);
    expect(trusted.headers.get("access-control-allow-credentials")).toBe("true");

    const other = await createApp().request(
      "/health",
      { headers: { origin: "https://evil.example" } },
      testEnv(),
    );
    expect(other.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("returns a JSON 404 for unknown routes", async () => {
    const response = await createApp().request("/nope", {}, testEnv());
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "not_found" });
  });
});
