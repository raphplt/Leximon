import { z } from "zod";

/** Position of the last trade of a page: trades are listed newest first, ties broken by id. */
export interface TradeCursor {
  readonly createdAt: number;
  readonly id: string;
}

const cursorSchema = z.tuple([z.number().int().nonnegative(), z.uuid()]);

/** Opaque to clients: base64url of a small JSON array. */
export function encodeTradeCursor(cursor: TradeCursor): string {
  return btoa(JSON.stringify([cursor.createdAt, cursor.id]))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

/** `undefined` when the cursor is malformed. */
export function decodeTradeCursor(value: string): TradeCursor | undefined {
  try {
    const parsed = cursorSchema.safeParse(
      JSON.parse(atob(value.replaceAll("-", "+").replaceAll("_", "/"))),
    );
    return parsed.success ? { createdAt: parsed.data[0], id: parsed.data[1] } : undefined;
  } catch {
    return undefined;
  }
}
