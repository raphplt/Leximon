import { describe, expect, it } from "vitest";
import { LEVEL_REWARD_SCHEDULE } from "../rules";
import {
  currentTitle,
  defaultAvatar,
  isChoosableRarity,
  levelRewardRulesAt,
  levelRewards,
  rewardBoosters,
  unclaimedLevels,
  wardrobe,
} from "./rewards";

const rules = levelRewardRulesAt(LEVEL_REWARD_SCHEDULE, Date.UTC(2026, 9, 21));
const kinds = (level: number) => levelRewards(rules, level).map((reward) => reward.kind);

describe("levelRewards (P58)", () => {
  it("gives nothing for the starting level", () => {
    expect(levelRewards(rules, 1)).toEqual([]);
    expect(levelRewards(rules, 0)).toEqual([]);
    expect(levelRewards(rules, 2.5)).toEqual([]);
  });

  it("alternates a refill and a bonus booster on ordinary levels", () => {
    expect(kinds(2)).toEqual(["refill"]);
    expect(kinds(3)).toEqual(["bonus_booster"]);
    expect(kinds(4)).toEqual(["refill"]);
    expect(kinds(17)).toEqual(["bonus_booster"]);
  });

  it("gives a garni booster and a title every 5 levels", () => {
    expect(levelRewards(rules, 5)).toEqual([
      { kind: "garni_booster" },
      { kind: "title", title: "Lexicographe en herbe" },
    ]);
    expect(levelRewards(rules, 15)).toContainEqual({ kind: "title", title: "Fine plume" });
    expect(levelRewards(rules, 45)).toContainEqual({ kind: "title", title: "Puits de science" });
  });

  it("gives a card choice, a reserve slot, an avatar and a pinned slot every 10 levels", () => {
    expect(kinds(10)).toEqual(["card_choice", "reserve_slot", "avatar", "frame", "pinned_slot"]);
    expect(kinds(30)).toEqual(["card_choice", "reserve_slot", "avatar", "pinned_slot"]);
    expect(kinds(40)).toEqual(["card_choice", "reserve_slot", "avatar"]);
    expect(kinds(50)).toEqual(["card_choice", "reserve_slot", "avatar"]);
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
    for (let level = 51; level <= 200; level++) {
      for (const kind of kinds(level)) expect(["bonus_booster", "avatar"]).toContain(kind);
    }
    expect(kinds(60)).toEqual(["bonus_booster", "avatar"]);
    expect(kinds(70)).toEqual(["bonus_booster"]);
  });
});

describe("cosmetics (P58, P49)", () => {
  const later = levelRewardRulesAt(LEVEL_REWARD_SCHEDULE, Date.UTC(2026, 9, 22));

  it("names the avatar of each level that gives one", () => {
    expect(levelRewards(rules, 10)).toContainEqual({ kind: "avatar", avatar: "metoposcope" });
    expect(levelRewards(rules, 60)).toContainEqual({ kind: "avatar", avatar: "soupette" });
    expect(levelRewards(rules, 200)).toContainEqual({ kind: "avatar" });
  });

  it("adds a frame at levels 10 and 20", () => {
    expect(levelRewards(later, 10)).toContainEqual({ kind: "frame", frame: "gilded" });
    expect(levelRewards(later, 20)).toContainEqual({ kind: "frame", frame: "ink" });
    expect(levelRewards(later, 30).map((reward) => reward.kind)).not.toContain("frame");
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
    expect(rewardBoosters(levelRewards(rules, 4))).toBe(0);
    expect(rewardBoosters(levelRewards(rules, 10))).toBe(0);
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

describe("isChoosableRarity", () => {
  it("allows Courant and Peu courant only", () => {
    expect(isChoosableRarity(rules, "common")).toBe(true);
    expect(isChoosableRarity(rules, "uncommon")).toBe(true);
    expect(isChoosableRarity(rules, "rare")).toBe(false);
    expect(isChoosableRarity(rules, "legendary")).toBe(false);
  });
});
