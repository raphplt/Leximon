/** 128-bit seed from the platform's cryptographic generator, as 32 lowercase hex characters. */
export function generateSeed(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}
