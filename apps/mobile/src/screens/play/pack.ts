import type { ProgressGain, RarityCompletionResponse } from "@leximon/contract";
import type { Rarity } from "@leximon/core";
import type { DrawnCard } from "@leximon/view-model";

/** A pack just opened, from its reveal to its recap. */
export interface Pack {
  /** In reveal order: the rarest card comes last. */
  readonly cards: readonly DrawnCard[];
  readonly quantitiesBefore: ReadonlyMap<string, number>;
  readonly raritiesBefore: ReadonlySet<Rarity>;
  readonly collectionName: string;
  /** Tone of the card backs (`back` of the collection). */
  readonly back: string | undefined;
  /** Cards the progress line counts: the collection's. */
  readonly collectionCardIds: ReadonlySet<string>;
  /** XP this pack earned. */
  readonly progress: ProgressGain;
  /** Rarities of the collection this pack completed. */
  readonly completions: readonly RarityCompletionResponse[];
}

/** Whether the card at `index` is the first copy the player ever got of it. */
export function isNewAt(pack: Pack, index: number): boolean {
  const drawn = pack.cards[index];
  return (
    drawn !== undefined &&
    !pack.quantitiesBefore.has(drawn.cardId) &&
    pack.cards.findIndex((c) => c.cardId === drawn.cardId) === index
  );
}
