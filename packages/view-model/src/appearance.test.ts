import type { ProfileResponse } from "@leximon/contract";
import { describe, expect, it } from "vitest";
import {
  appearanceBlock,
  appearanceChanges,
  draftItems,
  isAppearanceChanged,
  savedAppearance,
  withChoice,
} from "./appearance";
import { atelierItems } from "./profile";

const NOW = Date.parse("2026-11-09T12:00:00.000Z");

const PROFILE = {
  avatar: "cuistre",
  frame: "simple",
  title: "Lexicographe en herbe",
  level: 12,
  wardrobe: {
    avatars: ["cuistre", "metaphraste"],
    frames: ["simple", "gilded"],
    titles: ["Lexicographe en herbe"],
    banners: ["plain"],
  },
  banner: { motif: "plain", tint: "bordeaux" },
} satisfies Pick<ProfileResponse, "avatar" | "frame" | "title" | "level" | "wardrobe" | "banner">;

describe("appearance draft", () => {
  it("sends only what changed", () => {
    const draft = {
      ...withChoice(savedAppearance(PROFILE), "frames", "gilded"),
      bannerTint: "ink",
    };
    expect(appearanceChanges(PROFILE, draft)).toEqual({ frame: "gilded", bannerTint: "ink" });
    expect(isAppearanceChanged(PROFILE, savedAppearance(PROFILE))).toBe(false);
    expect(appearanceBlock(PROFILE, draft, NOW)).toBeNull();
  });

  it("lets a closed piece be tried on, and says how to get it", () => {
    const avatar = withChoice(savedAppearance(PROFILE), "avatars", "fluteau");
    expect(appearanceBlock(PROFILE, avatar, NOW)).toEqual({
      kind: "locked",
      text: "Tu gagnes l'avatar Le Flûteau au niveau 40. D'ici là, tu peux seulement l'essayer.",
    });
    const inCoffret = withChoice(savedAppearance(PROFILE), "frames", "gilded");
    expect(
      appearanceBlock(
        { ...PROFILE, wardrobe: { ...PROFILE.wardrobe, frames: ["simple"] } },
        inCoffret,
        NOW,
      ),
    ).toEqual({
      kind: "locked",
      text: "Le cadre Filet doré est dans ton coffret du niveau 10. Ouvre-le pour le porter.",
    });
    expect(
      appearanceBlock(PROFILE, { ...savedAppearance(PROFILE), bannerMotif: "marbled" }, NOW),
    ).toMatchObject({ kind: "for_sale", motif: "marbled", price: 250 });
  });

  it("marks the piece chosen in the draft, the one worn going back to owned", () => {
    const items = draftItems(
      atelierItems("avatars", PROFILE, NOW),
      (item) => item.id === "metaphraste",
    );
    expect(items.find((item) => item.id === "metaphraste")).toMatchObject({
      state: "worn",
      chosen: true,
    });
    expect(items.find((item) => item.id === "cuistre")).toMatchObject({
      state: "owned",
      chosen: false,
    });
    const tried = draftItems(
      atelierItems("avatars", PROFILE, NOW),
      (item) => item.id === "fluteau",
    );
    expect(tried.find((item) => item.id === "fluteau")).toMatchObject({
      state: "locked",
      chosen: true,
    });
  });
});
