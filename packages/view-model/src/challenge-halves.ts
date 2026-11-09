import type { JoustSummary, JoustsResponse, LeagueId } from "@leximon/contract";
import { formatCount, plural } from "./format";
import { LEAGUE_NAMES, placeText } from "./leagues";

/**
 * The two halves of Défis: the training on the player's own words, and the jousts against other
 * players. The same on the web and the phone.
 */

export type ChallengeHalf = "training" | "jousts";

export const CHALLENGE_HALVES: readonly { readonly id: ChallengeHalf; readonly label: string }[] = [
  { id: "training", label: "Entraînement" },
  { id: "jousts", label: "Joutes" },
];

/** « 3 mots à revoir. », once the review is read. */
export function trainingHalfLine(due: number | null): string | null {
  if (due === null) return null;
  if (due === 0) return "Aucun mot à revoir pour l'instant.";
  return `${plural(due, "mot", "mots")} à revoir.`;
}

/** A result still sealed: the player has not opened it. */
function sealed(joust: JoustSummary): boolean {
  return joust.state === "ended" && !joust.seen;
}

/** A joust someone else launched, which waits for the player's run. */
function toAnswer(joust: JoustSummary): boolean {
  return joust.state === "play" && !joust.launched;
}

/** What waits for the player in the jousts: the red count on Défis. */
export function joustsWaiting(jousts: readonly JoustSummary[]): number {
  return jousts.filter((joust) => sealed(joust) || toAnswer(joust)).length;
}

export interface JoustsHalf {
  /** The league whose crest stands on the half, once the jousts are open. */
  readonly league: LeagueId | null;
  /** The level that opens them, while it is too low. */
  readonly lockedAt: number | null;
  readonly lines: readonly string[];
  readonly waiting: number;
}

type Closed = Exclude<JoustsResponse["access"], "open" | "level_too_low">;

const CLOSED_LINES: Readonly<Record<Closed, string>> = {
  account_required: "Crée un compte pour jouter.",
  pseudo_required: "Choisis un pseudo pour jouter.",
  not_yet: "Elles arrivent bientôt pour tout le monde.",
};

/** The jousts' half: the player's league and place, then what waits for them or what is left. */
export function joustsHalf(response: JoustsResponse | null): JoustsHalf {
  if (response === null) return { league: null, lockedAt: null, lines: [], waiting: 0 };
  const { access, standing } = response;
  if (access === "level_too_low") {
    return {
      league: null,
      lockedAt: response.opensAtLevel,
      lines: [`Elles ouvrent au niveau ${response.opensAtLevel}.`],
      waiting: 0,
    };
  }
  if (access !== "open") {
    return { league: null, lockedAt: null, lines: [CLOSED_LINES[access]], waiting: 0 };
  }
  const name = LEAGUE_NAMES[standing.league];
  const place =
    standing.group === null
      ? `Tu joutes en ${name}.`
      : `Tu es ${placeText(standing.group.place)} sur ${formatCount(standing.group.size)} en ${name}.`;
  const seals = response.jousts.filter(sealed).length;
  const answers = response.jousts.filter(toAnswer).length;
  const next =
    seals > 0
      ? `${plural(seals, "pli", "plis")} à ouvrir.`
      : answers > 0
        ? `${plural(answers, "joute attend", "joutes attendent")} ta partie.`
        : standing.rankedLeft > 0
          ? `Encore ${plural(standing.rankedLeft, "joute classée", "joutes classées")} aujourd'hui.`
          : "Tes joutes classées du jour sont jouées.";
  return {
    league: standing.league,
    lockedAt: null,
    lines: [place, next],
    waiting: seals + answers,
  };
}
