import type { MailLetter } from "@leximon/contract";
import { describe, expect, it } from "vitest";
import { letterView, slippingDetail } from "./mail";

const now = Date.parse("2026-10-22T12:00:00.000Z");
const badge = { code: "AAAA1111", pseudo: "Mirabelle", avatar: "zani", frame: "simple", level: 12 };
const base = { id: 1, player: badge, read: false, createdAt: "2026-10-22T08:05:00.000Z" };
const tradeId = "8da39c89-f2d7-4463-b15e-21ebc88c1739";
const clanId = "0c6f2c2e-5f0e-4d5e-9b8c-2a1d3c4b5a69";

function view(letter: MailLetter) {
  return letterView(letter, now, "UTC");
}

describe("letterView", () => {
  it("names the other player and leads to the offers", () => {
    expect(view({ ...base, kind: "offer_received", tradeId })).toEqual({
      title: "Mirabelle t'envoie une offre",
      detail: "Échanges",
      when: "08:05",
      target: { kind: "screen", href: "/echanges" },
    });
    expect(view({ ...base, kind: "offer_completed", tradeId }).title).toBe(
      "Mirabelle accepte ton offre",
    );
    expect(view({ ...base, player: null, kind: "offer_declined", tradeId }).title).toBe(
      "Un joueur parti refuse ton offre",
    );
  });

  it("quotes the message that names the player, and opens the discussion", () => {
    expect(view({ ...base, kind: "clan_mention", clanId, excerpt: "@Toi, viens voir" })).toEqual(
      expect.objectContaining({
        title: "Mirabelle parle de toi",
        detail: "« @Toi, viens voir »",
        target: { kind: "chat" },
      }),
    );
    expect(view({ ...base, kind: "clan_mention", clanId, excerpt: null }).detail).toBe(
      "Message effacé",
    );
  });

  it("sends a request to enter the clan to the clan's page", () => {
    expect(view({ ...base, kind: "clan_request", clanId })).toEqual(
      expect.objectContaining({
        title: "Mirabelle veut entrer dans le clan",
        target: { kind: "screen", href: "/clan" },
      }),
    );
  });
});

describe("slippingDetail", () => {
  it("counts the other words slipping away", () => {
    expect(slippingDetail(0)).toBe("Défis");
    expect(slippingDetail(1)).toBe("Et 1 autre mot");
    expect(slippingDetail(3)).toBe("Et 3 autres mots");
  });
});
