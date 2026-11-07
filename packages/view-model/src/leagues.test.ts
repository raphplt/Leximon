import type { BoardResponse, JoustStanding, LeagueResponse } from "@leximon/contract";
import { describe, expect, it } from "vitest";
import { formatCount } from "./format";
import {
  boardNote,
  divisionName,
  laurelsDelta,
  meOutsidePage,
  ratingLine,
  roadStops,
  seasonLeft,
  seasonRecord,
  seasonRewardLines,
  standingHeader,
  waitingReward,
} from "./leagues";

const season = { index: 0, firstDay: "2026-11-09", lastDay: "2026-12-06" };
const chevalierII = { league: "chevalier", rank: 2, from: 700, index: 7 } as const;
const chevalierI = { league: "chevalier", rank: 1, from: 800, index: 8 } as const;

const standing: JoustStanding = {
  season,
  laurels: 742,
  division: chevalierII,
  nextDivision: chevalierI,
  streak: 0,
  champion: false,
  rewardsWaiting: 0,
};

const badge = (code: string) => ({ code, pseudo: code, avatar: "a", frame: "f", level: 9 });

describe("standingHeader", () => {
  it("names the division and what is left to the next one", () => {
    expect(standingHeader(standing, "2026-11-24")).toEqual({
      name: "Chevalier II",
      laurels: "742 lauriers",
      share: 0.42,
      next: "Encore 58 pour Chevalier I",
      season: "Fin de la saison dans 12 jours",
      streak: null,
      champion: null,
      waiting: null,
    });
  });

  it("tells the top, the streak, the emblem and the rewards waiting", () => {
    const header = standingHeader(
      {
        ...standing,
        laurels: 1330,
        division: { league: "champion", rank: null, from: 1200, index: 12 },
        nextDivision: null,
        streak: 3,
        champion: true,
        rewardsWaiting: 1,
      },
      "2026-12-06",
    );
    expect(header).toMatchObject({
      name: "Champion",
      share: 1,
      next: "Tu es dans la plus haute ligue.",
      season: "Fin de la saison ce soir",
      streak: "3 victoires classées d'affilée",
      champion: "Champion de la saison passée",
      waiting: "1 récompense à réclamer",
    });
  });
});

describe("texts", () => {
  it("names divisions", () => {
    expect(divisionName({ league: "page", rank: 3 })).toBe("Page III");
    expect(divisionName({ league: "ecuyer", rank: 1 })).toBe("Écuyer I");
  });

  it("counts the days left in the season", () => {
    expect(seasonLeft(season, "2026-12-05")).toBe("Fin de la saison demain soir");
    expect(seasonLeft(season, "2026-11-09")).toBe("Fin de la saison dans 27 jours");
  });

  it("tells the laurels of a joust", () => {
    expect(laurelsDelta({ before: 650, after: 675 })).toBe("+25 lauriers");
    expect(laurelsDelta({ before: 650, after: 649 })).toBe("−1 laurier");
    expect(laurelsDelta({ before: 600, after: 600 })).toBe("Lauriers inchangés");
  });
});

const league: LeagueResponse = {
  standing,
  road: [
    {
      division: { league: "page", rank: 3, from: 0, index: 0 },
      rewards: [],
      rewarded: false,
      claimed: false,
    },
    {
      division: { league: "page", rank: 2, from: 100, index: 1 },
      rewards: [{ kind: "ecus", amount: 20 }],
      rewarded: true,
      claimed: true,
    },
    {
      division: chevalierII,
      rewards: [{ kind: "ecus", amount: 20 }],
      rewarded: true,
      claimed: false,
    },
    {
      division: chevalierI,
      rewards: [{ kind: "ecus", amount: 20 }],
      rewarded: false,
      claimed: false,
    },
  ],
  seasonRewards: [
    { league: "page", rewards: [{ kind: "bonus_booster" }] },
    { league: "chevalier", rewards: [{ kind: "garni_booster" }] },
    { league: "champion", rewards: [{ kind: "precious_garni_booster" }] },
  ],
  waiting: [{ season: 0, step: 7, rewards: [{ kind: "ecus", amount: 20 }] }],
  stats: { ranked: 3, wins: 2, losses: 1, draws: 0, rating: null, ratingAfter: 5 },
  generalOpen: false,
};

describe("the road", () => {
  it("marks each stop claimed, waiting, reached or later", () => {
    const stops = roadStops(league);
    expect(stops.map((stop) => [stop.name, stop.status, stop.here])).toEqual([
      ["Page III", "reached", false],
      ["Page II", "claimed", false],
      ["Chevalier II", "waiting", true],
      ["Chevalier I", "later", false],
    ]);
    expect(stops[2]?.label).toBe("Chevalier II, 700 lauriers, 20 écus, à réclamer");
    expect(stops[0]?.reward).toBeNull();
  });

  it("says the end of season rewards", () => {
    expect(seasonRewardLines(league).map((line) => [line.name, line.reward, line.here])).toEqual([
      ["Page", "Un sachet bonus", false],
      ["Chevalier", "Un sachet garni", true],
      ["Champion", "Un sachet garni Précieux et l'emblème de Champion", false],
    ]);
  });

  it("names the next reward to claim", () => {
    expect(waitingReward(league)).toMatchObject({
      season: 0,
      step: 7,
      title: "20 écus pour avoir atteint Chevalier II",
      icon: "ecu",
      more: null,
    });
    expect(
      waitingReward({
        ...league,
        waiting: [{ season: -1, step: 0, rewards: [{ kind: "garni_booster" }] }],
      })?.title,
    ).toBe("Un sachet garni pour ta ligue à la fin de la saison passée");
    const older = waitingReward({
      ...league,
      waiting: [
        { season: -2, step: 0, rewards: [{ kind: "garni_booster" }] },
        { season: -2, step: 4, rewards: [{ kind: "ecus", amount: 20 }] },
      ],
    });
    expect(older?.title).toBe(
      "Un sachet garni pour ta ligue à la fin de la saison du 14 septembre",
    );
    expect(older?.more).toBe("Encore 1 récompense après celle-ci");
    expect(
      waitingReward({
        ...league,
        waiting: [{ season: -2, step: 7, rewards: [{ kind: "ecus", amount: 20 }] }],
      })?.title,
    ).toBe("20 écus pour avoir atteint Chevalier II pendant la saison du 14 septembre");
    expect(waitingReward({ ...league, waiting: [] })).toBeNull();
  });
});

describe("figures", () => {
  it("counts the season and hides the rating until enough jousts", () => {
    expect(seasonRecord(league.stats)).toBe("2 victoires, 1 défaite cette saison");
    expect(ratingLine(league.stats)).toBe(
      "Ta cote se montre après 5 joutes classées. Encore 2 joutes.",
    );
    expect(ratingLine({ ...league.stats, ranked: 7, rating: 1532 })).toBe(
      `Ta cote est de ${formatCount(1532)}. Elle choisit des adversaires de ta force et ne se remet jamais à zéro.`,
    );
    expect(seasonRecord({ ...league.stats, wins: 0, losses: 0 })).toBe(
      "Aucune joute classée cette saison pour l'instant.",
    );
  });
});

describe("boards", () => {
  const me = {
    player: badge("ME"),
    place: 9,
    laurels: 640,
    division: chevalierII,
    champion: false,
  };
  const board: BoardResponse = {
    board: "league",
    closed: null,
    league: "chevalier",
    entries: [{ ...me, player: badge("OTHER"), place: 1 }],
    me,
    next: null,
  };

  it("says who is on the board, or why it is empty", () => {
    expect(boardNote(board)).toBe("Les jouteurs de la ligue Chevalier cette saison.");
    expect(boardNote({ ...board, board: "clan", closed: "no_clan" })).toBe(
      "Rejoins un clan pour voir le classement de ses jouteurs.",
    );
  });

  it("pins the player under a page that does not show them", () => {
    expect(meOutsidePage(board)).toBe(true);
    expect(meOutsidePage({ ...board, entries: [me] })).toBe(false);
  });
});
