/**
 * Cursor of the back office lists, newest first: the creation time and id of the last row seen.
 * Opaque to clients (base64url of JSON).
 */
export interface TimeCursor {
  readonly at: string;
  readonly id: string;
}

/** A cursor made of a few strings: base64url of their JSON. */
export function encodeCursor(parts: readonly string[]): string {
  return btoa(JSON.stringify(parts)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

/** The `length` strings of a cursor; `undefined` when it is malformed. */
export function decodeCursor(value: string, length: number): string[] | undefined {
  try {
    const parsed: unknown = JSON.parse(atob(value.replaceAll("-", "+").replaceAll("_", "/")));
    if (
      Array.isArray(parsed) &&
      parsed.length === length &&
      parsed.every((part) => typeof part === "string")
    ) {
      return parsed;
    }
  } catch {
    // Falls through: malformed.
  }
  return undefined;
}

export function encodeTimeCursor(cursor: TimeCursor): string {
  return encodeCursor([cursor.at, cursor.id]);
}

/** `undefined` when the cursor is malformed. */
export function decodeTimeCursor(value: string): TimeCursor | undefined {
  const parts = decodeCursor(value, 2);
  if (parts === undefined) return undefined;
  const [at = "", id = ""] = parts;
  return Number.isNaN(Date.parse(at)) ? undefined : { at, id };
}

/** The cursor of the next page, when the query fetched one row more than the page. */
export function nextCursor<T>(
  rows: readonly T[],
  limit: number,
  toCursor: (row: T) => TimeCursor,
): string | null {
  const last = rows[limit - 1];
  return rows.length > limit && last !== undefined ? encodeTimeCursor(toCursor(last)) : null;
}
