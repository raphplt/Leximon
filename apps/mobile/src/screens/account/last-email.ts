import * as SecureStore from "expo-secure-store";

/** The address of the last sign-in, kept on the phone to fill the form next time. */
const KEY = "leximon_last_email";

export function keepLastEmail(email: string): void {
  SecureStore.setItemAsync(KEY, email).catch(() => {
    // Not kept: the field starts empty next time.
  });
}

export function readLastEmail(): string {
  try {
    return SecureStore.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}

/** The address must not outlive its account on this phone. */
export function forgetLastEmail(): void {
  SecureStore.deleteItemAsync(KEY).catch(() => {
    // Nothing to forget.
  });
}
