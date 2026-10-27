import {
  ACCOUNT_ERROR_CODES,
  type AgeBracket,
  type LinkPreviewError,
  type LinkPreviewResponse,
  type SendCodeRefusal,
} from "@leximon/contract";
import { capitalize, type PackNoun } from "./format";

/**
 * Texts of the sign-in flow, kept apart from the screen so that they are tested: what the
 * player reads before signing in decides whether a guest's cards are lost knowingly.
 */

/** The title of each step of the account screen. */
export const ACCOUNT_TITLES = {
  email: "Garde ta collection",
  code: "Vérifie tes e-mails",
  confirm: "Presque fini",
  member: "Tu es connecté",
} as const;

export const NEWS_OPT_IN = "M'écrire quand il y a du nouveau";

/** The age is optional: this choice sends none. */
export const AGE_UNSAID = "Je préfère ne pas dire";

export function ageBracketLabel(bracket: AgeBracket): string {
  return bracket === "50+" ? "50 ans et plus" : `${bracket.replace("-", " à ")} ans`;
}

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
        text: "Cette adresse a déjà un compte avec sa propre collection. Pour garder la partie que tu joues ici, utilise une autre adresse.",
        warning: `Si tu te connectes, ${lostGame(preview.guestCards)}.`,
        confirmLabel: "Perdre cette partie et me connecter",
        needsAge: false,
        acceptsLoss: true,
      };
    case "none":
      return preview.accountExists
        ? {
            title: "Connecte-toi",
            text: "Tu retrouves ta collection telle que tu l'as laissée.",
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
  if (guestCards === 0) return "la progression de cette partie sera perdue";
  return guestCards === 1
    ? "la carte obtenue ici sera perdue"
    : `les ${guestCards} cartes obtenues ici seront perdues`;
}

function withGame(guestCards: number, noun: PackNoun): string {
  if (guestCards === 0) return `tes ${noun.many} et ta progression`;
  const cards = guestCards === 1 ? "ta carte" : `tes ${guestCards} cartes`;
  return `${cards}, tes ${noun.many} et ta progression`;
}

export function sendErrorMessage(reason: SendCodeRefusal): string {
  switch (reason) {
    case "invalid_email":
      return "Cette adresse e-mail n'est pas valide.";
    case "undeliverable_email":
      return "Cette adresse ne peut pas recevoir d'e-mails. Vérifie-la.";
    case "rate_limited":
      return "Attends une minute avant de redemander un code.";
    case "daily_limit":
      return "Tu as demandé trop de codes aujourd'hui. Utilise celui du dernier e-mail, ou réessaie demain.";
    case "unavailable":
      return "L'envoi des e-mails est en panne. Réessaie dans quelques minutes.";
  }
}

export type CodeError = LinkPreviewError | string;

/** Refusal of a code check (preview) or of the sign-in itself. */
export function codeErrorMessage(error: CodeError): string {
  switch (error) {
    case "invalid_code":
    case "INVALID_OTP":
      return "Ce code est faux. Vérifie celui du dernier e-mail.";
    case "code_expired":
    case "OTP_EXPIRED":
      return "Ce code a expiré. Demande un nouveau code.";
    case "too_many_attempts":
    case "TOO_MANY_ATTEMPTS":
      return "Trop d'essais avec ce code. Demande un nouveau code.";
    case "rate_limited":
      return "Trop de tentatives. Réessaie dans une minute.";
    case ACCOUNT_ERROR_CODES.ageConfirmationRequired:
      return "Il faut cocher la case de l'âge. Demande un nouveau code et recommence.";
    case ACCOUNT_ERROR_CODES.guestLossNotAcknowledged:
      return "Ton compte a changé entre-temps. Demande un nouveau code.";
    case ACCOUNT_ERROR_CODES.accountLinkFailed:
      return "Le transfert de ta partie a échoué, mais tes cartes sont toujours là. Demande un nouveau code pour réessayer.";
    case ACCOUNT_ERROR_CODES.inviteRequired:
      return "La bêta est sur invitation. Ouvre d'abord ton lien d'invitation.";
    case ACCOUNT_ERROR_CODES.inviteClosed:
      return "Ce lien d'invitation n'est plus valable.";
    default:
      return "La connexion a échoué. Réessaie.";
  }
}

/** Errors after which the code can no longer work: the player goes back to ask for a new one. */
export function needsNewCode(error: CodeError): boolean {
  return error !== "invalid_code" && error !== "INVALID_OTP" && error !== "rate_limited";
}
