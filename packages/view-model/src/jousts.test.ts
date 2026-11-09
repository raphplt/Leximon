import type { JoustSummary } from "@leximon/contract";
import { describe, expect, it } from "vitest";
import {
  accessText,
  answerTimeText,
  clockShare,
  completeDeck,
  deadlineText,
  deckPoolGroups,
  deckRoomLine,
  forfeitLine,
  ghostLine,
  joustLine,
  joustRowState,
  joustSections,
  localDeadline,
  outcomeWord,
  rewardText,
  scoresLine,
  scoreText,
  secondsLeft,
  sortJousts,
  toggleDeckCard,
  trappedLine,
  trapsLine,
  waitingLine,
} from "./jousts";

const NOW = Date.parse("2026-11-10T15:00:00Z");
const NOW_ISO = new Date(NOW).toISOString();
const PARIS = "Europe/Paris";
const alix = { code: "ABCD1234", pseudo: "Alix", avatar: "a", frame: "f", level: 9 };

function joust(overrides: Partial<JoustSummary>): JoustSummary {
  return {
    id: "00000000-0000-4000-8000-000000000000",
    kind: "friendly",
    launched: true,
    opponent: alix,
    state: "play",
    replyBy: null,
    outcome: null,
    forfeit: false,
    mine: null,
    theirs: null,
    createdAt: "2026-11-10T14:00:00Z",
    seen: true,
    ...overrides,
  };
}

describe("jousts copy", () => {
  it("says what keeps a player from jousting", () => {
    expect(accessText("open", 8)).toBeNull();
    expect(accessText("level_too_low", 8)).toBe("Les joutes ouvrent au niveau 8.");
  });

  it("gives the score with its time", () => {
    expect(scoreText({ correct: 4, ms: 31_400 }, 5)).toBe("4 sur 5 en 31 s");
  });

  it("says when the second player must play", () => {
    expect(deadlineText("2026-11-11T17:40:00Z", NOW, PARIS)).toBe("demain 18 h 40");
    expect(deadlineText("2026-11-10T20:05:00Z", NOW, PARIS)).toBe("aujourd'hui 21 h 05");
    expect(deadlineText("2026-11-13T08:00:00Z", NOW, PARIS)).toBe("le 13 novembre à 9 h 00");
  });

  it("lines up each joust by where it stands", () => {
    expect(joustLine(joust({}), 5, NOW, PARIS)).toEqual({
      title: "Joute amicale contre Alix",
      detail: "À toi de jouer.",
      toPlay: true,
    });
    expect(
      joustLine(
        joust({ kind: "ranked", state: "waiting", replyBy: "2026-11-11T17:40:00Z" }),
        5,
        NOW,
        PARIS,
      ).detail,
    ).toBe("Alix a jusqu'à demain 18 h 40 pour jouer.");
    expect(
      joustLine(
        joust({
          state: "ended",
          outcome: "won",
          mine: { correct: 4, ms: 31_000 },
          theirs: { correct: 3, ms: 40_000 },
        }),
        5,
        NOW,
      ).detail,
    ).toBe("Gagnée. 4 sur 5 en 31 s contre 3 sur 5 en 40 s.");
    expect(joustLine(joust({ state: "ended", outcome: "won", forfeit: true }), 5, NOW).detail).toBe(
      "Gagnée. Alix n'a pas joué à temps.",
    );
  });

  it("names the rewards, with their numbers", () => {
    const result = { mine: [], theirs: [], tournament: null, wished: [] };
    expect(rewardText({ ...result, xp: 40, boosters: 1 })).toBe(
      "Tu gagnes 40 XP et 1 sachet bonus en réserve.",
    );
    expect(rewardText({ ...result, xp: 20, boosters: 0 })).toBe("Tu gagnes 20 XP.");
    expect(rewardText({ ...result, xp: 0, boosters: 0 })).toBeNull();
  });

  it("follows the first player's score question by question", () => {
    const ghost = [
      { correct: true, ms: 3_000 },
      { correct: false, ms: 9_000 },
      { correct: true, ms: 4_000 },
    ];
    expect(ghostLine(ghost, 0, alix)).toBe("À la 1re question, Alix en avait 1.");
    expect(ghostLine(ghost, 2, alix)).toBe("À la 3e question, Alix en avait 2.");
  });

  it("keeps the deck within its size and points", () => {
    const cost = (id: string) => (id.startsWith("l") ? 6 : 1);
    const limits = { size: 3, budget: 7 };
    expect(toggleDeckCard(["a"], "l1", cost, limits)).toEqual({ deck: ["a", "l1"], refused: null });
    expect(toggleDeckCard(["a", "l1"], "l2", cost, limits).refused).toMatch(/7 points/);
    expect(toggleDeckCard(["a", "b", "c"], "d", cost, limits).refused).toMatch(/3 cartes/);
    expect(toggleDeckCard(["a", "b"], "a", cost, limits)).toEqual({ deck: ["b"], refused: null });
  });

  it("puts the jousts to play first", () => {
    const sorted = sortJousts([
      joust({ id: "1", state: "ended" }),
      joust({ id: "2", state: "waiting" }),
      joust({ id: "3", state: "play" }),
    ]);
    expect(sorted.map((j) => j.id)).toEqual(["3", "2", "1"]);
  });
});

describe("the question's clock", () => {
  it("starts a fresh question now, and keeps the deadline of one served earlier", () => {
    const question = { servedAt: "2026-11-10T15:00:00.000Z", deadline: "2026-11-10T15:00:15.000Z" };
    // This device runs 3 seconds late.
    expect(localDeadline(question, NOW - 3_000)).toBe(NOW + 12_000);
    expect(localDeadline(question, NOW + 60_000)).toBe(NOW + 15_000);
    expect(secondsLeft(NOW + 14_200, NOW)).toBe(15);
    expect(clockShare(NOW + 7_500, 15_000, NOW)).toBe(0.5);
  });
});

describe("the end of a joust", () => {
  it("says the scores and the words that trapped the opponent", () => {
    expect(scoresLine({ correct: 1, ms: 9_000 }, { correct: 0, ms: 75_000 }, 5, alix)).toBe(
      "Tu as trouvé 1 mot sur 5 en 9 s, et Alix 0 sur 5 en 75 s.",
    );
    expect(trappedLine([], alix)).toBeNull();
    expect(trappedLine(["cacochyme"], alix)).toBe("Ton mot cacochyme a piégé Alix.");
    expect(trappedLine(["a", "b", "c"], alix)).toBe("Tes mots a, b et c ont piégé Alix.");
    expect(forfeitLine({ launched: true, outcome: "won", opponent: alix })).toBe(
      "La joute te revient, car Alix n'a pas joué à temps.",
    );
    expect(forfeitLine({ launched: true, outcome: "lost", opponent: alix })).toBe(
      "La joute revient à Alix, car tu ne l'as pas commencée dans les 24 heures.",
    );
    expect(forfeitLine({ launched: false, outcome: "lost", opponent: alix })).toBe(
      "La joute revient à ton adversaire, car tu n'as pas joué à temps.",
    );
  });
});

describe("the jousts' home", () => {
  it("files each joust in its section, a result not watched yet apart", () => {
    const toPlay = joust({ id: "1", state: "play" });
    const sealed = joust({ id: "2", state: "ended", outcome: "won", seen: false });
    const waiting = joust({ id: "3", state: "waiting" });
    const old = joust({ id: "4", state: "ended", outcome: "lost" });
    const newer = joust({ id: "5", state: "ended", outcome: "draw", createdAt: NOW_ISO });
    const sections = joustSections([old, waiting, sealed, toPlay, newer]);
    expect(sections.toPlay).toEqual([toPlay]);
    expect(sections.toDiscover).toEqual([sealed]);
    expect(sections.waiting).toEqual([waiting]);
    expect(sections.ended).toEqual([newer, old]);
  });

  it("says in one short line where a joust stands", () => {
    const at = "2026-11-11T08:05:00Z";
    expect(joustRowState(joust({ kind: "ranked" }), NOW, PARIS)).toBe("Classée · à toi de jouer");
    expect(joustRowState(joust({ launched: false, replyBy: at }), NOW, PARIS)).toBe(
      "Amicale · avant demain 9 h 05",
    );
    expect(joustRowState(joust({ state: "waiting", replyBy: at }), NOW, PARIS)).toBe(
      "Amicale · jusqu'à demain 9 h 05",
    );
    expect(joustRowState(joust({ state: "ended", forfeit: true }), NOW, PARIS)).toBe(
      "Amicale · forfait",
    );
    const ended = joust({
      state: "ended",
      mine: { correct: 4, ms: 1 },
      theirs: { correct: 3, ms: 1 },
    });
    expect(joustRowState(ended, NOW, PARIS)).toBe("Amicale · 4 à 3");
    expect(outcomeWord("won", true)).toBe("Victoire !");
    expect(outcomeWord("draw")).toBe("Égalité");
  });
});

describe("the run's summary", () => {
  it("names the wait and the traps, for one word and several", () => {
    expect(waitingLine(alix, "2026-11-11T16:20:00Z", NOW, PARIS)).toBe(
      "Alix a jusqu'à demain 17 h 20. On te prévient au courrier.",
    );
    expect(trapsLine(5, alix)).toBe("Les 5 mots de ton deck que Alix devra trouver.");
    expect(trapsLine(1, alix)).toBe("Le mot de ton deck que Alix devra trouver.");
  });

  it("gives an answer's time to the tenth, or says it was missed", () => {
    expect(answerTimeText({ correct: true, ms: 4_240 })).toBe("4,2 s");
    expect(answerTimeText({ correct: false, ms: 15_000 })).toBe("manqué");
  });
});

describe("completing the deck", () => {
  const candidates = [
    { cardId: "a", cost: 1 },
    { cardId: "b", cost: 6 },
    { cardId: "c", cost: 3 },
    { cardId: "d", cost: 3 },
    { cardId: "e", cost: 2 },
  ];

  it("takes every place it can, then the rarest cards the points allow", () => {
    expect(completeDeck([], candidates, { size: 3, budget: 25 })).toEqual(["b", "c", "d"]);
    expect(completeDeck(["a"], candidates, { size: 10, budget: 10 })).toEqual(["a", "c", "d", "e"]);
  });

  it("keeps the cards already chosen and a full deck as it is", () => {
    expect(completeDeck(["e", "a"], candidates, { size: 2, budget: 25 })).toEqual(["e", "a"]);
  });

  it("says the room left, or why nothing fits although places are empty", () => {
    const limits = { size: 10, budget: 25, min: 5 };
    expect(deckRoomLine(0, 0, limits, 1)).toBe(
      "Il te reste 25 points pour 10 places. Une carte Courante coûte 1 point, une Légendaire 6.",
    );
    expect(deckRoomLine(9, 24, limits, 1)).toBe(
      "Il te reste 1 point pour 1 place. Une carte Courante coûte 1 point, une Légendaire 6.",
    );
    expect(deckRoomLine(6, 21, limits, 5)).toBe(
      "Aucun de tes mots ne tient dans les 4 points qui restent. Retire une carte rare pour poser plusieurs cartes moins chères ou garde ce deck de 6 cartes.",
    );
    expect(deckRoomLine(4, 25, limits, 2)).toBe(
      "Tes 25 points sont dépensés. Retire une carte rare pour poser plusieurs cartes moins chères.",
    );
    expect(deckRoomLine(10, 20, limits, 1)).toBe("Ton deck est complet, avec 10 cartes.");
  });

  it("groups the words found by rarity, the rarest first, each group in alphabetical order", () => {
    const card = (word: string, rarity: "common" | "rare", cost: number) => ({
      cost,
      card: { word, rarity },
    });
    const groups = deckPoolGroups([
      card("zibeline", "common", 1),
      card("écureuil", "common", 1),
      card("orfraie", "rare", 3),
    ]);
    expect(groups.map((group) => [group.rarity, group.cost])).toEqual([
      ["rare", 3],
      ["common", 1],
    ]);
    expect(groups[1]?.cards.map((entry) => entry.card.word)).toEqual(["écureuil", "zibeline"]);
  });
});
