import type { MissionsResponse } from "@leximon/contract";
import { describe, expect, it } from "vitest";
import {
  missionChangeConfirm,
  missionLine,
  missionsClaimAction,
  missionsClaimedToast,
  missionsDoneLine,
  missionsHeadline,
  missionsHelp,
  missionsLockedLine,
} from "./missions";

const names = (id: string) => (id === "bestiaire" ? "Bestiaire" : null);

function missions(over: Partial<MissionsResponse> = {}): MissionsResponse {
  return {
    opensAtLevel: 2,
    day: "2026-11-09",
    missions: [
      { kind: "open_sachets", target: 3, progress: 1, claimed: false },
      { kind: "riddle", target: 1, progress: 1, claimed: false },
      { kind: "recycle", target: 1, progress: 1, claimed: true },
    ],
    canChange: true,
    bonusClaimed: false,
    claimable: { missions: 1, bonus: 0 },
    rewards: { xp: 30, ecus: 10, allDoneBoosters: 1 },
    ...over,
  };
}

describe("missionLine", () => {
  it("says the mission, its figure and where it stands", () => {
    const line = missionLine(
      { kind: "open_sachets", target: 3, progress: 1, claimed: false },
      names,
    );
    expect(line).toMatchObject({
      text: "Ouvre 3 sachets",
      figure: "1 / 3",
      state: "todo",
      place: "play",
      label: "Ouvre 3 sachets, 1 sur 3",
    });
  });

  it("agrees with one and many", () => {
    expect(
      missionLine({ kind: "open_sachets", target: 1, progress: 0, claimed: false }, names).text,
    ).toBe("Ouvre 1 sachet");
    expect(
      missionLine({ kind: "good_answers", target: 1, progress: 0, claimed: false }, names).text,
    ).toBe("Donne 1 bonne réponse aux défis");
    expect(missionLine({ kind: "trade", target: 1, progress: 0, claimed: false }, names).text).toBe(
      "Conclus un échange",
    );
  });

  it("names the collection of a review", () => {
    const line = missionLine(
      {
        kind: "review_collection",
        target: 3,
        collectionId: "bestiaire",
        progress: 3,
        claimed: false,
      },
      names,
    );
    expect(line).toMatchObject({
      text: "Révise juste 3 mots de Bestiaire",
      state: "done",
    });
  });

  it("shows a kind it does not know rather than failing", () => {
    const line = missionLine({ kind: "duel", target: 1, progress: 0, claimed: false }, names);
    expect(line).toMatchObject({
      place: null,
      text: "Mets Leximon à jour pour découvrir cette mission.",
    });
  });

  it("sends a joust mission to the jousts", () => {
    const line = missionLine({ kind: "joust", target: 1, progress: 0, claimed: false }, names);
    expect(line).toMatchObject({ place: "jousts", text: "Joue une joute" });
  });
});

describe("missions texts", () => {
  it("counts the missions done, for one and many", () => {
    expect(missionsHeadline(missions())).toBe("2 missions faites sur 3");
    const one = missions().missions.map((m, slot) => ({
      ...m,
      progress: slot === 0 ? 3 : 0,
      claimed: false,
    }));
    expect(missionsHeadline(missions({ missions: one }))).toBe("1 mission faite sur 3");
    const none = missions().missions.map((m) => ({ ...m, progress: 0, claimed: false }));
    expect(missionsHeadline(missions({ missions: none }))).toBe("0 mission faite sur 3");
  });

  it("lists what the missions give, each and all together", () => {
    expect(missionsHelp(missions())).toEqual([
      { label: "Chaque mission", xp: 30, ecus: 10, boosters: 0 },
      { label: "Les 3 missions faites", xp: 0, ecus: 0, boosters: 1 },
    ]);
    expect(missionsHelp(missions({ missions: missions().missions.slice(0, 1) }))[1]?.label).toBe(
      "La mission faite",
    );
  });

  it("says what a change does before it is made", () => {
    expect(missionChangeConfirm({ text: "Ouvre 3 sachets" })).toBe(
      "« Ouvre 3 sachets » laisse place à une autre mission, tirée au sort. Tu ne peux changer qu'une mission par jour.",
    );
  });

  it("puts what a claim gives in its button", () => {
    expect(missionsClaimAction(missions())).toBe("Prendre 30 XP et 10 écus");
    expect(missionsClaimAction(missions({ claimable: { missions: 2, bonus: 1 } }))).toBe(
      "Prendre 60 XP, 20 écus et un sachet bonus",
    );
    expect(missionsClaimAction(missions({ claimable: { missions: 0, bonus: 1 } }))).toBe(
      "Prendre un sachet bonus",
    );
    expect(missionsClaimAction(missions({ claimable: { missions: 0, bonus: 0 } }))).toBeNull();
  });

  it("says when missions open, and when the day's are done", () => {
    expect(missionsLockedLine(missions({ day: null, missions: [] }))).toBe(
      "Les missions du jour commencent au niveau 2.",
    );
    expect(missionsDoneLine(missions())).toBeNull();
    const done = missions().missions.map((m) => ({ ...m, claimed: true }));
    expect(missionsDoneLine(missions({ missions: done }))).toBe("Nouvelles missions demain");
  });

  it("toasts what was won", () => {
    const base = {
      missions: 3,
      ecus: 30,
      boosters: 1,
      bonusWaiting: false,
      wallet: {
        stored: 1,
        nextRefillAt: null,
        bonus: 1,
        garni: 0,
        bonusCap: 10,
        capacity: 8,
        ecus: 30,
      },
      progress: {
        xp: 300,
        level: 3,
        xpIntoLevel: 0,
        xpForNextLevel: 240,
        xpGained: 90,
        levelUp: false,
      },
    };
    expect(missionsClaimedToast(base)).toBe("Tu as gagné 90 XP, 30 écus et un sachet bonus !");
    expect(
      missionsClaimedToast({
        ...base,
        missions: 0,
        ecus: 0,
        boosters: 0,
        bonusWaiting: true,
        progress: { ...base.progress, xpGained: 0 },
      }),
    ).toBe(
      "Ta réserve de sachets bonus est pleine. Ouvre un sachet bonus pour prendre celui des missions.",
    );
  });
});
