import type { Catalog } from "@leximon/contract/client";
import type { Rarity } from "@leximon/core";
import { collectionTone, masteryColors, rarityStyles, solidColor } from "@leximon/tokens";
import {
  ALL_COLLECTIONS,
  type AlbumFilter,
  type AlbumItem,
  type AlbumState,
  albumView,
  type CompareFilter,
  compareFilters,
  comparingTitle,
  type MissingItem,
  type OwnedItem,
  playerName,
  shortName,
} from "@leximon/view-model";
import { router } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { api } from "@/api/client";
import { Card } from "@/cards/card";
import { catalogInHand, loadCatalog } from "@/cards/catalog";
import { cardDates, ownedCards, wordMemory } from "@/player/collection";
import { useNow, useShared, useSharedFailed } from "@/player/shared";
import { TAB_BAR_RISE } from "@/shell/tab-bar";
import { colors, fonts } from "@/theme";
import { Button } from "@/ui/button";
import { Icon } from "@/ui/icon";
import { RarityChip, RarityName } from "@/ui/rarity-icon";

/** The collection tab chosen last, kept on the device. */
const STORED_COLLECTION = "leximon_album";
const COLUMNS = 3;
const GUTTER = 16;
const GAP = 12;

function readCollection(): string | null {
  try {
    return SecureStore.getItem(STORED_COLLECTION);
  } catch {
    return null;
  }
}

/** The tab chosen last time if it still exists, else every collection. */
function rememberedCollection(catalog: Catalog): string {
  const stored = readCollection();
  return catalog.collections.some((c) => c.id === stored) && stored !== null
    ? stored
    : ALL_COLLECTIONS;
}

function writeCollection(id: string): void {
  SecureStore.setItemAsync(STORED_COLLECTION, id).catch(() => {
    // Not remembered: the album opens on every collection next time.
  });
}

/** The album: collection tabs, rarity and filters, the grid of cards. */
export function AlbumScreen({ friendCode }: { readonly friendCode: string | null }) {
  const window = useWindowDimensions();
  const [catalog, setCatalog] = useState<Catalog | null>(catalogInHand);
  const [failed, setFailed] = useState(false);
  const owned = useShared(ownedCards);
  const ownedFailed = useSharedFailed(ownedCards);
  const memory = useShared(wordMemory);
  const dates = useShared(cardDates);
  const now = useNow(60_000);
  const [state, setState] = useState<AlbumState>(() => ({
    collectionId: catalog === null ? "" : rememberedCollection(catalog),
    rarity: null,
    filter: "all",
    theme: null,
    search: "",
    compare: null,
  }));
  const [friend, setFriend] = useState<{
    readonly name: string;
    readonly cards: ReadonlySet<string>;
  } | null>(null);

  useEffect(() => {
    setFriend(null);
    setState((s) => ({ ...s, compare: null }));
    if (friendCode === null) return;
    let live = true;
    api
      .fetchFriendCards(friendCode)
      .then((found) => {
        if (!live || found === null) return;
        setFriend({ name: playerName(found.player), cards: new Set(found.cardIds) });
        setState((s) => ({ ...s, compare: "theirs" }));
      })
      .catch(() => {
        // The player's own album stays, without the comparison.
      });
    return () => {
      live = false;
    };
  }, [friendCode]);

  const load = useCallback(() => {
    setFailed(false);
    loadCatalog()
      .then((loaded) => {
        setCatalog(loaded);
        setState((s) =>
          s.collectionId === "" ? { ...s, collectionId: rememberedCollection(loaded) } : s,
        );
      })
      .catch(() => setFailed(true));
  }, []);

  useEffect(load, [load]);

  const view = useMemo(
    () =>
      catalog === null || owned === null
        ? null
        : albumView(
            {
              collections: catalog.collections,
              owned,
              memory: memory ?? new Map(),
              dates: dates ?? new Map(),
              now,
              ...(friend === null ? {} : { friend: friend.cards }),
            },
            state,
          ),
    [catalog, owned, memory, dates, now, state, friend],
  );

  const cardWidth = Math.floor((window.width - GUTTER * 2 - GAP * (COLUMNS - 1)) / COLUMNS);

  if (failed) {
    return (
      <View style={styles.center}>
        <Text style={styles.empty}>Les cartes n'ont pas pu être chargées. Réessaie.</Text>
        <Button label="Réessayer" secondary onPress={load} />
      </View>
    );
  }

  if (owned === null && ownedFailed) {
    return (
      <View style={styles.center}>
        <Text style={styles.empty}>Le serveur lambine.</Text>
        <Button label="Réessayer" secondary onPress={() => ownedCards.ensure()} />
      </View>
    );
  }

  if (view === null) {
    return (
      <View style={styles.center}>
        <Text style={styles.empty}>On range les cartes…</Text>
      </View>
    );
  }

  const pickCollection = (id: string) => {
    writeCollection(id);
    setState((s) => ({ ...s, collectionId: id, rarity: null, theme: null, search: "" }));
  };
  const tagline = catalog?.collections.find((c) => c.id === state.collectionId)?.tagline;
  const comparing = friend !== null && state.compare != null;

  const header = (
    <View style={styles.header}>
      <View style={styles.titleRow}>
        <Text style={styles.title} accessibilityRole="header">
          Album
        </Text>
        <Text style={styles.headline}>
          <Text style={styles.headlineStrong}>{view.headline.owned}</Text> mots sur{" "}
          {view.headline.total}
        </Text>
      </View>
      <View style={styles.search}>
        <Icon name="search" size={18} color={colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Chercher un mot"
          placeholderTextColor={colors.textFaint}
          selectionColor={colors.accent}
          value={state.search}
          onChangeText={(search) => setState((s) => ({ ...s, search }))}
          autoCorrect={false}
          returnKeyType="search"
          accessibilityLabel="Chercher un mot"
        />
        {state.search !== "" && (
          <Pressable
            onPress={() => setState((s) => ({ ...s, search: "" }))}
            accessibilityRole="button"
            accessibilityLabel="Effacer la recherche"
            hitSlop={8}
          >
            <Icon name="close" size={18} color={colors.textMuted} />
          </Pressable>
        )}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
        style={[styles.bleed, view.searching && styles.dimmed]}
        accessibilityRole="tablist"
      >
        {view.tabs.map((tab) => {
          const selected = !view.searching && tab.id === state.collectionId;
          return (
            <Pressable
              key={tab.id}
              onPress={() => pickCollection(tab.id)}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              style={[styles.tab, selected && styles.tabOn]}
            >
              <View style={styles.tabHead}>
                <Text style={styles.tabName}>{shortName(tab.name)}</Text>
                <Text style={styles.tabCount}>{tab.count}</Text>
              </View>
              <View style={styles.tabTrack}>
                <View
                  style={[
                    styles.tabFill,
                    {
                      width: `${Math.round(tab.ratio * 100)}%`,
                      backgroundColor: collectionTone(tab.id),
                    },
                  ]}
                />
              </View>
            </Pressable>
          );
        })}
      </ScrollView>

      {!view.searching && (
        <>
          {tagline !== undefined && <Text style={styles.tagline}>{tagline}</Text>}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.row}
            style={styles.bleed}
          >
            {view.rarities.map((chip) => (
              <RarityFilter
                key={chip.rarity}
                rarity={chip.rarity}
                count={chip.count}
                label={chip.aria}
                on={state.rarity === chip.rarity}
                onPick={() =>
                  setState((s) => ({ ...s, rarity: s.rarity === chip.rarity ? null : chip.rarity }))
                }
              />
            ))}
          </ScrollView>
          {comparing ? (
            <View style={styles.compare}>
              <View style={styles.compareHead}>
                <Text style={styles.compareTitle}>{comparingTitle(friend.name)}</Text>
                <Pressable
                  onPress={() => router.setParams({ ami: undefined })}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel="Fermer la comparaison"
                >
                  <Icon name="close" size={18} color={colors.textMuted} />
                </Pressable>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.row}
                style={styles.bleed}
              >
                {compareFilters(friend.name).map((choice) => (
                  <FilterChip
                    key={choice.id}
                    label={choice.label}
                    on={state.compare === choice.id}
                    onPick={() => setState((s) => ({ ...s, compare: choice.id as CompareFilter }))}
                  />
                ))}
              </ScrollView>
            </View>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.row}
              style={styles.bleed}
            >
              {view.filters.map((filter) => (
                <FilterChip
                  key={filter.id}
                  label={filter.label}
                  count={filter.count}
                  on={state.filter === filter.id}
                  onPick={() => setState((s) => ({ ...s, filter: filter.id as AlbumFilter }))}
                />
              ))}
              <View style={styles.divider} />
              {view.themes.map((theme) => (
                <FilterChip
                  key={theme.id}
                  label={theme.label}
                  on={state.theme === theme.id}
                  muted
                  onPick={() =>
                    setState((s) => ({ ...s, theme: s.theme === theme.id ? null : theme.id }))
                  }
                />
              ))}
            </ScrollView>
          )}
        </>
      )}
      {view.empty !== null && <Text style={styles.emptyLine}>{view.empty}</Text>}
    </View>
  );

  return (
    <FlatList
      data={view.empty === null ? view.items : []}
      keyExtractor={itemKey}
      numColumns={COLUMNS}
      ListHeaderComponent={header}
      renderItem={({ item }) => <Tile item={item} width={cardWidth} />}
      columnWrapperStyle={styles.gridRow}
      contentContainerStyle={styles.grid}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      initialNumToRender={9}
      maxToRenderPerBatch={9}
      windowSize={5}
      removeClippedSubviews
    />
  );
}

function itemKey(item: AlbumItem): string {
  if (item.kind === "owned") return item.card.id;
  if (item.kind === "missing") return `missing-${item.cardId}`;
  return "more";
}

const Tile = memo(function Tile({
  item,
  width,
}: {
  readonly item: AlbumItem;
  readonly width: number;
}) {
  switch (item.kind) {
    case "owned":
      return <OwnedTile item={item} width={width} />;
    case "missing":
      return <MissingTile item={item} width={width} />;
    case "more":
      return (
        <Pressable
          onPress={() => router.navigate("/")}
          accessibilityRole="link"
          style={[styles.more, { width, height: width * 1.4 }]}
        >
          <Text style={styles.moreCount}>{item.left}</Text>
          <Text style={styles.moreLabel}>{item.label}</Text>
        </Pressable>
      );
  }
});

function OwnedTile({ item, width }: { readonly item: OwnedItem; readonly width: number }) {
  return (
    <Pressable
      onPress={() => router.push({ pathname: "/carte/[id]", params: { id: item.card.id } })}
      accessibilityRole="button"
      accessibilityLabel={item.aria}
      style={[styles.tile, { width }]}
    >
      <View importantForAccessibility="no-hide-descendants">
        <Card card={item.card} collectionName={item.collectionName} width={width} />
      </View>
      {item.fresh && <Text style={styles.fresh}>Nouveau</Text>}
      {item.quantity > 1 && <Text style={styles.quantity}>×{item.quantity}</Text>}
      <View style={styles.mastery}>
        <View style={[styles.dot, { backgroundColor: masteryColors[item.level] }]} />
        <Text style={[styles.masteryText, { color: masteryColors[item.level] }]}>
          {item.levelLabel}
        </Text>
      </View>
    </Pressable>
  );
}

/** A card not found yet: only its rarity shows, the word stays a surprise. */
function MissingTile({ item, width }: { readonly item: MissingItem; readonly width: number }) {
  const frame = solidColor(rarityStyles[item.rarity].frame);
  return (
    <View
      style={[styles.tile, { width }]}
      accessible
      accessibilityRole="image"
      accessibilityLabel={item.aria}
    >
      <View style={[styles.missingBox, { width, height: width * 1.4, borderColor: `${frame}8C` }]}>
        <Text style={[styles.question, { fontSize: width * 0.32 }]}>?</Text>
      </View>
      <View style={styles.missingLabel}>
        <RarityName rarity={item.rarity} color={colors.textFaint} />
      </View>
    </View>
  );
}

function RarityFilter({
  rarity,
  count,
  label,
  on,
  onPick,
}: {
  readonly rarity: Rarity;
  readonly count: string;
  readonly label: string;
  readonly on: boolean;
  readonly onPick: () => void;
}) {
  return (
    <Pressable
      onPress={onPick}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      accessibilityLabel={label}
      style={[styles.chip, on && styles.chipOn]}
    >
      <RarityChip rarity={rarity} size={24} />
      <Text style={[styles.chipText, on && styles.chipTextOn]}>{count}</Text>
    </Pressable>
  );
}

function FilterChip({
  label,
  count = null,
  on,
  muted = false,
  onPick,
}: {
  readonly label: string;
  /** Shown beside the label when there is something to count. */
  readonly count?: number | null;
  readonly on: boolean;
  readonly muted?: boolean;
  readonly onPick: () => void;
}) {
  return (
    <Pressable
      onPress={onPick}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      style={[styles.chip, muted && styles.chipMuted, on && styles.chipOn]}
    >
      <Text style={[styles.chipText, muted && styles.chipTextMuted, on && styles.chipTextOn]}>
        {label}
      </Text>
      {count !== null && count > 0 && <Text style={styles.chipCount}>{count}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16, padding: 24 },
  empty: { fontFamily: fonts.ui.semibold, fontSize: 16, color: colors.textMuted },
  header: { gap: 12, paddingTop: 8, paddingBottom: 16 },
  titleRow: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
  title: { fontFamily: fonts.display, fontSize: 30, color: colors.text },
  headline: { fontFamily: fonts.ui.semibold, fontSize: 14, color: colors.textMuted },
  headlineStrong: { fontFamily: fonts.ui.extrabold, color: colors.text },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 22,
    backgroundColor: colors.well,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 8,
    color: colors.text,
    fontFamily: fonts.ui.semibold,
    fontSize: 16,
  },
  bleed: { marginHorizontal: -GUTTER, flexGrow: 0 },
  row: { gap: 8, paddingHorizontal: GUTTER, alignItems: "center" },
  compare: { gap: 8 },
  compareHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  compareTitle: { fontFamily: fonts.ui.extrabold, fontSize: 15, color: colors.accent },
  dimmed: { opacity: 0.4 },
  tab: {
    minWidth: 110,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    borderRadius: 14,
    backgroundColor: colors.backgroundRaised,
    borderWidth: 2,
    borderColor: "transparent",
  },
  tabOn: { borderColor: colors.accent },
  tabHead: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 10,
  },
  tabName: { fontFamily: fonts.ui.extrabold, fontSize: 14, color: colors.text },
  tabCount: { fontFamily: fonts.ui.bold, fontSize: 12, color: colors.textMuted },
  tabTrack: { height: 5, borderRadius: 3, backgroundColor: colors.well, overflow: "hidden" },
  tabFill: { height: 5, borderRadius: 3 },
  tagline: { fontFamily: fonts.text.italic, fontSize: 16, lineHeight: 22, color: colors.textMuted },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: 18,
    backgroundColor: colors.backgroundRaised,
  },
  chipMuted: { backgroundColor: "transparent", borderWidth: 1, borderColor: colors.outline },
  chipOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { fontFamily: fonts.ui.bold, fontSize: 14, color: colors.text },
  chipTextMuted: { color: colors.textMuted },
  chipTextOn: { color: colors.accentInk },
  chipCount: {
    overflow: "hidden",
    minWidth: 20,
    paddingHorizontal: 6,
    borderRadius: 10,
    backgroundColor: colors.accent,
    color: colors.accentInk,
    fontFamily: fonts.ui.extrabold,
    fontSize: 11,
    textAlign: "center",
  },
  divider: { width: 1, height: 22, marginHorizontal: 4, backgroundColor: colors.outline },
  emptyLine: {
    fontFamily: fonts.text.italic,
    fontSize: 17,
    color: colors.textMuted,
    textAlign: "center",
    marginTop: 32,
  },
  grid: { paddingHorizontal: GUTTER, paddingBottom: TAB_BAR_RISE + 24 },
  gridRow: { gap: GAP, marginBottom: 18 },
  tile: { alignItems: "center", gap: 6 },
  fresh: {
    position: "absolute",
    top: -8,
    left: -6,
    overflow: "hidden",
    paddingHorizontal: 7,
    paddingVertical: 1,
    borderRadius: 10,
    backgroundColor: colors.accent,
    color: colors.accentInk,
    fontFamily: fonts.ui.extrabold,
    fontSize: 11,
  },
  quantity: {
    position: "absolute",
    top: -6,
    right: -4,
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: colors.text,
    color: colors.background,
    fontFamily: fonts.ui.extrabold,
    fontSize: 12,
  },
  mastery: { flexDirection: "row", alignItems: "center", gap: 5 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  masteryText: { fontFamily: fonts.ui.bold, fontSize: 12 },
  missingBox: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderStyle: "dashed",
    borderRadius: 12,
    backgroundColor: "rgba(27, 31, 51, 0.5)",
  },
  question: { fontFamily: fonts.display, color: colors.outline },
  missingLabel: { transform: [{ scale: 0.85 }] },
  more: {
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 10,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.accent,
    borderStyle: "dashed",
  },
  moreCount: { fontFamily: fonts.display, fontSize: 30, color: colors.accent },
  moreLabel: {
    fontFamily: fonts.ui.bold,
    fontSize: 13,
    color: colors.text,
    textAlign: "center",
  },
});
