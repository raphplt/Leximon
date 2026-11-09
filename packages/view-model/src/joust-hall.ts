import type {
  BoardResponse,
  GroupPlace,
  JoustSummary,
  JoustView,
  LeagueId,
  LeagueResponse,
  WeekMove,
} from "@leximon/contract";
import { formatCount, plural } from "./format";
import { forfeitLine, outcomeWord, type RunSize, sachetGainText, xpGainText } from "./jousts";
import {
  type BoardLine,
  boardLines,
  LEAGUE_NAMES,
  placeText,
  pointsText,
  tournamentGain,
  ZONE_DOWN,
  ZONE_UP,
} from "./leagues";

/** The jousts' hall: the lice, the road of the leagues, the group around the player, how it works. */

const LEAGUE_ORDER = Object.keys(LEAGUE_NAMES) as LeagueId[];

function leagueAt(league: LeagueId, step: number): LeagueId {
  const rank = LEAGUE_ORDER.indexOf(league) + step;
  return LEAGUE_ORDER[Math.max(0, Math.min(LEAGUE_ORDER.length - 1, rank))] ?? league;
}

// --- The lice ------------------------------------------------------------------------------------

export interface WeekFigures {
  /** « 9e ». */
  readonly place: string;
  /** « sur 30 ». */
  readonly of: string;
  /** « 9 », and its word, « points ». */
  readonly points: string;
  readonly pointsWord: string;
}

export function weekFigures(group: GroupPlace): WeekFigures {
  return {
    place: placeText(group.place),
    of: `sur ${formatCount(group.size)}`,
    points: formatCount(group.points),
    pointsWord: group.points <= 1 ? "point" : "points",
  };
}

export const ZONE_STAY = "Zone de maintien";

/** The zone the player's place falls in, as its chip says it. */
export function zoneChip(move: WeekMove): string {
  switch (move) {
    case "up":
      return ZONE_UP;
    case "stay":
      return ZONE_STAY;
    case "down":
      return ZONE_DOWN;
  }
}

/** The ranked jousts of the day, as lances: one standing for each still to play. */
export function rankedLances(left: number, perDay: number): readonly boolean[] {
  return Array.from({ length: perDay }, (_, index) => index < left);
}

// --- The road of the leagues ---------------------------------------------------------------------

export const LEAGUE_ROAD = "Le chemin des ligues";
export const SEE_LEAGUES = "Voir les ligues";
export const YOU = "Toi";

export interface LeagueRoadStop {
  readonly league: LeagueId;
  readonly name: string;
  readonly state: "past" | "here" | "ahead";
  /** The écus a week in it gives; `null` while the ladder loads. */
  readonly ecus: number | null;
}

/** Every league, lowest first, the player's own raised. */
export function leagueRoad(
  current: LeagueId,
  ladder: LeagueResponse["ladder"] | null,
): readonly LeagueRoadStop[] {
  const here = LEAGUE_ORDER.indexOf(current);
  return LEAGUE_ORDER.map((league, index) => {
    const rewards = ladder?.find((step) => step.league === league)?.rewards;
    return {
      league,
      name: LEAGUE_NAMES[league],
      state: index < here ? "past" : index === here ? "here" : "ahead",
      ecus:
        rewards === undefined
          ? null
          : rewards.reduce((sum, reward) => sum + (reward.kind === "ecus" ? reward.amount : 0), 0),
    };
  });
}

/** What the road says to a screen reader. */
export function roadLabel(current: LeagueId): string {
  return `Les sept ligues, de Page à Champion. Tu es en ${LEAGUE_NAMES[current]}.`;
}

// --- The group around the player -----------------------------------------------------------------

export const MY_GROUP = "Ton groupe";

export interface GroupGlimpse {
  /** The player and up to three places on each side. */
  readonly lines: readonly BoardLine[];
  /** The line after which the climb stops, and what it says; `null` when it falls off the glimpse. */
  readonly upAfter: { readonly key: string; readonly text: string } | null;
  /** The line from which the fall starts, and what it says. */
  readonly downFrom: { readonly key: string; readonly text: string } | null;
}

/** The player's neighbours in the week's group, with the zone lines where they fall. */
export function groupGlimpse(board: BoardResponse, around = 3): GroupGlimpse | null {
  const { lines } = boardLines(board);
  const mine = lines.findIndex((line) => line.me);
  if (mine < 0 || board.league === null) return null;
  const first = Math.max(0, mine - around);
  const shown = lines.slice(first, mine + around + 1);
  const lastUp = lines.reduce((last, line, index) => (line.move === "up" ? index : last), -1);
  const firstDown = lines.findIndex((line) => line.move === "down");
  const inside = (index: number) => index >= first && index < first + shown.length;
  const up = board.moves?.up ?? 0;
  const down = board.moves?.down ?? 0;
  const upper = LEAGUE_NAMES[leagueAt(board.league, 1)];
  const lower = LEAGUE_NAMES[leagueAt(board.league, -1)];
  const upLine = lines[lastUp];
  const downLine = lines[firstDown];
  return {
    lines: shown,
    upAfter:
      upLine !== undefined && inside(lastUp) && inside(lastUp + 1)
        ? {
            key: upLine.key,
            text:
              up === 1
                ? `Le premier monte en ${upper} dimanche`
                : `Les ${formatCount(up)} premiers montent en ${upper} dimanche`,
          }
        : null,
    downFrom:
      downLine !== undefined && inside(firstDown) && inside(firstDown - 1)
        ? {
            key: downLine.key,
            text:
              down === 1
                ? `Le dernier descend en ${lower} dimanche`
                : `Les ${formatCount(down)} derniers descendent en ${lower} dimanche`,
          }
        : null,
  };
}

// --- How it works --------------------------------------------------------------------------------

export const HOW_TITLE = "Comment ça marche";
export const HOW_FOLD = "Replier";

/** The strip folds by itself once the player has played this many ranked jousts. */
const HOW_FOLDS_AFTER = 3;

export function howOpenAtFirst(rankedPlayed: number): boolean {
  return rankedPlayed < HOW_FOLDS_AFTER;
}

export interface HowStep {
  readonly icon: "jousts" | "candle" | "ecu";
  readonly title: string;
  readonly text: string;
}

/** The three steps of a ranked joust; `won` is what a victory gives, once the ladder is loaded. */
export function howSteps(size: RunSize, won: number | null): readonly HowStep[] {
  return [
    {
      icon: "jousts",
      title: "Lance une joute",
      text: "Le jeu te trouve un adversaire de ta ligue.",
    },
    {
      icon: "candle",
      title: `Trouve ${plural(size.questions, "mot", "mots")}`,
      text: `Une définition et ${formatCount(size.choices)} mots au choix, ${formatCount(size.seconds)} secondes pour chacun.`,
    },
    {
      icon: "ecu",
      title: "Gagne des points",
      text:
        won === null
          ? "Une victoire donne des points. Les premiers de chaque groupe montent de ligue le dimanche."
          : `Une victoire donne ${pointsText(won)}. Les premiers de chaque groupe montent de ligue le dimanche.`,
    },
  ];
}

// --- A sealed letter, opened -------------------------------------------------------------------

export const OPEN_LETTER = "Ouvrir";
export const LETTER_DETAIL = "Voir le détail";

export interface OpenedLetter {
  /** « Victoire ! », « Défaite », « Égalité ». */
  readonly outcome: string;
  /** « 4 mots trouvés contre 3. », or why the joust ended without a run. */
  readonly score: string;
  /** What the joust gave, once the result is known: « +3 points », « +12 XP », « +1 sachet ». */
  readonly gains: readonly string[];
}

/** The back of a sealed letter: the outcome at once, the gains once the result is fetched. */
export function openedLetter(
  joust: JoustSummary,
  result: JoustView["result"] | null,
): OpenedLetter {
  const score =
    joust.forfeit || joust.mine === null || joust.theirs === null
      ? forfeitLine(joust)
      : `${plural(joust.mine.correct, "mot trouvé", "mots trouvés")} contre ${joust.theirs.correct}.`;
  const gains =
    result === null
      ? []
      : [
          ...(result.tournament === null ? [] : [tournamentGain(result.tournament).points]),
          ...(result.xp > 0 ? [xpGainText(result.xp)] : []),
          ...(result.boosters > 0 ? [sachetGainText(result.boosters)] : []),
        ];
  return { outcome: outcomeWord(joust.outcome, true), score, gains };
}
