import type { DuelistSide, JoustSummary } from "@leximon/contract";
import type { EpochMs } from "@leximon/core";
import { deadlineText, type RunSize } from "./jousts";
import { LEAGUE_NAMES, placeText, pointsText } from "./leagues";

/** Before a joust: the search for an opponent, then the face-to-face and « Commencer ». */

export const START_JOUST = "Commencer";
export const START_LATER = "Plus tard";
export const OPPONENT_FOUND = "Adversaire trouvé !";
export const SEARCHING = "Recherche d'un adversaire…";

const KINDS: Readonly<Record<JoustSummary["kind"], string>> = {
  ranked: "Joute classée",
  free: "Joute libre",
  friendly: "Joute amicale",
};

export function joustKindName(kind: JoustSummary["kind"]): string {
  return KINDS[kind];
}

/** The game picks the opponent of a ranked or free joust: the search is shown for those only. */
export function searchedFor(kind: JoustSummary["kind"]): boolean {
  return kind !== "friendly";
}

/** Under the search: who the game looks for, then who it found. */
export function searchLine(
  kind: JoustSummary["kind"],
  found: { readonly name: string; readonly side: DuelistSide } | null,
): string {
  if (found === null) {
    return kind === "ranked"
      ? "Le jeu cherche un jouteur de ta ligue."
      : "Le jeu cherche un jouteur de ton niveau.";
  }
  const { name, side } = found;
  const league = `ligue ${LEAGUE_NAMES[side.league]}`;
  return side.group === null
    ? `${name}, ${league}.`
    : `${name}, ${league}, ${placeText(side.group.place)} de son groupe.`;
}

/** Under a duelist's name: « Page · 9 points cette semaine ». */
export function duelistMeta(side: DuelistSide): string {
  const league = LEAGUE_NAMES[side.league];
  return side.group === null
    ? league
    : `${league} · ${pointsText(side.group.points)} cette semaine`;
}

/** Under « Commencer »: when the clock starts, and how long the run lasts. */
export function startLine(size: RunSize): string {
  return `Le chrono démarre quand tu commences, puis tu as ${size.seconds} secondes pour chacun des ${size.questions} mots.`;
}

/** The first player's time to start, as they leave it for later. */
export function startByLine(
  startBy: string | null,
  opponentName: string,
  now: EpochMs,
  timeZone?: string,
): string | null {
  if (startBy === null) return null;
  return `Si tu ne la commences pas avant ${deadlineText(startBy, now, timeZone)}, la joute revient à ${opponentName}.`;
}
