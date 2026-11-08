import type { ProfileResponse } from "@leximon/contract";
import { BANNER_SCHEDULE } from "@leximon/core";
import { describe, expect, it } from "vitest";
import {
  bannerItems,
  bannerLockedToast,
  bannerMotifName,
  bannerPurchaseConfirm,
  bannerStateLabel,
  bannerTintItems,
} from "./banners";

const NOW = Date.parse("2026-11-09T12:00:00.000Z");
const RULES = BANNER_SCHEDULE[0];

function profile(
  banners: string[],
  banner = { motif: "plain", tint: "bordeaux" },
): Pick<ProfileResponse, "banner" | "wardrobe"> {
  return { banner, wardrobe: { avatars: [], frames: [], titles: [], banners } };
}

describe("banner items", () => {
  it("names every motif of the rules", () => {
    for (const { motif } of bannerItems(profile([]), NOW)) {
      expect(bannerMotifName(motif)).not.toBe(motif);
    }
    for (const tint of RULES.tints) {
      expect(bannerTintItems(profile([]), NOW).find((item) => item.tint === tint)?.name).not.toBe(
        tint,
      );
    }
  });

  it("puts the motifs owned first, then says what gives the others", () => {
    const items = bannerItems(
      profile(["plain", "scrolls"], { motif: "scrolls", tint: "ink" }),
      NOW,
    );
    expect(items.slice(0, 2).map((item) => [item.motif, item.state])).toEqual([
      ["plain", "owned"],
      ["scrolls", "worn"],
    ]);
    const labels = Object.fromEntries(items.map((item) => [item.motif, bannerStateLabel(item)]));
    expect(labels).toMatchObject({
      plain: "Choisir",
      scrolls: "Choisi",
      fleurons: "Niveau 15",
      checky: "Ligue Chevalier",
      binding: "Une collection complète",
      marbled: "250 écus",
    });
    expect(items.find((item) => item.motif === "marbled")?.state).toBe("for_sale");
    expect(
      bannerTintItems(profile([], { motif: "plain", tint: "ink" }), NOW).filter((t) => t.worn),
    ).toEqual([{ tint: "ink", name: "Encre", worn: true }]);
  });

  it("keeps a motif owned under older rules", () => {
    const items = bannerItems(profile(["plain", "retired"]), NOW);
    expect(items.find((item) => item.motif === "retired")?.state).toBe("owned");
  });

  it("says how to earn a motif and what a purchase leaves", () => {
    expect(bannerLockedToast({ kind: "level", level: 30 })).toBe("Tu le gagnes au niveau 30.");
    expect(bannerPurchaseConfirm("Papier marbré", 250, 251)).toBe(
      "Papier marbré coûte 250 écus. Il te restera 1 écu. Le motif est à toi pour toujours.",
    );
    expect(bannerPurchaseConfirm("Papier marbré", 250, 190)).toBe(
      "Papier marbré coûte 250 écus. Il te manque 60 écus.",
    );
  });
});
