import { isDiscordReturn } from "@/api/discord-link";
import { isGoogleReturn } from "@/api/google-sign-in";

const WEB_HOSTS = new Set(["leximon.fr", "www.leximon.fr"]);

function stripWebOrigin(path: string): string {
  if (!/^https?:\/\//i.test(path)) return path;
  try {
    const url = new URL(path);
    if (WEB_HOSTS.has(url.hostname.toLowerCase())) {
      return `${url.pathname || "/"}${url.search}${url.hash}`;
    }
  } catch {
    return path;
  }
  return path;
}

/**
 * Links that open the app. Google's return (`leximon://compte?…`) is read by the sign-in that
 * opened the browser: the router leaves it alone, since it carries the session cookie. Opened cold
 * (the app was closed meanwhile), it only leads to the account screen. Discord's return is read
 * the same way by the patron screen.
 */
export function redirectSystemPath({
  path,
  initial,
}: {
  readonly path: string;
  readonly initial: boolean;
}): string | null {
  if (isDiscordReturn(path)) return initial ? "/mecene" : null;
  if (isGoogleReturn(path)) return initial ? "/compte" : null;
  const localPath = stripWebOrigin(path);
  if (/^\/enigme(?:\/[^/?#]+)?(?:[?#]|$)/.test(localPath)) return "/enigme";
  return localPath;
}
