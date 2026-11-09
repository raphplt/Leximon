import type { PatronResponse } from "@leximon/contract";
import { describe, expect, it } from "vitest";
import {
  claimableLabel,
  finderLine,
  findStateLine,
  findsLeftLine,
  formatEuros,
  monthCosmeticLine,
  PATRON_MANAGE,
  PATRON_RESUME,
  patronCosmeticName,
  patronMarkHint,
  patronMarkLabel,
  patronMenuLabel,
  patronPageKind,
  patronPlanChoices,
  patronStatus,
  patronThanksLine,
  patronTrialNote,
  patronWelcome,
  thanksGroups,
  wordFoundLine,
} from "./patron";

const NOW = Date.parse("2027-03-10T12:00:00.000Z");
const ZONE = "Europe/Paris";

type Subscription = NonNullable<PatronResponse["subscription"]>;

function patron(overrides: Partial<PatronResponse> = {}): PatronResponse {
  return {
    sales: "open",
    minor: false,
    mark: null,
    monthCosmetic: null,
    claimable: [],
    canBuy: true,
    trialAvailable: true,
    trialDays: 14,
    founder: false,
    foundingOffer: false,
    finds: { left: 0, words: [] },
    thanksListed: true,
    subscription: null,
    ...overrides,
  };
}

function subscription(overrides: Partial<Subscription> = {}): Subscription {
  return {
    standing: "patron",
    plan: "monthly",
    currentPeriodEnd: "2027-04-14T08:00:00.000Z",
    trialEnd: null,
    cancelAt: null,
    paymentFailing: false,
    since: "2027-02-14T08:00:00.000Z",
    ...overrides,
  };
}

/** Intl puts narrow no-break spaces in prices; tests read them as plain spaces. */
const plain = (text: string | null | undefined) => text?.replace(/\s/g, " ");

describe("patronPageKind", () => {
  it("shows the offer to whoever may buy", () => {
    expect(patronPageKind(patron(), false)).toBe("offer");
  });

  it("shows the offer to a guest once sales are open, to send them to create an account", () => {
    expect(patronPageKind(patron({ canBuy: false }), true)).toBe("offer");
    expect(patronPageKind(patron({ canBuy: false, sales: "closed" }), true)).toBe("door");
  });

  it("keeps the announcement while sales are closed or unavailable", () => {
    expect(patronPageKind(patron({ sales: "closed", canBuy: false }), false)).toBe("door");
    expect(patronPageKind(patron({ sales: "unavailable", canBuy: false }), false)).toBe("door");
  });

  it("shows the status to a subscriber, trial included", () => {
    expect(patronPageKind(patron({ subscription: subscription() }), false)).toBe("member");
    expect(
      patronPageKind(patron({ subscription: subscription({ standing: "trial" }) }), false),
    ).toBe("member");
  });

  it("offers again to a former subscriber", () => {
    const ended = patron({ subscription: subscription({ standing: "none" }) });
    expect(patronPageKind(ended, false)).toBe("offer");
  });
});

describe("prices", () => {
  it("formats cents as euros", () => {
    expect(plain(formatEuros(399))).toBe("3,99 €");
    expect(plain(formatEuros(2999))).toBe("29,99 €");
  });

  it("gives both plans, the yearly one brought back to a month", () => {
    const [monthly, yearly] = patronPlanChoices(NOW);
    expect(plain(monthly?.label)).toBe("3,99 € par mois");
    expect(monthly?.note).toBeNull();
    expect(plain(yearly?.label)).toBe("29,99 € par an");
    expect(plain(yearly?.note)).toBe("Soit 2,50 € par mois.");
  });

  it("splits each plan into a price tag, the ribbon on the yearly one", () => {
    const [monthly, yearly] = patronPlanChoices(NOW);
    expect([plain(monthly?.price), monthly?.period, monthly?.ribbon]).toEqual([
      "3,99 €",
      "par mois",
      null,
    ]);
    expect([plain(yearly?.price), yearly?.period, plain(yearly?.ribbon)]).toEqual([
      "29,99 €",
      "par an",
      "2,50 € par mois",
    ]);
  });

  it("mentions the trial only to who never had one", () => {
    expect(patronTrialNote(patron())).toContain("14 premiers jours");
    expect(patronTrialNote(patron({ trialAvailable: false }))).toBeNull();
  });
});

describe("cosmetics", () => {
  it("names each kind", () => {
    expect(patronCosmeticName({ kind: "frame", frame: "wax" })).toBe("le cadre Sceau de cire");
    expect(patronCosmeticName({ kind: "avatar", avatar: "grimelin" })).toBe(
      "l'avatar gravé Le Grimelin",
    );
    expect(patronCosmeticName({ kind: "title", title: "Veilleur" })).toBe("le titre Veilleur");
  });

  it("shows the month's cosmetic, or nothing for a month without one", () => {
    expect(monthCosmeticLine({ month: "2027-03", cosmetic: { kind: "frame", frame: "wax" } })).toBe(
      "Ce mois-ci, les mécènes reçoivent le cadre Sceau de cire.",
    );
    expect(monthCosmeticLine(null)).toBeNull();
  });

  it("labels a claimable cosmetic with its month", () => {
    expect(claimableLabel({ month: "2027-03", cosmetic: { kind: "frame", frame: "wax" } })).toBe(
      "Le cadre Sceau de cire, mars 2027",
    );
  });
});

describe("patronStatus", () => {
  it("is null without a running subscription", () => {
    expect(patronStatus(patron(), NOW, ZONE)).toBeNull();
    expect(
      patronStatus(patron({ subscription: subscription({ standing: "none" }) }), NOW, ZONE),
    ).toBeNull();
  });

  it("gives a patron the month they started and the next payment", () => {
    const status = patronStatus(patron({ subscription: subscription() }), NOW, ZONE);
    expect(status?.headline).toBe("Mécène depuis février 2027");
    expect(status?.lines.map(plain)).toEqual([
      "Ton prochain paiement de 3,99 € aura lieu le 14 avril.",
    ]);
    expect(status?.warning).toBeNull();
    expect(status?.manage).toBe(PATRON_MANAGE);
  });

  it("names a founder", () => {
    const status = patronStatus(patron({ founder: true, subscription: subscription() }), NOW, ZONE);
    expect(status?.headline).toBe("Mécène fondateur depuis février 2027");
  });

  it("says when a cancelled subscription stops, and offers to resume it", () => {
    const status = patronStatus(
      patron({ subscription: subscription({ cancelAt: "2027-04-14T08:00:00.000Z" }) }),
      NOW,
      ZONE,
    );
    expect(status?.lines).toEqual([
      "Ton abonnement s'arrête le 14 avril. Tes cosmétiques restent à toi.",
    ]);
    expect(status?.manage).toBe(PATRON_RESUME);
  });

  it("gives the year of a date in another year", () => {
    const status = patronStatus(
      patron({
        subscription: subscription({ plan: "yearly", currentPeriodEnd: "2028-02-14T08:00:00Z" }),
      }),
      NOW,
      ZONE,
    );
    expect(status?.lines.map(plain)).toEqual([
      "Ton prochain paiement de 29,99 € aura lieu le 14 février 2028.",
    ]);
  });

  it("tells a trial when it ends and what it pays then", () => {
    const status = patronStatus(
      patron({
        subscription: subscription({
          standing: "trial",
          since: null,
          trialEnd: "2027-03-22T08:00:00.000Z",
          currentPeriodEnd: "2027-03-22T08:00:00.000Z",
        }),
      }),
      NOW,
      ZONE,
    );
    expect(status?.headline).toBe("Essai gratuit en cours");
    expect(plain(status?.lines[0])).toBe(
      "Ton essai se termine le 22 mars, et ton premier paiement de 3,99 € aura lieu ce jour-là.",
    );
    expect(status?.lines).toHaveLength(2);
  });

  it("tells a cancelled trial that nothing will be charged", () => {
    const status = patronStatus(
      patron({
        subscription: subscription({
          standing: "trial",
          since: null,
          trialEnd: "2027-03-22T08:00:00.000Z",
          cancelAt: "2027-03-22T08:00:00.000Z",
        }),
      }),
      NOW,
      ZONE,
    );
    expect(status?.lines[0]).toBe("Ton essai s'arrête le 22 mars, sans aucun paiement.");
  });

  it("warns of a failed payment", () => {
    const status = patronStatus(
      patron({ subscription: subscription({ paymentFailing: true }) }),
      NOW,
      ZONE,
    );
    expect(status?.warning).toBe(
      "Ton dernier paiement n'est pas passé. Mets à jour ta carte pour rester mécène.",
    );
  });
});

describe("patronWelcome", () => {
  const trial = subscription({
    standing: "trial",
    since: null,
    trialEnd: "2027-03-22T08:00:00.000Z",
    currentPeriodEnd: "2027-03-22T08:00:00.000Z",
  });

  it("is null without a running subscription", () => {
    expect(patronWelcome(patron(), NOW, ZONE)).toBeNull();
  });

  it("gives a trial the mark now, then the first payment and what it brings", () => {
    const welcome = patronWelcome(patron({ subscription: trial }), NOW, ZONE);
    expect(welcome?.steps.map((step) => [step.when, plain(step.what), step.later])).toEqual([
      ["Aujourd'hui", "Le titre et le badge de mécène", false],
      ["22 mars", "Premier paiement de 3,99 €", true],
      ["Dès ce paiement", "Le cosmétique du mois et le droit de dénicher un mot", true],
    ]);
    expect(welcome?.note).toBe("Tu peux résilier en un clic avant le 22 mars, sans rien payer.");
  });

  it("drops the way out once the trial is already cancelled", () => {
    const cancelled = { ...trial, cancelAt: "2027-03-22T08:00:00.000Z" };
    expect(patronWelcome(patron({ subscription: cancelled }), NOW, ZONE)?.note).toBeNull();
  });

  it("gives a paying patron the month's cosmetic now, then the months and quarters to come", () => {
    const welcome = patronWelcome(patron({ subscription: subscription() }), NOW, ZONE);
    expect(welcome?.steps.map((step) => step.kind)).toEqual(["mark", "cosmetic", "word"]);
    expect(welcome?.steps[0]?.what).toBe("Le titre, le badge et le cosmétique du mois");
    expect(welcome?.note).toBeNull();
  });
});

describe("menu", () => {
  it("offers the subscription, or leads a patron to theirs", () => {
    expect(patronMenuLabel(null)).toBe("Devenir mécène");
    expect(patronMenuLabel("patron")).toBe("Mon abonnement mécène");
    expect(patronMenuLabel("founder")).toBe("Mon abonnement mécène");
  });
});

describe("mark", () => {
  it("labels the badge and its hint", () => {
    expect(patronMarkLabel("patron")).toBe("Mécène");
    expect(patronMarkLabel("founder")).toBe("Mécène fondateur");
    expect(patronMarkLabel(null)).toBeNull();
    expect(patronMarkHint("patron")).toBe("Ce mécène fait vivre Leximon.");
    expect(patronMarkHint(null)).toBeNull();
  });
});

describe("finding a word", () => {
  it("counts the words left for 0, 1 and several", () => {
    expect(findsLeftLine(0)).toBe("Tu n'as pas de mot à dénicher pour l'instant.");
    expect(findsLeftLine(1)).toBe("Tu peux dénicher un mot.");
    expect(findsLeftLine(3)).toBe("Tu peux dénicher 3 mots.");
  });

  it("says where a found word stands, and signs its card", () => {
    expect(wordFoundLine("lucubrateur")).toBe(
      "« lucubrateur » est à toi. Il paraîtra avec sa collection, signé de ton pseudo.",
    );
    expect(findStateLine("rejected")).toContain("rendu");
    expect(finderLine("Raph")).toBe("Déniché par Raph");
  });
});

describe("the page of thanks", () => {
  it("tells the patron whether their pseudo is on it", () => {
    const paying = patron({ subscription: subscription({ standing: "patron" }) });
    expect(patronThanksLine(paying)).toBe("Ton pseudo y figure tant que ton profil est public.");
    expect(patronThanksLine({ ...paying, thanksListed: false })).toBe(
      "Tu as choisi de ne pas y figurer.",
    );
    expect(patronThanksLine(patron({ subscription: subscription({ standing: "trial" }) }))).toBe(
      "Ton pseudo y figurera après ton premier paiement, si ton profil est public.",
    );
  });

  it("puts the founders first and leaves out an empty group", () => {
    expect(
      thanksGroups([
        { pseudo: "Ludo", founder: false },
        { pseudo: "Raph", founder: true },
      ]).map((group) => [group.title, group.pseudos]),
    ).toEqual([
      ["Les mécènes fondateurs", ["Raph"]],
      ["Les mécènes", ["Ludo"]],
    ]);
    expect(thanksGroups([{ pseudo: "Ludo", founder: false }]).map((g) => g.title)).toEqual([
      "Les mécènes",
    ]);
  });
});
