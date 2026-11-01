import { describe, expect, it } from "vitest";
import { parseThemeChoice, resolveTheme } from "./theme";

describe("theme", () => {
  it("follows the device unless the player chose", () => {
    expect(parseThemeChoice(null)).toBe("device");
    expect(parseThemeChoice("sepia")).toBe("device");
    expect(parseThemeChoice("dark")).toBe("dark");
  });

  it("resolves to the device's theme or to the choice", () => {
    expect(resolveTheme("device", true)).toBe("dark");
    expect(resolveTheme("device", false)).toBe("light");
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });
});
