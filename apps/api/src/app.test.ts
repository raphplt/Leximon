import { describe, expect, it } from "vitest";
import { createApp } from "./app";

const env = { APP_ENV: "test" } as Env;

describe("api", () => {
  it("answers the health check", async () => {
    const response = await createApp().request("/health", {}, env);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
  });

  it("sets security headers", async () => {
    const response = await createApp().request("/health", {}, env);
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  });

  it("returns a JSON 404 for unknown routes", async () => {
    const response = await createApp().request("/nope", {}, env);
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "not_found" });
  });
});
