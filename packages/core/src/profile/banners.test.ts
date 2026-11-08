import { describe, expect, it } from "vitest";
import { BANNER_SCHEDULE } from "../rules";
import {
  bannerCatalog,
  bannerMotifsOwned,
  bannerPurchaseRefusal,
  bannerRulesAt,
  wornBanner,
} from "./banners";

const RULES = bannerRulesAt(BANNER_SCHEDULE, Date.now());
const NEWCOMER = { level: 1, bestLeague: null, completeCollections: 0, bought: [] } as const;

describe("banner motifs", () => {
  it("give the plain cloth alone to a newcomer", () => {
    expect([...bannerMotifsOwned(RULES, NEWCOMER)]).toEqual(["plain"]);
  });

  it("follow the level, the best league and the collections reached, not a coffret", () => {
    const owned = bannerMotifsOwned(RULES, {
      level: 31,
      bestLeague: "marechal",
      completeCollections: 1,
      bought: [],
    });
    expect([...owned].sort()).toEqual(
      ["binding", "checky", "fleurons", "plain", "quarterly", "scrolls"].sort(),
    );
  });

  it("keep a league's motif after going down, since the best league is what counts", () => {
    const owned = bannerMotifsOwned(RULES, { ...NEWCOMER, bestLeague: "champion" });
    expect(owned).toContain("cloth_of_gold");
    expect(owned).toContain("checky");
  });

  it("add the motifs bought, but nothing that is not for sale", () => {
    const owned = bannerMotifsOwned(RULES, { ...NEWCOMER, bought: ["marbled", "damask"] });
    expect(owned).toContain("marbled");
    expect(owned).not.toContain("damask");
  });
});

describe("the banner worn", () => {
  it("is the one chosen while allowed, else the plain bordeaux", () => {
    const owned = new Set(["plain", "fleurons"]);
    expect(wornBanner(RULES, owned, { motif: "fleurons", tint: "slate" })).toEqual({
      motif: "fleurons",
      tint: "slate",
    });
    expect(wornBanner(RULES, owned, { motif: "damask", tint: "rainbow" })).toEqual({
      motif: "plain",
      tint: "bordeaux",
    });
    expect(wornBanner(RULES, owned, { motif: null, tint: null })).toEqual({
      motif: "plain",
      tint: "bordeaux",
    });
  });
});

describe("buying a motif", () => {
  it("refuses what is not for sale, what is owned, and a short purse", () => {
    const owned = new Set(["plain", "marbled"]);
    expect(bannerPurchaseRefusal(RULES, owned, "damask", 1_000)).toBe("not_for_sale");
    expect(bannerPurchaseRefusal(RULES, owned, "marbled", 1_000)).toBe("already_owned");
    expect(bannerPurchaseRefusal(RULES, owned, "printer", 249)).toBe("not_enough_ecus");
    expect(bannerPurchaseRefusal(RULES, owned, "printer", 250)).toBeNull();
  });
});

describe("the catalog", () => {
  it("lists every motif once, the start first, then levels, leagues, collection and écus", () => {
    const catalog = bannerCatalog(RULES);
    expect(catalog.map((entry) => entry.motif)).toEqual([
      "plain",
      "fleurons",
      "scrolls",
      "damask",
      "checky",
      "quarterly",
      "cloth_of_gold",
      "binding",
      "marbled",
      "printer",
    ]);
    expect(catalog[1]?.source).toEqual({ kind: "level", level: 15 });
    expect(catalog.at(-1)?.source).toEqual({ kind: "ecus", price: 250 });
  });
});
