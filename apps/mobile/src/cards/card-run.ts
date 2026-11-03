/**
 * The cards a sheet was opened among, to turn to the one before or after. Kept here rather than
 * in the route: an album of a thousand cards does not fit in a link.
 */
let around: readonly string[] = [];

export function rememberCardsAround(cardIds: readonly string[]): void {
  around = cardIds;
}

export function cardsAround(): readonly string[] {
  return around;
}
