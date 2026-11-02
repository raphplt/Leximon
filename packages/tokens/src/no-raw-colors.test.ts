import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { colors } from "./tokens";

const ROOT = join(import.meta.dirname, "../../..");
const SOURCES = ["apps/web/src", "apps/mobile/src"];

/**
 * Illustrations and scenes keep a palette of their own: the look of the game comes from the roles,
 * these only paint what they depict. Anything else takes a role, so that a look changes in one place.
 */
const OWN_PALETTE = [
  // Cards, sachets and what is printed on them.
  /holo-card/,
  /cards\/card\.tsx/,
  /components\/card\.module/,
  /card-back/,
  /sachet/,
  /booster\/pli/,
  /pack-looks/,
  /rarity-icon/,
  // Drawings.
  /avatar/,
  /logo-mark/,
  /emblem/,
  /collection-seal/,
  // The medals and banners of a clan.
  /clan\/clan\.module/,
  // Scenes of one moment, each with its own light.
  /booster\/reveal-card\.module/,
  /coffret/,
  /level-road/,
  /play\/play\.module/,
  // Shared images, composed apart from the game.
  /opengraph-image/,
];

const RAW_COLOR = /#[0-9a-f]{3}(?:[0-9a-f]{3})?\b|rgba?\(\s*\d/gi;
const IGNORED_MATCH = /url\(#|href="#|\/\*|^\s*\*|\/\//;

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(css|tsx?)$/.test(entry.name) ? [path] : [];
  });
}

function rawColors(path: string): string[] {
  return readFileSync(path, "utf8")
    .split("\n")
    .filter((line) => !IGNORED_MATCH.test(line))
    .flatMap((line) => line.match(RAW_COLOR) ?? []);
}

describe("colors", () => {
  it("come from the roles, outside illustrations and scenes", () => {
    const offenders = SOURCES.flatMap((source) => sourceFiles(join(ROOT, source)))
      .map((path) => relative(ROOT, path))
      .filter((path) => !OWN_PALETTE.some((own) => own.test(path)))
      .filter((path) => rawColors(join(ROOT, path)).length > 0);
    expect(offenders).toEqual([]);
  });

  it("reach the phone through its theme, which picks the look at launch", () => {
    const direct = sourceFiles(join(ROOT, "apps/mobile/src"))
      .filter((path) => !path.endsWith("theme.ts"))
      .filter((path) => /\bcolors\b[^;]*from "@leximon\/tokens"/.test(readFileSync(path, "utf8")))
      .map((path) => relative(ROOT, path));
    expect(direct).toEqual([]);
  });

  it("match the page in the native configuration of the app", () => {
    const appJson = readFileSync(join(ROOT, "apps/mobile/app.json"), "utf8");
    const declared = appJson.match(/"backgroundColor": "#[0-9A-Fa-f]{6}"/g) ?? [];
    expect(declared).toEqual(Array(3).fill(`"backgroundColor": "${colors.page}"`));
  });
});
