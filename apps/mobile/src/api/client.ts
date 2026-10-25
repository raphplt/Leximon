import { type ApiTransport, createApiClient } from "@leximon/contract/client";
import { router } from "expo-router";
import { API_URL } from "../config";
import { arrival } from "./arrival";
import { authClient } from "./auth-client";

/** The plain headers the shared client builds, as Better Auth's fetch expects them. */
function plainHeaders(headers: HeadersInit | undefined): Record<string, string> {
  return Object.fromEntries(new Headers(headers).entries());
}

/**
 * Every request goes through Better Auth's fetch, so that the session cookie travels and its
 * renewals, set on any route, are kept. The response itself is taken as the network gave it.
 */
const transport: ApiTransport = async (path, init) => {
  let response: Response | undefined;
  await authClient.$fetch(`${API_URL}${path}`, {
    method: init.method ?? "GET",
    headers: plainHeaders(init.headers),
    ...(typeof init.body === "string" ? { body: init.body } : {}),
    customFetchImpl: async (input, requestInit) => {
      const received = await fetch(input, requestInit);
      response = received.clone();
      return received;
    },
  });
  if (response === undefined) throw new Error("no_response");
  return response;
};

export const api = createApiClient({
  transport,
  arrival,
  onBetaClosed() {
    router.replace("/invitation");
  },
});
