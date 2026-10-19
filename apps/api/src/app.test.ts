import { describe, expect, it } from "vitest";
import { createApp } from "./app";
import { TEST_ORIGIN, testEnv } from "./test-env";

function recordingLimiter(success: boolean) {
  const keys: string[] = [];
  const limiter: RateLimit = {
    limit: async ({ key }) => {
      keys.push(key);
      return { success };
    },
  };
  return { limiter, keys };
}

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

  it("limits guest sign-ups per address before touching the database", async () => {
    const { limiter, keys } = recordingLimiter(false);
    // The connection string points nowhere: a database access would fail the request with 500.
    const env = { ...testEnv(), SIGNUP_RATE_LIMITER: limiter };
    const response = await createApp().request(
      "/api/auth/sign-in/anonymous",
      {
        method: "POST",
        headers: {
          origin: TEST_ORIGIN,
          "content-type": "application/json",
          "cf-connecting-ip": "203.0.113.7",
        },
        body: "{}",
      },
      env,
    );
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("60");
    expect(await response.json()).toEqual({ error: "rate_limited" });
    expect(keys).toEqual(["SIGNUP_RATE_LIMITER:203.0.113.7"]);
  });
});
