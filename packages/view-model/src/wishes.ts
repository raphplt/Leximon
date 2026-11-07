import type { PlayerBadge } from "@leximon/contract";
import { formatCount, plural } from "./format";
import { playerName } from "./trades";

/** The list of wishes: the words a player looks for, and the players who look for their doubles. */

export const WISHES_TAB = "Souhaits";
export const WISH_SEEKERS_TITLE = "Ils cherchent tes doubles";
export const WISHES_TITLE = "Les mots que tu cherches";
export const REMOVE_WISH = "Retirer";
export const PROPOSE_TO_SEEKER = "Proposer un échange";

/** « Alix cherche 2 de tes doubles. » */
export function seekerLine(player: PlayerBadge, cardIds: readonly string[]): string {
  return `${playerName(player)} cherche ${cardIds.length === 1 ? "un de tes doubles" : `${formatCount(cardIds.length)} de tes doubles`}.`;
}

export function seekersNote(count: number): string {
  return count === 0
    ? "Personne ne cherche tes doubles pour l'instant. Un mot croisé en joute sans l'avoir va dans la liste de souhaits du joueur."
    : "Ils ne voient de ta collection que ces doubles, et tu ne vois de leur liste que ces mots.";
}

export function wishesNote(count: number): string {
  return count === 0
    ? "Ta liste est vide. Les mots que tu croises en joute sans les avoir y arrivent."
    : `${plural(count, "mot", "mots")}. Seuls les joueurs qui en ont un en double le voient. Un mot obtenu quitte la liste.`;
}

/** Under a joust's result: the words of the run the player does not own. */
export function wishedLine(count: number): string | null {
  if (count === 0) return null;
  return count === 1
    ? "Le mot que tu n'as pas va dans ta liste de souhaits."
    : `Les ${formatCount(count)} mots que tu n'as pas vont dans ta liste de souhaits.`;
}
