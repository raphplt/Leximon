import { xpToReach } from "@leximon/core";
import { describe, expect, it } from "vitest";
import {
  claimedToast,
  coffretAction,
  coffretHint,
  coffretsLabel,
  levelDetail,
  reserveLabel,
  rewardSummary,
  roadLayout,
  roadNodes,
  upcomingRewards,
  waitingCoffrets,
} from "./rewards";

const NOW = Date.UTC(2026, 9, 22);
const progress = (level: number, extra = 0) => ({
  xp: xpToReach(level) + extra,
  level,
  xpIntoLevel: extra,
  xpForNextLevel: 100 + 20 * (level - 1),
});

describe("level rewards", () => {
  it("sums up what each level gives", () => {
    expect(rewardSummary(1, NOW)).toBe("Départ");
    expect(rewardSummary(2, NOW)).toBe("Recharge");
    expect(rewardSummary(3, NOW)).toBe("Sachet bonus");
    expect(rewardSummary(15, NOW)).toBe("Sachet garni · Titre");
    expect(rewardSummary(20, NOW)).toBe(
      "Sachet garni · Réserve +1 · Avatar gravé · Cadre · Place épinglée +1",
    );
  });

  it("lists the coffrets waiting, lowest first", () => {
    expect(waitingCoffrets(6, [2, 4])).toEqual([3, 5, 6]);
    expect(coffretsLabel(1)).toBe("1 coffret");
    expect(coffretHint(15, NOW)).toBe("2 récompenses dedans.");
    expect(coffretHint(3, NOW)).toBe("1 récompense dedans.");
  });

  it("tells what was put away", () => {
    expect(claimedToast([{ kind: "refill" }])).toBe("Stock remis au plein.");
    expect(claimedToast([{ kind: "bonus_booster" }])).toBe("Rangé dans ta réserve.");
    expect(reserveLabel({ bonus: 3, bonusCap: 12 })).toBe("3 / 12 bonus");
    expect(coffretAction([{ kind: "refill" }])).toBe("Remplir mon stock");
    expect(coffretAction([{ kind: "garni_booster" }, { kind: "title", title: "x" }])).toBe(
      "Ranger dans ma réserve",
    );
  });

  it("shows the next four levels, milestones and openings marked", () => {
    const next = upcomingRewards(2, NOW);
    expect(next.map((r) => r.level)).toEqual([3, 4, 5, 6]);
    expect(next[0]).toMatchObject({ icon: "lock", milestone: false });
    expect(next[0]?.label).toBe(
      "Niveau 3 : Sachet bonus, ouvre choisir la collection de ton sachet",
    );
    expect(next[1]).toMatchObject({ icon: "bolt", label: "Niveau 4 : Recharge" });
    expect(next[2]).toMatchObject({ milestone: true, icon: "lock" });
  });
});

describe("level road", () => {
  it("marks each level claimed, to claim, next or closed", () => {
    const nodes = roadNodes(4, [2], NOW);
    expect(nodes[0]?.level).toBe(30);
    const state = (n: number) => nodes.find((node) => node.level === n)?.state;
    expect([1, 2, 3, 4, 5, 6].map(state)).toEqual([
      "claimed",
      "claimed",
      "claimable",
      "claimable",
      "next",
      "locked",
    ]);
    expect(nodes.find((n) => n.level === 5)?.opens).toBe("Les échanges");
    expect(roadNodes(25, [], NOW)[0]?.level).toBe(37);
  });

  it("winds the road and travels it up to the player's level", () => {
    const layout = roadLayout([3, 2, 1], 2, { width: 200, rowHeight: 100, amplitude: 50 });
    expect(layout.height).toBe(300);
    expect(layout.points.map((p) => p.y)).toEqual([50, 150, 250]);
    expect(layout.points[0]?.x).toBe(100 + 0.6 * 50);
    expect(layout.path.startsWith("M130 50 C")).toBe(true);
    expect(layout.donePath.startsWith(`M${layout.points[1]?.x} 150`)).toBe(true);
  });

  it("details a level", () => {
    const p = progress(16, 260);
    expect(levelDetail(16, p, [], NOW)).toMatchObject({
      title: "Un coffret t'attend",
      state: "claimable",
      xpLeft: null,
    });
    expect(levelDetail(15, p, [15], NOW).title).toBe("Déjà dans ta poche");
    expect(levelDetail(18, p, [], NOW)).toMatchObject({
      state: "locked",
      xpLeft: `Encore ${(xpToReach(18) - p.xp).toLocaleString("fr-FR")} XP.`,
    });
    expect(levelDetail(1, p, [], NOW).items[0]?.title).toBe("Bienvenue");
  });
});
