import { describe, expect, it } from "vitest";
import { createApp } from "./app";
import { emailKey } from "./middleware/rate-limit";
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

  it("limits waiting-list sign-ups per IP before touching the database", async () => {
    const { limiter, keys } = recordingLimiter(false);
    const env = { ...testEnv(), WAITLIST_RATE_LIMITER: limiter };
    const response = await createApp().request(
      "/waitlist",
      {
        method: "POST",
        headers: {
          origin: TEST_ORIGIN,
          "content-type": "application/json",
          "cf-connecting-ip": "203.0.113.7",
        },
        body: JSON.stringify({ email: "lectrice@example.com" }),
      },
      env,
    );
    expect(response.status).toBe(429);
    expect(keys).toEqual(["WAITLIST_RATE_LIMITER:203.0.113.7"]);
  });

  it("limits sign-in codes per IP and per hashed address, before touching the database", async () => {
    const ip = recordingLimiter(true);
    const address = recordingLimiter(false);
    const env = {
      ...testEnv(),
      OTP_SEND_IP_RATE_LIMITER: ip.limiter,
      OTP_SEND_EMAIL_RATE_LIMITER: address.limiter,
    };
    const response = await createApp().request(
      "/api/auth/email-otp/send-verification-otp",
      {
        method: "POST",
        headers: {
          origin: TEST_ORIGIN,
          "content-type": "application/json",
          "cf-connecting-ip": "203.0.113.7",
        },
        body: JSON.stringify({ email: "Joueur@Example.com", type: "sign-in" }),
      },
      env,
    );
    expect(response.status).toBe(429);
    expect(ip.keys).toEqual(["OTP_SEND_IP_RATE_LIMITER:203.0.113.7"]);
    const hashed = await emailKey(env.BETTER_AUTH_SECRET, "joueur@example.com");
    expect(address.keys).toEqual([`OTP_SEND_EMAIL_RATE_LIMITER:${hashed}`]);
    expect(address.keys[0]).not.toContain("example");
  });

  it("sends codes to sign in only", async () => {
    const response = await createApp().request(
      "/api/auth/email-otp/send-verification-otp",
      {
        method: "POST",
        headers: { origin: TEST_ORIGIN, "content-type": "application/json" },
        body: JSON.stringify({ email: "joueur@example.com", type: "forget-password" }),
      },
      testEnv(),
    );
    expect(response.status).toBe(400);
  });

  it("limits code checks per IP", async () => {
    const { limiter, keys } = recordingLimiter(false);
    const env = { ...testEnv(), OTP_VERIFY_IP_RATE_LIMITER: limiter };
    for (const path of ["/api/auth/sign-in/email-otp", "/account/link-preview"]) {
      const response = await createApp().request(
        path,
        {
          method: "POST",
          headers: {
            origin: TEST_ORIGIN,
            "content-type": "application/json",
            "cf-connecting-ip": "203.0.113.8",
          },
          body: JSON.stringify({ email: "joueur@example.com", otp: "123456", code: "123456" }),
        },
        env,
      );
      expect(response.status, path).toBe(429);
    }
    expect(keys).toEqual([
      "OTP_VERIFY_IP_RATE_LIMITER:203.0.113.8",
      "OTP_VERIFY_IP_RATE_LIMITER:203.0.113.8",
    ]);
  });

  it("hides the Better Auth routes the clients do not use", async () => {
    for (const path of [
      "/api/auth/email-otp/check-verification-otp",
      "/api/auth/email-otp/reset-password",
      "/api/auth/sign-up/email",
      "/api/auth/update-user",
      "/api/auth/delete-anonymous-user",
    ]) {
      const response = await createApp().request(
        path,
        { method: "POST", headers: { origin: TEST_ORIGIN, "content-type": "application/json" } },
        testEnv(),
      );
      expect(response.status, path).toBe(404);
    }
  });
});
