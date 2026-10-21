import { describe, expect, it } from "vitest";
import { LETTERMINT_API, lettermintMailer } from "./lettermint";
import type { CampaignMessage } from "./mailer";

const message = (n: number): CampaignMessage => ({
  to: `joueur${n}@example.com`,
  subject: "Leximon ouvre",
  html: "<p>Ouvert.</p>",
  text: "Ouvert.",
  headers: { "List-Unsubscribe": "<https://api/x>" },
  idempotencyKey: `key-${n}`,
  sendId: `send-${n}`,
});

function fakeFetch(status: number, body: unknown, headers: Record<string, string> = {}) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchFn = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response(JSON.stringify(body), { status, headers });
  }) as unknown as typeof fetch;
  return { calls, fetchFn };
}

const options = {
  token: "lm_test",
  from: "Leximon <bonjour@infos.leximon.fr>",
  replyTo: "contact@leximon.fr",
  route: "broadcast",
};

describe("Lettermint mailer", () => {
  it("posts the whole batch with one idempotency key and the send id per e-mail", async () => {
    const { calls, fetchFn } = fakeFetch(202, [{ message_id: "m1" }, { message_id: "m2" }]);
    const outcome = await lettermintMailer({ ...options, fetch: fetchFn }).sendBatch([
      message(1),
      message(2),
    ]);
    expect(outcome).toEqual({ kind: "accepted", messageIds: ["m1", "m2"] });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe(`${LETTERMINT_API}/send/batch`);
    const headers = new Headers(calls[0]?.init.headers);
    expect(headers.get("x-lettermint-token")).toBe("lm_test");
    const body = JSON.parse(String(calls[0]?.init.body)) as Record<string, unknown>[];
    expect(body[1]).toMatchObject({
      from: options.from,
      to: ["joueur2@example.com"],
      reply_to: ["contact@leximon.fr"],
      route: "broadcast",
      idempotency_key: "key-2",
      metadata: { send_id: "send-2" },
      headers: { "List-Unsubscribe": "<https://api/x>" },
    });
  });

  it("reads a rate limit as a retry, with the provider's delay", async () => {
    const { fetchFn } = fakeFetch(
      429,
      { error: { code: "RATE_LIMITED" } },
      { "retry-after": "42" },
    );
    expect(await lettermintMailer({ ...options, fetch: fetchFn }).sendBatch([message(1)])).toEqual({
      kind: "retry_later",
      code: "RATE_LIMITED",
      retryAfterS: 42,
    });
  });

  it("reads a key still in flight as a retry, a refused token as blocked", async () => {
    const conflict = fakeFetch(409, { error: { code: "IDEMPOTENCY_CONFLICT" } });
    expect(
      (await lettermintMailer({ ...options, fetch: conflict.fetchFn }).sendBatch([message(1)]))
        .kind,
    ).toBe("retry_later");
    const refused = fakeFetch(401, { message: "Unauthenticated" });
    expect(
      await lettermintMailer({ ...options, fetch: refused.fetchFn }).sendBatch([message(1)]),
    ).toEqual({
      kind: "blocked",
      code: "http_401",
    });
  });

  it("says which e-mails left when the batch stopped halfway", async () => {
    const { fetchFn } = fakeFetch(422, {
      error: { code: "VALIDATION_ERROR", details: { accepted: [{ index: 0, message_id: "m1" }] } },
    });
    expect(
      await lettermintMailer({ ...options, fetch: fetchFn }).sendBatch([
        message(1),
        message(2),
        message(3),
      ]),
    ).toEqual({
      kind: "partial",
      accepted: [{ index: 0, messageId: "m1" }],
      failedIndex: 1,
      code: "VALIDATION_ERROR",
    });
  });

  it("treats a network failure as unknown, to retry with the same keys", async () => {
    const fetchFn = (async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch;
    expect(await lettermintMailer({ ...options, fetch: fetchFn }).sendBatch([message(1)])).toEqual({
      kind: "retry_later",
      code: "network_error",
      retryAfterS: null,
    });
  });

  it("never puts an address in the outcome", async () => {
    const { fetchFn } = fakeFetch(500, { error: { code: "joueur1@example.com" } });
    const outcome = await lettermintMailer({ ...options, fetch: fetchFn }).sendBatch([message(1)]);
    expect(outcome).toEqual({ kind: "retry_later", code: "http_500", retryAfterS: null });
  });
});
