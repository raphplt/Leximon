import { playerCodeSchema } from "@leximon/contract";
import { describe, expect, it } from "vitest";
import { encodePlayerCode, generatePlayerCode } from "./player-code";

describe("player codes", () => {
  it("map each byte to one Crockford character, using its low 5 bits", () => {
    expect(encodePlayerCode(new Uint8Array([0, 1, 9, 10, 17, 31, 32, 255]))).toBe("019AHZ0Z");
  });

  it("never use the ambiguous letters I, L, O and U", () => {
    const all = encodePlayerCode(new Uint8Array([18, 19, 20, 21, 22, 26, 27, 28]));
    expect(all).toBe("JKMNPTVW");
    for (let byte = 0; byte < 256; byte += 8) {
      const code = encodePlayerCode(new Uint8Array(Array.from({ length: 8 }, (_, i) => byte + i)));
      expect(code).not.toMatch(/[ILOU]/);
    }
  });

  it("refuse a wrong number of bytes", () => {
    expect(() => encodePlayerCode(new Uint8Array(7))).toThrow();
  });

  it("are accepted by the contract, including typed by hand in lowercase with a dash", () => {
    for (let i = 0; i < 100; i++) {
      const code = generatePlayerCode();
      expect(playerCodeSchema.parse(code)).toBe(code);
      const typed = `${code.slice(0, 4)}-${code.slice(4)}`.toLowerCase();
      expect(playerCodeSchema.parse(typed)).toBe(code);
    }
  });
});
