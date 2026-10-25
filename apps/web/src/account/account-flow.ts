import {
  ACCOUNT_ERROR_CODES,
  type LinkPreviewError,
  type LinkPreviewResponse,
} from "@leximon/contract";
import type { SendCodeResult } from "@leximon/contract/client";
import type { PackNoun } from "../lib/pack-shape";

/**
 * Texts of the sign-in flow, kept apart from the screen so that they are tested: what the
 * player reads before signing in decides whether a guest's cards are lost knowingly.
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
  /** "J'ai 15 ans ou plus" must be ticked: an account is about to be created. */
  readonly needsAge: boolean;
  /** Confirming abandons the guest's cards: the request says the player accepted it. */
  readonly acceptsLoss: boolean;
  /** No account can be created here: the beta is on invitation and none came with the player. */
  readonly closed: boolean;
}

/** What the player confirms, given what signing in would do to the guest's game. */
export function confirmStep(preview: LinkPreviewResponse, noun: PackNoun): ConfirmStep {
  if (preview.inviteRequired) {
    return {
      title: "Sur invitation",
      text: "La bêta est fermée. Pour créer un compte, passe d'abord par un lien d'invitation.",
      warning: null,
      confirmLabel: "",
      needsAge: false,
      acceptsLoss: false,
      closed: true,
    };
  }
  return { ...stepOf(preview, noun), closed: false };
}

function stepOf(preview: LinkPreviewResponse, noun: PackNoun): Omit<ConfirmStep, "closed"> {
  switch (preview.outcome) {
    case "transfer":
      return preview.accountExists
        ? {
            title: "Connecte-toi",
            text: `${capitalize(withGame(preview.guestCards, noun))} passent sur ton compte.`,
            warning: null,
            confirmLabel: "Me connecter",
            needsAge: false,
            acceptsLoss: false,
          }
        : {
            title: "Crée ton compte",
            text: `${capitalize(withGame(preview.guestCards, noun))} passent sur ton nouveau compte.`,
            warning: null,
            confirmLabel: "Créer mon compte",
            needsAge: true,
            acceptsLoss: false,
          };
    case "abandon":
      return {
        title: "Tu vas perdre cette partie",
        text: "Cette adresse a déjà un compte, avec sa propre collection. Pour garder celle-ci, prends une autre adresse.",
        warning: `Si tu te connectes, ${lostGame(preview.guestCards)}.`,
        confirmLabel: "Perdre cette partie et me connecter",
        needsAge: false,
        acceptsLoss: true,
      };
    case "none":
      return preview.accountExists
        ? {
            title: "Connecte-toi",
            text: "Ta collection t'attend.",
            warning: null,
            confirmLabel: "Me connecter",
            needsAge: false,
            acceptsLoss: false,
          }
        : {
            title: "Crée ton compte",
            text: "Ta collection sera sur tous tes appareils.",
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

export function sendErrorMessage(reason: Extract<SendCodeResult, { kind: "refused" }>["reason"]) {
  switch (reason) {
    case "invalid_email":
      return "Il manque quelque chose à cette adresse.";
    case "undeliverable_email":
      return "Ce domaine ne reçoit pas d'e-mails. Vérifie l'adresse.";
    case "rate_limited":
      return "Attends une minute avant de redemander un code.";
    case "daily_limit":
      return "Assez de codes pour aujourd'hui. Prends celui du dernier e-mail, ou reviens demain.";
    case "unavailable":
      return "Les e-mails ne partent plus. Réessaie tout à l'heure.";
  }
}

export type CodeError = LinkPreviewError | string;

/** Refusal of a code check (preview) or of the sign-in itself. */
export function codeErrorMessage(error: CodeError): string {
  switch (error) {
    case "invalid_code":
    case "INVALID_OTP":
      return "Mauvais code. Prends celui du dernier e-mail.";
    case "code_expired":
    case "OTP_EXPIRED":
      return "Code expiré. Demandes-en un autre.";
    case "too_many_attempts":
    case "TOO_MANY_ATTEMPTS":
      return "Trop d'essais. Demande un autre code.";
    case "rate_limited":
      return "Doucement. Réessaie dans une minute.";
    case ACCOUNT_ERROR_CODES.ageConfirmationRequired:
      return "Coche la case de l'âge, puis demande un autre code.";
    case ACCOUNT_ERROR_CODES.guestLossNotAcknowledged:
      return "Ton compte a changé entre-temps. Demande un autre code.";
    case ACCOUNT_ERROR_CODES.accountLinkFailed:
      return "Le transfert a raté. Tes cartes n'ont pas bougé. Demande un autre code.";
    case ACCOUNT_ERROR_CODES.inviteRequired:
      return "La bêta est sur invitation. Passe d'abord par ton lien.";
    case ACCOUNT_ERROR_CODES.inviteClosed:
      return "Ce lien d'invitation est fermé.";
    default:
      return "Ça n'a pas marché. Réessaie.";
  }
}

/** Errors after which the code can no longer work: the player goes back to ask for a new one. */
export function needsNewCode(error: CodeError): boolean {
  return error !== "invalid_code" && error !== "INVALID_OTP" && error !== "rate_limited";
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
