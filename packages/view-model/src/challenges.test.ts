import { createSeededRandom } from "@leximon/core";
import { describe, expect, it } from "vitest";
import {
  answerFeedback,
  answerGains,
  answerTitle,
  challengeOutlook,
  dailyView,
  escapingWords,
  feedbackLine,
  hideWordIn,
  levelShares,
  levelUpLine,
  memoryCounts,
  memoryNote,
  nextDueLabel,
  noChallengeNotice,
  outlookLine,
  questionKicker,
  recapLine,
  reviewQuestion,
  sessionBonusGain,
  sessionXpLine,
  spellingLine,
  typedQuestionHint,
} from "./challenges";
import { SACHET_NOUN } from "./format";

const NOW = Date.UTC(2026, 9, 20, 12, 0, 0);
const at = (ms: number) => new Date(NOW + ms).toISOString();
const PLI = { one: "pli", many: "plis" };
const NO_BONUS = { daily: 0, gilded: 0, credited: 0, reserve: 0 };
const PROGRESS = { xp: 0, level: 1, xpIntoLevel: 0, xpForNextLevel: 100, levelUp: false };
const NO_XP = { ...PROGRESS, xpGained: 0 };

const DAY = 86_400_000;

describe("nextDueLabel", () => {
  it("says when the next word comes back", () => {
    expect(nextDueLabel(null, NOW)).toBeNull();
    expect(nextDueLabel(at(-1), NOW)).toBe("maintenant");
    expect(nextDueLabel(at(10 * 60_000), NOW)).toBe("dans 10 min");
    expect(nextDueLabel(at(3 * 3_600_000), NOW)).toBe("dans 3 h");
    expect(nextDueLabel(at(26 * 3_600_000), NOW)).toBe("demain");
    expect(nextDueLabel(at(5 * 86_400_000), NOW)).toBe("dans 5 jours");
  });
});

describe("recapLine", () => {
  const answer = (correct: boolean, levelUp = false) =>
    ({ cardId: "x", correct, levelUp, level: "sketch", bonus: NO_BONUS, progress: NO_XP }) as const;

  it("counts right answers and level ups", () => {
    expect(recapLine([answer(true), answer(false)])).toBe("1 bonne réponse sur 2");
    expect(recapLine([answer(false)])).toBe("Aucune bonne réponse sur 1");
    expect(recapLine([answer(true, true), answer(true, true), answer(true)])).toBe(
      "3 bonnes réponses sur 3, 2 mots montent d'un palier",
    );
  });
});

describe("lines", () => {
  it("names the new level with its article", () => {
    expect(levelUpLine("galimatias", "ink")).toBe("galimatias passe à l'Encre !");
    expect(levelUpLine("galimatias", "gilded")).toBe("galimatias passe à la Dorure !");
    expect(levelUpLine("galimatias", "sketch")).toBe("galimatias passe à l'Esquisse !");
  });

  it("encourages", () => {
    expect(feedbackLine(true)).toBe("Bien vu.");
    expect(feedbackLine(false)).toContain("Raté");
  });
});

describe("answer gains", () => {
  const gains = (bonus: typeof NO_BONUS, levelUp = false) =>
    answerGains({ progress: { levelUp, level: 6 }, bonus }, PLI);

  it("gives nothing to an answer that earned nothing", () => {
    expect(gains(NO_BONUS)).toEqual({ gains: [], lost: null });
  });

  it("gives a banner to a new level and to each bonus that reached the reserve", () => {
    expect(gains({ daily: 1, gilded: 2, credited: 3, reserve: 4 }, true).gains).toEqual([
      { icon: "chest", title: "Niveau 6", note: "Un coffret t'attend" },
      { icon: "sachet", title: "1 pli bonus", note: "Défi du jour réussi" },
      { icon: "sachet", title: "2 plis bonus", note: "Mots passés à la Dorure" },
    ]);
  });

  it("says what the full reserve refused, without a banner for it", () => {
    expect(gains({ daily: 0, gilded: 1, credited: 0, reserve: 10 })).toEqual({
      gains: [],
      lost: "Ta réserve est pleine, ce pli bonus est perdu.",
    });
    expect(gains({ daily: 1, gilded: 2, credited: 1, reserve: 10 })).toEqual({
      gains: [{ icon: "sachet", title: "1 pli bonus", note: "Défi du jour réussi" }],
      lost: "Ta réserve est pleine, 2 plis bonus sont perdus.",
    });
  });
});

describe("the session's bonus", () => {
  it("sums the session's bonus boosters for the recap", () => {
    const answer = (credited: number) => ({
      cardId: "x",
      correct: true,
      levelUp: false,
      level: "sketch" as const,
      bonus: { ...NO_BONUS, daily: credited, credited },
      progress: NO_XP,
    });
    expect(sessionBonusGain([answer(0), answer(0)])).toBeNull();
    expect(sessionBonusGain([answer(1)], PLI)?.title).toBe("1 pli bonus");
    expect(sessionBonusGain([answer(1), answer(1)], PLI)?.title).toBe("2 plis bonus");
    expect(sessionBonusGain([answer(1)], SACHET_NOUN)).toEqual({
      title: "1 sachet bonus",
      note: "Dans ta réserve",
    });
  });
});

describe("sessionXpLine", () => {
  const answer = (xpGained: number) => ({
    cardId: "x",
    correct: xpGained > 0,
    levelUp: false,
    level: "sketch" as const,
    bonus: NO_BONUS,
    progress: { ...PROGRESS, xpGained },
  });

  it("adds up the XP of the session, and says nothing without any", () => {
    expect(sessionXpLine([answer(15), answer(0), answer(40)])).toBe("+55 XP");
    expect(sessionXpLine([answer(0)])).toBeNull();
  });
});

describe("défis screen", () => {
  const goal = { answers: 5, correct: 3 };

  it("shows the daily goal and what is left", () => {
    const fresh = dailyView({ goal, answers: 0, correct: 0, awarded: false });
    expect(fresh).toMatchObject({
      title: "3 bonnes réponses sur 5",
      action: "Commencer le défi",
      done: false,
      ratio: 0,
    });
    expect(fresh.text).toBe("Trouve trois bonnes réponses sur cinq pour gagner un sachet bonus.");
    const going = dailyView({ goal, answers: 2, correct: 1, awarded: false });
    expect(going.bars).toEqual(["right", "wrong", "empty", "empty", "empty"]);
    expect(going.text).toBe("Encore 3 questions.");
    expect(going.action).toBe("Continuer le défi");
    expect(dailyView({ goal, answers: 6, correct: 2, awarded: false }).text).toBe(
      "Encore 1 bonne réponse.",
    );
    expect(dailyView({ goal, answers: 5, correct: 4, awarded: true })).toMatchObject({
      title: "Sachet gagné",
      action: "Reviens demain",
      done: true,
      ratio: 1,
    });
    expect(dailyView({ goal, answers: 5, correct: 4, awarded: true }, PLI).title).toBe("Pli gagné");
  });

  it("states the level thresholds in force", () => {
    expect(memoryNote(NOW)).toBe(
      "Entre deux paliers, des questions à choix multiples t'aident à retenir le mot. Pour passer à l'Encre, écris-le de mémoire 7 jours après ta dernière révision (30 jours pour la Dorure). Si tu te trompes, il revient le lendemain.",
    );
  });

  it("builds a one-word question, wrong choices from the same collection", () => {
    const random = createSeededRandom("0123456789abcdef0123456789abcdef");
    const home = { cards: ["a", "b", "c", "d", "e"].map((id) => ({ id })) };
    const other = { cards: ["x", "y"].map((id) => ({ id })) };
    const question = reviewQuestion(random, "a", [other, home], undefined, NOW);
    if (question?.format !== "definition" && question?.format !== "word") {
      throw new Error("expected a multiple choice question");
    }
    expect(question.cardId).toBe("a");
    expect(question.choices).toHaveLength(4);
    expect(question.choices).toContain("a");
    expect(question.choices.every((id) => home.cards.some((card) => card.id === id))).toBe(true);
    expect(reviewQuestion(random, "unknown", [home], undefined, NOW)).toBeNull();
  });

  it("asks for a word typed when a right answer can raise its level", () => {
    const random = createSeededRandom("0123456789abcdef0123456789abcdef");
    const home = { cards: ["a", "b", "c", "d", "e"].map((id) => ({ id })) };
    const now = Date.UTC(2026, 10, 2, 12);
    const lastWeek = { level: "sketch" as const, lastReviewedAt: now - 8 * 86_400_000 };
    expect(reviewQuestion(random, "a", [home], lastWeek, now)).toEqual({
      cardId: "a",
      format: "typed",
    });
    const yesterday = { level: "sketch" as const, lastReviewedAt: now - 86_400_000 };
    expect(reviewQuestion(random, "a", [home], yesterday, now)?.format).not.toBe("typed");
  });

  it("counts words at each level, owned words starting on a blank page", () => {
    expect(memoryCounts(["a", "b", "c"], new Map([["b", "ink" as const]]))).toEqual({
      blank: 2,
      sketch: 0,
      ink: 1,
      gilded: 0,
    });
  });

  it("lists the words slipping away, those that can climb first, then the most overdue", () => {
    const now = Date.parse("2026-10-29T12:00:00Z");
    const word = (due: number, lastReviewedAt: number | null = now - DAY) => ({
      level: "sketch" as const,
      due,
      lastReviewedAt,
    });
    const memory = new Map([
      ["late", word(now - 3_600_000)],
      ["later", word(now - 60_000, now - 8 * DAY)],
      ["soon", word(now + 3 * 3_600_000)],
      ["far", word(now + 5 * DAY)],
      ["traded", word(now - 1)],
    ]);
    const words = escapingWords(memory, new Set(["late", "later", "soon", "far"]), now);
    expect(words).toEqual([
      { cardId: "later", due: true, when: "À réviser maintenant", rise: "Peut passer à l'Encre" },
      { cardId: "late", due: true, when: "À réviser maintenant", rise: null },
      { cardId: "soon", due: false, when: "À réviser dans 3 h", rise: null },
    ]);
  });

  it("tells what the next challenges hold", () => {
    const now = Date.parse("2026-10-29T12:00:00Z");
    const memory = new Map([
      ["climbs", { level: "sketch" as const, due: now - 1, lastReviewedAt: now - 8 * DAY }],
      ["due", { level: "ink" as const, due: now - 1, lastReviewedAt: now - 8 * DAY }],
      ["later", { level: "sketch" as const, due: now + DAY, lastReviewedAt: now - 9 * DAY }],
    ]);
    const outlook = challengeOutlook(memory, ["climbs", "due", "later", "new1", "new2"], now);
    expect(outlook).toEqual({ due: 2, rising: 1, fresh: 2 });
    expect(outlookLine(outlook)).toBe(
      "2 mots à revoir, dont 1 peut monter de palier. 2 nouveaux mots attendent leur première question.",
    );
    expect(outlookLine({ due: 1, rising: 0, fresh: 1 })).toBe(
      "1 mot à revoir. 1 nouveau mot attend sa première question.",
    );
    expect(outlookLine({ due: 0, rising: 0, fresh: 0 })).toBeNull();
    expect(levelShares({ blank: 0, sketch: 3, ink: 1, gilded: 0 })).toEqual({
      blank: 0,
      sketch: 0.75,
      ink: 0.25,
      gilded: 0,
    });
  });

  it("rings louder for a level or a sachet than for a plain answer", () => {
    const bonus = { daily: 0, gilded: 0, credited: 0, reserve: 0 };
    expect(answerFeedback({ correct: false, levelUp: false, bonus })).toEqual({
      cue: "answerWrong",
      vibration: [10, 60, 10],
      followUp: null,
    });
    expect(answerFeedback({ correct: true, levelUp: false, bonus }).followUp).toBeNull();
    expect(answerFeedback({ correct: true, levelUp: true, bonus }).followUp).toBe("chimeRare");
    expect(
      answerFeedback({ correct: true, levelUp: false, bonus: { ...bonus, daily: 1 } }).followUp,
    ).toBe("chimePrecious");
  });

  it("words the question and the answer", () => {
    expect(questionKicker("word")).toBe("Quel mot correspond à cette définition ?");
    expect(answerTitle(true, 15)).toBe("Juste. +15 XP");
    expect(answerTitle(false, 0)).toBe("Raté.");
    expect(answerTitle(true, 15, true)).toBe("Juste, à une lettre près. +15 XP");
    expect(questionKicker("typed")).toBe("Écris le mot");
    expect(typedQuestionHint("ink")).toBe(
      "Écris le mot de mémoire pour passer à la Dorure. Les accents ne comptent pas et une faute de frappe est tolérée.",
    );
    expect(spellingLine(" Écornifleur ", "écornifleur")).toBeNull();
    expect(spellingLine("ecornifleur", "écornifleur")).toBe("Ça s'écrit écornifleur.");
  });

  it("hides the words of the same family in a definition", () => {
    expect(hideWordIn("Petit du renard, jeune renard.", "renardeau")).toBe("Petit du …, jeune ….");
    expect(hideWordIn("Charge de tribun dans la Rome antique.", "tribunat")).toBe(
      "Charge de … dans la Rome antique.",
    );
    expect(hideWordIn("Faire la bobe, bouder.", "bobe")).toBe("Faire la …, bouder.");
    expect(hideWordIn("Marchand d'Éventails.", "éventaillier")).toBe("Marchand d'….");
    expect(hideWordIn("Espace compris entre la poupe et le banc.", "espale")).toBe(
      "Espace compris entre la poupe et le banc.",
    );
  });

  it("hides the word under a prefix, and the word inside a longer one", () => {
    expect(hideWordIn("Apaiser de nouveau.", "rapaiser")).toBe("… de nouveau.");
    expect(hideWordIn("Passer des menottes aux poignets.", "emmenotter")).toBe(
      "Passer des … aux poignets.",
    );
    expect(hideWordIn("Couvrir d'une ombre.", "obombrer")).toBe("Couvrir d'une ….");
    expect(hideWordIn("Sujet au péché, par opposition à impeccable.", "peccable")).toBe(
      "Sujet au péché, par opposition à ….",
    );
    expect(hideWordIn("Ouvrier qui lie le foin en bottes.", "botteleur")).toBe(
      "Ouvrier qui lie le foin en ….",
    );
    expect(hideWordIn("Faire le mal.", "méfaire")).toBe("… le mal.");
    expect(hideWordIn("Petit fossé creusé au fond d'un grand fossé.", "cunette")).toBe(
      "Petit fossé creusé au fond d'un grand fossé.",
    );
  });
});

describe("noChallengeNotice", () => {
  const now = Date.parse("2026-10-25T10:00:00Z");

  it("sends a player without words to the sachets", () => {
    expect(noChallengeNotice(null, now)).toBe(
      "Aucun mot à réviser. Ouvre des sachets pour découvrir tes premiers mots.",
    );
  });

  it("says when the next word comes back", () => {
    expect(noChallengeNotice("2026-10-25T13:00:00Z", now)).toMatch(/^Tes mots tiennent bon\. /);
  });
});
