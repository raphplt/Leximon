import type { Catalog } from "@leximon/contract/client";
import { PRACTICE_SCHEDULE, practiceRulesAt, type Rarity } from "@leximon/core";
import {
  collectionTone,
  masteryColors,
  rarityStyles,
  room,
  solidColor,
  toyMatters,
  toy as toyValues,
} from "@leximon/tokens";
import {
  ALBUM_FILTER_TEXTS,
  ALL_COLLECTIONS,
  type AlbumFilter,
  type AlbumItem,
  type AlbumState,
  activeFilterCount,
  albumPracticeCards,
  albumView,
  type CompareFilter,
  compareFilters,
  comparingTitle,
  filterButtonLabel,
  isFeatureOpen,
  type MissingItem,
  type OwnedItem,
  playerName,
  shortName,
  withoutFilters,
} from "@leximon/view-model";
import { router } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { memo, type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
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
import { Desk } from "@/library/play-pieces";
import { cardDates, ownedCards, wordMemory } from "@/player/collection";
import { useNow, useShared, useSharedFailed } from "@/player/shared";
import { progress } from "@/player/state";
import { askAlbumPractice } from "@/screens/challenges/pending-practice";
import { TAB_BAR_RISE } from "@/shell/tab-bar";
import { alpha, colors, fontSizes, fonts, IS_LIBRARY, radii, space } from "@/theme";
import { Button } from "@/ui/button";
import { Icon } from "@/ui/icon";
import { RarityChip, RarityName } from "@/ui/rarity-icon";
import { Sheet } from "@/ui/sheet";
import { TextButton } from "@/ui/text-button";
import { Lettering, toyFace } from "@/ui/toy";

/** The collection tab chosen last, kept on the device. */
const STORED_COLLECTION = "leximon_album";
const COLUMNS = 3;
const GUTTER = 16;
const GAP = 12;
const ROOM_MARGIN = 6;

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

/** The album: search, collection tabs, the grid of cards; the filters wait behind their button. */
export function AlbumScreen({ friendCode }: { readonly friendCode: string | null }) {
  const window = useWindowDimensions();
  const [catalog, setCatalog] = useState<Catalog | null>(catalogInHand);
  const [failed, setFailed] = useState(false);
  const owned = useShared(ownedCards);
  const ownedFailed = useSharedFailed(ownedCards);
  const memory = useShared(wordMemory);
  const dates = useShared(cardDates);
  const now = useNow(60_000);
  const player = useShared(progress);
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
  const [filtering, setFiltering] = useState(false);

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

  const cardWidth = Math.floor(
    (window.width - LIBRARY_INSET * 2 - GUTTER * 2 - GAP * (COLUMNS - 1)) / COLUMNS,
  );
  const practiceCards =
    view !== null && player !== null && isFeatureOpen("practice_choice", player.level, now)
      ? albumPracticeCards(view, state, practiceRulesAt(PRACTICE_SCHEDULE, now).minWords)
      : null;

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
        <Text style={styles.empty}>Le serveur ne répond pas.</Text>
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
  const filtersOn = activeFilterCount(state);

  const header = (
    <View style={styles.header}>
      <View style={styles.titleRow}>
        {IS_LIBRARY ? (
          <View accessibilityRole="header">
            <Lettering size={fontSizes.heading}>Album</Lettering>
          </View>
        ) : (
          <Text style={styles.title} accessibilityRole="header">
            Album
          </Text>
        )}
        <Text style={styles.headline}>
          <Text style={styles.headlineStrong}>{view.headline.owned}</Text> mots sur{" "}
          {view.headline.total}
        </Text>
      </View>
      <View style={styles.searchRow}>
        <View style={[styles.search, IS_LIBRARY && library.search]}>
          <Icon name="search" size={18} color={SEARCH_MUTED} />
          <TextInput
            style={[styles.searchInput, IS_LIBRARY && library.searchInput]}
            placeholder="Chercher un mot"
            placeholderTextColor={IS_LIBRARY ? colors.paperInkMuted : colors.pageInkFaint}
            selectionColor={colors.rubric}
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
              <Icon name="close" size={18} color={SEARCH_MUTED} />
            </Pressable>
          )}
        </View>
        {!view.searching && (
          <Pressable
            onPress={() => setFiltering(true)}
            accessibilityRole="button"
            accessibilityLabel={filterButtonLabel(filtersOn)}
            style={[
              styles.filtersButton,
              filtersOn > 0 && styles.chipOn,
              IS_LIBRARY && toyFace(filtersOn > 0 ? "gold" : "paper"),
            ]}
          >
            <Text
              style={[
                styles.chipText,
                IS_LIBRARY && library.paperInk,
                filtersOn > 0 && styles.chipTextOn,
              ]}
            >
              {ALBUM_FILTER_TEXTS.button}
            </Text>
            {filtersOn > 0 && <Text style={styles.filtersCount}>{filtersOn}</Text>}
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
              style={[
                styles.tab,
                selected && styles.tabOn,
                IS_LIBRARY && [library.tab, toyFace(selected ? "gold" : "paper", "tile")],
              ]}
            >
              <View style={styles.tabHead}>
                <Text style={[styles.tabName, IS_LIBRARY && library.tabName]}>
                  {shortName(tab.name)}
                </Text>
                <Text style={[styles.tabCount, IS_LIBRARY && library.paperInkMuted]}>
                  {tab.count}
                </Text>
              </View>
              <View style={[styles.tabTrack, IS_LIBRARY && library.tabTrack]}>
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

      {!view.searching && tagline !== undefined && <Text style={styles.tagline}>{tagline}</Text>}
      {!view.searching && comparing && (
        <View style={styles.compare}>
          <View style={styles.compareHead}>
            <Text style={styles.compareTitle}>{comparingTitle(friend.name)}</Text>
            <Pressable
              onPress={() => router.setParams({ ami: undefined })}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Fermer la comparaison"
            >
              <Icon name="close" size={18} color={colors.pageInkMuted} />
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
      )}
      {practiceCards !== null && (
        <View style={styles.revise}>
          <Button
            label="Réviser ces mots"
            secondary
            onPress={() => {
              askAlbumPractice(practiceCards);
              router.navigate({ pathname: "/defis", params: { revision: "album" } });
            }}
          />
        </View>
      )}
      {view.empty !== null && <Text style={styles.emptyLine}>{view.empty}</Text>}
    </View>
  );

  const list = (
    <FlatList
      data={view.empty === null ? view.items : []}
      keyExtractor={itemKey}
      numColumns={COLUMNS}
      ListHeaderComponent={header}
      renderItem={({ item }) => <Tile item={item} width={cardWidth} />}
      columnWrapperStyle={styles.gridRow}
      contentContainerStyle={[styles.grid, IS_LIBRARY && library.grid]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      initialNumToRender={9}
      maxToRenderPerBatch={9}
      windowSize={5}
      removeClippedSubviews
    />
  );

  return (
    <>
      {IS_LIBRARY ? (
        <View style={library.room}>
          <Desk style={StyleSheet.absoluteFill} />
          <View style={library.inside}>{list}</View>
        </View>
      ) : (
        list
      )}
      <Sheet open={filtering} title={ALBUM_FILTER_TEXTS.button} onClose={() => setFiltering(false)}>
        {view.rarities.length > 0 && (
          <FilterGroup title={ALBUM_FILTER_TEXTS.rarity}>
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
          </FilterGroup>
        )}
        {!comparing && (
          <FilterGroup title={ALBUM_FILTER_TEXTS.show}>
            {view.filters.map((filter) => (
              <FilterChip
                key={filter.id}
                label={filter.label}
                count={filter.count}
                on={state.filter === filter.id}
                onPick={() => setState((s) => ({ ...s, filter: filter.id as AlbumFilter }))}
              />
            ))}
          </FilterGroup>
        )}
        {!comparing && view.themes.length > 0 && (
          <FilterGroup title={ALBUM_FILTER_TEXTS.themes}>
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
          </FilterGroup>
        )}
        <Button label={ALBUM_FILTER_TEXTS.apply} onPress={() => setFiltering(false)} />
        {filtersOn > 0 && (
          <TextButton
            label={ALBUM_FILTER_TEXTS.clear}
            onPress={() => setState((s) => withoutFilters(s))}
          />
        )}
      </Sheet>
    </>
  );
}

function FilterGroup({
  title,
  children,
}: {
  readonly title: string;
  readonly children: ReactNode;
}) {
  return (
    <View style={styles.group}>
      <Text style={styles.groupTitle} accessibilityRole="header">
        {title}
      </Text>
      <View style={styles.groupChips}>{children}</View>
    </View>
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
        <RarityName rarity={item.rarity} color={colors.pageInkFaint} />
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
      style={[
        styles.chip,
        on && styles.chipOn,
        IS_LIBRARY && toyFace(on ? "gold" : "paper", "tag"),
      ]}
    >
      <RarityChip rarity={rarity} size={24} />
      <Text style={[styles.chipText, IS_LIBRARY && library.paperInk, on && styles.chipTextOn]}>
        {count}
      </Text>
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
      style={[
        styles.chip,
        muted && styles.chipMuted,
        on && styles.chipOn,
        IS_LIBRARY && toyFace(on ? "gold" : "paper", "tag"),
      ]}
    >
      <Text
        style={[
          styles.chipText,
          muted && styles.chipTextMuted,
          IS_LIBRARY && library.paperInk,
          on && styles.chipTextOn,
        ]}
      >
        {label}
      </Text>
      {count !== null && count > 0 && <Text style={styles.chipCount}>{count}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: space.s8,
    padding: space.s12,
  },
  empty: {
    fontFamily: fonts.ui.semibold,
    fontSize: fontSizes.bodyLarge,
    color: colors.pageInkMuted,
  },
  header: { gap: space.s6, paddingTop: space.s4, paddingBottom: space.s8 },
  titleRow: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
  title: { fontFamily: fonts.display, fontSize: fontSizes.heading, color: colors.pageInk },
  headline: {
    fontFamily: fonts.ui.semibold,
    fontSize: fontSizes.label,
    color: colors.pageInkMuted,
  },
  headlineStrong: { fontFamily: fonts.ui.extrabold, color: colors.pageInk },
  searchRow: { flexDirection: "row", alignItems: "center", gap: space.s4 },
  search: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: space.s4,
    minHeight: 44,
    paddingHorizontal: space.s7,
    borderRadius: radii.x4,
    backgroundColor: colors.well,
  },
  searchInput: {
    flex: 1,
    paddingVertical: space.s4,
    color: colors.pageInk,
    fontFamily: fonts.ui.semibold,
    fontSize: fontSizes.bodyLarge,
  },
  bleed: { marginHorizontal: -GUTTER, flexGrow: 0 },
  row: { gap: space.s4, paddingHorizontal: GUTTER, alignItems: "center" },
  compare: { gap: space.s4 },
  compareHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  compareTitle: { fontFamily: fonts.ui.extrabold, fontSize: fontSizes.body, color: colors.rubric },
  dimmed: { opacity: 0.4 },
  tab: {
    minWidth: 110,
    paddingHorizontal: space.s6,
    paddingVertical: space.s5,
    gap: space.s4,
    borderRadius: radii.xl,
    backgroundColor: colors.pageRaised,
    borderWidth: 2,
    borderColor: "transparent",
  },
  tabOn: { borderColor: colors.gilt },
  tabHead: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: space.s5,
  },
  tabName: { fontFamily: fonts.ui.extrabold, fontSize: fontSizes.label, color: colors.pageInk },
  tabCount: { fontFamily: fonts.ui.bold, fontSize: fontSizes.caption, color: colors.pageInkMuted },
  tabTrack: { height: 5, borderRadius: 3, backgroundColor: colors.well, overflow: "hidden" },
  tabFill: { height: 5, borderRadius: 3 },
  tagline: {
    fontFamily: fonts.text.italic,
    fontSize: fontSizes.bodyLarge,
    lineHeight: 22,
    color: colors.pageInkMuted,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.s3,
    minHeight: 36,
    paddingHorizontal: space.s6,
    borderRadius: radii.x3,
    backgroundColor: colors.pageRaised,
  },
  filtersButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.s3,
    minHeight: 44,
    paddingHorizontal: space.s7,
    borderRadius: radii.x4,
    backgroundColor: colors.pageRaised,
  },
  filtersCount: {
    overflow: "hidden",
    minWidth: 20,
    paddingHorizontal: space.s3,
    borderRadius: radii.md,
    backgroundColor: colors.actionInk,
    color: colors.rubric,
    fontFamily: fonts.ui.extrabold,
    fontSize: fontSizes.caption,
    textAlign: "center",
  },
  group: { gap: space.s4 },
  groupTitle: { fontFamily: fonts.ui.extrabold, fontSize: fontSizes.body, color: colors.pageInk },
  groupChips: { flexDirection: "row", flexWrap: "wrap", gap: space.s4 },
  chipMuted: { backgroundColor: "transparent", borderWidth: 1, borderColor: colors.rule },
  chipOn: { backgroundColor: colors.action, borderColor: colors.gilt },
  chipText: { fontFamily: fonts.ui.bold, fontSize: fontSizes.label, color: colors.pageInk },
  chipTextMuted: { color: colors.pageInkMuted },
  chipTextOn: { color: colors.actionInk },
  chipCount: {
    overflow: "hidden",
    minWidth: 20,
    paddingHorizontal: space.s3,
    borderRadius: radii.md,
    backgroundColor: colors.action,
    color: colors.actionInk,
    fontFamily: fonts.ui.extrabold,
    fontSize: fontSizes.micro,
    textAlign: "center",
  },
  revise: { marginTop: space.s6 },
  emptyLine: {
    fontFamily: fonts.text.italic,
    fontSize: fontSizes.lead,
    color: colors.pageInkMuted,
    textAlign: "center",
    marginTop: space.s16,
  },
  grid: { paddingHorizontal: GUTTER, paddingBottom: TAB_BAR_RISE + 24 },
  gridRow: { gap: GAP, marginBottom: space.s9 },
  tile: { alignItems: "center", gap: space.s3 },
  fresh: {
    position: "absolute",
    top: -8,
    left: -6,
    overflow: "hidden",
    paddingHorizontal: 7,
    paddingVertical: 1,
    borderRadius: radii.md,
    backgroundColor: colors.action,
    color: colors.actionInk,
    fontFamily: fonts.ui.extrabold,
    fontSize: fontSizes.micro,
  },
  quantity: {
    position: "absolute",
    top: -6,
    right: -4,
    overflow: "hidden",
    paddingHorizontal: space.s4,
    paddingVertical: space.s1,
    borderRadius: radii.md,
    backgroundColor: colors.pageInk,
    color: colors.page,
    fontFamily: fonts.ui.extrabold,
    fontSize: fontSizes.caption,
  },
  mastery: { flexDirection: "row", alignItems: "center", gap: 5 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  masteryText: { fontFamily: fonts.ui.bold, fontSize: fontSizes.caption },
  missingBox: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderStyle: "dashed",
    borderRadius: radii.lg,
    backgroundColor: alpha(colors.well, 0.5),
  },
  question: { fontFamily: fonts.display, color: colors.rule },
  missingLabel: { transform: [{ scale: 0.85 }] },
  more: {
    alignItems: "center",
    justifyContent: "center",
    gap: space.s4,
    padding: space.s5,
    borderRadius: radii.lg,
    borderWidth: 2,
    borderColor: colors.gilt,
    borderStyle: "dashed",
  },
  moreCount: { fontFamily: fonts.display, fontSize: fontSizes.heading, color: colors.rubric },
  moreLabel: {
    fontFamily: fonts.ui.bold,
    fontSize: fontSizes.small,
    color: colors.pageInk,
    textAlign: "center",
  },
});

/** How far the desk's frame takes the cards in from the screen's edges. */
const LIBRARY_INSET = IS_LIBRARY ? ROOM_MARGIN + room.desk.frameWidth : 0;

const SEARCH_MUTED = IS_LIBRARY ? colors.paperInkMuted : colors.pageInkMuted;

/** « La Bibliothèque »: the cards on the desk, the tabs and the search cut from paper. */
const library = StyleSheet.create({
  room: { flex: 1, marginHorizontal: ROOM_MARGIN, marginBottom: TAB_BAR_RISE },
  // The cards slide under the frame, not over it.
  inside: {
    flex: 1,
    margin: room.desk.frameWidth,
    borderRadius: room.desk.radius - room.desk.frameWidth,
    overflow: "hidden",
  },
  search: {
    borderWidth: toyValues.outlineWidth,
    borderColor: toyValues.outline,
    borderRadius: 14,
    backgroundColor: colors.paper,
    boxShadow: `inset 0 3px 0 ${toyMatters.paper.bottom}`,
  },
  searchInput: { color: colors.paperInk },
  grid: { paddingBottom: space.s12 },
  paperInk: { color: colors.paperInk },
  paperInkMuted: { color: colors.paperInkMuted },
  tab: { borderWidth: toyValues.outlineWidth, marginBottom: 4 },
  tabName: { fontFamily: fonts.display, color: colors.paperInk },
  tabTrack: { backgroundColor: alpha(colors.paperInk, 0.18) },
});
