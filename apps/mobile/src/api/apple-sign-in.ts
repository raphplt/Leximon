import { ACCOUNT_ERROR_CODES, type AppleIdToken, type GoogleDeclarations } from "@leximon/contract";
import type { LinkSocialResult } from "@leximon/contract/client";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import { Platform } from "react-native";
import { api } from "./client";

export type AppleTrip =
  | { readonly kind: "signed_in" }
  | {
      readonly kind: "refused";
      readonly code: string;
      readonly guestCards: number;
      readonly idToken?: AppleIdToken;
    }
  | { readonly kind: "closed" };

export type AppleLinkTrip = LinkSocialResult | { readonly kind: "closed" };

export async function isAppleAvailable(): Promise<boolean> {
  if (Platform.OS !== "ios") return false;
  return AppleAuthentication.isAvailableAsync().catch(() => false);
}

function isCanceled(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ERR_REQUEST_CANCELED"
  );
}

async function requestAppleToken(): Promise<AppleIdToken | null | "missing_token"> {
  const nonce = Crypto.randomUUID();
  const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, nonce);
  try {
    // Only request e-mail, never full name: Leximon never stores a player's real name.
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [AppleAuthentication.AppleAuthenticationScope.EMAIL],
      nonce: hashedNonce,
    });
    if (!credential.identityToken) return "missing_token";
    return { token: credential.identityToken, nonce };
  } catch (error) {
    if (isCanceled(error)) return null;
    throw error;
  }
}

async function countGuestCards(): Promise<number> {
  try {
    const owned = await api.fetchOwnedCards();
    return owned.reduce((sum, card) => sum + card.quantity, 0);
  } catch {
    return 0;
  }
}

/**
 * Signs in natively with Apple on iOS. Sends the raw nonce + signed Apple identity token directly
 * to Better Auth (`idToken` flow); when a guest session would be lost, reuses `cachedToken` if
 * confirmed immediately so the player is not prompted twice.
 */
export async function signInWithApple(
  signUp: boolean,
  declared: GoogleDeclarations,
  cachedToken?: AppleIdToken,
): Promise<AppleTrip> {
  const idToken = cachedToken ?? (await requestAppleToken());
  if (idToken === null) return { kind: "closed" };
  if (idToken === "missing_token") {
    return { kind: "refused", code: "missing_identity_token", guestCards: 0 };
  }

  const result = await api.signInWithApple({ signUp, idToken, declared });
  if (result.kind === "signed_in") return { kind: "signed_in" };

  if (result.code === ACCOUNT_ERROR_CODES.guestLossNotAcknowledged) {
    return {
      kind: "refused",
      code: result.code,
      guestCards: await countGuestCards(),
      idToken,
    };
  }
  return { kind: "refused", code: result.code, guestCards: 0 };
}

/** Links Apple to the currently signed-in member account natively on iOS. */
export async function linkApple(): Promise<AppleLinkTrip> {
  const idToken = await requestAppleToken();
  if (idToken === null) return { kind: "closed" };
  if (idToken === "missing_token") {
    return { kind: "refused", code: "missing_identity_token" };
  }
  return api.linkApple({ idToken });
}
