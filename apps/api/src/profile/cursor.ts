import { z } from "zod";
import type { PlayerListCursor } from "./profile";

const cursorSchema = z.tuple([z.number().int().nonnegative(), z.string().min(1).max(20)]);

/** Opaque to clients: base64url of a small JSON array. */
export function encodePlayerListCursor(cursor: PlayerListCursor): string {
  return btoa(JSON.stringify([cursor.lastSeenAt, cursor.code]))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

/** `undefined` when the cursor is malformed. */
export function decodePlayerListCursor(value: string): PlayerListCursor | undefined {
  try {
    const parsed = cursorSchema.safeParse(
      JSON.parse(atob(value.replaceAll("-", "+").replaceAll("_", "/"))),
    );
    return parsed.success ? { lastSeenAt: parsed.data[0], code: parsed.data[1] } : undefined;
  } catch {
    return undefined;
  }
}
