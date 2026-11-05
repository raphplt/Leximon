/** What the home page offers a visitor: the game, or the waitlist while the beta is closed. */
export type Door = "open" | "waitlist";

/**
 * Read when the site is built, like the API's own `BETA_INVITES`: opening the game to everyone
 * is one variable on each side, and the page does not change.
 */
export const LANDING_DOOR: Door =
  process.env.NEXT_PUBLIC_BETA_INVITES === "required" ? "waitlist" : "open";
