import {
  playerCodeSchema,
  type Trade,
  type TradeRefusalCode,
  type TradeStatus,
} from "@leximon/contract";

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

/** Cards on each side of an offer (D-026). */
export const MAX_CARDS_PER_SIDE = 3;

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
  readonly mine: readonly string[];
  readonly theirs: readonly string[];
}

export function tradeSides(trade: Trade, box: TradeBox): TradeSides {
  return box === "incoming"
    ? { counterpartCode: trade.proposerCode, mine: trade.want, theirs: trade.give }
    : { counterpartCode: trade.recipientCode, mine: trade.give, theirs: trade.want };
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
  return `Ton compte est tout neuf : tu pourras échanger à partir du ${day} à ${time}.`;
}

/** Why a player below the level needed cannot trade yet (P48), or `null` once they can. */
export function tradeLevelLabel(level: number, minLevel: number): string | null {
  if (level >= minLevel) return null;
  const left = minLevel - level;
  return `Les échanges s'ouvrent au niveau ${minLevel} : encore ${left} niveau${left > 1 ? "x" : ""}. Ouvre des plis et relève des défis pour y arriver.`;
}

/** Adds or removes a card from a selection, without ever going over `max`. */
export function toggleCard(
  selection: readonly string[],
  cardId: string,
  max: number = MAX_CARDS_PER_SIDE,
): readonly string[] {
  if (selection.includes(cardId)) return selection.filter((id) => id !== cardId);
  return selection.length < max ? [...selection, cardId] : selection;
}

/** Problems the screen catches before asking the server, named like the server's refusals. */
export type OfferProblem = "invalid_code" | "self_trade" | "empty_side" | "too_many_cards";

export function offerProblem(offer: {
  readonly recipientCode: string;
  readonly ownCode: string | null;
  readonly give: readonly string[];
  readonly want: readonly string[];
}): OfferProblem | null {
  const recipient = normalizePlayerCode(offer.recipientCode);
  if (recipient === null) return "invalid_code";
  if (recipient === offer.ownCode) return "self_trade";
  if (offer.give.length === 0 || offer.want.length === 0) return "empty_side";
  if (offer.give.length > MAX_CARDS_PER_SIDE || offer.want.length > MAX_CARDS_PER_SIDE) {
    return "too_many_cards";
  }
  return null;
}

const REFUSAL_MESSAGES: Readonly<Record<TradeRefusalCode | OfferProblem, string>> = {
  invalid_code:
    "Un code joueur compte 8 caractères, lettres et chiffres (sans I, L, O ni U). Vérifie-le.",
  player_not_found: "Aucun joueur ne porte ce code. Vérifie-le avec la personne qui te l'a donné.",
  self_trade: "C'est ton propre code ! Demande celui de la personne avec qui tu veux échanger.",
  empty_side: "Choisis au moins une carte de chaque côté de l'échange.",
  too_many_cards: `Un échange compte au plus ${MAX_CARDS_PER_SIDE} cartes de chaque côté.`,
  duplicate_card: "Chaque carte ne peut figurer qu'une fois dans l'offre.",
  account_too_recent:
    "Ton compte est encore tout neuf : les échanges s'ouvrent 3 jours après ton arrivée.",
  level_too_low:
    "Les échanges s'ouvrent au niveau 5, pour toi comme pour l'autre joueur. Il faudra un peu de patience !",
  daily_limit_reached:
    "Tu as envoyé 10 offres en 24 heures, c'est le maximum. Reviens un peu plus tard !",
  card_not_tradeable:
    "Une des cartes n'est plus échangeable : elle n'est plus en double, ou c'est une Épique ou une Légendaire obtenue il y a moins de 7 jours.",
  trade_not_pending: "Cette offre a déjà reçu une réponse ou a été annulée.",
  trade_expired: "Trop tard, cette offre a expiré. Tu peux en proposer une nouvelle.",
  trade_not_found: "Cette offre n'existe plus.",
};

export function refusalMessage(code: TradeRefusalCode | OfferProblem): string {
  return REFUSAL_MESSAGES[code];
}

/** Count of a selection, for the step headings: `2 / 3`. */
export function selectionCount(selection: readonly string[]): string {
  return `${selection.length} / ${MAX_CARDS_PER_SIDE}`;
}
