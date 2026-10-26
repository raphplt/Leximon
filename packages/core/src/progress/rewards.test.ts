import { describe, expect, it } from "vitest";
import { LEVEL_REWARD_SCHEDULE } from "../rules";
import {
  currentTitle,
  defaultAvatar,
  levelRewardRulesAt,
  levelRewards,
  rewardBoosters,
  unclaimedLevels,
  wardrobe,
} from "./rewards";

const rules = levelRewardRulesAt(LEVEL_REWARD_SCHEDULE, Date.UTC(2026, 9, 21));
const kinds = (level: number) => levelRewards(rules, level).map((reward) => reward.kind);

describe("levelRewards", () => {
  it("gives nothing for the starting level", () => {
    expect(levelRewards(rules, 1)).toEqual([]);
    expect(levelRewards(rules, 0)).toEqual([]);
    expect(levelRewards(rules, 2.5)).toEqual([]);
  });

  it("gives a bonus booster on ordinary levels, never a refill", () => {
    for (const level of [2, 3, 4, 17]) expect(kinds(level)).toEqual(["bonus_booster"]);
    for (let level = 2; level <= 200; level++) expect(kinds(level)).not.toContain("refill");
  });

  it("gives a garni booster and a title every 5 levels", () => {
    expect(levelRewards(rules, 5)).toEqual([
      { kind: "garni_booster" },
      { kind: "title", title: "Lexicographe en herbe" },
    ]);
    expect(levelRewards(rules, 15)).toContainEqual({ kind: "title", title: "Fine plume" });
    expect(levelRewards(rules, 45)).toContainEqual({ kind: "title", title: "Puits de science" });
  });

  it("gives a garni booster, a reserve slot, an avatar and a pinned slot every 10 levels", () => {
    expect(kinds(10)).toEqual(["garni_booster", "reserve_slot", "avatar", "frame", "pinned_slot"]);
    expect(kinds(30)).toEqual(["garni_booster", "reserve_slot", "avatar", "frame", "pinned_slot"]);
    expect(kinds(40)).toEqual(["garni_booster", "reserve_slot", "avatar", "frame"]);
    expect(kinds(50)).toEqual(["garni_booster", "reserve_slot", "avatar", "frame"]);
  });

  it("caps the reserve at 15 places and the pinned cards at 6", () => {
    let slots = 0;
    let pinned = 3;
    for (let level = 2; level <= 200; level++) {
      slots += kinds(level).filter((kind) => kind === "reserve_slot").length;
      pinned += kinds(level).filter((kind) => kind === "pinned_slot").length;
    }
    expect(10 + slots).toBe(15);
    expect(pinned).toBe(6);
  });

  it("only gives bonus boosters and cosmetics beyond level 50", () => {
    const cosmetics = ["bonus_booster", "avatar", "frame", "title"];
    for (let level = 51; level <= 200; level++) {
      for (const kind of kinds(level)) expect(cosmetics).toContain(kind);
    }
    expect(kinds(60)).toEqual(["bonus_booster", "avatar", "frame"]);
    expect(kinds(70)).toEqual(["bonus_booster", "frame"]);
    expect(kinds(71)).toEqual(["bonus_booster"]);
    expect(levelRewards(rules, 95)).toEqual([
      { kind: "bonus_booster" },
      { kind: "title", title: "Immortel" },
    ]);
  });
});

describe("cosmetics", () => {
  const later = levelRewardRulesAt(LEVEL_REWARD_SCHEDULE, Date.UTC(2026, 9, 22));

  it("names the avatar of each level that gives one", () => {
    expect(levelRewards(rules, 10)).toContainEqual({ kind: "avatar", avatar: "metoposcope" });
    expect(levelRewards(rules, 60)).toContainEqual({ kind: "avatar", avatar: "soupette" });
    expect(levelRewards(rules, 200)).toContainEqual({ kind: "avatar" });
  });

  it("adds a frame at the levels the rules list, ten beyond level 20", () => {
    expect(levelRewards(later, 10)).toContainEqual({ kind: "frame", frame: "gilded" });
    expect(levelRewards(later, 20)).toContainEqual({ kind: "frame", frame: "ink" });
    expect(levelRewards(later, 30)).toContainEqual({ kind: "frame", frame: "pearls" });
    expect(levelRewards(later, 150)).toContainEqual({ kind: "frame", frame: "royal-sun" });
    const frames = [];
    for (let level = 21; level <= 200; level++) {
      for (const reward of levelRewards(later, level)) {
        if (reward.kind === "frame") frames.push(reward.frame);
      }
    }
    expect(frames).toHaveLength(10);
  });

  it("dresses a player with the starting set and their claimed coffrets", () => {
    const claimed = [10, 15, 20].map((level) => ({ level, rewards: levelRewards(later, level) }));
    const worn = wardrobe(later, claimed);
    expect([...worn.avatars]).toEqual([...later.startingAvatars, "metoposcope", "fanfreluche"]);
    expect([...worn.frames]).toEqual(["simple", "gilded", "ink"]);
    expect([...worn.titles]).toEqual(["Fine plume"]);
    expect(worn.pinnedSlots).toBe(5);
    expect(wardrobe(later, []).pinnedSlots).toBe(3);
  });

  it("reads an avatar claimed before avatars were named from the rules", () => {
    const worn = wardrobe(later, [{ level: 30, rewards: [{ kind: "avatar" }] }]);
    expect(worn.avatars.has("cuistre")).toBe(true);
  });

  it("gives every player a starting avatar from their code", () => {
    const avatar = defaultAvatar(later, "K7QF2M9D");
    expect(later.startingAvatars).toContain(avatar);
    expect(defaultAvatar(later, "K7QF2M9D")).toBe(avatar);
    const spread = new Set(["AAAAAAAA", "K7QF2M9D", "RAPH7K2Q", "ZZZZZZZZ", "12345678"]);
    expect(new Set([...spread].map((code) => defaultAvatar(later, code))).size).toBeGreaterThan(1);
  });
});

describe("rewardBoosters", () => {
  it("counts the boosters that go to the reserve", () => {
    expect(rewardBoosters(levelRewards(rules, 3))).toBe(1);
    expect(rewardBoosters(levelRewards(rules, 5))).toBe(1);
    expect(rewardBoosters(levelRewards(rules, 10))).toBe(1);
    expect(rewardBoosters(levelRewards(rules, 1))).toBe(0);
  });
});

describe("unclaimedLevels", () => {
  it("lists the levels reached and not claimed, from level 2", () => {
    expect(unclaimedLevels(1, [])).toEqual([]);
    expect(unclaimedLevels(5, [2, 4])).toEqual([3, 5]);
    expect(unclaimedLevels(3, [2, 3, 9])).toEqual([]);
  });
});

describe("currentTitle", () => {
  it("is the title of the highest milestone claimed", () => {
    expect(currentTitle(rules, [2, 3])).toBeNull();
    expect(currentTitle(rules, [5, 15, 12])).toBe("Fine plume");
  });
});
