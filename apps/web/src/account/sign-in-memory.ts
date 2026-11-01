/**
 * What this browser remembers of a sign-in: the address, to fill the form next time, and that one
 * just happened, for the game to say so after the full load. Storage can be missing or blocked:
 * then the field starts empty and nothing is said.
 */

const LAST_EMAIL_KEY = "leximon.last-email";
const SIGNED_IN_KEY = "leximon.signed-in";

export function keepLastEmail(email: string): void {
  try {
    window.localStorage.setItem(LAST_EMAIL_KEY, email);
  } catch {
    // Not kept: the field starts empty next time.
  }
}

export function readLastEmail(): string {
  try {
    return window.localStorage.getItem(LAST_EMAIL_KEY) ?? "";
  } catch {
    return "";
  }
}

/** The address must not outlive its account on this browser. */
export function forgetLastEmail(): void {
  try {
    window.localStorage.removeItem(LAST_EMAIL_KEY);
  } catch {
    // Nothing to forget.
  }
}

export function noteSignedIn(): void {
  try {
    window.sessionStorage.setItem(SIGNED_IN_KEY, "1");
  } catch {
    // The game opens without the message.
  }
}

/** True once after a sign-in. */
export function takeSignedIn(): boolean {
  try {
    const noted = window.sessionStorage.getItem(SIGNED_IN_KEY) !== null;
    window.sessionStorage.removeItem(SIGNED_IN_KEY);
    return noted;
  } catch {
    return false;
  }
}
