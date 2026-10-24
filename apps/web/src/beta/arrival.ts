import {
  INVITE_HEADER,
  inviteCodeSchema,
  playerCodeSchema,
  REFERRER_HEADER,
  SOURCE_HEADER,
  sourceCodeSchema,
} from "@leximon/contract";

import { INVITE_KEY, keep, REFERRER_KEY, readKept, SOURCE_KEY } from "./arrival-store";

export function rememberInvite(code: string): void {
  keep(INVITE_KEY, code);
}

/** Keeps the first friend link followed: the player who brought the visitor. */
export function rememberReferrer(code: string): void {
  if (readKept(REFERRER_KEY) === null) keep(REFERRER_KEY, code);
}

/** Headers of the sign-ins that may create a player. */
export function arrivalHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const headers: Record<string, string> = {};
  const invite = inviteCodeSchema.safeParse(readKept(INVITE_KEY));
  if (invite.success) headers[INVITE_HEADER] = invite.data;
  const source = sourceCodeSchema.safeParse(readKept(SOURCE_KEY));
  if (source.success) headers[SOURCE_HEADER] = source.data;
  const referrer = playerCodeSchema.safeParse(readKept(REFERRER_KEY));
  if (referrer.success) headers[REFERRER_HEADER] = referrer.data;
  return headers;
}

/** Once a player exists, the browser has nothing more to keep. */
export function forgetArrival(): void {
  try {
    window.localStorage.removeItem(INVITE_KEY);
    window.localStorage.removeItem(SOURCE_KEY);
    window.localStorage.removeItem(REFERRER_KEY);
  } catch {
    // Nothing was kept.
  }
}
