/** The words of an album filter, on their way to the Défis screen: too long for an address. */
let pending: readonly string[] | null = null;

export function askAlbumPractice(cardIds: readonly string[]): void {
  pending = cardIds;
}

export function takeAlbumPractice(): readonly string[] | null {
  const cardIds = pending;
  pending = null;
  return cardIds;
}
