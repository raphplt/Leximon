import type { MailLetter } from "@leximon/contract";
import type { EpochMs } from "@leximon/core";
import { messageTime } from "./clan";
import { plural } from "./format";
import { playerName } from "./trades";

export const MAIL_EMPTY = "Boîte vide. Le facteur repassera.";
export const MAIL_TODO = "À faire";
export const MAIL_NEWS = "Nouvelles";
export const MAIL_OLDER = "Lettres plus anciennes";

/** Where a letter leads: a screen, or the clan's discussion opened over the current one. */
export type LetterTarget =
  | { readonly kind: "screen"; readonly href: string }
  | { readonly kind: "chat" };

export interface LetterView {
  readonly title: string;
  readonly detail: string;
  /** « 14:05 » today, the date before. */
  readonly when: string;
  readonly target: LetterTarget;
}

const trades: LetterTarget = { kind: "screen", href: "/echanges" };
const friends: LetterTarget = { kind: "screen", href: "/amis" };

/** A letter as the mail lists it. */
export function letterView(letter: MailLetter, now: EpochMs, timeZone?: string): LetterView {
  const name = playerName(letter.player);
  const when = messageTime(letter.createdAt, now, timeZone);
  switch (letter.kind) {
    case "offer_received":
      return { title: `${name} t'envoie une offre`, detail: "Échanges", when, target: trades };
    case "offer_completed":
      return { title: `${name} accepte ton offre`, detail: "Échange fait", when, target: trades };
    case "offer_declined":
      return { title: `${name} refuse ton offre`, detail: "Échanges", when, target: trades };
    case "clan_mention":
      return {
        title: `${name} parle de toi`,
        detail: letter.excerpt === null ? "Message effacé" : `« ${letter.excerpt} »`,
        when,
        target: { kind: "chat" },
      };
    case "clan_request":
      return {
        title: `${name} veut entrer dans le clan`,
        detail: "Demandes du clan",
        when,
        target: { kind: "screen", href: "/clan" },
      };
    case "friend_request":
      return {
        title: `${name} te demande en ami`,
        detail: letter.pending ? "Demande d'ami" : "Amis",
        when,
        target: friends,
      };
    case "friend_accepted":
      return { title: `${name} accepte ta demande`, detail: "Amis", when, target: friends };
    case "referral_arrived":
      return { title: `${name} arrive par ton lien`, detail: "Nouvel ami", when, target: friends };
    case "referral_qualified":
      return {
        title: `Un sachet bonus grâce à ${name} !`,
        detail: "Parrainage",
        when,
        target: friends,
      };
    case "friend_reaction": {
      const others = letter.reactions - 1;
      return {
        title:
          others > 0
            ? `${name} et ${plural(others, "autre", "autres")} réagissent à ta trouvaille`
            : `${name} réagit à ta trouvaille`,
        detail: "Fil des amis",
        when,
        target: friends,
      };
    }
    default:
      throw new Error(`Unknown letter: ${JSON.stringify(letter satisfies never)}`);
  }
}

/** Under « Lucubrateur est en train de t'échapper. »: the others due with it. */
export function slippingDetail(others: number): string {
  return others === 0 ? "Défis" : `Et ${plural(others, "autre mot", "autres mots")}`;
}
