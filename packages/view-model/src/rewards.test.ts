import { xpToReach } from "@leximon/core";
import { describe, expect, it } from "vitest";
import {
  claimedToast,
  coffretAction,
  coffretHint,
  coffretsLabel,
  levelDetail,
  nextRewardLine,
  plateauLayout,
  quarterAt,
  quarterNodes,
  quarterOfLevel,
  reserveLabel,
  rewardSummary,
  upcomingRewards,
  waitingCoffrets,
} from "./rewards";

const NOW = Date.UTC(2026, 9, 22);
const progress = (level: number, extra = 0) => ({
  xp: xpToReach(level) + extra,
  level,
  xpIntoLevel: extra,
  xpForNextLevel: 100 + 45 * (level - 1),
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
    expect(next[0]).toMatchObject({
      icon: "lock",
      milestone: false,
      opens: "Ouvre choisir la collection de ton sachet",
    });
    expect(next[0]?.label).toBe(
      "Niveau 3 : Sachet bonus, ouvre choisir la collection de ton sachet",
    );
    expect(next[1]).toMatchObject({ icon: "bolt", opens: null, label: "Niveau 4 : Recharge" });
    expect(next[2]).toMatchObject({ milestone: true, icon: "lock" });
  });

  it("says the next reward in a sentence, an opening first", () => {
    expect(nextRewardLine(1, NOW)).toBe("Au niveau 2, une recharge.");
    expect(nextRewardLine(2, NOW)).toBe("Au niveau 3, choisir la collection de ton sachet.");
    expect(nextRewardLine(3, NOW)).toBe("Au niveau 4, une recharge.");
  });
});

describe("level road", () => {
  it("cuts the road into named quarters of ten levels", () => {
    expect(quarterOfLevel(1)).toMatchObject({ index: 1, name: "L'Échoppe", first: 1, last: 10 });
    expect(quarterOfLevel(10).index).toBe(1);
    expect(quarterOfLevel(16)).toMatchObject({ name: "Le Scriptorium", range: "Niveaux 11 à 20" });
    expect(quarterAt(12).name).toBe("Quartier 12");
  });

  it("marks each level claimed, to claim, next, closed or in the fog", () => {
    const nodes = quarterNodes(quarterAt(1), 4, [2], NOW);
    expect(nodes.map((n) => n.level)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    const node = (n: number) => nodes.find((it) => it.level === n);
    expect([1, 2, 3, 4, 5, 6].map((n) => node(n)?.state)).toEqual([
      "claimed",
      "claimed",
      "claimable",
      "claimable",
      "next",
      "locked",
    ]);
    expect([6, 7].map((n) => node(n)?.fog)).toEqual([false, true]);
    expect(node(5)?.opens).toBe("Les échanges");
  });

  it("zigzags the tiles up the plateau, a stone between two of them", () => {
    const layout = plateauLayout([11, 12, 13, 14, 15], 13);
    const { points, tile } = layout;
    expect(points.map((p) => p.level)).toEqual([11, 12, 13, 14, 15]);
    expect(points[1]?.y).toBe((points[0]?.y ?? 0) - tile.height);
    expect(points.map((p) => (p.x - (points[0]?.x ?? 0)) / tile.width)).toEqual([0, 1, 2, 3, 2]);
    expect(layout.stones.map((s) => s.done)).toEqual([true, true, false, false]);
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
