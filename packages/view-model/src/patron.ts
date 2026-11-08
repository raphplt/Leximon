import type {
  FindRefusal,
  MonthCosmeticView,
  PatronCosmeticView,
  PatronMarkView,
  PatronPlan,
  PatronResponse,
  WordFindView,
} from "@leximon/contract";
import {
  type EpochMs,
  FOUNDER_TITLE,
  PATRON_SCHEDULE,
  PATRON_TIME_ZONE,
  PATRON_TITLE,
  patronRulesAt,
} from "@leximon/core";
import { capitalize } from "./format";
import { avatarName, frameName } from "./profile";

/**
 * The patron page and the mark on profiles. The server says what the player may buy and claim;
 * these only choose the screen and word it.
 */

const EUROS = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

/** « 3,99 € », from cents. */
export function formatEuros(cents: number): string {
  return EUROS.format(cents / 100);
}

export function patronPrice(plan: PatronPlan, now: EpochMs): string {
  return formatEuros(patronRulesAt(PATRON_SCHEDULE, now).prices[plan]);
}

export const PATRON_PAGE_TITLE = "Devenir mécène";
export const PATRON_KICKER = "Abonnement";

/** The entry of the player's menu: the offer to whoever has no mark, their subscription otherwise. */
export function patronMenuLabel(mark: PatronMarkView): string {
  return mark === null ? "Devenir mécène" : "Mon abonnement mécène";
}
export const PATRON_CARD_KICKER = "Carte de mécène";
export const PATRON_MEMBER_TITLE = "Ton abonnement mécène";

/** What the subscription gives, the same before and after sales open. */
export const PATRON_BENEFITS: readonly string[] = [
  "Un cosmétique chaque mois, cadre ou avatar gravé, dévoilé le 1er et gardé à vie.",
  "Un mot par trimestre, que tu choisis parmi les mots pas encore publiés. Il entre dans le jeu avec ton pseudo, et tu en reçois un exemplaire unique.",
  "Des éditions de bibliothèque pour imprimer tes gravures à la sanguine, au lavis ou à l'encre de Chine, et une nouvelle chaque mois.",
  "Le cabinet de chaque mot, ouvert depuis sa carte, avec son usage dans les livres depuis 1800, son article du Littré et sa famille.",
  "Le titre et le badge de mécène sur ton profil, et trois cartes épinglées de plus.",
];

export const PATRON_INTRO =
  "Leximon est gratuit, sans publicité et sans sachet à acheter. Avec l'abonnement mécène, tu fais vivre le jeu.";
export const PATRON_NO_ADVANTAGE =
  "Un mécène n'a ni sachet, ni XP, ni avantage aux échanges en plus.";

/**
 * - `door`: sales are not open to this player; the offer is announced and « Préviens-moi » counted;
 * - `offer`: the player can subscribe, or a guest is sent to create an account first;
 * - `member`: subscribed, trial included.
 */
export type PatronPageKind = "door" | "offer" | "member";

export function patronPageKind(patron: PatronResponse, guest: boolean): PatronPageKind {
  const standing = patron.subscription?.standing ?? "none";
  if (standing !== "none") return "member";
  if (patron.canBuy || (guest && patron.sales === "open")) return "offer";
  return "door";
}

export interface PatronPlanChoice {
  readonly plan: PatronPlan;
  /** « 3,99 € par mois ». */
  readonly label: string;
  /** What a yearly plan comes to each month, `null` for the monthly one. */
  readonly note: string | null;
  /** The label split for a price tag: « 3,99 € », then « par mois ». */
  readonly price: string;
  readonly period: string;
  /** The ribbon over the yearly plan, « 2,50 € par mois »; `null` for the monthly one. */
  readonly ribbon: string | null;
}

export function patronPlanChoices(now: EpochMs): readonly PatronPlanChoice[] {
  const { prices } = patronRulesAt(PATRON_SCHEDULE, now);
  const perMonth = `${formatEuros(Math.round(prices.yearly / 12))} par mois`;
  return [
    {
      plan: "monthly",
      label: `${formatEuros(prices.monthly)} par mois`,
      note: null,
      price: formatEuros(prices.monthly),
      period: "par mois",
      ribbon: null,
    },
    {
      plan: "yearly",
      label: `${formatEuros(prices.yearly)} par an`,
      note: `Soit ${perMonth}.`,
      price: formatEuros(prices.yearly),
      period: "par an",
      ribbon: perMonth,
    },
  ];
}

/** The plan picked when the page opens: the cheaper one each month. */
export const PATRON_DEFAULT_PLAN: PatronPlan = "yearly";

/** Under the plans, for a player who never had a trial. */
export function patronTrialNote(patron: Pick<PatronResponse, "trialAvailable" | "trialDays">) {
  if (!patron.trialAvailable || patron.trialDays === 0) return null;
  return `Les ${patron.trialDays} premiers jours sont gratuits, et tu peux résilier en un clic avant le premier paiement.`;
}

/** Under the plans, for a player whose trial is spent. */
export const PATRON_CANCEL_NOTE = "Tu peux résilier en un clic depuis cette page, quand tu veux.";

export const PATRON_FOUNDING_OFFER =
  "Abonne-toi avant la fin du mois pour devenir Mécène fondateur. Tu gardes ce prix tant que ton abonnement continue, et le badge de fondateur à vie.";

/** The box the player ticks before paying; its final wording comes from the lawyer. */
export const PATRON_WAIVER =
  "Je veux profiter tout de suite de mon abonnement et je renonce à mon droit de rétractation.";
export const PATRON_MINOR_NOTE =
  "Tu as moins de 18 ans. Demande l'accord d'un parent avant de t'abonner.";
export const PATRON_GUEST_NOTE = "Crée un compte pour t'abonner.";

export const PATRON_SUBSCRIBE = "Devenir mécène";
export const PATRON_SUBSCRIBE_BUSY = "Ouverture du paiement…";
export const PATRON_CREATE_ACCOUNT = "Créer mon compte";
export const PATRON_NOTIFY = "Préviens-moi";
export const PATRON_NOTIFIED = "Noté. On te préviendra à l'ouverture des abonnements.";
export const PATRON_DOOR_KICKER = "Bientôt";

export const PATRON_MANAGE = "Gérer mon abonnement";
export const PATRON_RESUME = "Reprendre mon abonnement";
export const PATRON_MANAGE_BUSY = "Ouverture…";
/** On the phone, where nothing may be bought outside the stores' payment. */
export const PATRON_MANAGED_ON_WEB = "Ton abonnement se gère depuis ton compte sur leximon.fr.";

export const PATRON_THANKS = "Te voilà mécène !";
export const PATRON_WEAR_TITLE = "Porter mon titre";
export const PATRON_SEE_SUBSCRIPTION = "Voir mon abonnement";
export const PATRON_CONFIRMING = "Ton paiement est en cours de confirmation.";
export const PATRON_CHECKOUT_FAILED = "La page de paiement ne s'est pas ouverte. Réessaie.";
export const PATRON_PORTAL_FAILED = "La page de ton abonnement ne s'est pas ouverte. Réessaie.";
export const PATRON_LOAD_FAILED = "Le serveur ne répond pas. Réessaie.";

/** « le cadre Sceau de cire », « l'avatar gravé Le Grimelin », « le titre Mécène des brumes ». */
export function patronCosmeticName(cosmetic: PatronCosmeticView): string {
  switch (cosmetic.kind) {
    case "frame":
      return `le cadre ${frameName(cosmetic.frame)}`;
    case "avatar":
      return `l'avatar gravé ${avatarName(cosmetic.avatar)}`;
    case "title":
      return `le titre ${cosmetic.title}`;
  }
}

/** The month's showcase, seen by everyone from the 1st. */
export function monthCosmeticLine(month: MonthCosmeticView | null): string | null {
  if (month === null) return null;
  return `Ce mois-ci, les mécènes reçoivent ${patronCosmeticName(month.cosmetic)}.`;
}

const MONTH_FORMAT = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" });

/** « mars 2027 », from `2027-03`. */
export function patronMonthLabel(month: string): string {
  return MONTH_FORMAT.format(Date.parse(`${month}-15T12:00:00Z`));
}

/** A claimable cosmetic, « Le cadre Sceau de cire, mars 2027 ». */
export function claimableLabel(item: MonthCosmeticView): string {
  return `${capitalize(patronCosmeticName(item.cosmetic))}, ${patronMonthLabel(item.month)}`;
}

export const PATRON_CLAIMABLE_TITLE = "À réclamer";
export const PATRON_CLAIM = "Réclamer";
export const PATRON_CLAIM_BUSY = "Réclamation…";
export const PATRON_CLAIMED = "Ajouté à ton apparence.";

/** « 14 avril », with the year when it is not this one. Paris time, like every patron day. */
function patronDay(iso: string, now: EpochMs, timeZone: string): string {
  const at = Date.parse(iso);
  const year = (time: number) =>
    new Intl.DateTimeFormat("fr-FR", { year: "numeric", timeZone }).format(time);
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    ...(year(at) === year(now) ? {} : { year: "numeric" }),
    timeZone,
  }).format(at);
}

export interface PatronStatus {
  /** « Mécène depuis mars 2027 », « Essai gratuit en cours ». */
  readonly headline: string;
  readonly lines: readonly string[];
  /** A payment Stripe is retrying: shown apart, with the button that fixes it. */
  readonly warning: string | null;
  /** « Reprendre mon abonnement » once cancelled, « Gérer mon abonnement » otherwise. */
  readonly manage: string;
}

/** The member's status, or `null` without a running subscription. */
export function patronStatus(
  patron: Pick<PatronResponse, "subscription" | "founder">,
  now: EpochMs,
  timeZone: string = PATRON_TIME_ZONE,
): PatronStatus | null {
  const subscription = patron.subscription;
  if (subscription === null || subscription.standing === "none") return null;
  const day = (iso: string) => patronDay(iso, now, timeZone);
  const price = subscription.plan === null ? null : patronPrice(subscription.plan, now);
  const lines: string[] = [];

  if (subscription.standing === "trial") {
    const end = subscription.trialEnd ?? subscription.currentPeriodEnd;
    if (subscription.cancelAt !== null) {
      lines.push(`Ton essai s'arrête le ${day(subscription.cancelAt)}, sans aucun paiement.`);
    } else if (end !== null) {
      lines.push(
        price === null
          ? `Ton essai se termine le ${day(end)}.`
          : `Ton essai se termine le ${day(end)}, et ton premier paiement de ${price} aura lieu ce jour-là.`,
      );
    }
    lines.push(
      "Pendant l'essai, tu portes le titre et le badge de mécène. Le cosmétique du mois et le droit de dénicher un mot arrivent avec le premier paiement.",
    );
  } else if (subscription.cancelAt !== null) {
    lines.push(
      `Ton abonnement s'arrête le ${day(subscription.cancelAt)}. Tes cosmétiques restent à toi.`,
    );
  } else if (subscription.currentPeriodEnd !== null && price !== null) {
    lines.push(
      `Ton prochain paiement de ${price} aura lieu le ${day(subscription.currentPeriodEnd)}.`,
    );
  }

  const title = patron.founder ? "Mécène fondateur" : "Mécène";
  return {
    headline:
      subscription.standing === "trial"
        ? "Essai gratuit en cours"
        : subscription.since === null
          ? title
          : `${title} depuis ${new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone }).format(Date.parse(subscription.since))}`,
    lines,
    warning: subscription.paymentFailing
      ? "Ton dernier paiement n'est pas passé. Mets à jour ta carte pour rester mécène."
      : null,
    manage: subscription.cancelAt === null ? PATRON_MANAGE : PATRON_RESUME,
  };
}

/** The badge on profiles and in the list of players. */
export function patronMarkLabel(mark: PatronMarkView): string | null {
  switch (mark) {
    case "founder":
      return "Mécène fondateur";
    case "patron":
      return "Mécène";
    case null:
      return null;
  }
}

/** What the badge says on hover; a founder who stopped keeps the badge, so the past tense. */
export function patronMarkHint(mark: PatronMarkView): string | null {
  switch (mark) {
    case "founder":
      return "Ce mécène fondateur a soutenu Leximon dès le premier mois.";
    case "patron":
      return "Ce mécène fait vivre Leximon.";
    case null:
      return null;
  }
}

/** How long the page waits for Stripe's webhook after the payment, before saying it is coming. */
export const PATRON_CONFIRM_POLLS = 5;
export const PATRON_CONFIRM_INTERVAL_MS = 2_000;

/** The title the subscription lets the player wear. */
export function patronTitleOf(patron: Pick<PatronResponse, "founder">): string {
  return patron.founder ? FOUNDER_TITLE : PATRON_TITLE;
}

/** Once the title is worn from the thanks, « Tu portes le titre Mécène. ». */
export function patronTitleWorn(title: string): string {
  return `Tu portes le titre ${title}.`;
}

/** What a step of the welcome brings: drawn with its own icon. */
export type PatronWelcomeKind = "mark" | "payment" | "cosmetic" | "word";

export interface PatronWelcomeStep {
  readonly kind: PatronWelcomeKind;
  /** « Aujourd'hui », « 22 novembre », « Chaque mois ». */
  readonly when: string;
  readonly what: string;
  /** Still to come: drawn locked. */
  readonly later: boolean;
}

export interface PatronWelcome {
  readonly steps: readonly PatronWelcomeStep[];
  /** Under the steps: how to stop a trial before it costs anything. */
  readonly note: string | null;
}

/**
 * The reward back from the payment: what the subscription gives today, and what comes next. A
 * trial gives the title and the badge now, the cosmetic and the word with the first payment.
 */
export function patronWelcome(
  patron: Pick<PatronResponse, "subscription">,
  now: EpochMs,
  timeZone: string = PATRON_TIME_ZONE,
): PatronWelcome | null {
  const subscription = patron.subscription;
  if (subscription === null || subscription.standing === "none") return null;
  const mark = {
    kind: "mark",
    when: "Aujourd'hui",
    what: "Le titre et le badge de mécène",
    later: false,
  } as const;

  const end = subscription.trialEnd ?? subscription.currentPeriodEnd;
  if (subscription.standing === "trial" && end !== null) {
    const day = patronDay(end, now, timeZone);
    const price = subscription.plan === null ? null : patronPrice(subscription.plan, now);
    return {
      steps: [
        mark,
        {
          kind: "payment",
          when: day,
          what: price === null ? "Premier paiement" : `Premier paiement de ${price}`,
          later: true,
        },
        {
          kind: "cosmetic",
          when: "Dès ce paiement",
          what: "Le cosmétique du mois et le droit de dénicher un mot",
          later: true,
        },
      ],
      note:
        subscription.cancelAt === null
          ? `Tu peux résilier en un clic avant le ${day}, sans rien payer.`
          : null,
    };
  }
  return {
    steps: [
      { ...mark, what: "Le titre, le badge et le cosmétique du mois" },
      {
        kind: "cosmetic",
        when: "Chaque mois",
        what: "Un nouveau cosmétique, gardé à vie",
        later: true,
      },
      {
        kind: "word",
        when: "Chaque trimestre",
        what: "Un mot à dénicher pour le jeu",
        later: true,
      },
    ],
    note: null,
  };
}

// --- Finding a word ---------------------------------------------------------------------------

export const PATRON_FINDS_TITLE = "Ton mot dans le jeu";
export const PATRON_FINDS_RULE =
  "Un mot par trimestre d'abonnement, dès le premier paiement pour un abonnement annuel.";
export const PATRON_FIND_ACTION = "Dénicher un mot";
export const PATRON_FIND_PAGE_TITLE = "Dénicher un mot";
export const PATRON_FIND_INTRO =
  "Choisis un mot parmi ceux qui ne sont pas encore dans le jeu. Il paraîtra dans une prochaine collection avec ton pseudo, et tu en recevras un exemplaire unique.";
export const PATRON_FIND_SEARCH = "Cherche un mot par son début";
export const PATRON_FIND_EMPTY = "Aucun mot de la réserve ne commence ainsi.";
export const PATRON_FIND_MORE = "Voir plus de mots";
export const PATRON_FIND_PICK = "Dénicher";
export const PATRON_FIND_CONFIRM = "Dénicher ce mot";
export const PATRON_FIND_CANCEL = "Annuler";
export const PATRON_FIND_BUSY = "Dénichage…";
export const PATRON_FIND_WARNING =
  "Ce choix est définitif : le mot sort de la réserve pour tout le monde.";
export const PATRON_FIND_BACK = "Retour à ma page de mécène";

/** How many words the patron may still find. */
export function findsLeftLine(left: number): string {
  if (left === 0) return "Tu n'as pas de mot à dénicher pour l'instant.";
  return left === 1 ? "Tu peux dénicher un mot." : `Tu peux dénicher ${left} mots.`;
}

/** After the find: the reward, the word in quotes. */
export function wordFoundLine(word: string): string {
  return `« ${word} » est à toi. Il paraîtra avec sa collection, signé de ton pseudo.`;
}

/** Where a found word stands. */
export function findStateLine(state: WordFindView["state"]): string {
  switch (state) {
    case "reserved":
      return "Il paraîtra avec sa collection.";
    case "published":
      return "Paru, avec ton pseudo sur la carte.";
    case "rejected":
      return "Écarté au contrôle de qualité. Ton droit de dénicher t'est rendu.";
  }
}

export function findRefusalLine(reason: FindRefusal): string {
  switch (reason) {
    case "taken":
      return "Ce mot vient d'être déniché par un autre mécène.";
    case "no_right":
      return "Tu n'as plus de mot à dénicher pour l'instant.";
    case "no_pseudo":
      return "Choisis d'abord un pseudo dans ton profil : il signera ta carte.";
    case "not_in_reserve":
      return "Ce mot n'est plus dans la réserve.";
  }
}

/** On a card found by a patron, for every player. */
export function finderLine(pseudo: string): string {
  return `Déniché par ${pseudo}`;
}
