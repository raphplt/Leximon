import { describe, expect, it } from "vitest";
import { editionAlbumDone, editionOfCard, editionsOwnedLine } from "./editions";

describe("library editions", () => {
  const editions = {
    owned: ["sanguine", "lavis"],
    album: "lavis",
    cards: { ablais: null },
    cabinet: false,
  };

  it("print a card in its own choice, else in the album's", () => {
    expect(editionOfCard(editions, "ablais")).toBeNull();
    expect(editionOfCard(editions, "acertainer")).toBe("lavis");
    expect(editionOfCard(null, "acertainer")).toBeNull();
  });

  it("are said whole, for one edition, several, and none", () => {
    expect(editionsOwnedLine(["sanguine", "lavis", "encre"])).toBe(
      "Découvre de nouveaux styles pour tes cartes. Choisis-les depuis la fiche de chaque carte.",
    );
    expect(editionsOwnedLine([])).toBe("Tes éditions arrivent avec ton premier paiement.");
    expect(editionAlbumDone("sanguine")).toBe("Tout ton album est imprimé à la sanguine.");
    expect(editionAlbumDone(null)).toBe("Tout ton album reprend son impression ordinaire.");
  });
});
