import { DISCORD_RETURN_QUERY } from "@leximon/contract";
import * as WebBrowser from "expo-web-browser";
import { api } from "./client";

/** Where the API sends the browser back once Discord's page is done: this app. */
const APP_RETURN = "leximon://mecene";

export type DiscordTrip = "linked" | "failed" | "refused" | "closed";

export function isDiscordReturn(url: string): boolean {
  return url.startsWith(APP_RETURN) && url.includes(`${DISCORD_RETURN_QUERY}=`);
}

/** Links the patron's Discord account in the browser; the API says how it went on the way back. */
export async function linkDiscord(): Promise<DiscordTrip> {
  const start = await api.linkDiscord(true);
  if (start.kind === "refused") return "refused";
  const result = await WebBrowser.openAuthSessionAsync(start.url, APP_RETURN);
  if (result.type !== "success") return "closed";
  const query = new URLSearchParams(result.url.split("?")[1] ?? "");
  return query.get(DISCORD_RETURN_QUERY) === "linked" ? "linked" : "failed";
}
