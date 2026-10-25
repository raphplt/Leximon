/**
 * Where the app finds the API and the catalogue. Builds set them (eas.json); a development build
 * defaults to the local servers, reached from a device or emulator through `adb reverse`.
 */
// Dot access only: Expo inlines EXPO_PUBLIC_ variables at build time, not bracket access.
export const API_URL =
  process.env.EXPO_PUBLIC_API_URL ?? (__DEV__ ? "http://localhost:8787" : "https://api.leximon.fr");

/** The website, which also serves the published catalogue under /catalog. */
export const WEB_URL =
  process.env.EXPO_PUBLIC_WEB_URL ?? (__DEV__ ? "http://localhost:3000" : "https://leximon.fr");

export const CATALOG_URL = `${WEB_URL}/catalog`;
