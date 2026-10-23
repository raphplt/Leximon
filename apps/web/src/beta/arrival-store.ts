/**
 * The invitation and the `?src=` a visitor arrived with, kept in this browser until a player is
 * created: they go with the sign-in, the server decides. Storage can be missing (private window,
 * blocked site data): then nothing is kept, and the invitation page asks again.
 *
 * No schema library here: `rememberSource` runs on every page, the first visit included.
 */

export const INVITE_KEY = "leximon.invite";
export const SOURCE_KEY = "leximon.source";

/** The shape of `sourceCodeSchema`, checked again with the schema before it is sent. */
const SOURCE_CODE = /^[a-z0-9_-]{1,40}$/;

export function readKept(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function keep(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Nothing kept: the sign-in goes without it.
  }
}

/** Keeps the first source only: the link that brought the visitor, not the last one clicked. */
export function rememberSource(search: string): void {
  const source = new URLSearchParams(search).get("src")?.trim().toLowerCase();
  if (source !== undefined && SOURCE_CODE.test(source) && readKept(SOURCE_KEY) === null) {
    keep(SOURCE_KEY, source);
  }
}
