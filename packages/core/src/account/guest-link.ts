/**
 * What becomes of a guest's game when the player signs in.
 *
 * Only a new account receives a guest's game: signing up (the account has no game yet) moves
 * everything the guest owns to it. Signing in to an account that already plays never adds
 * anything to it: every guest starts with a full free stock, so letting a guest's cards join an
 * existing account would turn throwaway guests into a card farm. The guest is left behind, and
 * the player must have been warned first when it owned anything.
 */

/**
 * - `transfer`: the account has no game, the guest's whole game becomes its game;
 * - `abandon`: the account keeps its game alone, the guest's is left behind.
 */
export type GuestLinkOutcome = "transfer" | "abandon";

export interface GuestLinkSituation {
  /** The account owns anything of the game: wallet, cards, mastery or player code. */
  readonly accountHasGame: boolean;
  /** The guest owns at least one card or one word's mastery. */
  readonly guestHasCollection: boolean;
}

export interface GuestLinkDecision {
  readonly outcome: GuestLinkOutcome;
  /**
   * The guest's cards or mastery would be lost: the player must accept it first. An empty guest
   * (the web creates one on every new browser) has nothing to lose, so its sign-in is plain.
   */
  readonly losesCollection: boolean;
}

export function decideGuestLink(situation: GuestLinkSituation): GuestLinkDecision {
  if (!situation.accountHasGame) return { outcome: "transfer", losesCollection: false };
  return { outcome: "abandon", losesCollection: situation.guestHasCollection };
}
