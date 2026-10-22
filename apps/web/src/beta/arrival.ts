import {
  INVITE_HEADER,
  inviteCodeSchema,
  SOURCE_HEADER,
  sourceCodeSchema,
} from "@leximon/contract";

/**
 * The invitation and the `?src=` a visitor arrived with, kept in this browser until a player is
 * created: they go with the sign-in, the server decides. Storage can be missing (private window,
 * blocked site data): then nothing is kept, and the invitation page asks again.
 */

const INVITE_KEY = "leximon.invite";
const SOURCE_KEY = "leximon.source";

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Nothing kept: the sign-in goes without it.
  }
}

export function rememberInvite(code: string): void {
  write(INVITE_KEY, code);
}

/** Keeps the first source only: the link that brought the visitor, not the last one clicked. */
export function rememberSource(search: string): void {
  const source = sourceCodeSchema.safeParse(new URLSearchParams(search).get("src"));
  if (source.success && read(SOURCE_KEY) === null) write(SOURCE_KEY, source.data);
}

/** Headers of the sign-ins that may create a player. */
export function arrivalHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const headers: Record<string, string> = {};
  const invite = inviteCodeSchema.safeParse(read(INVITE_KEY));
  if (invite.success) headers[INVITE_HEADER] = invite.data;
  const source = sourceCodeSchema.safeParse(read(SOURCE_KEY));
  if (source.success) headers[SOURCE_HEADER] = source.data;
  return headers;
}

/** Once a player exists, the browser has nothing more to keep. */
export function forgetArrival(): void {
  try {
    window.localStorage.removeItem(INVITE_KEY);
    window.localStorage.removeItem(SOURCE_KEY);
  } catch {
    // Nothing was kept.
  }
}
