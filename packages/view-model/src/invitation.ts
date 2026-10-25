import { inviteCodeSchema, playerCodeSchema } from "@leximon/contract";

/** The doors of the closed beta: an invitation link, and the screen of those who have none. */

export const INVITED_TITLE = "Tu es invité";
export const CLOSED_TITLE = "Porte close";
export const INVITED_PITCH =
  "Des mots que plus personne ne dit, en cartes à collectionner. La bêta est fermée, ce lien t'ouvre la porte.";
export const INVITED_ACTION = "Ouvrir mon premier sachet";

export const INVITATION_REQUIRED_TITLE = "Sur invitation";
export const INVITATION_REQUIRED_TEXT = "La bêta est fermée. Il te faut un lien d'invitation.";

/** Why an invitation link no longer opens the door, and what is left to do. */
export const INVITE_CLOSED_TEXT = {
  full: "Ce lien a fait le plein. Laisse ton adresse, on te prévient à l'ouverture.",
  expired: "Ce lien a fait son temps. Laisse ton adresse, on te prévient à l'ouverture.",
  unknown: "Ce lien ne mène nulle part. Recopie-le en entier, ou laisse ton adresse.",
} as const;

export const WAITLIST_ERRORS = {
  invalid_email: "Il manque quelque chose à cette adresse.",
  rate_limited: "Doucement. Réessaie dans une minute.",
  unavailable: "Le serveur lambine. Réessaie.",
} as const;

/** A way in: an invitation code, or the code of the friend whose link was followed. */
export type Door =
  | { readonly kind: "invite"; readonly code: string }
  | { readonly kind: "friend"; readonly code: string };

/**
 * The way in held by what the player pasted: an invitation code, an invitation link
 * (`https://leximon.fr/invitation/<code>`) or a friend link (`…/ami/<code>`). `null` when it
 * holds none.
 */
export function doorFrom(input: string): Door | null {
  const trimmed = input.trim();
  const friend = /\/ami\/([^/?#\s]+)/i.exec(trimmed)?.[1];
  if (friend !== undefined) {
    const code = playerCodeSchema.safeParse(safeDecode(friend));
    return code.success ? { kind: "friend", code: code.data } : null;
  }
  const fromLink = /\/invitation\/([^/?#\s]+)/i.exec(trimmed)?.[1];
  const code = inviteCodeSchema.safeParse(fromLink === undefined ? trimmed : safeDecode(fromLink));
  return code.success ? { kind: "invite", code: code.data } : null;
}

export const DOOR_FIELD = "Ton lien d'invitation";
export const DOOR_INVALID = "Ce n'est pas un lien d'invitation. Recopie-le en entier.";

function safeDecode(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}
