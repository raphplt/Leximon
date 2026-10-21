import {
  type PlayerBadge,
  playerCodeSchema,
  type Trade,
  type TradeRefusalCode,
  type TradeStatus,
} from "@leximon/contract";
import { TRADE_SCHEDULE, tradeRulesAt } from "@leximon/core";

/**
 * Pure rules of the trades screen: what a trade means for the player looking at it, how long it
 * has left, and how a refusal reads. The server decides everything (D-026); these only explain.
 */

/** A result shown to the player after an action. */
export interface Notice {
  readonly tone: "success" | "error";
  readonly text: string;
  /** After an accepted trade: the new cards are in the album. */
  readonly albumLink?: boolean;
}

export type TradeBox = "incoming" | "outgoing";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Code as the player types it, or `null` when it cannot be a player code. */
export function normalizePlayerCode(input: string): string | null {
  const result = playerCodeSchema.safeParse(input);
  return result.success ? result.data : null;
}

/** `ABCD EFGH`: two groups read more easily aloud or copied by hand. */
export function formatPlayerCode(code: string): string {
  return code.length === 8 ? `${code.slice(0, 4)} ${code.slice(4)}` : code;
}

/** How a player reads in a list: their pseudo, else their code; « Un joueur parti » once gone. */
export function playerName(badge: Pick<PlayerBadge, "code" | "pseudo"> | null): string {
  if (badge === null) return DEPARTED_PLAYER;
  return badge.pseudo ?? formatPlayerCode(badge.code);
}

export const DEPARTED_PLAYER = "Un joueur parti";

/** A pending offer whose deadline has passed is expired, even before the server says so. */
export function effectiveStatus(trade: Trade, now: number): TradeStatus {
  return trade.status === "pending" && Date.parse(trade.expiresAt) <= now
    ? "expired"
    : trade.status;
}

const STATUS_LABELS: Readonly<Record<TradeStatus, string>> = {
  pending: "En attente",
  completed: "Conclue",
  declined: "Refusée",
  cancelled: "Annulée",
  expired: "Expirée",
};

export function statusLabel(status: TradeStatus): string {
  return STATUS_LABELS[status];
}

/** The offer seen from the player: what they would give, what they would get, and with whom. */
export interface TradeSides {
  readonly counterpartCode: string;
  /** `null` once that player deleted their account (R-07). */
  readonly counterpart: PlayerBadge | null;
  readonly mine: readonly string[];
  readonly theirs: readonly string[];
}

export function tradeSides(trade: Trade, box: TradeBox): TradeSides {
  return box === "incoming"
    ? {
        counterpartCode: trade.proposerCode,
        counterpart: trade.proposer,
        mine: trade.want,
        theirs: trade.give,
      }
    : {
        counterpartCode: trade.recipientCode,
        counterpart: trade.recipient,
        mine: trade.give,
        theirs: trade.want,
      };
}

/** Offers still awaiting an answer first, oldest deadline first; then the history, newest first. */
export function splitTrades(
  trades: readonly Trade[],
  now: number,
): { readonly pending: Trade[]; readonly history: Trade[] } {
  const pending: Trade[] = [];
  const history: Trade[] = [];
  for (const trade of trades) {
    (effectiveStatus(trade, now) === "pending" ? pending : history).push(trade);
  }
  pending.sort((a, b) => Date.parse(a.expiresAt) - Date.parse(b.expiresAt));
  history.sort(
    (a, b) => Date.parse(b.resolvedAt ?? b.expiresAt) - Date.parse(a.resolvedAt ?? a.expiresAt),
  );
  return { pending, history };
}

/** `expire dans 2 j 05 h`, `3 h 12`, `12 min`; never zero while the offer is still pending. */
export function timeLeftLabel(expiresAt: string, now: number): string {
  const left = Date.parse(expiresAt) - now;
  if (left <= 0) return "Expirée";
  if (left >= DAY) {
    const days = Math.floor(left / DAY);
    const hours = Math.floor((left % DAY) / HOUR);
    return `Expire dans ${days} j ${String(hours).padStart(2, "0")} h`;
  }
  if (left >= HOUR) {
    const hours = Math.floor(left / HOUR);
    const minutes = Math.floor((left % HOUR) / MINUTE);
    return `Expire dans ${hours} h ${String(minutes).padStart(2, "0")}`;
  }
  return `Expire dans ${Math.max(1, Math.ceil(left / MINUTE))} min`;
}

/**
 * When a recent account will be able to trade, or `null` once it can. `timeZone` is only there
 * for tests: the player sees their own.
 */
export function tradeableFromLabel(
  canTradeFrom: string,
  now: number,
  timeZone?: string,
): string | null {
  const from = Date.parse(canTradeFrom);
  if (from <= now) return null;
  const zone = timeZone === undefined ? {} : { timeZone };
  const day = new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    ...zone,
  }).format(from);
  const time = new Intl.DateTimeFormat("fr-FR", { hour: "numeric", minute: "2-digit", ...zone })
    .format(from)
    .replace(":", " h ");
  return `Compte tout neuf. Échanges possibles dès le ${day} à ${time}.`;
}

/** Why a player below the level needed cannot trade yet (P48), or `null` once they can. */
export function tradeLevelLabel(level: number, minLevel: number): string | null {
  if (level >= minLevel) return null;
  const left = minLevel - level;
  return `Les échanges ouvrent au niveau ${minLevel}. Encore ${left} niveau${left > 1 ? "x" : ""}.`;
}

/**
 * Adds or removes a card from a selection, without ever going over `max` (P59: one card per
 * side, then three). With one card per side, another card replaces the chosen one.
 */
export function toggleCard(
  selection: readonly string[],
  cardId: string,
  max: number,
): readonly string[] {
  if (selection.includes(cardId)) return selection.filter((id) => id !== cardId);
  if (max === 1) return [cardId];
  return selection.length < max ? [...selection, cardId] : selection;
}

/** « Échangeable dans 3 j », « dans 5 h »: when a held Épique or Légendaire can move (P35). */
export function heldLabel(tradeableFrom: string, now: number): string {
  const left = Math.max(0, Date.parse(tradeableFrom) - now);
  if (left >= DAY) return `Échangeable dans ${Math.ceil(left / DAY)} j`;
  return `Échangeable dans ${Math.max(1, Math.ceil(left / HOUR))} h`;
}

/** « Choisis 1 carte », « Choisis de 1 à 3 cartes ». */
export function pickHint(max: number): string {
  return max === 1 ? "Choisis 1 carte" : `Choisis de 1 à ${max} cartes`;
}

/** Problems the screen catches before asking the server, named like the server's refusals. */
export type OfferProblem = "invalid_code" | "self_trade" | "empty_side" | "too_many_cards";

export function offerProblem(offer: {
  readonly recipientCode: string;
  readonly ownCode: string | null;
  readonly give: readonly string[];
  readonly want: readonly string[];
  /** Cards per side the two levels allow (P59). */
  readonly max: number;
}): OfferProblem | null {
  const recipient = normalizePlayerCode(offer.recipientCode);
  if (recipient === null) return "invalid_code";
  if (recipient === offer.ownCode) return "self_trade";
  if (offer.give.length === 0 || offer.want.length === 0) return "empty_side";
  if (offer.give.length > offer.max || offer.want.length > offer.max) {
    return "too_many_cards";
  }
  return null;
}

const REFUSAL_MESSAGES: Readonly<Record<TradeRefusalCode | OfferProblem, string>> = {
  invalid_code: "Un code joueur fait 8 caractères, sans I, L, O ni U.",
  player_not_found: "Personne n'a ce code.",
  self_trade: "C'est ton code à toi.",
  empty_side: "Il faut au moins une carte de chaque côté.",
  too_many_cards: "Trop de cartes pour vos niveaux. Une de chaque côté avant le niveau 10.",
  duplicate_card: "Une même carte apparaît deux fois.",
  account_too_recent: "Compte tout neuf. Les échanges ouvrent 3 jours après ton arrivée.",
  level_too_low: "Il faut être niveau 5, toi comme l'autre joueur.",
  daily_limit_reached: "10 offres en 24 heures, c'est le maximum. Reviens demain.",
  card_not_tradeable:
    "Une carte n'est plus échangeable. Plus en double, ou Épique ou Légendaire de moins de 7 jours.",
  trade_not_pending: "Cette offre est déjà close.",
  trade_expired: "Trop tard, l'offre a expiré.",
  trade_not_found: "Cette offre n'existe plus.",
};

export function refusalMessage(code: TradeRefusalCode | OfferProblem): string {
  return REFUSAL_MESSAGES[code];
}

/** Count of a selection, for the step headings: `2 / 3`. */
export function selectionCount(selection: readonly string[], max: number): string {
  return `${selection.length} / ${max}`;
}

// --- Échanges screen (E-01 to E-07) --------------------------------------------------------------

/** « Reçues (2) »; the count only when there is something waiting. */
export function boxTabLabel(box: TradeBox, pending: number): string {
  const name = box === "incoming" ? "Reçues" : "Envoyées";
  return pending > 0 ? `${name} (${pending})` : name;
}

export const NO_OFFER_RECEIVED = "Personne ne frappe à la porte. Fais le premier pas.";
export const NO_OFFER_SENT = "Aucune offre en route.";

/** « 10 offres par 24 h. Une offre expire après 72 h. », with the rules of `now`. */
export function tradeRulesNote(now: number): string {
  const rules = tradeRulesAt(TRADE_SCHEDULE, now);
  return `${rules.offersPerDay} offres par 24 h. Une offre expire après ${Math.round(rules.offerTtlMs / HOUR)} h.`;
}

/** « baloise, talle »: the words of one side of an offer. */
export function wordList(cardIds: readonly string[], wordOf: (cardId: string) => string): string {
  return cardIds.map(wordOf).join(", ");
}

/**
 * One line of the history: « Conclue avec Raph : baloise contre talle. », the player's cards
 * first.
 */
export function historyLine(
  trade: Trade,
  box: TradeBox,
  now: number,
  wordOf: (cardId: string) => string,
): string {
  const sides = tradeSides(trade, box);
  return `${statusLabel(effectiveStatus(trade, now))} avec ${playerName(sides.counterpart)} : ${wordList(sides.mine, wordOf)} contre ${wordList(sides.theirs, wordOf)}.`;
}
