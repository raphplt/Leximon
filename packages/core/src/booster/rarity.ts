/** Rarities from most to least common. The order is meaningful: see `rarityRank`. */
export const RARITIES = ["common", "uncommon", "rare", "precious", "epic", "legendary"] as const;

export type Rarity = (typeof RARITIES)[number];

/** 0 for the most common rarity, higher for rarer ones. */
export function rarityRank(rarity: Rarity): number {
  return RARITIES.indexOf(rarity);
}

export function isAtLeast(rarity: Rarity, minimum: Rarity): boolean {
  return rarityRank(rarity) >= rarityRank(minimum);
}

/** Builds a record with one entry per rarity. */
export function byRarity<T>(make: (rarity: Rarity) => T): Record<Rarity, T> {
  return {
    common: make("common"),
    uncommon: make("uncommon"),
    rare: make("rare"),
    precious: make("precious"),
    epic: make("epic"),
    legendary: make("legendary"),
  };
}
