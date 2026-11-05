import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SEAL_SVG } from "./og-seal";

describe("SEAL_SVG", () => {
  it("is the logo's seal as the site serves it", () => {
    const served = readFileSync(join(__dirname, "../../public/logo-mark.svg"), "utf8");
    expect(SEAL_SVG).toBe(served.trimEnd());
  });
});
