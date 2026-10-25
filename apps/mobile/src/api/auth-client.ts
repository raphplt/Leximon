import { expoClient } from "@better-auth/expo/client";
import { createAuthClient } from "better-auth/client";
import * as SecureStore from "expo-secure-store";
import { API_URL } from "../config";

/**
 * Better Auth's client, used only for its fetch: the Expo plugin adds the session cookie it keeps
 * in the device keychain to each request, and stores every cookie the API sets in return.
 */
export const authClient = createAuthClient({
  baseURL: API_URL,
  plugins: [expoClient({ scheme: "leximon", storagePrefix: "leximon", storage: SecureStore })],
});
