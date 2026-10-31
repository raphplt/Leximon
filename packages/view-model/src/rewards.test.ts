import { xpToReach } from "@leximon/core";
import { describe, expect, it } from "vitest";
import {
  claimedToast,
  coffretHint,
  coffretReached,
  coffretsLabel,
  coffretsMailTitle,
  levelDetail,
  nextRewardLine,
  plateauLayout,
  quarterAt,
  quarterNodes,
  quarterOfLevel,
  reserveAfterClaim,
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
  xpForNextLevel: 150 + 45 * (level - 1),
});

describe("level rewards", () => {
  it("sums up what each level gives", () => {
    expect(rewardSummary(1, NOW)).toBe("Départ");
    expect(rewardSummary(2, NOW)).toBe("Sachet bonus");
    expect(rewardSummary(3, NOW)).toBe("Sachet bonus");
    expect(rewardSummary(15, NOW)).toBe("Sachet garni · Titre");
    expect(rewardSummary(20, NOW)).toBe(
      "Sachet garni · Réserve agrandie · Avatar gravé · Cadre · Une épingle de plus",
    );
  });

  it("lists the coffrets waiting, lowest first", () => {
    expect(waitingCoffrets(6, [2, 4])).toEqual([3, 5, 6]);
    expect(coffretsLabel(1)).toBe("1 coffret");
    expect(coffretHint(15, NOW)).toBe("Il contient 2 récompenses.");
    expect(coffretHint(3, NOW)).toBe("Il contient 1 récompense.");
    expect(coffretReached(4)).toBe("Niveau 4 atteint");
  });

  it("names the coffrets of the mail by their levels", () => {
    expect(coffretsMailTitle([4])).toBe("Coffret du niveau 4");
    expect(coffretsMailTitle([3, 5])).toBe("Coffrets des niveaux 3 et 5");
    expect(coffretsMailTitle([3, 4, 6])).toBe("3 coffrets, niveaux 3 à 6");
  });

  it("tells what was put away", () => {
    expect(claimedToast([{ kind: "bonus_booster" }])).toBe("Les sachets sont dans ta réserve.");
    expect(claimedToast([{ kind: "title", title: "Fine plume" }])).toBe(
      "À retrouver dans ton profil.",
    );
    expect(reserveAfterClaim({ bonus: 3 })).toBe("Tu as maintenant 3 sachets bonus en réserve.");
    expect(reserveAfterClaim({ bonus: 1 })).toBe("Tu as maintenant 1 sachet bonus en réserve.");
    expect(reserveLabel({ bonus: 3, bonusCap: 12 })).toBe("3 / 12 bonus");
  });

  it("shows the next four levels, milestones and openings marked", () => {
    const next = upcomingRewards(2, NOW);
    expect(next.map((r) => r.level)).toEqual([3, 4, 5, 6]);
    expect(next[0]).toMatchObject({
      icon: "lock",
      milestone: false,
      opens: "Débloque le choix de la collection de ton sachet, les révisions par thème",
    });
    expect(next[0]?.label).toBe(
      "Niveau 3, Sachet bonus, débloque le choix de la collection de ton sachet, les révisions par thème",
    );
    expect(next.map((r) => r.word)).toEqual(["Collections", "Sachet", "Échanges", "Sachet"]);
    expect(next[1]).toMatchObject({
      icon: "sachet",
      opens: null,
      label: "Niveau 4, Sachet bonus",
    });
    expect(next[2]).toMatchObject({ milestone: true, icon: "lock" });
  });

  it("says the next reward in a sentence, an opening first", () => {
    expect(nextRewardLine(1, NOW)).toBe("Au niveau 2, tu gagnes un sachet bonus.");
    expect(nextRewardLine(2, NOW)).toBe(
      "Au niveau 3, tu débloques le choix de la collection de ton sachet et les révisions par thème.",
    );
    expect(nextRewardLine(3, NOW)).toBe("Au niveau 4, tu gagnes un sachet bonus.");
  });
});

describe("level road", () => {
  it("cuts the road into named quarters of ten levels", () => {
    expect(quarterOfLevel(1)).toMatchObject({ index: 1, name: "L'Échoppe", first: 1, last: 10 });
    expect(quarterOfLevel(10).index).toBe(1);
    expect(quarterOfLevel(16)).toMatchObject({ name: "Le Scriptorium", range: "Niveaux 11 à 20" });
    expect(quarterAt(12).name).toBe("Quartier 12");
    expect(quarterAt(2).chapter).toBe("Chapitre II");
    expect(quarterAt(14).chapter).toBe("Chapitre XIV");
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
      title: "Un coffret à ouvrir",
      state: "claimable",
      xpLeft: null,
    });
    expect(levelDetail(15, p, [15], NOW).title).toBe("Coffret ouvert");
    expect(levelDetail(18, p, [], NOW)).toMatchObject({
      state: "locked",
      xpLeft: `Encore ${(xpToReach(18) - p.xp).toLocaleString("fr-FR")} XP.`,
    });
    expect(levelDetail(1, p, [], NOW).items[0]?.title).toBe("Niveau de départ");
  });
});
