import {
  type CatalogCard,
  type MissingWordRefusal,
  RARITY_LABELS,
  type RecycleRefusal,
} from "@leximon/contract";
import {
  canOpenCollection,
  ECU_SCHEDULE,
  type EcuRules,
  type EpochMs,
  ecuRulesAt,
  RARITIES,
  type Rarity,
  type RecyclePlan,
  recyclePlan,
  UNLOCK_SCHEDULE,
  unlockRulesAt,
} from "@leximon/core";
import { formatCount, plural } from "./format";

/** The écus: the pill, the recycling of duplicates and the missing word. */

export function ecuRules(now: EpochMs): EcuRules {
  return ecuRulesAt(ECU_SCHEDULE, now);
}

/** « 0 écu », « 1 écu », « 34 écus ». */
export function ecusLabel(count: number): string {
  return plural(count, "écu", "écus");
}

export const ECUS_TITLE = "Tes écus";

const RARITY_FEMININE: Readonly<Record<Rarity, string>> = {
  common: "Courante",
  uncommon: "Peu courante",
  rare: "Rare",
  precious: "Précieuse",
  epic: "Épique",
  legendary: "Légendaire",
};

const RARITY_MASCULINE_PLURAL: Readonly<Record<Rarity, string>> = {
  common: "Courants",
  uncommon: "Peu courants",
  rare: "Rares",
  precious: "Précieux",
  epic: "Épiques",
  legendary: "Légendaires",
};

/** The panel behind the pill: where écus come from and what they buy, with the figures. */
export function ecusPanel(rules: EcuRules): readonly string[] {
  const [first, ...others] = RARITIES;
  const gains = others.map(
    (rarity) => `${formatCount(rules.recycleValue[rarity])} pour une ${RARITY_FEMININE[rarity]}`,
  );
  const prices = others.map(
    (rarity) => `${formatCount(rules.missingWordPrice[rarity])} en ${RARITY_LABELS[rarity]}`,
  );
  return [
    "Tu gagnes des écus en recyclant tes doubles, et tu les dépenses pour choisir un mot qui te manque.",
    `Un double rapporte ${listOf([`${ecusLabel(rules.recycleValue[first])} pour une carte ${RARITY_FEMININE[first]}`, ...gains])}.`,
    `Un mot manquant coûte ${listOf([`${ecusLabel(rules.missingWordPrice[first])} en ${RARITY_LABELS[first]}`, ...prices])}.`,
  ];
}

function listOf(items: readonly string[]): string {
  return items.length < 2
    ? (items[0] ?? "")
    : `${items.slice(0, -1).join(", ")} et ${items[items.length - 1]}`;
}

/** What the one-touch recycling would do now, from the cards the screen knows of. */
export function recyclePreview(
  rules: EcuRules,
  cards: readonly Pick<CatalogCard, "id" | "rarity">[],
  copies: ReadonlyMap<string, number>,
): RecyclePlan {
  return recyclePlan(
    rules,
    cards.flatMap((card) => {
      const quantity = copies.get(card.id) ?? 0;
      return quantity > 0 ? [{ cardId: card.id, rarity: card.rarity, quantity }] : [];
    }),
  );
}

/** « Recycler 12 doubles, +34 écus »; `null` when there is nothing to recycle. */
export function recycleAction(plan: RecyclePlan): string | null {
  if (plan.copies === 0) return null;
  return `Recycler ${plural(plan.copies, "double", "doubles")}, +${ecusLabel(plan.ecus)}`;
}

export const RECYCLE_BUSY = "Recyclage…";
export const RECYCLE_FAILED = "Tes doubles n'ont pas été recyclés. Réessaie.";

export const RECYCLE_RULE =
  "Le recyclage te laisse toujours la carte et un double, pour l'échanger. Les cartes Épiques et Légendaires se recyclent une par une, depuis leur fiche.";

/** Said once recycled; a concurrent tab may have left nothing. */
export function recycledToast(plan: Pick<RecyclePlan, "copies" | "ecus">): string {
  if (plan.copies === 0) return "Tu n'avais plus de double à recycler.";
  return `Tu as recyclé ${plural(plan.copies, "double", "doubles")} et gagné ${ecusLabel(plan.ecus)}.`;
}

/** On a card's sheet: « Recycler un double, +50 écus »; `null` with a single copy. */
export function recycleCopyAction(
  rules: EcuRules,
  rarity: Rarity,
  quantity: number,
): string | null {
  if (quantity < 2) return null;
  return `Recycler un double, +${ecusLabel(rules.recycleValue[rarity])}`;
}

/** The rarest cards are never recycled in bulk: their sheet asks once more. */
export function recycleCopyNeedsConfirm(rules: EcuRules, rarity: Rarity): boolean {
  return !rules.recycledTogether.includes(rarity);
}

export function recycleCopyConfirm(rules: EcuRules, rarity: Rarity, quantity: number): string {
  const left = quantity - 1;
  return `Ce double vaut ${ecusLabel(rules.recycleValue[rarity])}. Il te restera ${plural(left, "exemplaire", "exemplaires")} de cette carte.`;
}

export const RECYCLE_COPY_CONFIRM_ACTION = "Oui, recycler ce double";
export const RECYCLE_COPY_KEEP = "Garder ce double";

export function recycleRefusalMessage(reason: RecycleRefusal): string {
  switch (reason) {
    case "no_duplicate":
      return "Tu n'as plus de double de cette carte.";
  }
}

export const MISSING_WORD_TITLE = "Choisir un mot manquant";
export const MISSING_WORD_OPEN = "Choisir un mot manquant";
export const MISSING_WORD_RULE =
  "Choisis une collection et une rareté. Tu reçois un mot qui te manque, tiré au sort parmi ceux de ton choix.";
export const MISSING_WORD_GOT = "Un nouveau mot dans ton album !";
export const MISSING_WORD_BUSY = "Tirage…";
export const MISSING_WORD_FAILED = "Le mot n'a pas été tiré. Réessaie.";

/** The collections a missing word may come from: the ones whose sachet the player may choose. */
export function missingWordCollections<T extends { readonly id: string }>(
  collections: readonly T[],
  level: number,
  now: EpochMs,
): T[] {
  const rules = unlockRulesAt(UNLOCK_SCHEDULE, now);
  return collections.filter((collection) => canOpenCollection(rules, collection.id, level));
}

/** Under the collections while only the first one is open. */
export function missingWordLockedLine(level: number, now: EpochMs): string | null {
  const opens = unlockRulesAt(UNLOCK_SCHEDULE, now).levels.choose_collection;
  if (level >= opens) return null;
  return `Tu pourras choisir un mot des autres collections au niveau ${opens}.`;
}

export type MissingWordState = "open" | "too_poor" | "complete";

export interface MissingWordOption {
  readonly rarity: Rarity;
  readonly label: string;
  readonly price: number;
  readonly missing: number;
  readonly state: MissingWordState;
  /** « 12 mots manquants », « Tu les as tous ». */
  readonly missingLine: string;
  /** « 40 écus ». */
  readonly priceLabel: string;
}

/** What each rarity of a collection offers, from the cards the screen knows of. */
export function missingWordOptions(
  rules: EcuRules,
  cards: readonly Pick<CatalogCard, "id" | "rarity">[],
  copies: ReadonlyMap<string, number>,
  ecus: number,
): MissingWordOption[] {
  return RARITIES.flatMap((rarity) => {
    const ofRarity = cards.filter((card) => card.rarity === rarity);
    if (ofRarity.length === 0) return [];
    const missing = ofRarity.filter((card) => (copies.get(card.id) ?? 0) === 0).length;
    const price = rules.missingWordPrice[rarity];
    const state: MissingWordState = missing === 0 ? "complete" : ecus < price ? "too_poor" : "open";
    return [
      {
        rarity,
        label: RARITY_LABELS[rarity],
        price,
        missing,
        state,
        missingLine:
          missing === 0 ? "Tu les as tous" : plural(missing, "mot manquant", "mots manquants"),
        priceLabel: ecusLabel(price),
      },
    ];
  });
}

/** « Recevoir un mot Rare pour 40 écus ». */
export function missingWordAction(option: Pick<MissingWordOption, "label" | "price">): string {
  return `Recevoir un mot ${option.label} pour ${ecusLabel(option.price)}`;
}

/** Why the chosen rarity cannot be bought, or `null` when it can. */
export function missingWordBlocked(option: MissingWordOption, ecus: number): string | null {
  switch (option.state) {
    case "open":
      return null;
    case "complete":
      return `Tu as déjà tous les mots ${RARITY_MASCULINE_PLURAL[option.rarity]} de cette collection.`;
    case "too_poor":
      return `Il te faut ${ecusLabel(option.price)}. ${ecus === 0 ? "Tu n'en as aucun." : `Tu en as ${formatCount(ecus)}.`}`;
  }
}

export function missingWordRefusalMessage(reason: MissingWordRefusal): string {
  switch (reason) {
    case "not_enough_ecus":
      return "Tu n'as plus assez d'écus pour ce mot.";
    case "nothing_missing":
      return "Tu as déjà tous les mots de ce choix.";
    case "collection_locked":
      return "Cette collection n'est pas encore ouverte pour toi.";
    case "collection_not_found":
      return "Cette collection n'existe plus.";
  }
}

/** The copies once recycled, without reading them all again. */
export function copiesAfterRecycle(
  copies: ReadonlyMap<string, number>,
  recycled: readonly { readonly cardId: string; readonly copies: number }[],
): Map<string, number> {
  const after = new Map(copies);
  for (const card of recycled) {
    after.set(card.cardId, Math.max(0, (after.get(card.cardId) ?? 0) - card.copies));
  }
  return after;
}
