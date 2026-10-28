/** Pages whose second path segment opens something: a sign-up place, a friendship, an unsubscription. */
const SECRET_SEGMENTS: ReadonlyMap<string, string> = new Map([
  ["invitation", "[code]"],
  ["ami", "[code]"],
  ["desinscription", "[jeton]"],
]);

/** The only query parameter worth counting: the video or post a visitor came from. */
const KEPT_PARAMS = ["src"];

/**
 * The address Umami may keep for a page of the site: secret codes masked, every query parameter but
 * the arrival source dropped. `null` for a page that is not counted (the back-office).
 */
export function cleanPageUrl(raw: string, origin: string): string | null {
  const url = new URL(raw, origin);
  const [first, second] = url.pathname.split("/").slice(1);
  if (first === "admin") return null;
  const mask = first === undefined ? undefined : SECRET_SEGMENTS.get(first);
  if (mask !== undefined && second !== undefined && second !== "") {
    url.pathname = `/${first}/${mask}`;
  }
  const kept = new URLSearchParams();
  for (const key of KEPT_PARAMS) {
    const value = url.searchParams.get(key);
    if (value !== null) kept.set(key, value);
  }
  url.search = kept.toString();
  url.hash = "";
  return url.toString();
}

/**
 * Umami gets a page of the site as a path and another site as a full address. A page of the site is
 * cleaned like any other; another site keeps only its origin, since its path can carry anything.
 */
export function cleanReferrer(raw: string, origin: string): string {
  if (raw === "") return "";
  try {
    const url = new URL(raw, origin);
    if (url.origin !== origin) return url.origin;
    const page = cleanPageUrl(raw, origin);
    return page === null ? "" : page.slice(origin.length);
  } catch {
    return "";
  }
}

type Payload = { readonly url?: string; readonly referrer?: string };

/** Umami's `before-send` hook: the event with clean addresses, or `null` to send nothing. */
export function cleanPayload<P extends Payload>(payload: P, origin: string): P | null {
  if (payload.url === undefined) return payload;
  const url = cleanPageUrl(payload.url, origin);
  if (url === null) return null;
  return { ...payload, url, referrer: cleanReferrer(payload.referrer ?? "", origin) };
}
