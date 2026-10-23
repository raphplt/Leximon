import {
  INVITE_HEADER,
  inviteCodeSchema,
  SOURCE_HEADER,
  sourceCodeSchema,
} from "@leximon/contract";

import { INVITE_KEY, keep, readKept, SOURCE_KEY } from "./arrival-store";

export function rememberInvite(code: string): void {
  keep(INVITE_KEY, code);
}

/** Headers of the sign-ins that may create a player. */
export function arrivalHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const headers: Record<string, string> = {};
  const invite = inviteCodeSchema.safeParse(readKept(INVITE_KEY));
  if (invite.success) headers[INVITE_HEADER] = invite.data;
  const source = sourceCodeSchema.safeParse(readKept(SOURCE_KEY));
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
