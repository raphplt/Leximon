import { isGoogleReturn } from "@/api/google-sign-in";

/**
 * Links that open the app. Google's return (`leximon://compte?…`) is read by the sign-in that
 * opened the browser: the router leaves it alone, since it carries the session cookie. Opened cold
 * (the app was closed meanwhile), it only leads to the account screen.
 */
export function redirectSystemPath({
  path,
  initial,
}: {
  readonly path: string;
  readonly initial: boolean;
}): string | null {
  if (!isGoogleReturn(path)) return path;
  return initial ? "/compte" : null;
}
