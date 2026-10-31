import type { RiddleResponse } from "@leximon/contract";
import { describe, expect, it } from "vitest";
import {
  riddleAskLabel,
  riddleCells,
  riddleClueLines,
  riddleHeadline,
  riddleInvitation,
  riddleLink,
  riddleNature,
  riddleNextLine,
  riddleProgressLine,
  riddlePublicLine,
  riddleResultLine,
  riddleRewardLines,
  riddleRule,
  riddleShareText,
  riddleSquares,
  riddleTriesLine,
} from "./riddle";

const RIDDLE: RiddleResponse = {
  number: 42,
  partOfSpeech: "n. f.",
  letters: 8,
  step: 0,
  lastStep: 6,
  clues: { opening: null, definition: null, etymology: null },
  shownLetters: "",
  outcome: null,
  answer: null,
  xp: 0,
  cardGiven: false,
  nextAt: "2026-11-01T23:00:00.000Z",
};

const FOUND: RiddleResponse = {
  ...RIDDLE,
  step: 2,
  outcome: "found",
  answer: { cardId: "ralingue", word: "ralingue" },
  xp: 55,
  cardGiven: true,
};

describe("riddleNature", () => {
  it("spells the nature out", () => {
    expect(riddleNature("n. f.", 8)).toBe("Nom féminin de 8 lettres");
    expect(riddleNature("v. tr.", 7)).toBe("Verbe de 7 lettres");
    expect(riddleNature("adj.", 5)).toBe("Adjectif de 5 lettres");
  });

  it("falls back on the card's abbreviation", () => {
    expect(riddleNature("loc. adv.", 6)).toBe("loc. adv. de 6 lettres");
  });
});

describe("rules", () => {
  it("says the number of tries", () => {
    expect(riddleRule(6)).toContain("en 7 essais");
  });

  it("says what the riddle earns", () => {
    expect(riddleInvitation(6, Date.UTC(2026, 10, 1))).toBe(
      "Le même mot pour tout le monde, à trouver en 7 essais. Il rapporte 50 XP, et la carte si tu ne l'as pas.",
    );
  });
});

describe("riddleResultLine", () => {
  it.each([
    [0, "found", "Trouvé sans indice"],
    [1, "found", "Trouvé au 1er indice"],
    [2, "found", "Trouvé au 2e indice"],
    [3, "found", "Trouvé au 3e indice"],
    [4, "found", "Trouvé avec 1 lettre"],
    [6, "found", "Trouvé avec 3 lettres"],
    [6, "lost", "Pas trouvé"],
  ] as const)("step %i, %s", (step, outcome, line) => {
    expect(riddleResultLine({ step, outcome })).toBe(line);
  });
});

describe("the shared result", () => {
  it("has one square per try", () => {
    expect(riddleSquares({ step: 0, outcome: "found", lastStep: 6 })).toBe("🟩");
    expect(riddleSquares({ step: 2, outcome: "found", lastStep: 6 })).toBe("🟧🟧🟩");
    expect(riddleSquares({ step: 6, outcome: "lost", lastStep: 6 })).toBe("🟧🟧🟧🟧🟧🟧🟧");
  });

  it("gives the result and the link, not the word", () => {
    const text = riddleShareText(FOUND);
    expect(text).toBe(
      "Énigme Leximon n° 42\nTrouvé au 2e indice 🟧🟧🟩\nhttps://leximon.fr/enigme/42",
    );
    expect(text).not.toContain("ralingue");
  });

  it("links the riddle's page", () => {
    expect(riddleLink(7)).toBe("https://leximon.fr/enigme/7");
  });
});

describe("riddleClueLines", () => {
  const clues = { opening: "Cordage…", definition: null, etymology: null };

  it("shows nothing at the start", () => {
    expect(riddleClueLines(RIDDLE)).toEqual([]);
  });

  it("shows the opening", () => {
    expect(riddleClueLines({ ...RIDDLE, clues })).toEqual([
      { label: "Début de la définition", text: "Cordage…" },
    ]);
  });

  it("replaces the opening by the definition, then adds the origin", () => {
    const lines = riddleClueLines({
      ...RIDDLE,
      clues: { ...clues, definition: "Cordage cousu.", etymology: "De l'anglais." },
    });
    expect(lines).toEqual([
      { label: "Définition", text: "Cordage cousu." },
      { label: "Origine", text: "De l'anglais." },
    ]);
  });
});

describe("riddleCells", () => {
  it("has one box per letter, the letters shown first", () => {
    expect(riddleCells({ ...RIDDLE, letters: 4, shownLetters: "ra" })).toEqual(["r", "a", "", ""]);
  });

  it("keeps an accented letter whole", () => {
    expect(riddleCells({ ...RIDDLE, letters: 2, shownLetters: "é" })).toEqual(["é", ""]);
  });
});

describe("tries", () => {
  it("counts the tries left", () => {
    expect(riddleTriesLine({ step: 0, lastStep: 6 })).toBe("Il te reste 7 essais.");
    expect(riddleTriesLine({ step: 5, lastStep: 6 })).toBe("Il te reste 2 essais.");
  });

  it("says when one is left", () => {
    expect(riddleTriesLine({ step: 6, lastStep: 6 })).toBe("Il te reste un dernier essai.");
  });

  it("names what the button gives", () => {
    expect(riddleAskLabel({ step: 2, lastStep: 6 })).toBe("Demander un indice");
    expect(riddleAskLabel({ step: 3, lastStep: 6 })).toBe("Demander une lettre");
    expect(riddleAskLabel({ step: 6, lastStep: 6 })).toBe("Abandonner et voir le mot");
  });
});

describe("the end of the game", () => {
  it("celebrates a word found", () => {
    expect(riddleHeadline(FOUND)).toBe("Bien trouvé !");
    expect(riddleRewardLines(FOUND)).toEqual([
      "Tu gagnes 55 XP.",
      "La carte « ralingue » rejoint ton album.",
    ]);
  });

  it("says when the player already had the card", () => {
    expect(riddleRewardLines({ ...FOUND, cardGiven: false })[1]).toBe("Tu avais déjà cette carte.");
  });

  it("gives the word of a lost game, with no reward", () => {
    const lost = { ...FOUND, outcome: "lost", xp: 0, cardGiven: false } as const;
    expect(riddleHeadline(lost)).toBe("Le mot était « ralingue ».");
    expect(riddleRewardLines(lost)).toEqual([]);
  });

  it("says when the next riddle comes", () => {
    expect(riddleNextLine(RIDDLE, Date.parse(RIDDLE.nextAt) - 3_600_000)).toBe(
      "La prochaine énigme arrive dans 1 h 00.",
    );
  });

  it("sums up a game on the Défis screen", () => {
    expect(riddleProgressLine({ ...RIDDLE, step: 2 })).toBe("Il te reste 5 essais.");
    expect(riddleProgressLine(FOUND)).toBe("Trouvé au 2e indice.");
  });
});

describe("riddlePublicLine", () => {
  it.each([
    [0, 0, "Personne n'a trouvé ce mot pour l'instant."],
    [3, 0, "Personne n'a trouvé ce mot pour l'instant."],
    [1, 1, "1 joueur sur 1 a trouvé ce mot."],
    [5, 3, "3 joueurs sur 5 ont trouvé ce mot."],
  ])("%i played, %i found", (played, found, line) => {
    expect(riddlePublicLine(played, found)).toBe(line);
  });
});
