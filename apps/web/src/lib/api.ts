import { type ApiTransport, createApiClient } from "@leximon/contract/client";
import { arrivalHeaders, forgetArrival } from "../beta/arrival";

// Dot access only: Next.js inlines NEXT_PUBLIC_ variables at build time, not bracket access.
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";

/** The browser carries the session in Better Auth's cookie. */
export const browserTransport: ApiTransport = (path, init) =>
  fetch(`${API_URL}${path}`, { ...init, credentials: "include" });

/** Pages that work without a player: signing in to an account, entering by an invitation, a shared riddle. */
const OPEN_WITHOUT_PLAYER = ["/compte", "/invitation", "/ami/", "/enigme/"];

export const api = createApiClient({
  transport: browserTransport,
  arrival: { headers: arrivalHeaders, forget: forgetArrival },
  onBetaClosed() {
    if (!OPEN_WITHOUT_PLAYER.some((path) => window.location.pathname.startsWith(path))) {
      window.location.assign("/invitation");
    }
  },
});
