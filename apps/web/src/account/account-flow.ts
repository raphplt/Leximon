import {
  ACCOUNT_ERROR_CODES,
  type GuestLinkPreviewOutcome,
  type LinkPreviewError,
  type LinkPreviewResponse,
} from "@leximon/contract";
import type { SendCodeResult } from "../lib/api";
import type { PackNoun } from "../lib/pack-shape";

/**
 * Texts of the sign-in flow (D-030), kept apart from the screen so that they are tested: what the
 * player reads before signing in decides whether a guest's cards are lost knowingly (P37, P54).
 */

export function cardCount(count: number): string {
  if (count === 0) return "aucune carte";
  return count === 1 ? "1 carte" : `${count} cartes`;
}

export interface ConfirmStep {
  readonly title: string;
  readonly text: string;
  /** Shown above the buttons, as a warning: something will be lost. */
  readonly warning: string | null;
  readonly confirmLabel: string;
  /** "J'ai 15 ans ou plus" must be ticked: an account is about to be created (P8). */
  readonly needsAge: boolean;
  /** Confirming abandons the guest's cards: the request says the player accepted it. */
  readonly acceptsLoss: boolean;
}

/** What the player confirms, given what signing in would do to the guest's game. */
export function confirmStep(preview: LinkPreviewResponse, noun: PackNoun): ConfirmStep {
  switch (preview.outcome) {
    case "transfer":
      return preview.accountExists
        ? {
            title: "Connecte-toi",
            text: `Ton compte est encore vide : ${withGame(preview.guestCards, noun)} le rejoignent.`,
            warning: null,
            confirmLabel: "Me connecter",
            needsAge: false,
            acceptsLoss: false,
          }
        : {
            title: "Crée ton compte",
            text: `${capitalize(withGame(preview.guestCards, noun))} te suivent : tu les retrouveras sur tous tes appareils.`,
            warning: null,
            confirmLabel: "Créer mon compte",
            needsAge: true,
            acceptsLoss: false,
          };
    case "abandon":
      return {
        title: "Tes cartes d'invité seront perdues",
        text: "Cette adresse a déjà un compte qui joue : seul un nouveau compte peut accueillir une partie commencée en invité. Pour la garder, crée plutôt un compte avec une autre adresse.",
        warning: `Si tu te connectes, ${lostGame(preview.guestCards)}, sans retour possible.`,
        confirmLabel: "Me connecter quand même",
        needsAge: false,
        acceptsLoss: true,
      };
    case "none":
      return preview.accountExists
        ? {
            title: "Connecte-toi",
            text: "Tu retrouves ta collection.",
            warning: null,
            confirmLabel: "Me connecter",
            needsAge: false,
            acceptsLoss: false,
          }
        : {
            title: "Crée ton compte",
            text: "Tu retrouveras ta collection sur tous tes appareils.",
            warning: null,
            confirmLabel: "Créer mon compte",
            needsAge: true,
            acceptsLoss: false,
          };
  }
}

/**
 * Whether the player has something to read or tick before signing in. Joining an account that
 * exists with nothing of the guest at stake (an empty guest, or none) is a plain sign-in.
 */
export function needsConfirmation(preview: LinkPreviewResponse): boolean {
  return !(preview.outcome === "none" && preview.accountExists);
}

function lostGame(guestCards: number): string {
  if (guestCards === 0) return "ta progression jouée ici sera perdue";
  return guestCards === 1
    ? "la carte jouée ici sera perdue"
    : `les ${guestCards} cartes jouées ici seront perdues`;
}

function withGame(guestCards: number, noun: PackNoun): string {
  return guestCards === 0
    ? `tes ${noun.many} et ta progression`
    : `tes ${cardCount(guestCards)}, tes ${noun.many} et ta progression`;
}

/** Message once signed in. */
export function doneMessage(outcome: GuestLinkPreviewOutcome): string {
  switch (outcome) {
    case "transfer":
      return "Ton compte est prêt : ta collection est à l'abri.";
    case "abandon":
    case "none":
      return "Tu as retrouvé ta collection.";
  }
}

export function sendErrorMessage(reason: Extract<SendCodeResult, { kind: "refused" }>["reason"]) {
  switch (reason) {
    case "invalid_email":
      return "Cette adresse ne semble pas valide.";
    case "rate_limited":
      return "Attends une minute avant de redemander un code.";
    case "unavailable":
      return "L'envoi des e-mails n'est pas encore ouvert. Réessaie plus tard.";
  }
}

export type CodeError = LinkPreviewError | string;

/** Refusal of a code check (preview) or of the sign-in itself. */
export function codeErrorMessage(error: CodeError): string {
  switch (error) {
    case "invalid_code":
    case "INVALID_OTP":
      return "Ce n'est pas le bon code. Vérifie le dernier e-mail reçu.";
    case "code_expired":
    case "OTP_EXPIRED":
      return "Ce code a expiré. Demande-en un nouveau.";
    case "too_many_attempts":
    case "TOO_MANY_ATTEMPTS":
      return "Trop d'essais avec ce code. Demande-en un nouveau.";
    case "rate_limited":
      return "Trop d'essais d'un coup. Attends une minute.";
    case ACCOUNT_ERROR_CODES.ageConfirmationRequired:
      return "Coche la case sur ton âge, puis demande un nouveau code.";
    case ACCOUNT_ERROR_CODES.guestLossNotAcknowledged:
      return "Ton compte vient de changer. Demande un nouveau code pour voir ce que deviennent tes cartes.";
    case ACCOUNT_ERROR_CODES.accountLinkFailed:
      return "Ta collection n'a pas pu rejoindre ton compte. Tu es toujours en invité et rien n'est perdu : réessaie avec un nouveau code.";
    default:
      return "Ça n'a pas marché. Réessaie dans un moment.";
  }
}

/** Errors after which the code can no longer work: the player goes back to ask for a new one. */
export function needsNewCode(error: CodeError): boolean {
  return error !== "invalid_code" && error !== "INVALID_OTP" && error !== "rate_limited";
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
