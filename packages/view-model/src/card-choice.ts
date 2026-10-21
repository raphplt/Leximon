import type { CardChoiceRefusal } from "@leximon/contract";
import {
  type EpochMs,
  isChoosableRarity,
  LEVEL_REWARD_SCHEDULE,
  levelRewardRulesAt,
  type Rarity,
} from "@leximon/core";
import { plural } from "./format";

/**
 * The card of the player's choice (P58, N-08): a Courant or Peu courant card the player lacks,
 * taken from the published collections. Contents are known: nothing is drawn. Once every such
 * card is owned, any of them can be taken again. The server checks the same rule.
 */

export interface ChoosableCard {
  readonly id: string;
  readonly word: string;
  readonly rarity: Rarity;
  readonly collectionId: string;
}

export interface ChoiceGroup<C extends ChoosableCard> {
  readonly collectionId: string;
  readonly name: string;
  readonly cards: readonly C[];
}

/** French alphabetical order, accents ignored: « écale » sits with the e. */
const ORDER = new Intl.Collator("fr", { sensitivity: "base" });

/** Removes accents and case, for a search typed without them. */
function fold(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

/** The cards that can be chosen, by collection, filtered by a search on the word. */
export function choiceGroups<C extends ChoosableCard>(
  collections: readonly {
    readonly id: string;
    readonly name: string;
    readonly cards: readonly C[];
  }[],
  owned: ReadonlySet<string>,
  search: string,
  now: EpochMs,
): ChoiceGroup<C>[] {
  const rules = levelRewardRulesAt(LEVEL_REWARD_SCHEDULE, now);
  const choosable = collections.map((c) => ({
    collectionId: c.id,
    name: c.name,
    cards: c.cards.filter((card) => isChoosableRarity(rules, card.rarity)),
  }));
  const missing = choosable.map((g) => ({ ...g, cards: g.cards.filter((c) => !owned.has(c.id)) }));
  const lacksAny = missing.some((g) => g.cards.length > 0);
  const wanted = fold(search.trim());
  return (lacksAny ? missing : choosable)
    .map((g) => ({
      ...g,
      cards: g.cards
        .filter((c) => wanted === "" || fold(c.word).includes(wanted))
        .sort((a, b) => ORDER.compare(a.word, b.word)),
    }))
    .filter((g) => g.cards.length > 0);
}

/** « 214 cartes qui te manquent », above the list. */
export function choiceCount(groups: readonly ChoiceGroup<ChoosableCard>[]): string {
  const count = groups.reduce((sum, g) => sum + g.cards.length, 0);
  return plural(count, "carte qui te manque", "cartes qui te manquent");
}

export function choiceRefusalMessage(reason: CardChoiceRefusal): string {
  switch (reason) {
    case "already_chosen":
      return "Carte déjà choisie pour ce niveau.";
    case "no_card_choice":
      return "Pas de carte au choix en attente.";
    case "card_not_choosable":
      return "Celle-là, tu ne peux pas la prendre. Choisis-en une autre.";
  }
}
