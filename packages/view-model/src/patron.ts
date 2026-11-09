import type {
  FindRefusal,
  MonthCosmeticView,
  PatronCosmeticView,
  PatronMarkView,
  PatronPlan,
  PatronResponse,
  PatronVoteRefusal,
  WordFindView,
} from "@leximon/contract";
import {
  type EpochMs,
  FOUNDER_TITLE,
  PATRON_SCHEDULE,
  PATRON_TIME_ZONE,
  PATRON_TITLE,
  parisMonthOf,
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

/** One thing the subscription gives: the same list on the offer and on the subscriber's page. */
export type PatronPerkKey =
  | "cosmetic"
  | "word"
  | "editions"
  | "cabinet"
  | "badge"
  | "vote"
  | "thanks"
  | "discord";

export interface PatronPerk {
  readonly key: PatronPerkKey;
  /** The block's title on the subscriber's page. */
  readonly title: string;
  /** On the offer, the words set in bold, then the rest of the sentence. */
  readonly lead: string;
  readonly rest: string;
}

export const PATRON_PERKS: readonly PatronPerk[] = [
  {
    key: "cosmetic",
    title: "Le cosmétique du mois",
    lead: "Un cosmétique chaque mois",
    rest: ", cadre ou avatar gravé, dévoilé le 1er et gardé à vie.",
  },
  {
    key: "word",
    title: "Ton mot dans le jeu",
    lead: "Un mot à toi chaque trimestre",
    rest: ", choisi parmi les mots pas encore publiés. Il paraît avec ton pseudo, et tu en reçois un exemplaire unique.",
  },
  {
    key: "editions",
    title: "Éditions de bibliothèque",
    lead: "Des éditions de bibliothèque",
    rest: " pour imprimer tes gravures à la sanguine, au lavis ou à l'encre de Chine, et une nouvelle chaque mois.",
  },
  {
    key: "cabinet",
    title: "Le cabinet des mots",
    lead: "Le cabinet de chaque mot",
    rest: ", ouvert depuis sa carte, avec son usage dans les livres depuis 1800, son article du Littré et sa famille.",
  },
  {
    key: "badge",
    title: "Ton titre et ton badge",
    lead: "Le titre et le badge de mécène",
    rest: " sur ton profil, avec trois cartes épinglées de plus.",
  },
  {
    key: "vote",
    title: "Le vote des mécènes",
    lead: "Une voix dans le vote des mécènes",
    rest: " sur le thème d'une prochaine collection.",
  },
  {
    key: "thanks",
    title: "La page des mécènes",
    lead: "Ton pseudo sur la page des mécènes",
    rest: ", si ton profil est public.",
  },
  {
    key: "discord",
    title: "Le salon des mécènes",
    lead: "Le salon des mécènes",
    rest: " sur le Discord de Leximon, ouvert par le rôle Mécène.",
  },
];

export const PATRON_INTRO =
  "Leximon est gratuit, sans publicité et sans sachet à acheter. Avec l'abonnement mécène, tu fais vivre le jeu.";

/**
 * - `door`: sales are not open to this player; the offer is announced and « Préviens-moi » counted;
 * - `offer`: the player can subscribe, or a guest is sent to create an account first;
 * - `member`: a paying subscriber, until the subscription stops.
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

/** Under the plans. */
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
export const PATRON_INVOICES = "Voir mes factures";
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
  /** « Mécène depuis mars 2027 », or « Mécène jusqu'au 22 novembre » once cancelled. */
  readonly headline: string;
  readonly lines: readonly string[];
  /** A payment Stripe is retrying: shown apart, with the button that fixes it. */
  readonly warning: string | null;
  /** The subscription was cancelled and stops at its end: shown apart, like the warning. */
  readonly ending: string | null;
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
  const title = patron.founder ? "Mécène fondateur" : "Mécène";
  const month = (iso: string) =>
    new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone }).format(
      Date.parse(iso),
    );

  if (subscription.cancelAt !== null) {
    const end = day(subscription.cancelAt);
    return {
      headline: `${title} jusqu'au ${end}`,
      lines: [],
      warning: null,
      ending: `Tu as résilié ton abonnement. Il s'arrête le ${end}, sans autre paiement, et tes cosmétiques restent à toi.`,
      manage: PATRON_RESUME,
    };
  }
  return {
    headline: subscription.since === null ? title : `${title} depuis ${month(subscription.since)}`,
    lines:
      subscription.currentPeriodEnd !== null && price !== null
        ? [`Ton prochain paiement de ${price} aura lieu le ${day(subscription.currentPeriodEnd)}.`]
        : [],
    warning: subscription.paymentFailing
      ? "Ton dernier paiement n'est pas passé. Mets à jour ta carte pour rester mécène."
      : null,
    ending: null,
    manage: PATRON_MANAGE,
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
export type PatronWelcomeKind = "mark" | "cosmetic" | "word";

export interface PatronWelcomeStep {
  readonly kind: PatronWelcomeKind;
  /** « Aujourd'hui », « Chaque mois ». */
  readonly when: string;
  readonly what: string;
  /** Still to come: drawn locked. */
  readonly later: boolean;
}

/** The reward back from the payment: what the subscription gives today, and what comes next. */
export function patronWelcome(
  patron: Pick<PatronResponse, "subscription">,
): readonly PatronWelcomeStep[] | null {
  if ((patron.subscription?.standing ?? "none") === "none") return null;
  return [
    {
      kind: "mark",
      when: "Aujourd'hui",
      what: "Le titre, le badge et le cosmétique du mois",
      later: false,
    },
    {
      kind: "cosmetic",
      when: "Chaque mois",
      what: "Un nouveau cosmétique, gardé à vie",
      later: true,
    },
    { kind: "word", when: "Chaque trimestre", what: "Un mot à dénicher pour le jeu", later: true },
  ];
}

// --- The subscriber's page, perk by perk ------------------------------------------------------

/** Under the cosmetic's block: what waits to be claimed, or when the next one comes. */
export function cosmeticPerkLine(
  patron: Pick<PatronResponse, "claimable">,
  now: EpochMs,
  timeZone: string = PATRON_TIME_ZONE,
): string {
  const count = patron.claimable.length;
  if (count === 1) return "Un cosmétique t'attend. Réclame-le pour l'ajouter à ton apparence.";
  if (count > 1) {
    return `${count} cosmétiques t'attendent. Réclame-les pour les ajouter à ton apparence.`;
  }
  const [year, month] = parisMonthOf(now).split("-").map(Number) as [number, number];
  const next = Date.UTC(month === 12 ? year + 1 : year, month === 12 ? 0 : month, 15, 12);
  const name = new Intl.DateTimeFormat("fr-FR", {
    month: "long",
    ...(month === 12 ? { year: "numeric" } : {}),
    timeZone,
  }).format(next);
  return `Le prochain se dévoile le 1er ${name}.`;
}

export const PATRON_CABINET_LINE =
  "Le cabinet s'ouvre depuis la fiche de chaque carte de ton album.";
export const PATRON_OPEN_ALBUM = "Ouvrir l'album";

/** Under the badge's block: the title worn or not, and the pinned cards it adds. */
export function badgePerkLine(title: string, worn: boolean): string {
  const pins = "Ton profil montre trois cartes épinglées de plus.";
  return worn
    ? `Tu portes le titre ${title}. ${pins}`
    : `${pins} Porte ton titre pour l'afficher à côté de ton pseudo.`;
}
export const PATRON_SEE_PROFILE = "Voir mon profil";

export const PATRON_VOTE_NONE =
  "Aucun vote n'est ouvert. Le prochain s'annoncera ici avant une nouvelle collection.";
export const PATRON_DISCORD_SOON = "Le salon ouvre bientôt sur le Discord de Leximon.";

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

export const PATRON_THANKS_PAGE_TITLE = "La page des mécènes";
export const PATRON_THANKS_HIDE = "Ne pas me citer";
export const PATRON_THANKS_SHOW = "Me citer à nouveau";
export const PATRON_THANKS_SEE = "Voir la page des mécènes";
export const PATRON_THANKS_FAILED = "Le réglage n'a pas été enregistré. Réessaie.";

/** Where the patron stands on the public page of thanks. */
export function patronThanksLine(patron: PatronResponse): string {
  if (!patron.thanksListed) return "Tu as choisi de ne pas y figurer.";
  const waiting = patron.thanksWaiting;
  if (waiting?.reason === "level") {
    return `Ton pseudo y figurera au niveau ${waiting.level}, quand ton profil deviendra public.`;
  }
  if (waiting?.reason === "private") return "Ton pseudo y figurera quand ton profil sera public.";
  if (waiting?.reason === "pseudo") return "Ton pseudo y figurera dès que tu en auras choisi un.";
  return "Ton pseudo y figure.";
}

export const THANKS_PAGE_TITLE = "Les mécènes de Leximon";
export const THANKS_PAGE_INTRO =
  "Merci à celles et ceux qui font vivre Leximon. Grâce à eux, le jeu reste gratuit et sans publicité.";
export const THANKS_FOUNDERS = "Les mécènes fondateurs";
export const THANKS_PATRONS = "Les mécènes";
export const THANKS_EMPTY = "Aucun mécène ne figure encore sur cette page.";
export const THANKS_FAILED = "La liste des mécènes ne s'est pas chargée. Réessaie.";

/** The page of thanks in its two groups, founders first; an empty group is left out. */
export function thanksGroups(
  patrons: readonly { readonly pseudo: string; readonly founder: boolean }[],
): { readonly title: string; readonly founder: boolean; readonly pseudos: string[] }[] {
  return [
    { title: THANKS_FOUNDERS, founder: true },
    { title: THANKS_PATRONS, founder: false },
  ]
    .map((group) => ({
      ...group,
      pseudos: patrons.filter((p) => p.founder === group.founder).map((p) => p.pseudo),
    }))
    .filter((group) => group.pseudos.length > 0);
}

export const PATRON_POLL_TITLE = "Le vote des mécènes";
export const PATRON_POLL_VOTE = "Voter pour ce thème";
export const PATRON_POLL_CHOSEN = "Ta voix";
export const PATRON_POLL_FAILED = "Ta voix n'a pas été enregistrée. Réessaie.";

export interface PollThemeScreen {
  readonly name: string;
  readonly description: string;
  /** The patron's voice went to this theme. */
  readonly chosen: boolean;
  /** « 3 voix », once the vote has closed. */
  readonly votes: string | null;
  readonly winner: boolean;
}

export interface PollScreen {
  readonly intro: string;
  /** Under the themes: who may vote, or the theme chosen once closed. */
  readonly note: string | null;
  /** The patron may give or change a voice now. */
  readonly canVote: boolean;
  readonly themes: readonly PollThemeScreen[];
}

/**
 * The vote on the patron page: a paying patron votes; a former one still sees the vote they took
 * part in. Nothing without a vote, nor for a player who never subscribed.
 */
export function pollScreen(
  patron: PatronResponse,
  now: EpochMs,
  timeZone: string = PATRON_TIME_ZONE,
): PollScreen | null {
  const poll = patron.poll;
  const standing = patron.subscription?.standing ?? "none";
  if (poll === null || (standing === "none" && poll.myVote === null)) return null;
  const closes = patronDay(poll.closesAt, now, timeZone);
  const result = poll.result;
  const themes = poll.themes.map((theme, index) => ({
    name: theme.name,
    description: theme.description,
    chosen: poll.myVote === index,
    votes: result === null ? null : `${result.votes[index] ?? 0} voix`,
    winner: result?.winner === index,
  }));
  if (poll.open) {
    const canVote = standing === "patron";
    return {
      intro: `Choisis le thème de la prochaine collection. Le vote se ferme le ${closes}.`,
      note: canVote
        ? poll.myVote === null
          ? "Une voix par mécène. Le résultat s'affiche à la fermeture."
          : "Tu peux changer ta voix jusqu'à la fermeture. Le résultat s'affiche alors."
        : "Le vote est réservé aux mécènes.",
      canVote,
      themes,
    };
  }
  return {
    intro: `Le vote s'est fermé le ${closes}.`,
    note: pollOutcome(poll),
    canVote: false,
    themes,
  };
}

function pollOutcome(poll: NonNullable<PatronResponse["poll"]>): string {
  const winner = poll.result?.winner;
  const theme = winner == null ? undefined : poll.themes[winner];
  if (theme !== undefined) {
    return `La prochaine collection aura pour thème « ${theme.name} ».`;
  }
  return poll.result?.votes.some((votes) => votes > 0) === true
    ? "Plusieurs thèmes sont à égalité. Le choix sera annoncé dans les nouveautés."
    : "Aucun mécène n'a voté.";
}

export function voteRefusalLine(reason: PatronVoteRefusal): string {
  switch (reason) {
    case "not_patron":
      return "Le vote est réservé aux mécènes.";
    case "poll_closed":
      return "Le vote vient de se fermer.";
    case "unknown_theme":
      return "Ce thème ne fait pas partie du vote.";
  }
}

export const PATRON_DISCORD_TITLE = "Le salon des mécènes";
export const PATRON_DISCORD_LINK = "Relier mon Discord";
export const PATRON_DISCORD_UNLINK = "Délier mon Discord";
export const PATRON_DISCORD_LINKED =
  "Ton compte Discord est relié. Le rôle Mécène arrive dans une minute.";
export const PATRON_DISCORD_FAILED = "La liaison avec Discord n'a pas abouti. Réessaie.";

export interface DiscordScreen {
  readonly line: string;
  /** « Relier mon Discord », for a paying patron not linked yet. */
  readonly canLink: boolean;
  readonly canUnlink: boolean;
}

/** The patrons' Discord on the patron page; nothing until the bot is set, nor for a non-subscriber. */
export function discordScreen(patron: PatronResponse): DiscordScreen | null {
  const standing = patron.subscription?.standing ?? "none";
  const { available, username } = patron.discord;
  if (!available || (standing === "none" && username === null)) return null;
  if (username !== null) {
    return {
      line:
        standing === "patron"
          ? `Relié au compte Discord ${username}. Le rôle Mécène t'ouvre le salon réservé tant que ton abonnement court.`
          : `Relié au compte Discord ${username}. Le rôle Mécène revient avec ton abonnement.`,
      canLink: false,
      canUnlink: true,
    };
  }
  return {
    line: "Relie ton compte Discord pour rejoindre le serveur de Leximon avec le rôle Mécène, qui ouvre un salon réservé.",
    canLink: true,
    canUnlink: false,
  };
}
