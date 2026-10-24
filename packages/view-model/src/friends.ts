import type {
  FeedEvent,
  Friend,
  FriendReactionKind,
  FriendRefusal,
  PodiumEntry,
  ReferralReward,
} from "@leximon/contract";
import type { EpochMs, Rarity } from "@leximon/core";
import { seenLabel } from "./clan";
import { formatCount, plural } from "./format";
import { playerName } from "./trades";

/** Friends: the list, requests, the friend link, the weekly podium and the feed. */

export const FRIENDS_TITLE = "Amis";
export const FRIENDS_GUEST =
  "Les amis, c'est pour les comptes. Crée le tien, et ramène les copains.";
export const FRIENDS_PSEUDO_FIRST = "Choisis d'abord un pseudo : c'est lui que tes amis cherchent.";
export const FRIENDS_EMPTY = "Pas encore d'ami ici. Envoie ton lien, la boutique est grande.";
export const FEED_EMPTY = "Rien dans le fil. Tes amis cherchent encore.";

/** « niv. 12 · vu hier ». */
export function friendLine(friend: Pick<Friend, "player" | "online" | "lastSeenAt">, now: EpochMs) {
  return `niv. ${friend.player.level} · ${seenLabel(friend, now)}`;
}

/** « 3 échanges possibles », or nothing when none is. */
export function tradesLabel(trades: number): string | null {
  if (trades <= 0) return null;
  return trades > 1 ? `${formatCount(trades)} échanges possibles` : "1 échange possible";
}

/** « 12 amis sur 200 ». */
export function friendsCountLabel(count: number, max: number): string {
  return `${plural(count, "ami", "amis")} sur ${formatCount(max)}`;
}

export function friendLink(origin: string, code: string): string {
  return `${origin}/ami/${code}`;
}

/** What the friend link says when it is shared: the pleasure first, the link last. */
export function friendLinkText(origin: string, code: string): string {
  return `Des mots que plus personne ne dit, gratuits tous les jours. Viens jouer avec moi : ${friendLink(origin, code)}`;
}

/** Places of the closed beta left on the link; nothing when the beta is open to all. */
export function betaPlacesLabel(left: number | null): string | null {
  if (left === null) return null;
  if (left === 0) return "Plus de place de bêta sur ton lien.";
  return `Ton lien fait encore entrer ${plural(left, "joueur", "joueurs")} dans la bêta.`;
}

/**
 * Why a request or an answer did not go through. A refusal from the other player is never told:
 * asking again someone who refused reads as the request already sent.
 */
export function friendRefusalText(reason: FriendRefusal | "account_locked"): string {
  switch (reason) {
    case "account_required":
      return "Il faut un compte pour avoir des amis.";
    case "pseudo_required":
      return "Choisis d'abord un pseudo.";
    case "player_not_found":
      return "Personne sous ce pseudo.";
    case "request_not_found":
      return "Cette demande n'existe plus.";
    case "self":
      return "C'est toi, ça.";
    case "already_friends":
      return "Vous êtes déjà amis.";
    case "already_requested":
    case "recently_declined":
      return "Demande déjà envoyée.";
    case "requests_closed":
      return "Ce joueur ne prend pas de demande.";
    case "daily_limit_reached":
      return "Assez de demandes pour aujourd'hui. Reprends demain.";
    case "too_many_pending":
      return "Trop de demandes en attente. Laisse-leur le temps de répondre.";
    case "friend_limit_reached":
      return "Ta liste d'amis est pleine.";
    case "their_friend_limit_reached":
      return "Sa liste d'amis est pleine.";
    case "account_locked":
      return "Ton compte est suspendu.";
    default:
      throw new Error(`Unknown refusal: ${String(reason satisfies never)}`);
  }
}

export function requestSentToast(
  outcome: "sent" | "accepted",
  player: { readonly code: string; readonly pseudo: string | null },
): string {
  const name = playerName(player);
  return outcome === "sent" ? `Demande envoyée à ${name}.` : `${name} et toi, vous êtes amis.`;
}

// --- Podium --------------------------------------------------------------------------------

/** « 1er », « 2e ». */
export function rankLabel(rank: number): string {
  return rank === 1 ? "1er" : `${rank}e`;
}

/** « 12 bonnes réponses », « Aucune bonne réponse ». */
export function answersLabel(answers: number): string {
  return answers === 0
    ? "Aucune bonne réponse"
    : plural(answers, "bonne réponse", "bonnes réponses");
}

export interface PodiumView {
  /** The first three places, ties included (two firsts make three steps at most). */
  readonly steps: readonly PodiumEntry[];
  /** The player's place below the steps, « 4e sur 12 »; `null` when they stand on them. */
  readonly mine: string | null;
  /** Everyone, for the whole list. */
  readonly all: readonly PodiumEntry[];
  /** Nobody answered right this week yet. */
  readonly empty: boolean;
}

export function podiumView(entries: readonly PodiumEntry[]): PodiumView {
  const steps = entries.slice(0, 3);
  const self = entries.find((entry) => entry.self);
  const onSteps = self !== undefined && steps.some((entry) => entry.self);
  return {
    steps,
    mine:
      self === undefined || onSteps
        ? null
        : `${rankLabel(self.rank)} sur ${formatCount(entries.length)}`,
    all: entries,
    empty: entries.every((entry) => entry.answers === 0),
  };
}

export const PODIUM_EMPTY =
  "Personne n'a encore répondu cette semaine. La première marche est libre.";
export const PODIUM_ALONE = "Un podium, ça se fait à plusieurs. Invite un ami.";

// --- Feed ----------------------------------------------------------------------------------

export const REACTIONS: readonly { readonly id: FriendReactionKind; readonly label: string }[] = [
  { id: "hats_off", label: "Chapeau" },
  { id: "jealous", label: "Jaloux" },
  { id: "lucky", label: "Veinard" },
  { id: "well_played", label: "Bien joué" },
];

/** What the feed needs to know about a card: the catalogue's word and rarity. */
export interface FeedCard {
  readonly word: string;
  readonly rarity: Rarity;
}

/**
 * A feed event as one sentence around an optional word: `before`, the word in italics, `after`.
 * `self` when the event is the player's own.
 */
export interface FeedLine {
  readonly before: string;
  readonly word: string | null;
  readonly after: string;
}

const ARTICLE: Readonly<Record<Rarity, string>> = {
  common: "une Courante",
  uncommon: "une Peu courante",
  rare: "une Rare",
  precious: "un Précieux",
  epic: "une Épique",
  legendary: "une Légendaire",
};

export function feedLine(
  event: FeedEvent,
  self: boolean,
  card: FeedCard | null,
  collectionName: string | null,
): FeedLine {
  const name = self ? "Tu" : playerName(event.player);
  switch (event.kind) {
    case "rare_find":
      return {
        before: `${name} ${self ? "trouves" : "trouve"} ${card === null ? "une carte rare" : ARTICLE[card.rarity]} : `,
        word: card?.word ?? null,
        after: "",
      };
    case "gilded":
      return {
        before: `${name} ${self ? "passes" : "passe"} `,
        word: card?.word ?? "un mot",
        after: " à la Dorure",
      };
    case "level":
      return {
        before: `${name} ${self ? "atteins" : "atteint"} le niveau ${event.level}`,
        word: null,
        after: "",
      };
    case "collection_complete":
      return {
        before: `${name} ${self ? "complètes" : "complète"} « ${collectionName ?? "une collection"} »`,
        word: null,
        after: "",
      };
    default:
      throw new Error(`Unknown event: ${JSON.stringify(event satisfies never)}`);
  }
}

/** Each reaction with its count, in the set order, and whether it is the player's. */
export function reactionChips(event: Pick<FeedEvent, "reactions" | "mine">): readonly {
  readonly id: FriendReactionKind;
  readonly label: string;
  readonly count: number;
  readonly mine: boolean;
}[] {
  return REACTIONS.map((reaction) => ({
    ...reaction,
    count: event.reactions.find((r) => r.reaction === reaction.id)?.count ?? 0,
    mine: event.mine === reaction.id,
  }));
}

/**
 * The event once the player picked a reaction, or took theirs back (`null`): counts follow at
 * once, before the server answers.
 */
export function withReaction<T extends Pick<FeedEvent, "reactions" | "mine">>(
  event: T,
  reaction: FriendReactionKind | null,
): T {
  const counts = new Map(event.reactions.map((r) => [r.reaction, r.count]));
  if (event.mine !== null) counts.set(event.mine, (counts.get(event.mine) ?? 1) - 1);
  if (reaction !== null) counts.set(reaction, (counts.get(reaction) ?? 0) + 1);
  return {
    ...event,
    mine: reaction,
    reactions: REACTIONS.flatMap(({ id }) => {
      const count = counts.get(id) ?? 0;
      return count > 0 ? [{ reaction: id, count }] : [];
    }),
  };
}

// --- Friend link and its reward ------------------------------------------------------------

export function referrerTitle(pseudo: string): string {
  return `${pseudo} t'invite sur Leximon`;
}

export const REFERRER_PITCH =
  "Des mots que plus personne ne dit, à collectionner. Un sachet gratuit t'attend, et un ami.";
export const REFERRER_ACTION = "Ouvrir mon premier sachet";
export const REFERRER_FULL = "Ce lien a fait le plein. La bêta reste sur invitation.";
export const REFERRER_UNKNOWN = "Ce lien ne mène à personne.";

/** The mail's line for a bonus booster earned by a friend link. */
export function referralRewardTitle(reward: ReferralReward): string {
  const name = playerName(reward.player);
  return reward.role === "referrer"
    ? `Un sachet bonus : ${name} atteint le niveau 5 !`
    : `Un sachet bonus de bienvenue, grâce à ${name} !`;
}

export const REFERRAL_CLAIMED = "Sachet bonus en réserve !";

// --- Comparing albums ----------------------------------------------------------------------

export type CompareFilter = "theirs" | "mine" | "both";

export function compareFilters(
  name: string,
): readonly { readonly id: CompareFilter; readonly label: string }[] {
  return [
    { id: "theirs", label: `${name} l'a, pas moi` },
    { id: "mine", label: `Je l'ai, pas ${name}` },
    { id: "both", label: "On l'a tous les deux" },
  ];
}

export function comparingTitle(name: string): string {
  return `Ton album, à côté de celui de ${name}`;
}
