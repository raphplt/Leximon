/** The app on the stores: where the site sends a player who would rather play on the phone. */
export type Store = "android" | "ios";

/** The App Store's id of the app, which Safari's own banner needs. */
export const APP_STORE_ID = "6827744020";

export const STORE_LINKS: Readonly<Record<Store, string>> = {
  android: "https://play.google.com/store/apps/details?id=fr.leximon.app",
  ios: `https://apps.apple.com/fr/app/leximon/id${APP_STORE_ID}`,
};

/** The two lines of a store badge, worded as each store words its own. */
export const STORE_BADGES: Readonly<
  Record<Store, { readonly over: string; readonly name: string }>
> = {
  android: { over: "Disponible sur", name: "Google Play" },
  ios: { over: "Télécharger dans", name: "l'App Store" },
};

/** Android first: most phones in France run it. */
export const STORES: readonly Store[] = ["android", "ios"];

export const STORES_LINE =
  "L'app est gratuite sur Android et iPhone, avec le même compte que le site.";
