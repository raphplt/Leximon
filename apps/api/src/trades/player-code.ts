/** Crockford base 32: no I, L, O or U, so a code read aloud or copied by hand stays unambiguous. */
const CROCKFORD_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

export const PLAYER_CODE_LENGTH = 8;

/**
 * Encodes random bytes as a player code, one character per byte. Keeping the low 5 bits of a
 * byte is unbiased, since 256 is a multiple of 32.
 */
export function encodePlayerCode(bytes: Uint8Array): string {
  if (bytes.length !== PLAYER_CODE_LENGTH) {
    throw new Error(`A player code needs ${PLAYER_CODE_LENGTH} random bytes`);
  }
  return Array.from(bytes, (byte) => CROCKFORD_ALPHABET.charAt(byte & 31)).join("");
}

/** A fresh code from the platform's cryptographic generator: 40 bits, guessing one is impractical. */
export function generatePlayerCode(): string {
  return encodePlayerCode(crypto.getRandomValues(new Uint8Array(PLAYER_CODE_LENGTH)));
}
