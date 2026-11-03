import type { Catalog } from "@leximon/contract/client";
import { collectionName } from "@leximon/contract/client";
import { fullPinsLine, morePinsLine, PIN_TEXTS, pinCandidates } from "@leximon/view-model";
import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Card } from "@/cards/card";
import { ownedCards } from "@/player/collection";
import { useShared } from "@/player/shared";
import { fontSizes, fonts, paperColors, radii, space } from "@/theme";
import { Icon } from "@/ui/icon";
import { RarityName } from "@/ui/rarity-icon";
import { Sheet } from "@/ui/sheet";

/**
 * Which card goes in a place of the profile: the player's cards, rarest first, with a search.
 * Those already pinned stay listed, greyed, so the player sees what is already shown.
 */
export function PinPicker({
  open,
  title,
  catalog,
  pinned,
  onPick,
  onClose,
}: {
  readonly open: boolean;
  readonly title: string;
  readonly catalog: Catalog | null;
  readonly pinned: readonly string[];
  readonly onPick: (cardId: string) => void;
  readonly onClose: () => void;
}) {
  const owned = useShared(ownedCards);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (open) setSearch("");
  }, [open]);

  const list = useMemo(
    () =>
      catalog === null || owned === null
        ? null
        : pinCandidates(catalog.cardsById.values(), owned, pinned, search),
    [catalog, owned, pinned, search],
  );

  return (
    <Sheet open={open} title={title} onClose={onClose}>
      <View style={styles.search}>
        <Icon name="search" size={18} color={ink.pageInkMuted} />
        <TextInput
          style={styles.searchInput}
          value={search}
          placeholder={PIN_TEXTS.search}
          placeholderTextColor={ink.pageInkFaint}
          selectionColor={ink.rubric}
          accessibilityLabel={PIN_TEXTS.search}
          autoCorrect={false}
          autoCapitalize="none"
          onChangeText={setSearch}
        />
      </View>
      {list === null ? (
        <Text style={styles.note}>Chargement de tes cartes…</Text>
      ) : list.items.length === 0 ? (
        <Text style={styles.note}>{search === "" ? PIN_TEXTS.noCards : PIN_TEXTS.noMatch}</Text>
      ) : (
        list.items.map((item) => (
          <Pressable
            key={item.cardId}
            disabled={item.pinned}
            onPress={() => onPick(item.cardId)}
            accessibilityRole="button"
            accessibilityState={{ disabled: item.pinned }}
            style={({ pressed }) => [
              styles.row,
              item.pinned && styles.rowPinned,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.word}>{item.word}</Text>
            {item.pinned ? (
              <View style={styles.already}>
                <Icon name="pin" size={14} color={ink.pageInkMuted} />
                <Text style={styles.alreadyText}>{PIN_TEXTS.alreadyPinned}</Text>
              </View>
            ) : (
              <RarityName rarity={item.rarity} color={ink.pageInkMuted} />
            )}
          </Pressable>
        ))
      )}
      {list !== null && list.more > 0 && <Text style={styles.note}>{morePinsLine(list.more)}</Text>}
    </Sheet>
  );
}

/**
 * Pinning from a card's sheet with every place taken: the pinned cards, and a touch on one
 * puts the new card in its place.
 */
export function ReplacePin({
  open,
  word,
  catalog,
  pinned,
  onPick,
  onClose,
}: {
  readonly open: boolean;
  readonly word: string;
  readonly catalog: Catalog | null;
  readonly pinned: readonly string[];
  readonly onPick: (index: number) => void;
  readonly onClose: () => void;
}) {
  return (
    <Sheet open={open} title={PIN_TEXTS.fullTitle} onClose={onClose}>
      <Text style={styles.lead}>{fullPinsLine(word)}</Text>
      <View style={styles.faces}>
        {pinned.map((cardId, index) => {
          const card = catalog?.cardsById.get(cardId);
          return (
            <Pressable
              key={cardId}
              onPress={() => onPick(index)}
              accessibilityRole="button"
              accessibilityLabel={`Remplacer ${card?.word ?? "cette carte"}`}
            >
              {card === undefined || catalog === null ? (
                <View style={styles.placeholder} />
              ) : (
                <Card
                  card={card}
                  collectionName={collectionName(catalog, card.collectionId)}
                  width={104}
                />
              )}
            </Pressable>
          );
        })}
      </View>
    </Sheet>
  );
}

/** It is read on a sheet, a leaf of paper in « La Bibliothèque ». */
const ink = paperColors;

const styles = StyleSheet.create({
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.s5,
    minHeight: 48,
    paddingHorizontal: space.s7,
    borderRadius: 24,
    backgroundColor: ink.well,
  },
  searchInput: {
    flex: 1,
    color: ink.pageInk,
    fontFamily: fonts.ui.semibold,
    fontSize: fontSizes.body,
    paddingVertical: space.s4,
  },
  note: { fontFamily: fonts.ui.medium, fontSize: fontSizes.label, color: ink.pageInkMuted },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.s6,
    minHeight: 50,
    paddingHorizontal: space.s7,
    borderRadius: radii.xl,
    backgroundColor: ink.panel,
  },
  rowPinned: { opacity: 0.55 },
  pressed: { opacity: 0.7 },
  word: { flex: 1, fontFamily: fonts.display, fontSize: fontSizes.subtitle, color: ink.pageInk },
  already: { flexDirection: "row", alignItems: "center", gap: space.s2 },
  alreadyText: { fontFamily: fonts.ui.bold, fontSize: fontSizes.small, color: ink.pageInkMuted },
  lead: {
    fontFamily: fonts.text.regular,
    fontSize: fontSizes.lead,
    lineHeight: 24,
    color: ink.pageInk,
  },
  faces: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: space.s6 },
  placeholder: { width: 104, height: 146, borderRadius: radii.md, backgroundColor: ink.panel },
});
