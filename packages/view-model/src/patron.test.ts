import type { PatronResponse } from "@leximon/contract";
import { describe, expect, it } from "vitest";
import {
  claimableLabel,
  formatEuros,
  monthCosmeticLine,
  PATRON_MANAGE,
  PATRON_RESUME,
  patronCosmeticName,
  patronMarkHint,
  patronMarkLabel,
  patronPageKind,
  patronPlanChoices,
  patronStatus,
  patronTrialNote,
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

describe("mark", () => {
  it("labels the badge and its hint", () => {
    expect(patronMarkLabel("patron")).toBe("Mécène");
    expect(patronMarkLabel("founder")).toBe("Mécène fondateur");
    expect(patronMarkLabel(null)).toBeNull();
    expect(patronMarkHint("patron")).toBe("Ce mécène fait vivre Leximon.");
    expect(patronMarkHint(null)).toBeNull();
  });
});
