import { describe, expect, it } from "vitest";
import { CONTEST_WINDOW_MS, canContest, restrictionsAt } from "./sanction";

const now = Date.UTC(2026, 9, 22);

describe("restrictionsAt (P68)", () => {
  it("leaves a player without sanctions free", () => {
    expect(restrictionsAt([], now)).toEqual({ canWrite: true, canTrade: true, locked: false });
  });

  it("applies timed sanctions until their end, and not once revoked", () => {
    const mute = { kind: "mute", until: now + 1, revokedAt: null } as const;
    expect(restrictionsAt([mute], now).canWrite).toBe(false);
    expect(restrictionsAt([{ ...mute, until: now }], now).canWrite).toBe(true);
    expect(restrictionsAt([{ ...mute, revokedAt: now - 1 }], now).canWrite).toBe(true);
    expect(restrictionsAt([{ kind: "trade_ban", until: now + 1, revokedAt: null }], now)).toEqual({
      canWrite: true,
      canTrade: false,
      locked: false,
    });
  });

  it("locks a suspended or closed account entirely", () => {
    expect(restrictionsAt([{ kind: "close", until: null, revokedAt: null }], now)).toEqual({
      canWrite: false,
      canTrade: false,
      locked: true,
    });
    expect(restrictionsAt([{ kind: "suspend", until: now + 1, revokedAt: null }], now).locked).toBe(
      true,
    );
  });

  it("ignores content sanctions, which act once", () => {
    expect(restrictionsAt([{ kind: "hide_message", until: null, revokedAt: null }], now)).toEqual({
      canWrite: true,
      canTrade: true,
      locked: false,
    });
  });
});

describe("canContest", () => {
  it("allows one contest within six months", () => {
    expect(canContest(now, null, now + CONTEST_WINDOW_MS)).toBe(true);
    expect(canContest(now, null, now + CONTEST_WINDOW_MS + 1)).toBe(false);
    expect(canContest(now, now + 1, now + 2)).toBe(false);
  });
});
