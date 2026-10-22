import { z } from "zod";
import type { ClanListCursor, MemberCursor } from "./clans";

const clanCursorSchema = z.tuple([z.number().int().nonnegative(), z.uuid()]);
const memberCursorSchema = z.tuple([
  z.number().int().nonnegative(),
  z.number().int().nonnegative(),
  z.string().min(1).max(200),
]);

/** Opaque to clients: base64url of a small JSON array. */
function encode(value: unknown): string {
  return btoa(JSON.stringify(value)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function decode<T>(schema: z.ZodType<T>, value: string): T | undefined {
  try {
    const parsed = schema.safeParse(
      JSON.parse(atob(value.replaceAll("-", "+").replaceAll("_", "/"))),
    );
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}

export function encodeClanCursor(cursor: ClanListCursor): string {
  return encode([cursor.memberCount, cursor.id]);
}

/** `undefined` when the cursor is malformed. */
export function decodeClanCursor(value: string): ClanListCursor | undefined {
  const parsed = decode(clanCursorSchema, value);
  return parsed === undefined ? undefined : { memberCount: parsed[0], id: parsed[1] };
}

export function encodeMemberCursor(cursor: MemberCursor): string {
  return encode([cursor.answers, cursor.joinedAt, cursor.userId]);
}

export function decodeMemberCursor(value: string): MemberCursor | undefined {
  const parsed = decode(memberCursorSchema, value);
  return parsed === undefined
    ? undefined
    : { answers: parsed[0], joinedAt: parsed[1], userId: parsed[2] };
}
