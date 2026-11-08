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
    expect(editionsOwnedLine(["encre"])).toBe(
      "Tu possèdes l'encre de Chine. Choisis l'édition d'une carte depuis sa fiche.",
    );
    expect(editionsOwnedLine(["sanguine", "lavis", "encre"])).toBe(
      "Tu possèdes la sanguine, le lavis et l'encre de Chine. Choisis l'édition d'une carte depuis sa fiche.",
    );
    expect(editionsOwnedLine([])).toBe("Tes éditions arrivent avec ton premier paiement.");
    expect(editionAlbumDone("sanguine")).toBe("Tout ton album est imprimé à la sanguine.");
    expect(editionAlbumDone(null)).toBe("Tout ton album reprend son impression ordinaire.");
  });
});
