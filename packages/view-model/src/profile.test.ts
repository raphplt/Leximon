import type { ProfileResponse } from "@leximon/contract";
import { describe, expect, it } from "vitest";
import { formatCount } from "./format";
import {
  atelierItems,
  avatarName,
  canShareProfile,
  cosmeticLockedToast,
  cosmeticStateLabel,
  deleteAccountLabel,
  frameName,
  memberSinceLabel,
  profileHeadline,
  profilePath,
  profileSubline,
  pseudoHint,
  statTiles,
  visibilityNote,
} from "./profile";
import { rewardItem } from "./rewards";

const NOW = Date.parse("2026-11-02T12:00:00.000Z");

function profile(overrides: Partial<ProfileResponse> = {}): ProfileResponse {
  return {
    playerCode: "K7QP2MXA",
    tradeMinLevel: 5,
    member: true,
    pseudo: "Raph",
    pseudoChangeableFrom: null,
    avatar: "cuistre",
    frame: "simple",
    title: "Lexicographe en herbe",
    titleChosen: false,
    profilePublic: true,
    publicFromLevel: 8,
    level: 12,
    memberSince: "2026-10-05T10:00:00.000Z",
    clan: null,
    pinned: [],
    pinnedSlots: 3,
    wardrobe: {
      avatars: [
        "metaphraste",
        "bachelette",
        "grimelin",
        "cassandre",
        "preopinant",
        "ricanerie",
        "metoposcope",
      ],
      frames: ["simple", "gilded"],
      titles: ["Lexicographe en herbe"],
      banners: ["plain"],
    },
    stats: {
      words: 412,
      legendaries: 1,
      gilded: 0,
      tradesCompleted: 7,
      completeCollections: 0,
      daysPlayed: 18,
    },
    banner: { motif: "plain", tint: "bordeaux" },
    jousts: null,
    ...overrides,
  };
}

describe("names", () => {
  it("names avatars and frames, and falls back on the id", () => {
    expect(avatarName("encaveur")).toBe("L'Encaveur");
    expect(avatarName("bejaune")).toBe("Le Béjaune");
    expect(frameName("ink")).toBe("Encre qui coule");
    expect(avatarName("grigou")).toBe("Grigou");
  });

  it("says what a coffret puts in the atelier", () => {
    expect(rewardItem({ kind: "avatar", avatar: "cuistre" }).detail).toBe(
      "Le Cuistre, à choisir depuis ton profil",
    );
    expect(rewardItem({ kind: "avatar" }).detail).toBe("Pour ton profil");
    expect(rewardItem({ kind: "frame", frame: "gilded" })).toEqual({
      icon: "cadre",
      title: "Cadre",
      detail: "Filet doré, à choisir depuis ton profil",
    });
  });
});

describe("profile header", () => {
  it("reads the title and level, then the code and the month joined", () => {
    expect(profileHeadline("Fine plume", 16)).toBe("Fine plume · niveau 16");
    expect(profileHeadline(null, 3)).toBe("Niveau 3");
    expect(memberSinceLabel("2026-11-30T23:30:00.000Z", "Europe/Paris")).toBe(
      "membre depuis décembre 2026",
    );
    expect(profileSubline("K7QP2MXA", "2026-10-05T10:00:00.000Z", "Europe/Paris")).toBe(
      "Code joueur K7QP 2MXA · membre depuis octobre 2026",
    );
    expect(profilePath("Jean-Luc 2")).toBe("/joueur/Jean-Luc%202");
  });

  it("says who sees the profile until others do", () => {
    expect(visibilityNote(profile({ member: false }))).toMatch(/^Crée un compte/);
    expect(visibilityNote(profile({ level: 4 }))).toBe("Ton profil devient public au niveau 8.");
    expect(visibilityNote(profile({ pseudo: null }))).toMatch(/^Choisis un pseudo/);
    expect(visibilityNote(profile({ profilePublic: false }))).toBe(
      "Ton profil est caché. Tu peux le rendre public dans les réglages.",
    );
    expect(visibilityNote(profile())).toBeNull();
    expect(canShareProfile(profile())).toBe(true);
    expect(canShareProfile(profile({ level: 4 }))).toBe(false);
  });

  it("puts the figures in tiles, singular when there is one", () => {
    expect(statTiles(profile().stats, 1561)).toEqual([
      { value: "412", label: `mots sur ${formatCount(1561)}` },
      { value: "1", label: "Légendaire" },
      { value: "0", label: "mot à la Dorure" },
      { value: "7", label: "échanges conclus" },
      { value: "0", label: "collection complète" },
      { value: "18 j", label: "de jeu" },
    ]);
    expect(statTiles(profile().stats, null)[0]?.label).toBe("mots");
  });
});

describe("atelierItems", () => {
  it("lists avatars by level: worn, owned, waiting in a coffret, locked", () => {
    const items = atelierItems("avatars", profile(), NOW);
    expect(items.slice(0, 6).map((i) => i.level)).toEqual([1, 1, 1, 1, 1, 1]);
    const state = (id: string) => items.find((i) => i.id === id);
    expect(state("cuistre")).toMatchObject({ state: "worn", level: 30 });
    expect(state("metoposcope")).toMatchObject({ state: "owned", name: "Le Métoposcope" });
    expect(state("fanfreluche")).toMatchObject({ state: "locked", level: 20 });
    const reached = atelierItems("avatars", profile({ level: 20 }), NOW);
    const fanfreluche = reached.find((i) => i.id === "fanfreluche");
    expect(fanfreluche?.state).toBe("in_coffret");
    if (fanfreluche === undefined) throw new Error("missing");
    expect(cosmeticStateLabel(fanfreluche)).toBe("Dans un coffret");
    expect(cosmeticLockedToast(fanfreluche)).toBe(
      "Il est dans ton coffret du niveau 20. Ouvre-le d'abord.",
    );
  });

  it("lists frames and titles, and keeps what older rules gave", () => {
    const frames = atelierItems("frames", profile({ frame: "gilded" }), NOW);
    expect(frames.slice(0, 4).map((i) => [i.id, cosmeticStateLabel(i)])).toEqual([
      ["simple", "Choisir"],
      ["gilded", "Choisi"],
      ["ink", "Niveau 20"],
      ["pearls", "Niveau 30"],
    ]);
    expect(frames.at(-1)).toMatchObject({ id: "royal-sun", name: "Soleil royal", level: 150 });
    const titles = atelierItems(
      "titles",
      profile({
        wardrobe: { ...profile().wardrobe, titles: ["Lexicographe en herbe", "Vieux titre"] },
      }),
      NOW,
    );
    expect(titles.find((i) => i.id === "Lexicographe en herbe")?.state).toBe("worn");
    expect(titles.find((i) => i.id === "Vieux titre")?.state).toBe("owned");
    expect(titles.find((i) => i.id === "Fine plume")?.state).toBe("locked");
  });
});

describe("settings", () => {
  it("says when the pseudo may change", () => {
    expect(pseudoHint(profile(), NOW)).toBe("Modifiable une fois par mois.");
    expect(
      pseudoHint(
        profile({ pseudoChangeableFrom: "2026-11-21T10:00:00.000Z" }),
        NOW,
        "Europe/Paris",
      ),
    ).toBe("Prochain changement possible le 21 novembre.");
  });

  it("puts the consequence in the delete button", () => {
    expect(deleteAccountLabel(412)).toBe("Supprimer mon compte et mes 412 mots");
    expect(deleteAccountLabel(1)).toBe("Supprimer mon compte et mon mot");
    expect(deleteAccountLabel(0)).toBe("Supprimer mon compte");
  });
});
