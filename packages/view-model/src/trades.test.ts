import type { Trade } from "@leximon/contract";
import { describe, expect, it } from "vitest";
import {
  boxTabLabel,
  copiesAfterTrade,
  effectiveStatus,
  formatPlayerCode,
  heldLabel,
  historyLine,
  normalizePlayerCode,
  offerProblem,
  pickOrder,
  refusalMessage,
  splitTrades,
  statusLabel,
  timeLeftLabel,
  toggleCard,
  tradeDoneAction,
  tradeDoneTitle,
  tradeLevelLabel,
  tradeRulesNote,
  tradeSides,
  tradesDone,
} from "./trades";

const now = Date.parse("2026-10-20T12:00:00.000Z");

function trade(overrides: Partial<Trade> = {}): Trade {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    proposerCode: "AAAA1111",
    recipientCode: "BBBB2222",
    proposer: { code: "AAAA1111", pseudo: null, avatar: "cuistre", frame: "simple", level: 12 },
    recipient: { code: "BBBB2222", pseudo: null, avatar: "zani", frame: "simple", level: 9 },
    give: ["acariatre"],
    want: ["bisbille", "cacochyme"],
    status: "pending",
    createdAt: "2026-10-20T10:00:00.000Z",
    expiresAt: "2026-10-23T10:00:00.000Z",
    resolvedAt: null,
    ...overrides,
  };
}

describe("normalizePlayerCode", () => {
  it("accepts lower case, spaces and dashes", () => {
    expect(normalizePlayerCode(" abcd-efgh ")).toBe("ABCDEFGH");
    expect(normalizePlayerCode("1234 5678")).toBe("12345678");
  });

  it("refuses the wrong length and letters outside Crockford base 32", () => {
    expect(normalizePlayerCode("ABCDEFG")).toBeNull();
    expect(normalizePlayerCode("ABCDEFGHJ")).toBeNull();
    expect(normalizePlayerCode("ABCDEFGI")).toBeNull();
    expect(normalizePlayerCode("ABCDEFGU")).toBeNull();
  });
});

describe("formatPlayerCode", () => {
  it("splits the code in two groups", () => {
    expect(formatPlayerCode("ABCDEFGH")).toBe("ABCD EFGH");
    expect(formatPlayerCode("ABC")).toBe("ABC");
  });
});

describe("effectiveStatus and statusLabel", () => {
  it("treats a pending offer past its deadline as expired", () => {
    expect(effectiveStatus(trade(), now)).toBe("pending");
    expect(effectiveStatus(trade({ expiresAt: "2026-10-20T11:59:59.000Z" }), now)).toBe("expired");
    expect(
      effectiveStatus(trade({ status: "completed", expiresAt: "2026-10-01T00:00:00.000Z" }), now),
    ).toBe("completed");
  });

  it("says every status in plain French", () => {
    expect(statusLabel("completed")).toBe("Conclue");
    expect(statusLabel("declined")).toBe("Refusée");
    expect(statusLabel("cancelled")).toBe("Annulée");
    expect(statusLabel("expired")).toBe("Expirée");
    expect(statusLabel("pending")).toBe("En attente");
  });
});

describe("tradeSides", () => {
  it("swaps the sides for an offer received", () => {
    expect(tradeSides(trade(), "incoming")).toEqual({
      counterpartCode: "AAAA1111",
      counterpart: expect.objectContaining({ code: "AAAA1111" }),
      mine: ["bisbille", "cacochyme"],
      theirs: ["acariatre"],
    });
    expect(tradeSides(trade(), "outgoing")).toEqual({
      counterpartCode: "BBBB2222",
      counterpart: expect.objectContaining({ code: "BBBB2222" }),
      mine: ["acariatre"],
      theirs: ["bisbille", "cacochyme"],
    });
  });
});

describe("splitTrades", () => {
  it("puts pending offers first, the most urgent on top, then the newest answers", () => {
    const late = trade({ id: "late", expiresAt: "2026-10-23T09:00:00.000Z" });
    const urgent = trade({ id: "urgent", expiresAt: "2026-10-20T13:00:00.000Z" });
    const lapsed = trade({ id: "lapsed", expiresAt: "2026-10-20T11:00:00.000Z" });
    const declined = trade({
      id: "declined",
      status: "declined",
      resolvedAt: "2026-10-20T11:30:00.000Z",
    });
    const { pending, history } = splitTrades([late, lapsed, declined, urgent], now);
    expect(pending.map((t) => t.id)).toEqual(["urgent", "late"]);
    expect(history.map((t) => t.id)).toEqual(["declined", "lapsed"]);
  });
});

describe("timeLeftLabel", () => {
  it("counts days, hours, then minutes", () => {
    expect(timeLeftLabel("2026-10-23T10:00:00.000Z", now)).toBe("Expire dans 2 j 22 h");
    expect(timeLeftLabel("2026-10-21T13:00:00.000Z", now)).toBe("Expire dans 1 j 01 h");
    expect(timeLeftLabel("2026-10-20T15:07:00.000Z", now)).toBe("Expire dans 3 h 07");
    expect(timeLeftLabel("2026-10-20T12:11:10.000Z", now)).toBe("Expire dans 12 min");
  });

  it("never shows zero, and says when it is over", () => {
    expect(timeLeftLabel("2026-10-20T12:00:05.000Z", now)).toBe("Expire dans 1 min");
    expect(timeLeftLabel("2026-10-20T12:00:00.000Z", now)).toBe("Expirée");
  });
});

describe("toggleCard", () => {
  it("adds, removes, and stops at the limit of the two levels", () => {
    expect(toggleCard([], "a", 3)).toEqual(["a"]);
    expect(toggleCard(["a", "b"], "a", 3)).toEqual(["b"]);
    const full = ["a", "b", "c"];
    expect(toggleCard(full, "d", 3)).toBe(full);
    expect(toggleCard(full, "b", 3)).toEqual(["a", "c"]);
  });

  it("swaps the card when only one goes on each side", () => {
    expect(toggleCard(["a"], "b", 1)).toEqual(["b"]);
    expect(toggleCard(["a"], "a", 1)).toEqual([]);
  });
});

describe("pickOrder", () => {
  const card = (id: string, rarity: "common" | "rare" | "epic", word: string) => ({
    id,
    rarity,
    word,
  });
  const cards = [
    card("a", "common", "écu"),
    card("b", "rare", "zéphyr"),
    card("c", "common", "abaque"),
    card("d", "epic", "obole"),
  ];

  it("puts the rarest first, then sorts words as a French reader would", () => {
    expect(pickOrder(cards, null).map((c) => c.id)).toEqual(["d", "b", "c", "a"]);
  });

  it("leads with the words the receiver lacks", () => {
    expect(pickOrder(cards, new Set(["b", "d"])).map((c) => c.id)).toEqual(["c", "a", "d", "b"]);
  });
});

describe("heldLabel", () => {
  it("counts days, then hours, before a held card can move", () => {
    const at = Date.parse("2026-10-20T12:00:00.000Z");
    expect(heldLabel("2026-10-27T11:00:00.000Z", at)).toBe("Échangeable dans 7 j");
    expect(heldLabel("2026-10-20T16:30:00.000Z", at)).toBe("Échangeable dans 5 h");
  });
});

describe("offerProblem", () => {
  const offer = {
    recipientCode: "bbbb-2222",
    ownCode: "AAAA1111",
    give: ["a"],
    want: ["b"],
    max: 3,
  };

  it("accepts up to the limit of the two levels on each side", () => {
    expect(offerProblem(offer)).toBeNull();
    expect(offerProblem({ ...offer, give: ["a", "b", "c"], want: ["d", "e", "f"] })).toBeNull();
    expect(offerProblem({ ...offer, give: ["a", "b"], max: 1 })).toBe("too_many_cards");
  });

  it("names what is wrong, like the server would", () => {
    expect(offerProblem({ ...offer, recipientCode: "nope" })).toBe("invalid_code");
    expect(offerProblem({ ...offer, recipientCode: "aaaa 1111" })).toBe("self_trade");
    expect(offerProblem({ ...offer, give: [] })).toBe("empty_side");
    expect(offerProblem({ ...offer, want: ["a", "b", "c", "d"] })).toBe("too_many_cards");
  });
});

describe("refusalMessage", () => {
  it("explains each refusal", () => {
    expect(refusalMessage("daily_limit_reached")).toContain("10 offres");
    expect(refusalMessage("card_not_tradeable")).toContain("7 jours");
    expect(refusalMessage("player_not_found")).toBe("Personne n'a ce code.");
    expect(refusalMessage("trade_not_found")).toBe("Cette offre n'existe plus.");
  });
});

describe("tradeLevelLabel", () => {
  it("says how many levels are left, and nothing once the level is reached", () => {
    expect(tradeLevelLabel(4, 5)).toBe("Les échanges ouvrent au niveau 5. Encore 1 niveau.");
    expect(tradeLevelLabel(1, 5)).toContain("Encore 4 niveaux");
    expect(tradeLevelLabel(5, 5)).toBeNull();
  });
});

describe("échanges screen", () => {
  it("counts the offers waiting in each tab", () => {
    expect(boxTabLabel("incoming", 2)).toBe("Reçues (2)");
    expect(boxTabLabel("outgoing", 0)).toBe("Envoyées");
  });

  it("states the limits in force", () => {
    expect(tradeRulesNote(now)).toBe("10 offres par 24 h. Une offre expire après 72 h.");
  });

  it("sums up a past offer, the player's cards first", () => {
    const done = trade({ status: "completed", resolvedAt: "2026-10-20T11:00:00.000Z" });
    const upper = (id: string) => id.toUpperCase();
    expect(historyLine(done, "incoming", now, upper)).toBe(
      "Conclue avec AAAA 1111 : BISBILLE, CACOCHYME contre ACARIATRE.",
    );
    expect(historyLine(done, "outgoing", now, upper)).toBe(
      "Conclue avec BBBB 2222 : ACARIATRE contre BISBILLE, CACOCHYME.",
    );
  });

  it("names the other player by pseudo, or as gone once they deleted their account", () => {
    const upper = (id: string) => id.toUpperCase();
    const named = trade({
      status: "completed",
      proposer: { code: "AAAA1111", pseudo: "Raph", avatar: "cuistre", frame: "ink", level: 30 },
    });
    expect(historyLine(named, "incoming", now, upper)).toMatch(/^Conclue avec Raph :/);
    const gone = trade({ status: "completed", proposerCode: "", proposer: null });
    expect(historyLine(gone, "incoming", now, upper)).toMatch(/^Conclue avec Un joueur parti :/);
  });
});

describe("copies after a trade", () => {
  it("moves one copy each way, and forgets a card given away for good", () => {
    const before = new Map([
      ["aigrefin", 2],
      ["baguenaude", 1],
    ]);
    expect(copiesAfterTrade(before, ["capon", "aigrefin"], ["baguenaude", "aigrefin"])).toEqual(
      new Map([
        ["aigrefin", 2],
        ["capon", 1],
      ]),
    );
    expect(before.get("baguenaude")).toBe(1);
  });
});

describe("an offer accepted while its sender was away", () => {
  const lucie = { code: "AAAA1111", pseudo: "Lucie", avatar: "zani", frame: "simple", level: 3 };
  const letter = (id: number, kind: "offer_completed" | "offer_declined", read = false) => ({
    id,
    kind,
    player: lucie,
    read,
    createdAt: "2026-10-24T10:00:00.000Z",
    tradeId: "6f1c3b8e-1f7a-4e8a-9a51-2a3b4c5d6e7f",
  });

  it("keeps the unread acceptances not shown yet, oldest first", () => {
    const letters = [
      letter(9, "offer_completed"),
      letter(8, "offer_declined"),
      letter(7, "offer_completed", true),
      letter(6, "offer_completed"),
      letter(5, "offer_completed"),
    ];
    expect(tradesDone(letters, new Set([6])).map((t) => t.letterId)).toEqual([5, 9]);
  });

  it("names who said yes, and leads to the card or the album", () => {
    expect(tradeDoneTitle(lucie)).toBe("Lucie a dit oui !");
    expect(tradeDoneTitle(null)).toBe("Échange conclu !");
    expect(tradeDoneAction(1)).toBe("Lire la carte");
    expect(tradeDoneAction(3)).toBe("Voir dans l'album");
  });
});
