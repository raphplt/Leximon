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
  email: "Crée ton compte",
  code: "Vérifie tes e-mails",
  confirm: "Presque fini",
  member: "Tu es connecté",
} as const;

/**
 * What the player came to do. Both go through the same code by e-mail, and the server alone
 * knows whether the address has an account: the intent only changes what the screen says.
 */
export type AccountIntent = "signup" | "signin";

export const ACCOUNT_INTENTS: readonly { readonly value: AccountIntent; readonly label: string }[] =
  [
    { value: "signup", label: "Créer un compte" },
    { value: "signin", label: "Se connecter" },
  ];

/** The query that opens the account screen on signing in rather than up. */
export const SIGN_IN_QUERY = "connexion";

export interface EmailStep {
  readonly title: string;
  readonly text: string;
  /** How the code works, in small under the button: there is no password to look for. */
  readonly how: string;
  /** Only a new account is asked about news by e-mail: a member sets it in their account. */
  readonly asksNews: boolean;
}

const HOW_THE_CODE_WORKS = "Tu recevras un code par e-mail, sans mot de passe.";

export function emailStep(intent: AccountIntent): EmailStep {
  return intent === "signup"
    ? {
        title: "Crée ton compte",
        text: "Garde ta collection et retrouve-la partout.",
        how: HOW_THE_CODE_WORKS,
        asksNews: true,
      }
    : {
        title: "Connecte-toi",
        text: "Retrouve ta collection là où tu l'as laissée.",
        how: HOW_THE_CODE_WORKS,
        asksNews: false,
      };
}

/** Under the button that opens a sachet, while a guest still has some to open. */
export const GUEST_SIGN_UP_CTA = "Crée ton compte pour garder tes cartes";

/** Said over the game once the code is accepted. */
export const SIGNED_IN_TOAST = "Tu es connecté.";

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
export function confirmStep(
  preview: LinkPreviewResponse,
  noun: PackNoun,
  intent: AccountIntent = "signup",
): ConfirmStep {
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
  const step = stepOf(preview, noun);
  // Come to sign in with an address that has no account: say so before creating one.
  if (intent === "signin" && !preview.accountExists) {
    return {
      ...step,
      title: "Pas encore de compte",
      text: `${NO_ACCOUNT_YET} ${step.text}`,
      closed: false,
    };
  }
  return { ...step, closed: false };
}

const NO_ACCOUNT_YET = "Aucun compte n'utilise encore cette adresse. Tu peux le créer maintenant.";

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

/* --- Signing in with Google --- */

export const GOOGLE_BUTTON = "Continuer avec Google";

/** Between the Google button and the address form. */
export const GOOGLE_OR = "ou";

/** Said on the step that asks the age before leaving for Google. */
// A non-breaking hyphen: « e-mail » never splits over two lines.
export const GOOGLE_AGE_TEXT = "Google ne nous transmet que ton adresse e\u2011mail.";

/**
 * Queries of the account page on Google's return: `google` once signed in (with `news` when the
 * box was ticked before leaving), `error` and `cards` when the sign-in failed. Better Auth names
 * `error` itself.
 */
export const GOOGLE_QUERY = { done: "google", news: "nouvelles", error: "error", cards: "cards" };

export type GoogleReturn =
  /** The player turned back at Google's: nothing to say. */
  | { readonly kind: "cancelled" }
  /** « Se connecter » with a Google account that has no account here: off to « Créer ». */
  | { readonly kind: "no_account"; readonly notice: string }
  /** The account plays already: the guest's game would be lost, the player confirms first. */
  | { readonly kind: "guest_loss"; readonly step: Omit<ConfirmStep, "closed" | "needsAge"> }
  | { readonly kind: "error"; readonly message: string };

/** What the account page says after a failed trip to Google, from its `error` and `cards`. */
export function googleReturn(error: string, cards: string | null): GoogleReturn {
  switch (error) {
    case "access_denied":
      return { kind: "cancelled" };
    case "signup_disabled":
      return {
        kind: "no_account",
        notice: "Aucun compte n'utilise encore ce compte Google. Crée-le ici.",
      };
    case ACCOUNT_ERROR_CODES.guestLossNotAcknowledged: {
      const count = Number.parseInt(cards ?? "", 10);
      return {
        kind: "guest_loss",
        step: {
          title: "Tu vas perdre cette partie",
          text: "Ce compte Google mène à un compte Leximon qui a déjà sa propre collection. Pour garder la partie que tu joues ici, utilise un autre compte Google.",
          warning: `Si tu te connectes, ${lostGame(Number.isNaN(count) ? 0 : count)}.`,
          confirmLabel: "Perdre cette partie et me connecter",
          acceptsLoss: true,
        },
      };
    }
    default:
      return { kind: "error", message: googleErrorMessage(error) };
  }
}

function googleErrorMessage(error: string): string {
  switch (error) {
    case "BANNED_USER":
      return "Ce compte a été suspendu. Écris à contact@leximon.fr pour en savoir plus.";
    case "email_not_verified":
    case "account_not_linked":
      return "Google n'a pas vérifié cette adresse. Connecte-toi plutôt avec un code par e-mail.";
    case ACCOUNT_ERROR_CODES.ageConfirmationRequired:
      return "Il faut cocher la case de l'âge pour créer un compte.";
    case ACCOUNT_ERROR_CODES.accountLinkFailed:
      return "Le transfert de ta partie a échoué, mais tes cartes sont toujours là. Réessaie.";
    case ACCOUNT_ERROR_CODES.inviteRequired:
      return "La bêta est sur invitation. Ouvre d'abord ton lien d'invitation.";
    case ACCOUNT_ERROR_CODES.inviteClosed:
      return "Ce lien d'invitation n'est plus valable.";
    default:
      return "La connexion avec Google a échoué. Réessaie.";
  }
}

/** After the member's address, when Google is one of the ways they sign in. */
export const BY_GOOGLE = "par Google";
