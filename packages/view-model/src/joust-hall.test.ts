import type { BoardEntry, BoardResponse, JoustSummary, WeekMove } from "@leximon/contract";
import { describe, expect, it } from "vitest";
import {
  groupGlimpse,
  howOpenAtFirst,
  howSteps,
  leagueRoad,
  openedLetter,
  rankedLances,
  weekFigures,
  weekRewardLine,
  zoneChip,
} from "./joust-hall";

const size = { questions: 5, seconds: 15, choices: 4, replyHours: 24 };

describe("the lice", () => {
  it("splits the week's place and points", () => {
    expect(weekFigures({ place: 9, points: 9, size: 30, move: "up" })).toEqual({
      place: "9e",
      of: "sur 30",
      points: "9",
      pointsWord: "points",
    });
    expect(weekFigures({ place: 1, points: 1, size: 30, move: "up" })).toMatchObject({
      place: "1er",
      pointsWord: "point",
    });
    expect(weekFigures({ place: 30, points: 0, size: 30, move: "down" }).pointsWord).toBe("point");
  });

  it("names each zone", () => {
    expect(zoneChip("up")).toBe("Zone de montée");
    expect(zoneChip("stay")).toBe("Zone de maintien");
    expect(zoneChip("down")).toBe("Zone de descente");
  });

  it("stands a lance for each ranked joust left today", () => {
    expect(rankedLances(3, 5)).toEqual([true, true, true, false, false]);
    expect(rankedLances(0, 5)).toEqual([false, false, false, false, false]);
  });
});

describe("the road of the leagues", () => {
  it("lights the leagues passed and raises the player's", () => {
    const road = leagueRoad("chevalier");
    expect(road.map((stop) => stop.state)).toEqual([
      "past",
      "past",
      "here",
      "ahead",
      "ahead",
      "ahead",
      "ahead",
    ]);
    expect(road[0]).toEqual({ league: "page", name: "Page", state: "past" });
  });
});

describe("what the week gives", () => {
  it("says the rewards of the player's league once the ladder is known", () => {
    const ladder = [
      {
        league: "page" as const,
        up: 10,
        down: 0,
        rewards: [{ kind: "ecus" as const, amount: 10 }],
      },
    ];
    expect(weekRewardLine("page", ladder)).toBe(
      "Dimanche, ta semaine en Page te rapporte 10 écus.",
    );
    expect(weekRewardLine("ecuyer", ladder)).toBeNull();
    expect(weekRewardLine("page", null)).toBeNull();
  });
});

describe("the group around the player", () => {
  const moveAt = (place: number): WeekMove => (place <= 10 ? "up" : place > 29 ? "down" : "stay");
  const entry = (place: number, mine: number): BoardEntry =>
    place === mine
      ? {
          kind: "player",
          player: { code: "me", pseudo: "Moi", avatar: "a", frame: "f", level: 9 },
          place,
          points: 40 - place,
          league: "page",
          move: moveAt(place),
        }
      : { kind: "bot", bot: place, place, points: 40 - place, league: "page", move: moveAt(place) };
  const groupWith = (mine: number): BoardResponse => ({
    board: "group",
    closed: null,
    league: "ecuyer",
    moves: { up: 10, down: 1 },
    entries: Array.from({ length: 30 }, (_, index) => entry(index + 1, mine)),
    me: entry(mine, mine),
    next: null,
  });

  it("shows three places on each side, the climb line where it falls", () => {
    const glimpse = groupGlimpse(groupWith(9));
    expect(glimpse?.lines.map((line) => line.place)).toEqual([
      "6",
      "7",
      "8",
      "9",
      "10",
      "11",
      "12",
    ]);
    expect(glimpse?.upAfter).toEqual({
      key: "b-10",
      text: "Les 10 premiers montent en Chevalier dimanche",
    });
    expect(glimpse?.downFrom).toBeNull();
  });

  it("draws the fall line near the bottom of the group", () => {
    const glimpse = groupGlimpse(groupWith(28));
    expect(glimpse?.lines.map((line) => line.place)).toEqual(["25", "26", "27", "28", "29", "30"]);
    expect(glimpse?.downFrom).toEqual({ key: "b-30", text: "Le dernier descend en Page dimanche" });
    expect(glimpse?.upAfter).toBeNull();
  });

  it("has nothing to show for a player out of the group", () => {
    expect(groupGlimpse({ ...groupWith(9), me: null })).toBeNull();
  });
});

describe("how it works", () => {
  it("says the run with its numbers", () => {
    expect(howSteps(size, 3).map((step) => step.title)).toEqual([
      "Lance une joute",
      "Trouve 5 mots",
      "Gagne des points",
    ]);
    expect(howSteps(size, 3)[1]?.text).toBe(
      "Une définition et 4 mots au choix, 15 secondes pour chacun.",
    );
    expect(howSteps(size, 3)[2]?.text).toContain("Une victoire donne 3 points.");
  });

  it("folds by itself after three ranked jousts", () => {
    expect(howOpenAtFirst(0)).toBe(true);
    expect(howOpenAtFirst(2)).toBe(true);
    expect(howOpenAtFirst(3)).toBe(false);
  });
});

describe("a sealed letter, opened", () => {
  const joust: JoustSummary = {
    id: "00000000-0000-4000-8000-000000000001",
    kind: "ranked",
    launched: true,
    opponent: { code: "c", pseudo: "Alix", avatar: "a", frame: "f", level: 9 },
    state: "ended",
    replyBy: null,
    outcome: "won",
    forfeit: false,
    mine: { correct: 4, ms: 30_000 },
    theirs: { correct: 1, ms: 40_000 },
    createdAt: "2026-11-09T10:00:00.000Z",
    seen: false,
  };

  it("says the outcome and the score at once", () => {
    expect(openedLetter(joust, null)).toEqual({
      outcome: "Victoire !",
      score: "4 mots trouvés contre 1.",
      gains: [],
    });
    expect(openedLetter({ ...joust, mine: { correct: 1, ms: 1 } }, null).score).toBe(
      "1 mot trouvé contre 1.",
    );
  });

  it("adds what the joust gave once the result is known", () => {
    const result = {
      mine: [],
      theirs: [],
      xp: 12,
      boosters: 0,
      wished: [],
      tournament: { won: 3, league: "page" as const, group: null },
    };
    expect(openedLetter(joust, result).gains).toEqual(["+3 points", "+12 XP"]);
  });

  it("says who did not play in time", () => {
    expect(openedLetter({ ...joust, forfeit: true, theirs: null }, null).score).toBe(
      "La joute te revient, car Alix n'a pas joué à temps.",
    );
  });
});
