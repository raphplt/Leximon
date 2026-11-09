import { LEVEL_REWARD_SCHEDULE, PATRON_SCHEDULE } from "@leximon/core";
import { describe, expect, it } from "vitest";
import {
  type AvatarFrame,
  avatarFrame,
  avatarFrames,
  frameGradients,
  framePaint,
} from "./avatar-frames";
import { emblemColors, emblemField, mixHex } from "./tokens";

describe("avatar frames", () => {
  it("exist for every frame the patron calendar gives", () => {
    for (const rules of PATRON_SCHEDULE) {
      for (const cosmetic of Object.values(rules.cosmetics).flat()) {
        if (cosmetic.kind === "frame")
          expect(cosmetic.frame in avatarFrames, cosmetic.frame).toBe(true);
      }
    }
  });

  it("draws every frame the rules give", () => {
    for (const period of LEVEL_REWARD_SCHEDULE) {
      for (const id of [period.startingFrame, ...Object.values(period.frames)]) {
        expect(Object.keys(avatarFrames)).toContain(id);
      }
    }
  });

  it("falls back on the simple frame for an unknown id", () => {
    expect(avatarFrame("from-a-newer-server")).toBe(avatarFrames.simple);
  });

  it("only writes finite numbers in its paths, inside its reach", () => {
    for (const frame of Object.values<AvatarFrame>(avatarFrames)) {
      for (const shape of [...(frame.turning ?? []), ...frame.shapes]) {
        expect(shape.d).not.toMatch(/NaN|Infinity/);
      }
      expect(frame.reach).toBeGreaterThan(42 + frame.footprint);
    }
  });

  it("paints matters with a gradient and thicknesses flat", () => {
    expect(framePaint("gold")).toEqual({ matter: "gold" });
    expect(framePaint("gold:edge")).toHaveProperty("color");
    expect(frameGradients(avatarFrames.pearls)).toEqual(["brass", "nacre"]);
  });
});

describe("emblem colours", () => {
  it("mixes two colours", () => {
    expect(mixHex("#000000", "#FFFFFF", 0.5)).toBe("#808080");
    expect(mixHex("#9A2232", "#000000", 0)).toBe("#9A2232");
  });

  it("lights each field at the top and deepens it at the point", () => {
    for (const key of Object.keys(emblemColors)) {
      const { top, bottom } = emblemField(key);
      expect(top).toMatch(/^#[0-9A-F]{6}$/);
      expect(bottom).toMatch(/^#[0-9A-F]{6}$/);
    }
  });
});
