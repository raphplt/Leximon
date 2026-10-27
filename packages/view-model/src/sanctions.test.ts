import { describe, expect, it } from "vitest";
import { contestState, sanctionTitle, sanctionUntil, writingBlock } from "./sanctions";

const now = Date.parse("2026-10-22T12:00:00.000Z");
const none = { contestedAt: null, contestOutcome: null, revokedAt: null };

describe("a sanction", () => {
  it("says what it is", () => {
    expect(sanctionTitle("suspend")).toBe("Ton compte est suspendu");
  });

  it("says until when", () => {
    expect(sanctionUntil({ kind: "mute", until: "2026-10-29T13:00:00.000Z" }, now, "UTC")).toBe(
      "Jusqu'au 29 octobre à 13:00",
    );
    expect(sanctionUntil({ kind: "mute", until: "2026-10-21T13:00:00.000Z" }, now)).toBe(
      "Sanction terminée",
    );
    expect(sanctionUntil({ kind: "close", until: null }, now)).toBe("Sanction définitive");
    expect(sanctionUntil({ kind: "hide_message", until: null }, now)).toBeNull();
  });

  it("forbids writing while a mute, a suspension or a closing runs", () => {
    const mute = { kind: "mute" as const, until: "2026-10-23T12:00:00.000Z", revokedAt: null };
    expect(writingBlock([mute], now)).toMatch(
      /^Une sanction t'empêche d'écrire \(jusqu'au 23 octobre/,
    );
    expect(writingBlock([{ ...mute, revokedAt: "2026-10-22T11:00:00.000Z" }], now)).toBeNull();
    expect(writingBlock([{ ...mute, kind: "trade_ban" }], now)).toBeNull();
  });

  it("follows its contest", () => {
    expect(contestState(none)).toBeNull();
    expect(contestState({ ...none, contestedAt: "2026-10-22T10:00:00.000Z" })).toBe(
      "Ta contestation a été envoyée. L'équipe va la lire.",
    );
    expect(
      contestState({
        contestedAt: "2026-10-22T10:00:00.000Z",
        contestOutcome: "revoked",
        revokedAt: "2026-10-22T11:00:00.000Z",
      }),
    ).toBe("Ta contestation a été acceptée. La sanction est levée.");
  });
});
