import { BANNER_SCHEDULE, bannerCatalog } from "@leximon/core";
import { describe, expect, it } from "vitest";
import {
  type BannerMotif,
  bannerMotif,
  bannerMotifs,
  bannerSvg,
  bannerTint,
  bannerTints,
} from "./profile-banners";

describe("profile banners", () => {
  it("draw every motif and every tint the rules give", () => {
    for (const period of BANNER_SCHEDULE) {
      for (const { motif } of bannerCatalog(period))
        expect(Object.keys(bannerMotifs)).toContain(motif);
      for (const tint of period.tints) expect(Object.keys(bannerTints)).toContain(tint);
    }
  });

  it("only write finite numbers in their paths", () => {
    for (const motif of Object.values<BannerMotif>(bannerMotifs)) {
      expect(motif.tile.width).toBeGreaterThan(0);
      for (const shape of motif.shapes) expect(shape.d).not.toMatch(/NaN|Infinity|undefined/);
    }
  });

  it("fall back on the plain bordeaux for ids from a newer server", () => {
    expect(bannerMotif("from-a-newer-server")).toBe(bannerMotifs.plain);
    expect(bannerTint("from-a-newer-server")).toBe(bannerTints.bordeaux);
  });

  it("writes a whole banner as an SVG document in its tint", () => {
    const svg = bannerSvg({ motif: "fleurons", tint: "ink" }, 400, 480);
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="480"')).toBe(
      true,
    );
    expect(svg).toContain(`fill="${bannerTints.ink}"`);
    expect(svg).toContain('<pattern id="m" width="32" height="32"');
    expect(svg.endsWith("</svg>")).toBe(true);
  });
});
