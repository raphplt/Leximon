import type { PatronResponse } from "@leximon/contract";
import { describe, expect, it } from "vitest";
import {
  badgePerkLine,
  claimableLabel,
  cosmeticPerkLine,
  discordScreen,
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
  patronWelcome,
  pollScreen,
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
    founder: false,
    foundingOffer: false,
    finds: { left: 0, words: [] },
    thanksListed: true,
    thanksWaiting: null,
    poll: null,
    discord: { available: false, username: null },
    subscription: null,
    ...overrides,
  };
}

function subscription(overrides: Partial<Subscription> = {}): Subscription {
  return {
    standing: "patron",
    plan: "monthly",
    currentPeriodEnd: "2027-04-14T08:00:00.000Z",
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

  it("shows the status to a paying subscriber", () => {
    expect(patronPageKind(patron({ subscription: subscription() }), false)).toBe("member");
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
    expect(status?.headline).toBe("Mécène jusqu'au 14 avril");
    expect(status?.ending).toBe(
      "Tu as résilié ton abonnement. Il s'arrête le 14 avril, sans autre paiement, et tes cosmétiques restent à toi.",
    );
    expect(status?.lines).toEqual([]);
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
  it("is null without a running subscription", () => {
    expect(patronWelcome(patron())).toBeNull();
  });

  it("gives the month's cosmetic now, then the months and quarters to come", () => {
    const welcome = patronWelcome(patron({ subscription: subscription() }));
    expect(welcome?.map((step) => step.kind)).toEqual(["mark", "cosmetic", "word"]);
    expect(welcome?.[0]?.what).toBe("Le titre, le badge et le cosmétique du mois");
  });
});

describe("perks on the subscriber's page", () => {
  const frame = { month: "2027-03", cosmetic: { kind: "frame", frame: "wax" } } as const;

  it("asks to claim what waits, else gives the day of the next cosmetic", () => {
    expect(cosmeticPerkLine(patron({ claimable: [frame] }), NOW, ZONE)).toBe(
      "Un cosmétique t'attend. Réclame-le pour le porter.",
    );
    expect(cosmeticPerkLine(patron({ claimable: [frame, frame] }), NOW, ZONE)).toBe(
      "2 cosmétiques t'attendent. Réclame-les pour les porter.",
    );
    expect(cosmeticPerkLine(patron(), NOW, ZONE)).toBe(
      "Le prochain cosmétique sera dévoilé le 1er avril.",
    );
    expect(cosmeticPerkLine(patron(), Date.parse("2027-12-10T12:00:00Z"), ZONE)).toBe(
      "Le prochain cosmétique sera dévoilé le 1er janvier 2028.",
    );
  });

  it("says whether the title is worn", () => {
    expect(badgePerkLine("Mécène", true)).toBe(
      "Tu portes le titre Mécène. Tu peux épingler trois cartes de plus sur ton profil.",
    );
    expect(badgePerkLine("Mécène", false)).toContain("Porte ton titre");
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
      "« lucubrateur » est à toi. Il paraîtra dans une prochaine collection, avec ton pseudo sur la carte.",
    );
    expect(findStateLine("rejected")).toContain("un autre mot");
    expect(finderLine("Raph")).toBe("Déniché par Raph");
  });
});

describe("the page of thanks", () => {
  it("tells the patron whether their pseudo is on it", () => {
    const paying = patron({ subscription: subscription({ standing: "patron" }) });
    expect(patronThanksLine(paying)).toBe("Ton pseudo y figure.");
    expect(patronThanksLine({ ...paying, thanksWaiting: { reason: "level", level: 5 } })).toBe(
      "Ton pseudo y figurera au niveau 5, quand ton profil deviendra public.",
    );
    expect(patronThanksLine({ ...paying, thanksWaiting: { reason: "private", level: 5 } })).toBe(
      "Ton pseudo y figurera quand ton profil sera public.",
    );
    expect(patronThanksLine({ ...paying, thanksWaiting: { reason: "pseudo", level: 5 } })).toBe(
      "Ton pseudo y figurera dès que tu en auras choisi un.",
    );
    expect(patronThanksLine({ ...paying, thanksListed: false })).toBe(
      "Tu as choisi de ne pas y figurer.",
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

describe("the patrons' vote", () => {
  const THEMES = [
    { name: "La mer", description: "Les mots des marins." },
    { name: "La cuisine", description: "Les mots des tables." },
    { name: "Le jardin", description: "Les mots des haies." },
  ];
  const open = {
    id: "6f1f6c2e-5d0b-4f55-9a43-9d7b8a1f1a01",
    themes: THEMES,
    closesAt: "2027-03-17T12:00:00.000Z",
    open: true,
    myVote: null,
    result: null,
  };
  const paying = (poll: PatronResponse["poll"]) =>
    patron({ poll, subscription: subscription({ standing: "patron" }) });

  it("lets a paying patron vote, and a former one only see the vote", () => {
    const screen = pollScreen(paying(open), NOW, ZONE);
    expect(screen?.canVote).toBe(true);
    expect(screen?.intro).toBe(
      "Choisis le thème de la prochaine collection. Le vote se ferme le 17 mars.",
    );
    const former = patron({
      poll: { ...open, myVote: 0 },
      subscription: subscription({ standing: "none" }),
    });
    expect(pollScreen(former, NOW, ZONE)).toMatchObject({
      canVote: false,
      note: "Le vote est réservé aux mécènes.",
    });
  });

  it("shows nothing to a player who never subscribed", () => {
    expect(pollScreen(patron({ poll: open }), NOW, ZONE)).toBeNull();
    expect(pollScreen(paying(null), NOW, ZONE)).toBeNull();
  });

  it("marks the patron's voice, and keeps the counts until it closes", () => {
    const screen = pollScreen(paying({ ...open, myVote: 1 }), NOW, ZONE);
    expect(screen?.themes.map((theme) => theme.chosen)).toEqual([false, true, false]);
    expect(screen?.themes.every((theme) => theme.votes === null)).toBe(true);
  });

  it("names the theme chosen once closed, or says the tie", () => {
    const closed = { ...open, open: false, myVote: 0 };
    const won = pollScreen(paying({ ...closed, result: { votes: [1, 4, 0], winner: 1 } }), NOW);
    expect(won?.note).toBe("La prochaine collection aura pour thème « La cuisine ».");
    expect(won?.themes.map((theme) => [theme.votes, theme.winner])).toEqual([
      ["1 voix", false],
      ["4 voix", true],
      ["0 voix", false],
    ]);
    const tie = pollScreen(paying({ ...closed, result: { votes: [2, 2, 0], winner: null } }), NOW);
    expect(tie?.note).toBe(
      "Plusieurs thèmes sont à égalité. Le choix sera annoncé dans les nouveautés.",
    );
    const empty = pollScreen(
      paying({ ...closed, result: { votes: [0, 0, 0], winner: null } }),
      NOW,
    );
    expect(empty?.note).toBe("Aucun mécène n'a voté.");
  });
});

describe("the patrons' Discord", () => {
  const discord = (username: string | null) => ({ available: true, username });

  it("offers the link to a paying patron, and nothing to a former one without a link", () => {
    const paying = patron({ discord: discord(null), subscription: subscription() });
    expect(discordScreen(paying)).toMatchObject({ canLink: true, canUnlink: false });
    const former = patron({
      discord: discord(null),
      subscription: subscription({ standing: "none" }),
    });
    expect(discordScreen(former)).toBeNull();
  });

  it("names the account linked, and shows nothing before the bot is set", () => {
    const linked = patron({ discord: discord("raph"), subscription: subscription() });
    expect(discordScreen(linked)?.line).toContain("Ton compte Discord raph est relié.");
    expect(discordScreen(linked)?.canUnlink).toBe(true);
    expect(discordScreen(patron({ subscription: subscription() }))).toBeNull();
  });
});
