import { describe, expect, it } from "vitest";
import { communityTabOf, noPlayerYet, playerListNote, publicProfileDetail } from "./community";

const seen = {
  member: true,
  pseudo: "Lucubrateur",
  level: 12,
  publicFromLevel: 8,
  profilePublic: true,
};

describe("communityTabOf", () => {
  it("opens the clans on demand, the players otherwise", () => {
    expect(communityTabOf("clans")).toBe("clans");
    expect(communityTabOf("joueurs")).toBe("joueurs");
    expect(communityTabOf("autre")).toBe("joueurs");
    expect(communityTabOf(null)).toBe("joueurs");
  });
});

describe("playerListNote", () => {
  it("says nothing to a player others can see in the list", () => {
    expect(playerListNote(seen)).toBeNull();
  });

  it("says what keeps a player out of the list", () => {
    expect(playerListNote({ ...seen, member: false })).toBe(
      "Crée un compte pour apparaître dans cette liste.",
    );
    expect(playerListNote({ ...seen, level: 7 })).toBe(
      "Tu apparaîtras dans cette liste au niveau 8.",
    );
    expect(playerListNote({ ...seen, pseudo: null })).toBe(
      "Choisis un pseudo pour apparaître dans cette liste.",
    );
    expect(playerListNote({ ...seen, profilePublic: false })).toContain("Ton profil est caché");
  });
});

describe("publicProfileDetail", () => {
  it("names the list, and the level until it is reached", () => {
    expect(publicProfileDetail({ level: 3, publicFromLevel: 8 })).toBe(
      "Visible dans la liste des joueurs et par un lien dès le niveau 8",
    );
    expect(publicProfileDetail({ level: 8, publicFromLevel: 8 })).toBe(
      "Visible dans la liste des joueurs et par un lien",
    );
  });
});

describe("noPlayerYet", () => {
  it("gives the level", () => {
    expect(noPlayerYet(8)).toBe(
      "Personne ici pour l'instant. Les joueurs y apparaissent au niveau 8.",
    );
  });
});
