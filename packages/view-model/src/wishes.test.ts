import { describe, expect, it } from "vitest";
import { deckTrapsLine, trappedText } from "./jousts";
import { seekerLine, seekersNote, wishedLine, wishesNote } from "./wishes";

const badge = { code: "ABCD-1234", pseudo: "Alix", avatar: "a", frame: "f", level: 9 };

describe("wishes", () => {
  it("say how many doubles a player looks for", () => {
    expect(seekerLine(badge, ["a"])).toBe("Alix cherche un de tes doubles.");
    expect(seekerLine(badge, ["a", "b", "c"])).toBe("Alix cherche 3 de tes doubles.");
  });

  it("explain the lists, empty or not", () => {
    expect(seekersNote(0)).toContain("Personne ne cherche tes doubles");
    expect(wishesNote(0)).toBe(
      "Ta liste est vide. Les mots que tu croises en joute sans les avoir y arrivent.",
    );
    expect(wishesNote(1)).toMatch(/^1 mot\. /);
    expect(wishesNote(4)).toMatch(/^4 mots\. /);
  });

  it("tell the words of a joust going to the list", () => {
    expect(wishedLine(0)).toBeNull();
    expect(wishedLine(1)).toBe("Le mot que tu n'as pas va dans ta liste de souhaits.");
    expect(wishedLine(3)).toBe("Les 3 mots que tu n'as pas vont dans ta liste de souhaits.");
  });
});

describe("traps", () => {
  it("count the opponents a card and a deck trapped", () => {
    expect(trappedText(1)).toBe("1 adversaire piégé");
    expect(trappedText(4)).toBe("4 adversaires piégés");
    expect(deckTrapsLine([])).toBeNull();
    expect(deckTrapsLine([{ count: 1 }])).toBe("Tes cartes ont piégé tes adversaires 1 fois.");
    expect(deckTrapsLine([{ count: 2 }, { count: 3 }])).toBe(
      "Tes cartes ont piégé tes adversaires 5 fois.",
    );
  });
});
