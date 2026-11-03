import { type CatalogCard, RARITY_LABELS } from "@leximon/contract";
import { type Catalog, cardOrPlaceholder, collectionName } from "@leximon/contract/client";
import { router } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import { Card } from "@/cards/card";
import { rememberCardsAround } from "@/cards/card-run";
import { space } from "@/theme";

/** The card behind an id from the API; a placeholder if this catalogue does not know it. */
export function catalogCard(catalog: Catalog, cardId: string): CatalogCard {
  return cardOrPlaceholder(catalog, cardId, catalog.cardsById.get(cardId)?.rarity ?? "common");
}

export function cardLabel(card: CatalogCard): string {
  return `${card.word}, ${RARITY_LABELS[card.rarity]}`;
}

/** `among`: the cards shown with it, in their order, to turn through from its sheet. */
export function openCard(cardId: string, among: readonly string[] = []): void {
  rememberCardsAround(among);
  router.push({ pathname: "/carte/[id]", params: { id: cardId } });
}

/** A row of small cards; each opens its card sheet, too small to read otherwise. */
export function CardRow({
  catalog,
  cardIds,
  width,
}: {
  readonly catalog: Catalog;
  readonly cardIds: readonly string[];
  readonly width: number;
}) {
  return (
    <View style={styles.row}>
      {cardIds.map((cardId) => {
        const card = catalogCard(catalog, cardId);
        return (
          <Pressable
            key={cardId}
            onPress={() => openCard(cardId)}
            accessibilityRole="button"
            accessibilityLabel={`Voir la carte ${cardLabel(card)}`}
          >
            <View importantForAccessibility="no-hide-descendants">
              <Card
                card={card}
                collectionName={collectionName(catalog, card.collectionId)}
                width={width}
              />
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: space.s4 },
});
