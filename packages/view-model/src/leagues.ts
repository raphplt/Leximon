import type {
  Board,
  BoardEntry,
  BoardResponse,
  GroupPlace,
  JoustStanding,
  JoustView,
  LeagueClaimRefusal,
  LeagueId,
  LeagueResponse,
  LevelRewardView,
  PlayerBadge,
  WeekMove,
  WeekView,
} from "@leximon/contract";
import { formatCount, plural } from "./format";
import { rewardItem, rewardsPhrase } from "./rewards";
import { playerName } from "./trades";

/** The leagues of ranked jousts: the header of the jousts' home, the ladder, the boards. */

export const LEAGUE_NAMES: Readonly<Record<LeagueId, string>> = {
  page: "Page",
  ecuyer: "Écuyer",
  chevalier: "Chevalier",
  banneret: "Banneret",
  marechal: "Maréchal",
  connetable: "Connétable",
  champion: "Champion",
};

const LEAGUE_ORDER = Object.keys(LEAGUE_NAMES) as LeagueId[];

function leagueBeside(league: LeagueId, move: WeekMove): LeagueId {
  const rank = LEAGUE_ORDER.indexOf(league) + (move === "up" ? 1 : move === "down" ? -1 : 0);
  return LEAGUE_ORDER[Math.max(0, Math.min(LEAGUE_ORDER.length - 1, rank))] ?? league;
}

const NUMERALS = ["I", "II", "III", "IV", "V", "VI"];

/** The numeral drawn on a league's shield, its rank; `null` for Champion, drawn with a crown. */
export function leagueNumeral(league: LeagueId): string | null {
  return league === "champion" ? null : (NUMERALS[LEAGUE_ORDER.indexOf(league)] ?? null);
}

/** « 12 points », « 1 point », « 0 point ». */
export function pointsText(points: number): string {
  return plural(points, "point", "points");
}

/** « 1er », « 2e ». */
export function placeText(place: number): string {
  return place === 1 ? "1er" : `${formatCount(place)}e`;
}

export const CLASSEMENT = "Classement";
export const LADDER_TITLE = "L'échelle des ligues";
export const CHAMPION_EMBLEM = "Champion";

/** What a place would give if the week ended now, in a sentence. */
export function moveSentence(league: LeagueId, move: WeekMove): string {
  switch (move) {
    case "up":
      return `Si le tournoi finissait maintenant, tu monterais en ${LEAGUE_NAMES[leagueBeside(league, "up")]}.`;
    case "down":
      return `Si le tournoi finissait maintenant, tu descendrais en ${LEAGUE_NAMES[leagueBeside(league, "down")]}.`;
    case "stay":
      return `Si le tournoi finissait maintenant, tu resterais en ${LEAGUE_NAMES[league]}.`;
  }
}

export interface StandingHeader {
  readonly name: string;
  /** « 4e sur 30 », once in the week's tournament. */
  readonly place: string | null;
  readonly points: string | null;
  readonly move: WeekMove | null;
  /** What the place would give, or how to enter the tournament. */
  readonly line: string;
  /** « Fin du tournoi dans 3 jours ». */
  readonly week: string;
  /** The ranked jousts left today. */
  readonly ranked: string;
  readonly champion: string | null;
  /** « 2 récompenses à réclamer ». */
  readonly waiting: string | null;
}

export function standingHeader(standing: JoustStanding, today: string): StandingHeader {
  const { league, group } = standing;
  return {
    name: LEAGUE_NAMES[league],
    place: group === null ? null : `${placeText(group.place)} sur ${formatCount(group.size)}`,
    points: group === null ? null : pointsText(group.points),
    move: group?.move ?? null,
    line:
      group === null
        ? "Joue une joute classée pour entrer dans le tournoi de la semaine."
        : moveSentence(league, group.move),
    week: weekLeft(standing.week, today),
    ranked: rankedLeftText(standing.rankedLeft),
    champion: league === "champion" ? CHAMPION_EMBLEM : null,
    waiting:
      standing.rewardsWaiting === 0
        ? null
        : plural(standing.rewardsWaiting, "récompense à réclamer", "récompenses à réclamer"),
  };
}

/** « Encore 3 joutes classées aujourd'hui », or what is left once they are played. */
export function rankedLeftText(left: number): string {
  if (left === 0)
    return "Tes joutes classées du jour sont jouées. Les joutes libres restent ouvertes.";
  return `Encore ${plural(left, "joute classée", "joutes classées")} aujourd'hui`;
}

const DAY_MS = 86_400_000;

function dayNumber(day: string): number {
  return Math.round(Date.parse(`${day}T00:00:00Z`) / DAY_MS);
}

/** « Fin du tournoi dans 3 jours », « demain soir », « ce soir ». `today` is the day in Paris. */
export function weekLeft(week: WeekView, today: string): string {
  const left = dayNumber(week.lastDay) - dayNumber(today);
  if (left <= 0) return "Fin du tournoi ce soir à minuit";
  if (left === 1) return "Fin du tournoi demain soir à minuit";
  return `Fin du tournoi dans ${formatCount(left)} jours`;
}

// --- A joust's points ----------------------------------------------------------------------------

export type JoustTournament = NonNullable<NonNullable<JoustView["result"]>["tournament"]>;

export interface TournamentGain {
  /** « +3 points », « +1 point », « Aucun point ». */
  readonly points: string;
  /** « 4e de ton groupe, 12 points », while the week lasts. */
  readonly place: string | null;
  readonly move: WeekMove | null;
}

export function tournamentGain(tournament: JoustTournament): TournamentGain {
  const { won, group } = tournament;
  return {
    points: won === 0 ? "Aucun point" : `+${pointsText(won)}`,
    place: group === null ? null : groupPlaceText(group),
    move: group?.move ?? null,
  };
}

function groupPlaceText(group: GroupPlace): string {
  return `${placeText(group.place)} de ton groupe, ${pointsText(group.points)}`;
}

// --- The ladder ----------------------------------------------------------------------------------

export interface LadderStep {
  readonly league: LeagueId;
  readonly name: string;
  readonly here: boolean;
  /** « Les 7 premiers montent, les 5 derniers descendent. » */
  readonly moves: string;
  /** « 20 écus par semaine ». */
  readonly reward: string;
  readonly label: string;
}

function movesText(up: number, down: number): string {
  const ups =
    up === 0
      ? "Personne ne monte"
      : up === 1
        ? "Le premier monte"
        : `Les ${formatCount(up)} premiers montent`;
  const downs =
    down === 0
      ? "personne ne descend"
      : down === 1
        ? "le dernier descend"
        : `les ${formatCount(down)} derniers descendent`;
  return `${ups}, ${downs}.`;
}

/** Every league, highest first, as the ladder shows it. */
export function ladderSteps(league: LeagueResponse): LadderStep[] {
  return [...league.ladder].reverse().map((step) => {
    const name = LEAGUE_NAMES[step.league];
    const moves = movesText(step.up, step.down);
    const reward = `${rewardsPhrase(step.rewards)} par semaine`;
    return {
      league: step.league,
      name,
      here: step.league === league.standing.league,
      moves,
      reward,
      label: `${name}. ${moves} ${capitalizeFirst(reward)}.`,
    };
  });
}

/** How the tournament works, with its numbers. */
export function ladderRules(league: LeagueResponse): readonly string[] {
  const { won, draw } = league.points;
  return [
    `Une victoire classée rapporte ${pointsText(won)}, une égalité ${pointsText(draw)}, une défaite aucun.`,
    `Tu joues ${plural(league.standing.rankedPerDay, "joute classée", "joutes classées")} par jour au plus, lancées ou reçues.`,
    "Le dimanche à minuit, les premiers de chaque groupe montent d'une ligue et les derniers descendent. Une semaine sans joute classée ne change rien.",
    `Monter donne en plus ${rewardsPhrase(league.upRewards)}. Finir dans les ${formatCount(league.podium.places)} premiers en Champion donne en plus ${rewardsPhrase(league.podium.rewards)}.`,
    "Les automates complètent les groupes tant qu'il manque des joueurs. Ils ne joutent pas : leurs points montent au fil de la semaine.",
  ];
}

function capitalizeFirst(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// --- Claiming ------------------------------------------------------------------------------------

export const LEAGUE_CLAIM = "Réclamer";
export const LEAGUE_CLAIM_BUSY = "Ouverture…";

/** The next reward to claim, oldest first, said as on its button. */
export interface WaitingReward {
  readonly week: number;
  /** « 10 écus et un sachet garni pour le tournoi de la semaine passée ». */
  readonly title: string;
  /** « 1er de ton groupe en Page : tu passes en Écuyer. » */
  readonly detail: string;
  readonly icon: ReturnType<typeof rewardItem>["icon"];
  /** « Encore 2 récompenses après celle-ci », when more wait. */
  readonly more: string | null;
  readonly rewards: readonly LevelRewardView[];
}

export function waitingReward(league: LeagueResponse): WaitingReward | null {
  const [first] = league.waiting;
  if (first === undefined) return null;
  const current = league.standing.week;
  const when =
    first.week === current.index - 1
      ? "de la semaine passée"
      : `de la semaine du ${weekStartText(first.week, current)}`;
  const where = `${placeText(first.place)} de ton groupe en ${LEAGUE_NAMES[first.league]}`;
  const moved =
    first.move === "up"
      ? `tu passes en ${LEAGUE_NAMES[leagueBeside(first.league, "up")]}`
      : first.move === "down"
        ? `tu redescends en ${LEAGUE_NAMES[leagueBeside(first.league, "down")]}`
        : `tu restes en ${LEAGUE_NAMES[first.league]}`;
  const others = league.waiting.length - 1;
  const [reward] = first.rewards.filter((each) => each.kind !== "ecus");
  return {
    week: first.week,
    title: capitalizeFirst(`${rewardsPhrase(first.rewards)} pour le tournoi ${when}`),
    detail: `${where} : ${moved}.`,
    icon: reward === undefined ? "ecu" : rewardItem(reward).icon,
    more:
      others === 0 ? null : `Encore ${plural(others, "récompense", "récompenses")} après celle-ci`,
    rewards: first.rewards,
  };
}

/** « 9 novembre »: the first day of an earlier week. */
function weekStartText(week: number, current: WeekView): string {
  const first = Date.parse(`${current.firstDay}T00:00:00Z`);
  const day = new Date(first - (current.index - week) * 7 * DAY_MS);
  return day.toLocaleDateString("fr-FR", { day: "numeric", month: "long", timeZone: "UTC" });
}

export function leagueClaimRefusalText(reason: LeagueClaimRefusal): string {
  switch (reason) {
    case "reserve_full":
      return "Ta réserve de sachets bonus est pleine. Ouvre un sachet, puis réclame cette récompense, qui t'attend.";
    case "not_reached":
      return "Cette récompense n'est pas encore là : le tournoi n'est pas fini.";
  }
}

/** Once claimed: « Tu reçois 10 écus. », the sachets said to be in the reserve. */
export function leagueClaimedToast(rewards: readonly LevelRewardView[]): string {
  const sachets = rewards.some((reward) => reward.kind !== "ecus");
  return `Tu reçois ${rewardsPhrase(rewards)}${sachets ? ", rangé dans ta réserve" : ""}.`;
}

// --- Figures -------------------------------------------------------------------------------------

/** « 4 victoires, 2 défaites cette semaine ». */
export function weekRecord(stats: LeagueResponse["stats"]): string {
  if (stats.wins + stats.losses + stats.draws === 0) {
    return "Aucune joute classée cette semaine pour l'instant.";
  }
  const parts = [
    plural(stats.wins, "victoire", "victoires"),
    plural(stats.losses, "défaite", "défaites"),
  ];
  if (stats.draws > 0) parts.push(plural(stats.draws, "égalité", "égalités"));
  return `${parts.join(", ")} cette semaine`;
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
  { id: "group", label: "Mon tournoi" },
  { id: "friends", label: "Amis" },
  { id: "clan", label: "Clan" },
  { id: "general", label: "Général" },
];

/** Names of the automatons, old names of knights and ladies. */
const AUTOMATON_NAMES = [
  "Aliénor",
  "Aubin",
  "Bertrand",
  "Blanche",
  "Clotaire",
  "Clémence",
  "Enguerrand",
  "Ermengarde",
  "Fulbert",
  "Gauvain",
  "Héloïse",
  "Hugues",
  "Iseut",
  "Lancelin",
  "Mahaut",
  "Ombeline",
  "Perceval",
  "Pernelle",
  "Roland",
  "Sibylle",
  "Tancrède",
  "Ursule",
  "Yvain",
  "Ysolde",
  "Amaury",
  "Bérengère",
  "Geoffroy",
  "Mélisende",
  "Thibaut",
  "Aude",
  "Baudouin",
  "Gisèle",
];

export const AUTOMATON = "automate";
export const HIDDEN_JOUSTER = "Jouteur";

/** A line of a board as shown. */
export interface BoardLine {
  readonly key: string;
  readonly kind: BoardEntry["kind"];
  readonly name: string;
  /** « automate » under an automaton's name. */
  readonly tag: string | null;
  readonly player: PlayerBadge | null;
  readonly place: string;
  readonly podium: boolean;
  readonly points: string;
  readonly league: LeagueId;
  readonly move: WeekMove | null;
  readonly champion: boolean;
  readonly me: boolean;
}

function isMe(entry: BoardEntry, me: BoardEntry | null): boolean {
  return (
    me !== null &&
    me.kind === "player" &&
    entry.kind === "player" &&
    entry.player.code === me.player.code
  );
}

export function boardLine(entry: BoardEntry, board: BoardResponse): BoardLine {
  const me = isMe(entry, board.me);
  const base = {
    kind: entry.kind,
    place: formatCount(entry.place),
    podium: entry.place <= 3,
    points: formatCount(entry.points),
    league: entry.league,
    move: entry.move,
    champion: entry.league === "champion",
    me,
  };
  switch (entry.kind) {
    case "player": {
      const name = playerName(entry.player);
      return {
        ...base,
        key: `p-${entry.player.code}`,
        name: me ? `${name} (toi)` : name,
        tag: null,
        player: entry.player,
      };
    }
    case "bot":
      return {
        ...base,
        key: `b-${entry.bot}`,
        name: AUTOMATON_NAMES[entry.bot % AUTOMATON_NAMES.length] ?? "Automate",
        tag: AUTOMATON,
        player: null,
      };
    case "hidden":
      return {
        ...base,
        key: `h-${entry.place}`,
        name: HIDDEN_JOUSTER,
        tag: null,
        player: null,
      };
  }
}

/** The lines of a board, with the player pinned under the page when it does not show them. */
export function boardLines(board: BoardResponse): {
  readonly lines: readonly BoardLine[];
  readonly pinned: BoardLine | null;
} {
  const lines = board.entries.map((entry) => boardLine(entry, board));
  const shown = lines.some((line) => line.me);
  return {
    lines,
    pinned: board.me === null || shown ? null : { ...boardLine(board.me, board), me: true },
  };
}

/** Where the group's zones start: the first line that stays, and the first that goes down. */
export function zoneStarts(lines: readonly BoardLine[]): {
  readonly stay: string | null;
  readonly down: string | null;
} {
  const stay = lines.findIndex((line) => line.move !== "up");
  const down = lines.findIndex((line) => line.move === "down");
  return {
    stay: stay > 0 ? (lines[stay]?.key ?? null) : null,
    down: down >= 0 ? (lines[down]?.key ?? null) : null,
  };
}

export const ZONE_UP = "Zone de montée";
export const ZONE_DOWN = "Zone de descente";

/** The line under a board: who is on it, or why it is empty. */
export function boardNote(board: BoardResponse): string {
  if (board.closed === "no_clan") return "Rejoins un clan pour voir le classement de ses jouteurs.";
  if (board.closed === "general_closed") {
    return "Le classement de toutes les ligues s'ouvrira quand 50 joueurs auront fait 5 joutes classées dans le mois.";
  }
  if (board.closed === "not_entered") {
    return "Joue une joute classée pour entrer dans le tournoi de la semaine : tu rejoindras un groupe de 30 jouteurs de ta ligue.";
  }
  switch (board.board) {
    case "group":
      return board.league === null || board.moves === null
        ? "Ton groupe du tournoi de la semaine."
        : `Ton groupe de la ligue ${LEAGUE_NAMES[board.league]}. ${movesText(board.moves.up, board.moves.down)} Les automates complètent les places libres.`;
    case "friends":
      return "Tes amis entrés dans le tournoi de la semaine, avec toi, par ligue puis par points.";
    case "clan":
      return "Les membres de ton clan entrés dans le tournoi de la semaine, avec toi, par ligue puis par points.";
    case "general":
      return "Tous les jouteurs du tournoi de la semaine, par ligue puis par points.";
  }
}
