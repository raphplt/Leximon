import { testDatabaseUrl } from "@leximon/db/testing";
import { describe, expect, it } from "vitest";
import { createApp } from "../app";
import { MOBILE_APP_ORIGIN } from "../auth";
import { testEnv } from "../test-env";

const env = testEnv(testDatabaseUrl());
const app = createApp();

/** What the mobile app sends: no Origin, as a native request, but the app's scheme instead. */
function fromApp(extra: Record<string, string> = {}): Record<string, string> {
  return { "expo-origin": MOBILE_APP_ORIGIN, "content-type": "application/json", ...extra };
}

function cookieOf(response: Response): string {
  return response.headers
    .getSetCookie()
    .map((header) => header.split(";")[0])
    .join("; ");
}

describe("mobile session", () => {
  it("signs in as a guest, plays and signs out with the cookie the app keeps", async () => {
    const signIn = await app.request(
      "/api/auth/sign-in/anonymous",
      { method: "POST", headers: fromApp(), body: "{}" },
      env,
    );
    expect(signIn.status).toBe(200);
    const cookie = cookieOf(signIn);
    expect(cookie).toContain("session_token");

    const wallet = await app.request("/me/wallet", { headers: fromApp({ cookie }) }, env);
    expect(wallet.status).toBe(200);

    const signOut = await app.request(
      "/api/auth/sign-out",
      { method: "POST", headers: fromApp({ cookie }), body: "{}" },
      env,
    );
    expect(signOut.status).toBe(200);
    // The app drops what it kept; the token alone no longer opens anything.
    const token = cookie
      .split("; ")
      .filter((pair) => pair.includes("session_token"))
      .join("; ");
    const after = await app.request("/me/wallet", { headers: fromApp({ cookie: token }) }, env);
    expect(after.status).toBe(401);
  });
});
