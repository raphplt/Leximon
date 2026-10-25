import {
  INVITE_HEADER,
  inviteCodeSchema,
  playerCodeSchema,
  REFERRER_HEADER,
} from "@leximon/contract";
import type { Arrival } from "@leximon/contract/client";
import * as SecureStore from "expo-secure-store";

/**
 * The invitation and the friend link a player came with, kept on the device until a player is
 * created: they go with the sign-in, the server decides.
 */

const INVITE_KEY = "leximon_invite";
const REFERRER_KEY = "leximon_referrer";

function read(key: string): string | null {
  try {
    return SecureStore.getItem(key);
  } catch {
    return null;
  }
}

function forget(key: string): void {
  SecureStore.deleteItemAsync(key).catch(() => {
    // Nothing kept, nothing to forget.
  });
}

export function rememberInvite(code: string): void {
  SecureStore.setItem(INVITE_KEY, code);
}

/** Keeps the first friend link followed: the player who brought this one. */
export function rememberReferrer(code: string): void {
  if (read(REFERRER_KEY) === null) SecureStore.setItem(REFERRER_KEY, code);
}

export const arrival: Arrival = {
  headers() {
    const headers: Record<string, string> = {};
    const invite = inviteCodeSchema.safeParse(read(INVITE_KEY));
    if (invite.success) headers[INVITE_HEADER] = invite.data;
    const referrer = playerCodeSchema.safeParse(read(REFERRER_KEY));
    if (referrer.success) headers[REFERRER_HEADER] = referrer.data;
    return headers;
  },
  forget() {
    forget(INVITE_KEY);
    forget(REFERRER_KEY);
  },
};
