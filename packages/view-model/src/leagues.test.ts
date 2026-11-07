import type { BoardResponse, JoustStanding, LeagueResponse } from "@leximon/contract";
import { describe, expect, it } from "vitest";
import {
  boardLines,
  boardNote,
  ladderRules,
  ladderSteps,
  leagueNumeral,
  placeText,
  pointsText,
  rankedLeftText,
  ratingLine,
  standingHeader,
  tournamentGain,
  waitingReward,
  weekLeft,
  weekRecord,
  zoneStarts,
} from "./leagues";

const week = { index: 2, firstDay: "2026-11-23", lastDay: "2026-11-29" };

const standing: JoustStanding = {
  week,
  league: "chevalier",
  group: { place: 4, points: 12, size: 30, move: "up" },
  rankedLeft: 3,
  rankedPerDay: 5,
  rewardsWaiting: 0,
};

const badge = (code: string) => ({ code, pseudo: code, avatar: "a", frame: "f", level: 9 });

const ecus = (amount: number) => ({ kind: "ecus" as const, amount });

const league: LeagueResponse = {
  standing,
  ladder: [
    { league: "page", up: 10, down: 0, rewards: [ecus(10)] },
    { league: "ecuyer", up: 8, down: 3, rewards: [ecus(15)] },
    { league: "chevalier", up: 7, down: 5, rewards: [ecus(20)] },
    { league: "banneret", up: 6, down: 5, rewards: [ecus(25)] },
    { league: "marechal", up: 5, down: 6, rewards: [ecus(30)] },
    { league: "connetable", up: 4, down: 7, rewards: [ecus(35)] },
    { league: "champion", up: 0, down: 8, rewards: [ecus(40)] },
  ],
  upRewards: [{ kind: "garni_booster" }],
  podium: { places: 3, rewards: [{ kind: "precious_garni_booster" }] },
  points: { won: 3, draw: 1, lost: 0 },
  waiting: [],
  stats: { ranked: 2, wins: 0, losses: 0, draws: 0, rating: null, ratingAfter: 5 },
  generalOpen: false,
};

describe("words", () => {
  it("count points and places", () => {
    expect(pointsText(0)).toBe("0 point");
    expect(pointsText(1)).toBe("1 point");
    expect(pointsText(12)).toBe("12 points");
    expect(placeText(1)).toBe("1er");
    expect(placeText(2)).toBe("2e");
  });

  it("number the leagues on their shields, Champion crowned", () => {
    expect(leagueNumeral("page")).toBe("I");
    expect(leagueNumeral("connetable")).toBe("VI");
    expect(leagueNumeral("champion")).toBeNull();
  });

  it("say the ranked jousts left today", () => {
    expect(rankedLeftText(3)).toBe("Encore 3 joutes classées aujourd'hui");
    expect(rankedLeftText(1)).toBe("Encore 1 joute classée aujourd'hui");
    expect(rankedLeftText(0)).toBe(
      "Tes joutes classées du jour sont jouées. Les joutes libres restent ouvertes.",
    );
  });

  it("count down to Sunday midnight", () => {
    expect(weekLeft(week, "2026-11-25")).toBe("Fin du tournoi dans 4 jours");
    expect(weekLeft(week, "2026-11-28")).toBe("Fin du tournoi demain soir à minuit");
    expect(weekLeft(week, "2026-11-29")).toBe("Fin du tournoi ce soir à minuit");
  });
});

describe("standingHeader", () => {
  it("tells the place in the group and what it would give", () => {
    expect(standingHeader(standing, "2026-11-25")).toEqual({
      name: "Chevalier",
      place: "4e sur 30",
      points: "12 points",
      move: "up",
      line: "Si le tournoi finissait maintenant, tu monterais en Banneret.",
      week: "Fin du tournoi dans 4 jours",
      ranked: "Encore 3 joutes classées aujourd'hui",
      champion: null,
      waiting: null,
    });
  });

  it("asks for a ranked joust before the first of the week, and wears the Champion emblem", () => {
    const header = standingHeader(
      { ...standing, league: "champion", group: null, rewardsWaiting: 2 },
      "2026-11-25",
    );
    expect(header).toMatchObject({
      name: "Champion",
      place: null,
      points: null,
      line: "Joue une joute classée pour entrer dans le tournoi de la semaine.",
      champion: "Champion",
      waiting: "2 récompenses à réclamer",
    });
  });

  it("says a fall and a stay", () => {
    const at = (move: "down" | "stay") =>
      standingHeader({ ...standing, group: { place: 28, points: 0, size: 30, move } }, "2026-11-25")
        .line;
    expect(at("down")).toBe("Si le tournoi finissait maintenant, tu descendrais en Écuyer.");
    expect(at("stay")).toBe("Si le tournoi finissait maintenant, tu resterais en Chevalier.");
  });
});

describe("tournamentGain", () => {
  it("gives the points won and the place now", () => {
    expect(
      tournamentGain({
        won: 3,
        league: "page",
        group: { place: 1, points: 9, size: 30, move: "up" },
      }),
    ).toEqual({ points: "+3 points", place: "1er de ton groupe, 9 points", move: "up" });
    expect(tournamentGain({ won: 1, league: "page", group: null })).toEqual({
      points: "+1 point",
      place: null,
      move: null,
    });
    expect(tournamentGain({ won: 0, league: "page", group: null }).points).toBe("Aucun point");
  });
});

describe("the ladder", () => {
  it("lists the leagues from the top, with their moves and rewards", () => {
    const steps = ladderSteps(league);
    expect(steps.map((step) => step.name)).toEqual([
      "Champion",
      "Connétable",
      "Maréchal",
      "Banneret",
      "Chevalier",
      "Écuyer",
      "Page",
    ]);
    expect(steps[0]).toMatchObject({
      moves: "Personne ne monte, les 8 derniers descendent.",
      reward: "40 écus par semaine",
      here: false,
    });
    expect(steps.find((step) => step.here)?.league).toBe("chevalier");
    expect(steps.at(-1)?.moves).toBe("Les 10 premiers montent, personne ne descend.");
  });

  it("tells the rule with its numbers", () => {
    expect(ladderRules(league)).toEqual([
      "Une victoire classée rapporte 3 points, une égalité 1 point, une défaite aucun.",
      "Tu joues 5 joutes classées par jour au plus, lancées ou reçues.",
      "Le dimanche à minuit, les premiers de chaque groupe montent d'une ligue et les derniers descendent. Une semaine sans joute classée ne change rien.",
      "Monter donne en plus un sachet garni. Finir dans les 3 premiers en Champion donne en plus un sachet garni Précieux.",
      "Les automates complètent les groupes tant qu'il manque des joueurs. Ils ne joutent pas. Leurs points montent au fil de la semaine.",
    ]);
  });
});

describe("waitingReward", () => {
  it("tells last week's reward and what the place gave", () => {
    const next = waitingReward({
      ...league,
      waiting: [
        {
          week: 1,
          league: "page",
          place: 1,
          move: "up",
          rewards: [ecus(10), { kind: "garni_booster" }],
        },
      ],
    });
    expect(next).toMatchObject({
      week: 1,
      title: "10 écus et un sachet garni pour le tournoi de la semaine passée",
      detail: "Tu as fini 1er de ton groupe en Page et tu passes en Écuyer.",
      icon: "star",
      more: null,
    });
  });

  it("dates an older week and counts the rewards after", () => {
    const at = (move: "stay" | "down") => ({
      week: 0,
      league: "chevalier" as const,
      place: 12,
      move,
      rewards: [ecus(20)],
    });
    const next = waitingReward({ ...league, waiting: [at("down"), at("stay")] });
    expect(next).toMatchObject({
      title: "20 écus pour le tournoi de la semaine du 9 novembre",
      detail: "Tu as fini 12e de ton groupe en Chevalier et tu redescends en Écuyer.",
      icon: "ecu",
      more: "Encore 1 récompense après celle-ci",
    });
    expect(waitingReward(league)).toBeNull();
  });
});

describe("figures", () => {
  it("count the week's ranked jousts", () => {
    expect(weekRecord(league.stats)).toBe("Aucune joute classée cette semaine pour l'instant.");
    expect(weekRecord({ ...league.stats, wins: 1, losses: 3, draws: 1 })).toBe(
      "1 victoire, 3 défaites, 1 égalité cette semaine",
    );
  });

  it("show the rating after 5 ranked jousts", () => {
    expect(ratingLine(league.stats)).toBe(
      "Ta cote se montre après 5 joutes classées. Encore 3 joutes.",
    );
    expect(ratingLine({ ...league.stats, ranked: 4 })).toContain("Encore 1 joute.");
    expect(ratingLine({ ...league.stats, ranked: 7, rating: 1612 })).toContain("1\u202f612");
  });
});

describe("boards", () => {
  const line = (kind: "player" | "bot" | "hidden", place: number, move: "up" | "stay" | "down") =>
    kind === "player"
      ? {
          kind,
          player: badge(`P${place}`),
          place,
          points: 40 - place,
          league: "ecuyer" as const,
          move,
        }
      : kind === "bot"
        ? { kind, bot: place, place, points: 40 - place, league: "ecuyer" as const, move }
        : { kind, place, points: 40 - place, league: "ecuyer" as const, move };
  const group: BoardResponse = {
    board: "group",
    closed: null,
    league: "ecuyer",
    moves: { up: 2, down: 1 },
    entries: [line("bot", 1, "up"), line("player", 2, "up"), line("hidden", 3, "stay")],
    me: line("player", 2, "up"),
    next: null,
  };

  it("names players, automatons and hidden players, the player marked", () => {
    const { lines, pinned } = boardLines(group);
    expect(lines.map((each) => [each.name, each.tag, each.me])).toEqual([
      ["Aubin", "automate", false],
      ["P2 (toi)", null, true],
      ["Jouteur", null, false],
    ]);
    expect(pinned).toBeNull();
    expect(zoneStarts(lines)).toEqual({ stay: "h-3", down: null });
  });

  it("sets a Champion apart outside the group only", () => {
    const champion = { ...line("player", 2, "stay"), league: "champion" as const };
    expect(boardLines({ ...group, entries: [champion] }).lines[0]?.champion).toBe(false);
    expect(
      boardLines({ ...group, board: "friends", moves: null, entries: [champion] }).lines[0]
        ?.champion,
    ).toBe(true);
  });

  it("pins the player under a page that does not show them", () => {
    const { pinned } = boardLines({ ...group, entries: [line("bot", 1, "up")] });
    expect(pinned).toMatchObject({ name: "P2 (toi)", me: true, place: "2" });
    expect(boardLines({ ...group, me: null }).pinned).toBeNull();
  });

  it("explains each board", () => {
    expect(boardNote(group)).toBe(
      "Ton groupe de la ligue Écuyer. Les 2 premiers montent, le dernier descend. Les automates complètent les places libres.",
    );
    expect(boardNote({ ...group, closed: "not_entered", entries: [], me: null })).toContain(
      "Joue une joute classée",
    );
    expect(boardNote({ ...group, board: "clan", closed: "no_clan" })).toBe(
      "Rejoins un clan pour voir le classement de ses jouteurs.",
    );
    const friends = { ...group, board: "friends" as const, moves: null };
    expect(boardNote(friends)).toBe(
      "Tes amis entrés dans le tournoi de la semaine, avec toi, par ligue puis par points.",
    );
    expect(boardNote({ ...friends, me: null })).toBe(
      "Tes amis entrés dans le tournoi de la semaine, sans toi, par ligue puis par points. Joue une joute classée pour y entrer.",
    );
  });
});
