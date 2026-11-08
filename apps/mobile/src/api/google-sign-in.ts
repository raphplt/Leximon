import { getSetCookie } from "@better-auth/expo/client";
import type { GoogleDeclarations } from "@leximon/contract";
import { GOOGLE_QUERY } from "@leximon/view-model";
import * as SecureStore from "expo-secure-store";
import * as WebBrowser from "expo-web-browser";
import { API_URL } from "../config";
import { COOKIE_STORAGE_KEY } from "./auth-client";
import { api } from "./client";

/** Where Google's redirect brings the player back: this app, which the browser hands it to. */
const APP_RETURN = "leximon://compte";

export type GoogleTrip =
  | { readonly kind: "signed_in" }
  /** Back without signing in, with Better Auth's reason (`error`) and the guest's cards. */
  | { readonly kind: "refused"; readonly error: string; readonly cards: string | null }
  /** The browser was closed before Google sent the player back. */
  | { readonly kind: "closed" };

export function isGoogleReturn(url: string): boolean {
  return url.startsWith(APP_RETURN);
}

/**
 * Signs in with Google in the browser. The trip starts through the API's proxy, which gives the
 * browser the state cookie the app holds; on the way back the API adds the session cookie to the
 * app's link, kept here in the keychain as Better Auth's Expo client does.
 */
export async function signInWithGoogle(
  signUp: boolean,
  declared: GoogleDeclarations,
): Promise<GoogleTrip> {
  const done = new URLSearchParams({ [GOOGLE_QUERY.done]: "1" });
  const googleURL = await api.startGoogleSignIn({
    signUp,
    callbackURL: `${APP_RETURN}?${done}`,
    errorCallbackURL: APP_RETURN,
    declared,
  });
  const proxy = `${API_URL}/api/auth/expo-authorization-proxy?${new URLSearchParams({
    authorizationURL: googleURL,
  })}`;
  const result = await WebBrowser.openAuthSessionAsync(proxy, APP_RETURN);
  if (result.type !== "success") return { kind: "closed" };

  const query = new URLSearchParams(result.url.split("?")[1] ?? "");
  const cookie = query.get("cookie");
  if (cookie !== null) {
    const kept = await SecureStore.getItemAsync(COOKIE_STORAGE_KEY);
    await SecureStore.setItemAsync(COOKIE_STORAGE_KEY, getSetCookie(cookie, kept ?? undefined));
    return { kind: "signed_in" };
  }
  const error = query.get(GOOGLE_QUERY.error);
  if (error === null) return { kind: "closed" };
  return { kind: "refused", error, cards: query.get(GOOGLE_QUERY.cards) };
}
