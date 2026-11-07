import type {
  Board,
  BoardResponse,
  DivisionView,
  JoustStanding,
  LeagueClaimRefusal,
  LeagueId,
  LeagueResponse,
  LevelRewardView,
  SeasonView,
} from "@leximon/contract";
import { formatCount, plural } from "./format";
import { rewardItem, rewardsPhrase } from "./rewards";

/** The leagues of ranked jousts: the header of the jousts' home, the road, the boards. */

export const LEAGUE_NAMES: Readonly<Record<LeagueId, string>> = {
  page: "Page",
  ecuyer: "Écuyer",
  chevalier: "Chevalier",
  banneret: "Banneret",
  champion: "Champion",
};

const NUMERALS = ["", "I", "II", "III", "IV", "V"];

/** « Chevalier II », « Champion ». */
export function divisionName(division: Pick<DivisionView, "league" | "rank">): string {
  const league = LEAGUE_NAMES[division.league];
  return division.rank === null ? league : `${league} ${NUMERALS[division.rank] ?? division.rank}`;
}

/** The numeral drawn on the division's shield; `null` for Champion, drawn with a crown. */
export function divisionNumeral(division: Pick<DivisionView, "rank">): string | null {
  return division.rank === null ? null : (NUMERALS[division.rank] ?? String(division.rank));
}

/** « 742 lauriers », « 1 laurier ». */
export function laurelsText(laurels: number): string {
  return plural(laurels, "laurier", "lauriers");
}

export const CLASSEMENT = "Classement";
export const ROAD_TITLE = "La route des lauriers";

export interface StandingHeader {
  readonly name: string;
  readonly laurels: string;
  /** Share of the division filled, 0 to 1. */
  readonly share: number;
  /** « Encore 58 pour Chevalier I », or the top reached. */
  readonly next: string;
  /** « Fin de la saison dans 12 jours ». */
  readonly season: string;
  /** « 3 victoires d'affilée », shown from the second. */
  readonly streak: string | null;
  readonly champion: string | null;
  /** « 2 récompenses à réclamer ». */
  readonly waiting: string | null;
}

export function standingHeader(standing: JoustStanding, today: string): StandingHeader {
  const { laurels, division, nextDivision } = standing;
  return {
    name: divisionName(division),
    laurels: laurelsText(laurels),
    share: divisionShare(laurels, division, nextDivision),
    next:
      nextDivision === null
        ? "Tu es dans la plus haute ligue."
        : `Encore ${formatCount(nextDivision.from - laurels)} pour ${divisionName(nextDivision)}`,
    season: seasonLeft(standing.season, today),
    streak:
      standing.streak >= 2 ? `${formatCount(standing.streak)} victoires classées d'affilée` : null,
    champion: standing.champion ? "Champion de la saison passée" : null,
    waiting:
      standing.rewardsWaiting === 0
        ? null
        : plural(standing.rewardsWaiting, "récompense à réclamer", "récompenses à réclamer"),
  };
}

export function divisionShare(
  laurels: number,
  division: Pick<DivisionView, "from">,
  next: Pick<DivisionView, "from"> | null,
): number {
  if (next === null) return 1;
  return Math.max(0, Math.min(1, (laurels - division.from) / (next.from - division.from)));
}

const DAY_MS = 86_400_000;

function dayNumber(day: string): number {
  return Math.round(Date.parse(`${day}T00:00:00Z`) / DAY_MS);
}

/** « Fin de la saison dans 12 jours », « demain », « ce soir ». `today` is the day in Paris. */
export function seasonLeft(season: SeasonView, today: string): string {
  const left = dayNumber(season.lastDay) - dayNumber(today);
  if (left <= 0) return "Fin de la saison ce soir";
  if (left === 1) return "Fin de la saison demain soir";
  return `Fin de la saison dans ${formatCount(left)} jours`;
}

// --- A joust's laurels ---------------------------------------------------------------------------

/** « +25 lauriers », « −15 lauriers », or nothing when a draw or the floor left them as they were. */
export function laurelsDelta(laurels: { readonly before: number; readonly after: number }): string {
  const delta = laurels.after - laurels.before;
  if (delta === 0) return "Lauriers inchangés";
  const amount = laurelsText(Math.abs(delta));
  return delta > 0 ? `+${amount}` : `−${amount}`;
}

// --- The road ------------------------------------------------------------------------------------

export type LeagueStopStatus = "claimed" | "waiting" | "reached" | "later";

export interface LeagueStop {
  readonly key: number;
  readonly name: string;
  readonly league: LeagueId;
  readonly numeral: string | null;
  readonly from: string;
  readonly here: boolean;
  readonly reached: boolean;
  readonly status: LeagueStopStatus;
  /** « 20 écus », « un sachet garni »; `null` for the start. */
  readonly reward: string | null;
  readonly icon: ReturnType<typeof rewardItem>["icon"] | null;
  /** Under the stop's icon: « 20 » écus, « garni » for a sachet. */
  readonly short: string | null;
  /** « Chevalier I, 800 lauriers, 20 écus, à réclamer ». */
  readonly label: string;
}

export function roadStops(league: LeagueResponse): LeagueStop[] {
  const { laurels, division } = league.standing;
  return league.road.map((stop) => {
    const reached = laurels >= stop.division.from || stop.rewarded;
    const status: LeagueStopStatus = stop.claimed
      ? "claimed"
      : stop.rewarded
        ? "waiting"
        : reached
          ? "reached"
          : "later";
    const [first] = stop.rewards;
    const reward = stop.rewards.length === 0 ? null : rewardsPhrase(stop.rewards);
    const name = divisionName(stop.division);
    const said =
      status === "claimed"
        ? "réclamée"
        : status === "waiting"
          ? "à réclamer"
          : status === "reached"
            ? "atteinte"
            : "à venir";
    return {
      key: stop.division.index,
      name,
      league: stop.division.league,
      numeral: divisionNumeral(stop.division),
      from: formatCount(stop.division.from),
      here: stop.division.index === division.index,
      reached,
      status,
      reward,
      icon: first === undefined ? null : rewardItem(first).icon,
      short: first === undefined ? null : shortReward(first),
      label: [name, laurelsText(stop.division.from), reward, reward === null ? null : said]
        .filter((part) => part !== null)
        .join(", "),
    };
  });
}

function shortReward(reward: LevelRewardView): string {
  switch (reward.kind) {
    case "ecus":
      return formatCount(reward.amount);
    case "precious_garni_booster":
      return "Précieux";
    case "garni_booster":
      return "garni";
    default:
      return rewardItem(reward).title;
  }
}

export const SEASON_END_KICKER = "En fin de saison, selon ta ligue";
export const SEASON_RULE =
  "Une défaite coûte plus de lauriers à chaque ligue : 15 en Page, 20 en Écuyer, 23 en Chevalier, 26 en Banneret et 30 en Champion. Pendant la saison, tu ne descends jamais sous le début de la ligue atteinte. À la fin de la saison, tu repars une ligue plus bas.";
export const ROAD_RULE =
  "Une division atteinte pour la première fois dans la saison donne 20 écus, une nouvelle ligue un sachet garni.";

export function seasonRewardLines(league: LeagueResponse): readonly {
  readonly league: LeagueId;
  readonly name: string;
  readonly reward: string;
  readonly here: boolean;
}[] {
  return league.seasonRewards.map((entry) => ({
    league: entry.league,
    name: LEAGUE_NAMES[entry.league],
    reward: capitalizeFirst(
      `${rewardsPhrase(entry.rewards)}${entry.league === "champion" ? " et l'emblème de Champion" : ""}`,
    ),
    here: entry.league === league.standing.division.league,
  }));
}

function capitalizeFirst(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// --- Claiming ------------------------------------------------------------------------------------

export const LEAGUE_CLAIM = "Réclamer";
export const LEAGUE_CLAIM_BUSY = "Ouverture…";

/** The next reward to claim, oldest first, said as on its button. */
export interface WaitingReward {
  readonly season: number;
  readonly step: number;
  /** « 20 écus pour avoir atteint Chevalier II ». */
  readonly title: string;
  readonly icon: ReturnType<typeof rewardItem>["icon"];
  /** « Encore 9 récompenses après celle-ci », when more wait. */
  readonly more: string | null;
  readonly rewards: readonly LevelRewardView[];
}

/** The next reward to claim, oldest first, said as on its button. */
export function waitingReward(league: LeagueResponse): WaitingReward | null {
  const [first] = league.waiting;
  if (first === undefined) return null;
  const current = league.standing.season.index;
  const what = rewardsPhrase(first.rewards);
  const division = league.road.find((stop) => stop.division.index === first.step)?.division;
  const when =
    first.season === current
      ? ""
      : first.season === current - 1
        ? " la saison passée"
        : ` pendant la saison du ${seasonStartText(first.season, league.standing.season)}`;
  const title =
    first.step === 0
      ? `${what} pour ta ligue à la fin de la saison${first.season === current - 1 ? " passée" : ` du ${seasonStartText(first.season, league.standing.season)}`}`
      : `${what} pour avoir atteint ${division === undefined ? "une division" : divisionName(division)}${when}`;
  const others = league.waiting.length - 1;
  const [reward] = first.rewards;
  return {
    season: first.season,
    step: first.step,
    title: capitalizeFirst(title),
    icon: reward === undefined ? "sachet" : rewardItem(reward).icon,
    more:
      others === 0 ? null : `Encore ${plural(others, "récompense", "récompenses")} après celle-ci`,
    rewards: first.rewards,
  };
}

/** « 12 octobre »: the first day of an earlier season, counted back from the current one. */
function seasonStartText(season: number, current: SeasonView): string {
  const first = Date.parse(`${current.firstDay}T00:00:00Z`);
  const length = Date.parse(`${current.lastDay}T00:00:00Z`) - first + DAY_MS;
  const day = new Date(first - (current.index - season) * length);
  return day.toLocaleDateString("fr-FR", { day: "numeric", month: "long", timeZone: "UTC" });
}

export function leagueClaimRefusalText(reason: LeagueClaimRefusal): string {
  switch (reason) {
    case "reserve_full":
      return "Ta réserve de sachets bonus est pleine. Ouvre un sachet, puis réclame cette récompense, qui t'attend.";
    case "not_reached":
      return "Cette récompense n'est pas encore atteinte.";
  }
}

// --- Figures -------------------------------------------------------------------------------------

/** « 12 victoires, 9 défaites, 1 égalité cette saison ». */
export function seasonRecord(stats: LeagueResponse["stats"]): string {
  if (stats.wins + stats.losses + stats.draws === 0) {
    return "Aucune joute classée cette saison pour l'instant.";
  }
  const parts = [
    plural(stats.wins, "victoire", "victoires"),
    plural(stats.losses, "défaite", "défaites"),
  ];
  if (stats.draws > 0) parts.push(plural(stats.draws, "égalité", "égalités"));
  return `${parts.join(", ")} cette saison`;
}

/** The rating, for the curious, once enough ranked jousts are played. */
export function ratingLine(stats: LeagueResponse["stats"]): string {
  if (stats.rating !== null) {
    return `Ta cote est de ${formatCount(stats.rating)}. Elle choisit des adversaires de ta force et ne se remet jamais à zéro.`;
  }
  const left = stats.ratingAfter - stats.ranked;
  return `Ta cote se montre après ${formatCount(stats.ratingAfter)} joutes classées. Encore ${plural(left, "joute", "joutes")}.`;
}

// --- Boards --------------------------------------------------------------------------------------

export const BOARDS: readonly { readonly id: Board; readonly label: string }[] = [
  { id: "league", label: "Ma ligue" },
  { id: "friends", label: "Amis" },
  { id: "clan", label: "Clan" },
  { id: "general", label: "Général" },
];

/** The line under a board: who is on it, or why it is empty. */
export function boardNote(board: BoardResponse): string {
  if (board.closed === "no_clan") return "Rejoins un clan pour voir le classement de ses jouteurs.";
  if (board.closed === "general_closed") {
    return "Le classement de toutes les ligues s'ouvrira quand 50 joueurs auront fait 5 joutes classées dans le mois.";
  }
  switch (board.board) {
    case "league":
      return board.league === null
        ? "Les jouteurs de ta ligue cette saison."
        : `Les jouteurs de la ligue ${LEAGUE_NAMES[board.league]} cette saison.`;
    case "friends":
      return "Tes amis qui ont déjà jouté, avec toi.";
    case "clan":
      return "Les membres de ton clan qui ont déjà jouté, avec toi.";
    case "general":
      return "Tous les jouteurs de la saison.";
  }
}

/** The player is not on the page shown: their line is pinned under it. */
export function meOutsidePage(board: BoardResponse): boolean {
  return !board.entries.some((entry) => entry.player.code === board.me.player.code);
}

/** Once claimed: « Tu reçois 20 écus. », the sachets said to be in the reserve. */
export function leagueClaimedToast(rewards: readonly LevelRewardView[]): string {
  const sachets = rewards.some((reward) => reward.kind !== "ecus");
  return `Tu reçois ${rewardsPhrase(rewards)}${sachets ? ", rangé dans ta réserve" : ""}.`;
}
