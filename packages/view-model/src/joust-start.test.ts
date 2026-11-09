import { describe, expect, it } from "vitest";
import { duelistMeta, searchLine, startByLine, startLine } from "./joust-start";

const NOW = Date.parse("2026-11-09T08:00:00Z");

describe("before a joust", () => {
  it("says who the game looks for, then who it found", () => {
    expect(searchLine("ranked", null)).toBe("Le jeu cherche un jouteur de ta ligue.");
    expect(searchLine("free", null)).toBe("Le jeu cherche un jouteur de ton niveau.");
    const side = { league: "page" as const, group: null, rarities: [] };
    expect(searchLine("ranked", { name: "Alix", side })).toBe("Alix, ligue Page.");
    expect(
      searchLine("ranked", {
        name: "Alix",
        side: { ...side, group: { place: 1, points: 12, size: 30, move: "up" } },
      }),
    ).toBe("Alix, ligue Page, 1er de son groupe.");
  });

  it("shows each duelist's league and week", () => {
    expect(duelistMeta({ league: "ecuyer", group: null, rarities: [] })).toBe("Écuyer");
    expect(
      duelistMeta({
        league: "ecuyer",
        group: { place: 3, points: 1, size: 30, move: "stay" },
        rarities: [],
      }),
    ).toBe("Écuyer · 1 point cette semaine");
  });

  it("says when the clock starts, and until when the joust waits", () => {
    expect(startLine({ questions: 5, seconds: 15, choices: 4, replyHours: 24 })).toBe(
      "Le chrono démarre quand tu commences, puis tu as 15 secondes pour chacun des 5 mots.",
    );
    expect(startByLine(null, "Alix", NOW)).toBeNull();
    expect(startByLine("2026-11-10T08:00:00Z", "Alix", NOW, "Europe/Paris")).toBe(
      "Si tu ne la commences pas avant demain 9 h 00, la joute revient à Alix.",
    );
  });
});
