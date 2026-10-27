/**
 * The code just sent, kept in this browser while it is valid. On a phone, going to the mail app
 * and back often reloads the tab: without this, the player lands on the address form again and
 * their code is lost. Storage can be missing or blocked: then the flow simply starts over.
 */

const KEY = "leximon.pending-code";
/** As long as the code itself is valid. */
const VALID_MS = 10 * 60 * 1000;

export interface PendingCode {
  readonly email: string;
  readonly newsOptIn: boolean;
}

export function keepPendingCode(pending: PendingCode, now: number): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ ...pending, sentAt: now }));
  } catch {
    // Nothing kept: a reload starts over.
  }
}

export function readPendingCode(now: number): PendingCode | null {
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
  const pending = raw === null ? null : parsePendingCode(raw, now);
  if (raw !== null && pending === null) forgetPendingCode();
  return pending;
}

export function forgetPendingCode(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // Nothing to forget.
  }
}

/** `null` when the stored value is not ours or the code it stands for has expired. */
export function parsePendingCode(raw: string, now: number): PendingCode | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof value !== "object" || value === null) return null;
  const { email, newsOptIn, sentAt } = value as Record<string, unknown>;
  if (typeof email !== "string" || !email.includes("@")) return null;
  if (typeof sentAt !== "number" || now - sentAt < 0 || now - sentAt > VALID_MS) return null;
  return { email, newsOptIn: newsOptIn === true };
}
