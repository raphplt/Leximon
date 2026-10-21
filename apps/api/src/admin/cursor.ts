/**
 * Cursor of the back office lists, newest first: the creation time and id of the last row seen.
 * Opaque to clients (base64url of JSON).
 */
export interface TimeCursor {
  readonly at: string;
  readonly id: string;
}

export function encodeTimeCursor(cursor: TimeCursor): string {
  return btoa(JSON.stringify([cursor.at, cursor.id]))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

/** `undefined` when the cursor is malformed. */
export function decodeTimeCursor(value: string): TimeCursor | undefined {
  try {
    const parsed: unknown = JSON.parse(atob(value.replaceAll("-", "+").replaceAll("_", "/")));
    if (
      Array.isArray(parsed) &&
      parsed.length === 2 &&
      typeof parsed[0] === "string" &&
      typeof parsed[1] === "string" &&
      !Number.isNaN(Date.parse(parsed[0]))
    ) {
      return { at: parsed[0], id: parsed[1] };
    }
  } catch {
    // Falls through: malformed.
  }
  return undefined;
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
