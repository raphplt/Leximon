import { unsubscribeTokenSchema } from "@leximon/contract";

/**
 * HMAC-SHA-256 with WebCrypto: unsubscribe tokens we issue, and Lettermint webhooks we receive.
 * Checks go through `crypto.subtle.verify`, which compares in constant time.
 */

const encoder = new TextEncoder();
const TOKEN_CONTEXT = "unsubscribe:v1:";

function hmacKey(secret: string, usage: "sign" | "verify"): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    [usage],
  );
}

function toBase64Url(bytes: ArrayBuffer): string {
  let binary = "";
  for (const byte of new Uint8Array(bytes)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(text: string): Uint8Array<ArrayBuffer> | null {
  try {
    const binary = atob(text.replace(/-/g, "+").replace(/_/g, "/"));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

function fromHex(text: string): Uint8Array<ArrayBuffer> | null {
  if (!/^(?:[0-9a-f]{2})+$/i.test(text)) return null;
  const bytes = new Uint8Array(text.length / 2);
  for (let i = 0; i < bytes.length; i += 1)
    bytes[i] = Number.parseInt(text.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

/**
 * Issues the unsubscribe tokens of a batch: `<send id>.<HMAC>`. The token names a send row, never
 * the address, and cannot be made without the secret. The key is imported once per batch.
 */
export function createUnsubscribeSigner(secret: string): (sendId: string) => Promise<string> {
  const key = hmacKey(secret, "sign");
  return async (sendId) => {
    const mac = await crypto.subtle.sign("HMAC", await key, encoder.encode(TOKEN_CONTEXT + sendId));
    return `${sendId}.${toBase64Url(mac)}`;
  };
}

/** The send id of a genuine token, or null. */
export async function verifyUnsubscribeToken(
  secret: string,
  token: string,
): Promise<string | null> {
  if (!unsubscribeTokenSchema.safeParse(token).success) return null;
  const [sendId = "", mac = ""] = token.split(".");
  const signature = fromBase64Url(mac);
  if (signature === null) return null;
  const valid = await crypto.subtle.verify(
    "HMAC",
    await hmacKey(secret, "verify"),
    signature,
    encoder.encode(TOKEN_CONTEXT + sendId),
  );
  return valid ? sendId : null;
}

/** Replays older than this are refused, as Lettermint recommends. */
export const WEBHOOK_TOLERANCE_S = 5 * 60;

export type WebhookCheck =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly reason: "malformed" | "timestamp_mismatch" | "stale" | "signature_mismatch";
    };

/**
 * Checks a Lettermint delivery: `X-Lettermint-Signature: t=<unix s>,v1=<hex HMAC>` over
 * `<t>.<raw body>`, with `X-Lettermint-Delivery` equal to `t` and within 5 minutes of `nowS`.
 */
export async function verifyLettermintSignature(input: {
  readonly secret: string;
  readonly signatureHeader: string | null;
  readonly deliveryHeader: string | null;
  readonly rawBody: string;
  readonly nowS: number;
}): Promise<WebhookCheck> {
  const { secret, signatureHeader, deliveryHeader, rawBody, nowS } = input;
  if (signatureHeader === null || deliveryHeader === null)
    return { ok: false, reason: "malformed" };
  const fields = new Map<string, string>();
  for (const part of signatureHeader.split(",")) {
    const [name, value] = part.trim().split("=", 2);
    if (name !== undefined && value !== undefined) fields.set(name, value);
  }
  const timestamp = fields.get("t");
  const signature = fromHex(fields.get("v1") ?? "");
  if (timestamp === undefined || !/^\d{1,12}$/.test(timestamp) || signature === null) {
    return { ok: false, reason: "malformed" };
  }
  if (deliveryHeader.trim() !== timestamp) return { ok: false, reason: "timestamp_mismatch" };
  if (Math.abs(nowS - Number(timestamp)) > WEBHOOK_TOLERANCE_S)
    return { ok: false, reason: "stale" };
  const valid = await crypto.subtle.verify(
    "HMAC",
    await hmacKey(secret, "verify"),
    signature,
    encoder.encode(`${timestamp}.${rawBody}`),
  );
  return valid ? { ok: true } : { ok: false, reason: "signature_mismatch" };
}
