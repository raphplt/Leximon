/**
 * Pseudonymous id of a player in the event log (D-030): an HMAC-SHA-256 of their id keyed by
 * `ANALYTICS_SECRET`, cut to 128 bits. The log alone cannot be joined with game data; with the
 * secret, the API can still find a player's rows to erase them on request.
 */
export async function analyticsSubject(secret: string, userId: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(userId)));
  return Array.from(signature.subarray(0, 16), (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}
