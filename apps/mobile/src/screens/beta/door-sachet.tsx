import type { CatalogCard, CatalogCollectionFile } from "@leximon/contract";
import { lettering } from "@leximon/tokens";
import { frequencyLine } from "@leximon/view-model";
import { useEffect, useState } from "react";
import { StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { Card } from "@/cards/card";
import { loadCatalog } from "@/cards/catalog";
import { play } from "@/feedback/feedback";
import { Desk, PaperAction } from "@/library/play-pieces";
import { Sachet } from "@/screens/play/sachet";
import { fontSizes, fonts, space } from "@/theme";
import { RarityName } from "@/ui/rarity-icon";
import { Kicker } from "@/ui/toy";

const SACHET_WIDTH = 170;
const CARD_WIDTH = 140;

/**
 * A real sachet on the desk, torn on the spot by someone who cannot play yet: a card of its
 * collection comes out, drawn here for show. Nothing is asked of the server and nothing is kept.
 */
export function DoorSachet() {
  const window = useWindowDimensions();
  const [collection, setCollection] = useState<CatalogCollectionFile | null>(null);
  const [card, setCard] = useState<CatalogCard | null>(null);
  const [round, setRound] = useState(0);
  const narrow = window.width < 375;
  const sachetWidth = Math.min(SACHET_WIDTH, Math.round(window.width * 0.48));
  const cardWidth = Math.min(CARD_WIDTH, Math.max(96, Math.floor((window.width - 112) * 0.45)));

  useEffect(() => {
    let live = true;
    loadCatalog()
      .then((catalog) => {
        if (live) setCollection(catalog.collections[0] ?? null);
      })
      // Without the catalogue the desk stays empty: the door below still works.
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);

  const open = () => {
    if (collection === null) return;
    const drawn = collection.cards[Math.floor(Math.random() * collection.cards.length)];
    if (drawn === undefined) return;
    play("cardSlide");
    setCard(drawn);
  };

  const again = () => {
    setCard(null);
    setRound((value) => value + 1);
  };

  return (
    <View style={styles.counter}>
      <Desk style={StyleSheet.absoluteFill} />
      {collection !== null && card === null && (
        <>
          <Sachet
            key={round}
            collection={collection}
            state="sealed"
            active
            width={sachetWidth}
            refill={null}
            refillLabel={null}
            onTearStart={() => undefined}
            onOpen={open}
          />
          <View style={styles.hint}>
            <Kicker>Un sachet t'attend. Déchire-le.</Kicker>
          </View>
        </>
      )}
      {collection !== null && card !== null && (
        <View style={[styles.revealed, narrow && styles.revealedNarrow]}>
          <Card card={card} collectionName={collection.name} width={cardWidth} />
          <View style={styles.revealedText}>
            <RarityName rarity={card.rarity} color={lettering.fill} />
            <Text style={styles.frequency}>{frequencyLine(card.perBillion)}</Text>
            <PaperAction label="Un autre sachet" onPress={again} />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  counter: {
    height: 350,
    alignItems: "center",
    justifyContent: "center",
    marginTop: space.s10,
  },
  hint: { position: "absolute", bottom: space.s6 },
  revealed: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.s8,
    paddingHorizontal: space.s8,
  },
  revealedNarrow: {
    gap: space.s5,
    paddingHorizontal: space.s5,
  },
  revealedText: { flex: 1, minWidth: 0, alignItems: "flex-start", gap: space.s6 },
  frequency: {
    color: lettering.fill,
    fontFamily: fonts.ui.bold,
    fontSize: fontSizes.body,
    lineHeight: 20,
  },
});
