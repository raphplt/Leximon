import { describe, expect, it } from "vitest";
import {
  createUnsubscribeSigner,
  verifyLettermintSignature,
  verifyUnsubscribeToken,
} from "./signatures";

const SECRET = "secret-for-tests";
const SEND_ID = "0b5d5a8e-8c5c-4a52-9a43-0f2b7f7d1e10";

describe("unsubscribe tokens", () => {
  it("round-trips the send id and never holds the address", async () => {
    const token = await createUnsubscribeSigner(SECRET)(SEND_ID);
    expect(token.startsWith(`${SEND_ID}.`)).toBe(true);
    expect(token).not.toContain("@");
    expect(await verifyUnsubscribeToken(SECRET, token)).toBe(SEND_ID);
  });

  it("refuses another secret, another id, and garbage", async () => {
    const token = await createUnsubscribeSigner(SECRET)(SEND_ID);
    expect(await verifyUnsubscribeToken("other-secret", token)).toBeNull();
    const otherId = "1b5d5a8e-8c5c-4a52-9a43-0f2b7f7d1e10";
    expect(await verifyUnsubscribeToken(SECRET, `${otherId}.${token.split(".")[1]}`)).toBeNull();
    expect(await verifyUnsubscribeToken(SECRET, "nope")).toBeNull();
    expect(await verifyUnsubscribeToken(SECRET, `${SEND_ID}.${"A".repeat(43)}`)).toBeNull();
  });
});

async function sign(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(mac), (b) => b.toString(16).padStart(2, "0")).join("");
}

describe("Lettermint webhook signature", () => {
  const rawBody = '{"id":"evt_1","event":"message.hard_bounced"}';
  const now = 1_790_000_000;

  async function headers(t: number, body = rawBody, secret = SECRET) {
    return {
      signatureHeader: `t=${t},v1=${await sign(secret, `${t}.${body}`)}`,
      deliveryHeader: String(t),
    };
  }

  it("accepts a genuine delivery", async () => {
    const check = await verifyLettermintSignature({
      secret: SECRET,
      rawBody,
      nowS: now,
      ...(await headers(now)),
    });
    expect(check).toEqual({ ok: true });
  });

  it("refuses a changed body, another secret, an old delivery, and mismatched headers", async () => {
    const base = { secret: SECRET, nowS: now };
    expect(
      await verifyLettermintSignature({ ...base, rawBody: `${rawBody} `, ...(await headers(now)) }),
    ).toEqual({ ok: false, reason: "signature_mismatch" });
    expect(
      await verifyLettermintSignature({ ...base, rawBody, ...(await headers(now, rawBody, "x")) }),
    ).toEqual({ ok: false, reason: "signature_mismatch" });
    expect(
      await verifyLettermintSignature({ ...base, rawBody, ...(await headers(now - 301)) }),
    ).toEqual({ ok: false, reason: "stale" });
    const genuine = await headers(now);
    expect(
      await verifyLettermintSignature({
        ...base,
        rawBody,
        ...genuine,
        deliveryHeader: String(now - 1),
      }),
    ).toEqual({ ok: false, reason: "timestamp_mismatch" });
    expect(
      await verifyLettermintSignature({
        ...base,
        rawBody,
        signatureHeader: "v1=zz",
        deliveryHeader: "1",
      }),
    ).toEqual({ ok: false, reason: "malformed" });
    expect(
      await verifyLettermintSignature({
        ...base,
        rawBody,
        signatureHeader: null,
        deliveryHeader: null,
      }),
    ).toEqual({ ok: false, reason: "malformed" });
  });
});
