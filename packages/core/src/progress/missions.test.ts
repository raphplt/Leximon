import { describe, expect, it } from "vitest";
import { createSeededRandom } from "../random";
import { MISSION_SCHEDULE } from "../rules";
import {
  changeMission,
  claimOfDay,
  type DayActivity,
  drawMissions,
  favouriteGesture,
  GESTURE_OF,
  MISSION_KINDS,
  type MissionContext,
  type MissionKind,
  missionProgress,
  missionRulesAt,
} from "./missions";

const rules = missionRulesAt(MISSION_SCHEDULE, Date.UTC(2026, 10, 9));

const everything: MissionContext = {
  feasible: new Set(MISSION_KINDS),
  collections: ["fondateurs", "bestiaire"],
  favourite: "sachets",
  yesterday: [],
};

const idle: DayActivity = {
  sachets: 0,
  goodAnswers: 0,
  wordsWritten: 0,
  goodAnswersByCollection: {},
  riddleFound: false,
  trades: 0,
  recycles: 0,
};

function seed(n: number): string {
  return n.toString(16).padStart(32, "0");
}

describe("drawMissions", () => {
  it("draws three distinct kinds, at most one of the favourite gesture", () => {
    for (let n = 0; n < 300; n++) {
      const missions = drawMissions(rules, everything, createSeededRandom(seed(n)));
      expect(missions).toHaveLength(3);
      expect(new Set(missions.map((m) => m.kind)).size).toBe(3);
      expect(missions.filter((m) => GESTURE_OF[m.kind] === "sachets").length).toBeLessThanOrEqual(
        1,
      );
    }
  });

  it("never draws a mission the player cannot do", () => {
    const context = {
      ...everything,
      feasible: new Set<MissionKind>(["open_sachets", "riddle", "good_answers", "recycle"]),
    };
    for (let n = 0; n < 200; n++) {
      for (const mission of drawMissions(rules, context, createSeededRandom(seed(n)))) {
        expect(context.feasible.has(mission.kind)).toBe(true);
      }
    }
  });

  it("asks a collection the player has words of", () => {
    const context = {
      ...everything,
      feasible: new Set<MissionKind>(["review_collection", "riddle", "trade"]),
      collections: ["bestiaire"],
    };
    const missions = drawMissions(rules, context, createSeededRandom(seed(1)));
    expect(missions).toContainEqual({
      kind: "review_collection",
      target: 3,
      collectionId: "bestiaire",
    });
  });

  it("draws fewer missions when the player can do fewer kinds", () => {
    const context = { ...everything, feasible: new Set<MissionKind>(["open_sachets", "riddle"]) };
    expect(drawMissions(rules, context, createSeededRandom(seed(2)))).toHaveLength(2);
  });

  it("leaves yesterday's kinds out while there are others", () => {
    const yesterday: MissionKind[] = ["riddle", "good_answers", "trade"];
    for (let n = 0; n < 100; n++) {
      const missions = drawMissions(
        rules,
        { ...everything, yesterday },
        createSeededRandom(seed(n)),
      );
      for (const mission of missions) expect(yesterday).not.toContain(mission.kind);
    }
  });

  it("varies from one seed to another", () => {
    const sets = new Set<string>();
    for (let n = 0; n < 50; n++) {
      sets.add(
        drawMissions(rules, everything, createSeededRandom(seed(n)))
          .map((m) => m.kind)
          .sort()
          .join(","),
      );
    }
    expect(sets.size).toBeGreaterThan(5);
  });
});

describe("changeMission", () => {
  it("gives another kind than every mission of the day", () => {
    const missions = drawMissions(rules, everything, createSeededRandom(seed(3)));
    for (let n = 0; n < 50; n++) {
      const next = changeMission(rules, everything, missions, 1, createSeededRandom(seed(n)));
      expect(next).not.toBeNull();
      expect(missions.map((m) => m.kind)).not.toContain(next?.kind);
    }
  });

  it("gives nothing when no other kind is possible", () => {
    const context = { ...everything, feasible: new Set<MissionKind>(["open_sachets", "riddle"]) };
    const missions = drawMissions(rules, context, createSeededRandom(seed(4)));
    expect(changeMission(rules, context, missions, 0, createSeededRandom(seed(5)))).toBeNull();
  });
});

describe("favouriteGesture", () => {
  it("is the gesture of the most days, the sachet first on a tie", () => {
    expect(favouriteGesture({ sachets: 4, challenges: 6 })).toBe("challenges");
    expect(favouriteGesture({ sachets: 3, challenges: 3 })).toBe("sachets");
    expect(favouriteGesture({})).toBeNull();
  });
});

describe("missionProgress", () => {
  it("counts what the mission asks, capped at its target", () => {
    const activity = { ...idle, sachets: 5, goodAnswersByCollection: { bestiaire: 2 } };
    expect(missionProgress({ kind: "open_sachets", target: 3 }, activity)).toBe(3);
    expect(
      missionProgress(
        { kind: "review_collection", target: 3, collectionId: "bestiaire" },
        activity,
      ),
    ).toBe(2);
    expect(
      missionProgress(
        { kind: "review_collection", target: 3, collectionId: "fondateurs" },
        activity,
      ),
    ).toBe(0);
    expect(missionProgress({ kind: "riddle", target: 1 }, { ...idle, riddleFound: true })).toBe(1);
  });
});

describe("claimOfDay", () => {
  const missions = [
    { kind: "open_sachets", target: 3 },
    { kind: "riddle", target: 1 },
    { kind: "recycle", target: 1 },
  ] as const;

  it("claims the missions done and not claimed yet", () => {
    const claim = claimOfDay(
      rules,
      { day: "2026-11-09", missions, claimed: [], bonusClaimed: false },
      { ...idle, sachets: 3, recycles: 1 },
    );
    expect(claim).toEqual({ day: "2026-11-09", slots: [0, 2], bonus: false });
  });

  it("gives the bonus with the last mission of the day", () => {
    const claim = claimOfDay(
      rules,
      { day: "2026-11-09", missions, claimed: [0, 2], bonusClaimed: false },
      { ...idle, sachets: 3, recycles: 1, riddleFound: true },
    );
    expect(claim).toEqual({ day: "2026-11-09", slots: [1], bonus: true });
  });

  it("gives a bonus that waited, without a mission left", () => {
    const claim = claimOfDay(
      rules,
      { day: "2026-11-09", missions, claimed: [0, 1, 2], bonusClaimed: false },
      idle,
    );
    expect(claim).toEqual({ day: "2026-11-09", slots: [], bonus: true });
  });
});
