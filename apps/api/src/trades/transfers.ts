/** One copy of a card leaving (`debit`) or joining (`credit`) a player's collection. */
export interface CardMove {
  readonly userId: string;
  readonly cardId: string;
}

export interface TransferPlan {
  readonly debits: readonly CardMove[];
  readonly credits: readonly CardMove[];
}

export interface TradeSides {
  readonly proposerId: string;
  readonly recipientId: string;
  readonly give: readonly string[];
  readonly want: readonly string[];
}

/**
 * Copies moved when a trade is concluded: each card given goes from the proposer to the
 * recipient, each card wanted the other way. A card on both sides cancels out, so that no row is
 * written twice in the same statement. Sorted by (user, card): concurrent trades write the rows
 * they create in the same order.
 */
export function planTransfers(trade: TradeSides): TransferPlan {
  const both = new Set(trade.give.filter((cardId) => trade.want.includes(cardId)));
  const give = trade.give.filter((cardId) => !both.has(cardId));
  const want = trade.want.filter((cardId) => !both.has(cardId));
  const move = (userId: string) => (cardId: string) => ({ userId, cardId });
  return {
    debits: sortMoves([...give.map(move(trade.proposerId)), ...want.map(move(trade.recipientId))]),
    credits: sortMoves([...give.map(move(trade.recipientId)), ...want.map(move(trade.proposerId))]),
  };
}

function compareMoves(a: CardMove, b: CardMove): number {
  if (a.userId !== b.userId) return a.userId < b.userId ? -1 : 1;
  if (a.cardId !== b.cardId) return a.cardId < b.cardId ? -1 : 1;
  return 0;
}

function sortMoves(moves: CardMove[]): CardMove[] {
  return moves.sort(compareMoves);
}
