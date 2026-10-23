import type { AdminOverview } from "@leximon/contract";
import { describe, expect, it } from "vitest";
import { composeDigest, postToDiscord } from "./digest";
import { readErrors } from "./errors";

const overview: AdminOverview = {
  players: { members: 1204, guests: 310, banned: 1, newMembers7d: 42, newGuests7d: 90 },
  boosters: { last24h: 230, last7d: 1500 },
  answers: { last24h: 410, last7d: 2900 },
  trades: { pending: 3, completed7d: 17 },
  waitlist: { total: 50, last7d: 4 },
};
const NOW = Date.parse("2026-10-23T03:17:00Z");

function stubFetch(status: number, body: unknown) {
  const calls: { url: string; init: RequestInit | undefined }[] = [];
  const fetcher = (async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    return new Response(status === 204 ? null : JSON.stringify(body), { status });
  }) as typeof fetch;
  return { fetcher, calls };
}

describe("readErrors", () => {
  it("groups the day's errors by Worker and message, most frequent first", async () => {
    const group = (service: string, message: string, value: number) => ({
      count: value,
      value,
      groups: [
        { key: "$metadata.service", value: service },
        { key: "$metadata.message", value: message },
      ],
    });
    const { fetcher, calls } = stubFetch(200, {
      success: true,
      result: {
        calculations: [
          {
            aggregates: [
              group("leximon-web-production", "Client error", 2),
              group("leximon-api-production", "Unhandled error", 5),
            ],
          },
        ],
      },
    });

    const report = await readErrors({ accountId: "acc", token: "tok" }, NOW, fetcher);

    expect(report).toEqual({
      kind: "read",
      total: 7,
      groups: [
        { service: "leximon-api-production", message: "Unhandled error", count: 5 },
        { service: "leximon-web-production", message: "Client error", count: 2 },
      ],
    });
    expect(calls[0]?.url).toContain("/accounts/acc/workers/observability/telemetry/query");
    expect(new Headers(calls[0]?.init?.headers).get("authorization")).toBe("Bearer tok");
    const sent = JSON.parse(String(calls[0]?.init?.body));
    expect(sent.timeframe).toEqual({ from: NOW - 86_400_000, to: NOW });
  });

  it("says the errors are unread when the API refuses", async () => {
    const { fetcher } = stubFetch(403, { success: false, errors: [] });
    expect(await readErrors({ accountId: "acc", token: "bad" }, NOW, fetcher)).toEqual({
      kind: "unavailable",
      status: 403,
    });
  });
});

describe("composeDigest", () => {
  it("lists the errors, then the day's play", () => {
    const text = composeDigest({
      now: NOW,
      overview,
      errors: {
        kind: "read",
        total: 7,
        groups: [
          { service: "leximon-api-production", message: "Unhandled `error` @everyone", count: 7 },
        ],
      },
    });

    expect(text).toContain("**Leximon · vendredi 23 octobre**");
    expect(text).toContain("**7 erreurs sur 24 h**");
    expect(text).toContain("· 7 × leximon-api-production — Unhandled error everyone");
    expect(text).toContain("Sur 24 h : 230 sachets ouverts, 410 réponses aux défis.");
    expect(text).toContain("1 204 comptes (+42 en 7 jours)");
  });

  it("says so when the day had no error, or when they could not be read", () => {
    expect(
      composeDigest({ now: NOW, overview, errors: { kind: "read", total: 0, groups: [] } }),
    ).toContain("Aucune erreur sur 24 h.");
    expect(
      composeDigest({ now: NOW, overview, errors: { kind: "unavailable", status: 401 } }),
    ).toContain("lecture impossible (HTTP 401)");
  });

  it("stays within Discord's 2,000 characters", () => {
    const groups = Array.from({ length: 8 }, (_, i) => ({
      service: "leximon-api-production",
      message: "x".repeat(500),
      count: i + 1,
    }));
    const text = composeDigest({ now: NOW, overview, errors: { kind: "read", total: 36, groups } });
    expect(text.length).toBeLessThanOrEqual(2000);
  });
});

describe("postToDiscord", () => {
  it("posts the text with every mention disabled", async () => {
    const { fetcher, calls } = stubFetch(204, {});
    expect(await postToDiscord("https://discord.test/hook", "Salut", fetcher)).toBe(true);
    expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({
      content: "Salut",
      allowed_mentions: { parse: [] },
    });
  });
});
