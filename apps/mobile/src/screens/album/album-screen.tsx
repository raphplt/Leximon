import type { Catalog } from "@leximon/contract/client";
import { PRACTICE_SCHEDULE, practiceRulesAt, type Rarity } from "@leximon/core";
import {
  collectionTone,
  masteryColors,
  rarityStyles,
  solidColor,
  toyMatters,
  toy as toyValues,
} from "@leximon/tokens";
import {
  ALBUM_FILTER_TEXTS,
  ALBUM_SORT_LABELS,
  ALBUM_SORT_TITLE,
  ALBUM_SORTS,
  ALL_COLLECTIONS,
  type AlbumFilter,
  type AlbumItem,
  type AlbumLetter,
  type AlbumSort,
  type AlbumState,
  activeFilterCount,
  albumPracticeCards,
  albumView,
  type CompareFilter,
  compareFilters,
  comparingTitle,
  ECUS_TITLE,
  ecusLabel,
  editionOfCard,
  filterButtonLabel,
  isAlbumSort,
  isFeatureOpen,
  type MissingItem,
  type OwnedItem,
  playerName,
  shortName,
  withoutFilters,
} from "@leximon/view-model";
import { router } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { memo, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  type LayoutChangeEvent,
  Pressable,
  RefreshControl,
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
import { EcusSheet } from "@/ecus/ecus-sheet";
import { vibrate } from "@/feedback/feedback";
import { DESK_RADIUS, Desk } from "@/library/play-pieces";
import { cardDates, ownedCards, wordMemory } from "@/player/collection";
import { useNow, useShared, useSharedFailed } from "@/player/shared";
import { editions, progress, wallet } from "@/player/state";
import { askAlbumPractice } from "@/screens/challenges/pending-practice";
import { openCard } from "@/screens/trades/card-row";
import { TAB_BAR_RISE } from "@/shell/tab-bar";
import { alpha, colors, fontSizes, fonts, paperColors, radii, space } from "@/theme";
import { Button } from "@/ui/button";
import { Icon } from "@/ui/icon";
import { TOOLING_ROOM } from "@/ui/ornaments";
import { RarityChip, RarityName } from "@/ui/rarity-icon";
import { Sheet } from "@/ui/sheet";
import { TextButton } from "@/ui/text-button";
import { Lettering, ToyIcon, toyFace } from "@/ui/toy";

/** The collection tab chosen last, kept on the device. */
const STORED_COLLECTION = "leximon_album";
/** The order chosen last, kept on the device. */
const STORED_SORT = "leximon_album_sort";
const COLUMNS = 3;
/** Inside the desk, its tooling already holds the cards off the edge: a narrow margin leaves them wider. */
const GUTTER = 6;
const GAP = 12;
const ROOM_MARGIN = 6;
/** Under a card, its level or its rarity: every tile is as tall, so a letter knows its row. */
const TILE_FOOT = 28;
const ROW_GAP = space.s9;
const GRID_TOP = space.s5;
/** The bar of letters, in the right margin of the cards. */
const LETTER_ROOM = 24;
const LETTER_GAP = 6;

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

function readSort(): AlbumSort {
  try {
    const stored = SecureStore.getItem(STORED_SORT);
    return isAlbumSort(stored) ? stored : "alpha";
  } catch {
    return "alpha";
  }
}

function writeSort(sort: AlbumSort): void {
  SecureStore.setItemAsync(STORED_SORT, sort).catch(() => {
    // Not remembered: the album opens from A to Z next time.
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
    sort: readSort(),
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
  const currentWallet = useShared(wallet);
  const [ecusOpen, setEcusOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    ownedCards.refresh();
    wordMemory.refresh();
    cardDates.refresh();
    setTimeout(() => setRefreshing(false), 400);
  }, []);

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

  // The sheet turns through the cards the album shows, in its order. Read at the tap, so that
  // the tiles keep one handler and are not drawn again for every filter.
  const shownIds = useRef<readonly string[]>([]);
  shownIds.current =
    view?.items.flatMap((item) => (item.kind === "owned" ? [item.card.id] : [])) ?? [];
  const openOwned = useCallback((cardId: string) => openCard(cardId, shownIds.current), []);

  const list = useRef<FlatList<AlbumItem>>(null);
  /** Where the rows of cards start, under the review button. */
  const rowsTop = useRef<number>(GRID_TOP);
  const resetKey = JSON.stringify(state);
  // Another filter or sort starts the cards over from the top of their box.
  // biome-ignore lint/correctness/useExhaustiveDependencies: the key is the reason to run
  useEffect(() => {
    list.current?.scrollToOffset({ offset: 0, animated: false });
  }, [resetKey]);

  const lettered = (view?.letters.length ?? 0) > 0;
  const columns = window.width >= 900 ? 5 : window.width >= 600 ? 4 : COLUMNS;
  // The bar of letters keeps its margin even when the order hides it: changing the order
  // does not resize every card.
  const cardWidth = Math.floor(
    (window.width - LIBRARY_INSET * 2 - GUTTER - LETTER_ROOM - LETTER_GAP - GAP * (columns - 1)) /
      columns,
  );
  const tileHeight = Math.ceil(cardWidth * 1.4) + TILE_FOOT;
  // Every row is as tall: the list knows where the rows it has not drawn yet lie, and a letter
  // finds its row by counting.
  const rowHeight = tileHeight + ROW_GAP;
  const rowLayout = useCallback(
    (_rows: unknown, row: number) => ({
      length: rowHeight,
      offset: rowsTop.current + row * rowHeight,
      index: row,
    }),
    [rowHeight],
  );
  const jumpTo = (index: number) =>
    list.current?.scrollToOffset({
      // A little of the row above shows, and the badges over the cards with it.
      offset: rowsTop.current - GRID_TOP + Math.floor(index / columns) * rowHeight,
      animated: false,
    });
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
  const comparing = friend !== null && state.compare != null;
  const filtersOn = activeFilterCount(state);
  const fresh = view.filters.find((filter) => filter.id === "new");
  const sort = state.sort ?? "alpha";
  const pickSort = (next: AlbumSort) => {
    writeSort(next);
    setState((s) => ({ ...s, sort: next }));
  };

  // The search, the tabs and the filters stay in view; only the cards run under them.
  const header = (
    <View style={[styles.header, library.header]}>
      <View style={styles.titleRow}>
        <View accessibilityRole="header">
          <Lettering size={fontSizes.heading}>Album</Lettering>
        </View>
        <Text style={styles.headline}>
          <Text style={styles.headlineStrong}>{view.headline.owned}</Text> mots sur{" "}
          {view.headline.total}
        </Text>
      </View>
      <View style={styles.searchRow}>
        <View style={[styles.search, library.search]}>
          <Icon name="search" size={18} color={SEARCH_MUTED} />
          <TextInput
            style={[styles.searchInput, library.searchInput]}
            placeholder="Chercher un mot"
            placeholderTextColor={colors.paperInkMuted}
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
              toyFace(filtersOn > 0 ? "gold" : "paper"),
            ]}
          >
            <Text style={[styles.chipText, library.paperInk, filtersOn > 0 && styles.chipTextOn]}>
              {ALBUM_FILTER_TEXTS.button}
            </Text>
            {filtersOn > 0 && <Text style={styles.filtersCount}>{filtersOn}</Text>}
          </Pressable>
        )}
        {currentWallet !== null && (
          <Pressable
            onPress={() => setEcusOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={`${ECUS_TITLE}, ${ecusLabel(currentWallet.ecus)}`}
            style={[styles.filtersButton, styles.ecusButton, toyFace("paper")]}
          >
            <ToyIcon name="ecu" size={26} />
          </Pressable>
        )}
      </View>

      <TabRow dimmed={view.searching}>
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
                library.tab,
                toyFace(selected ? "gold" : "paper", "tile"),
              ]}
            >
              <View style={styles.tabHead}>
                <Text style={[styles.tabName, library.tabName]}>{shortName(tab.name)}</Text>
                <Text style={[styles.tabCount, library.paperInkMuted]}>{tab.count}</Text>
              </View>
              <View style={[styles.tabTrack, library.tabTrack]}>
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
      </TabRow>

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
    </View>
  );

  const showFresh =
    !view.searching &&
    !comparing &&
    fresh !== undefined &&
    ((fresh.count ?? 0) > 0 || state.filter === "new");
  const hasHead = showFresh || practiceCards !== null || view.empty !== null;

  const head = (
    <View
      style={hasHead ? styles.listHead : undefined}
      onLayout={(event: LayoutChangeEvent) => {
        rowsTop.current = GRID_TOP + event.nativeEvent.layout.height;
      }}
    >
      {showFresh && fresh !== undefined && (
        <View style={styles.quick}>
          <FilterChip
            label={fresh.label}
            count={fresh.count}
            on={state.filter === "new"}
            onPick={() => setState((s) => ({ ...s, filter: s.filter === "new" ? "all" : "new" }))}
          />
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

  const album = (
    <>
      {header}
      <View style={styles.shelf}>
        <FlatList
          key={columns}
          ref={list}
          data={view.empty === null ? view.items : []}
          keyExtractor={itemKey}
          numColumns={columns}
          getItemLayout={rowLayout}
          ListHeaderComponent={head}
          renderItem={({ item }) => (
            <Tile item={item} width={cardWidth} height={tileHeight} onOpen={openOwned} />
          )}
          columnWrapperStyle={styles.gridRow}
          contentContainerStyle={[styles.grid, styles.gridLettered, library.grid]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          initialNumToRender={9}
          maxToRenderPerBatch={9}
          windowSize={5}
          removeClippedSubviews
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.gilt}
              colors={[colors.gilt]}
            />
          }
        />
        {lettered && <LetterBar letters={view.letters} onJump={jumpTo} />}
      </View>
    </>
  );

  return (
    <>
      <View style={library.room}>
        {/* The desk runs on under the tabs: its foot is never seen, and the cards keep the room. */}
        <View style={library.deskClip}>
          <Desk style={library.desk} />
        </View>
        <View style={library.inside}>{album}</View>
      </View>
      <Sheet open={filtering} title={ALBUM_FILTER_TEXTS.button} onClose={() => setFiltering(false)}>
        {!comparing && (
          <FilterGroup title={ALBUM_SORT_TITLE}>
            {ALBUM_SORTS.map((choice) => (
              <FilterChip
                key={choice}
                label={ALBUM_SORT_LABELS[choice]}
                on={sort === choice}
                onPick={() => pickSort(choice)}
              />
            ))}
          </FilterGroup>
        )}
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
      {currentWallet !== null && (
        <EcusSheet
          wallet={currentWallet}
          now={now}
          collectionId={state.collectionId === ALL_COLLECTIONS ? undefined : state.collectionId}
          open={ecusOpen}
          onClose={() => setEcusOpen(false)}
        />
      )}
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
  height,
  onOpen,
}: {
  readonly item: AlbumItem;
  readonly width: number;
  readonly height: number;
  readonly onOpen: (cardId: string) => void;
}) {
  return (
    <View style={{ width, height }}>
      {item.kind === "owned" ? (
        <OwnedTile item={item} width={width} onOpen={onOpen} />
      ) : item.kind === "missing" ? (
        <MissingTile item={item} width={width} />
      ) : (
        <Pressable
          onPress={() => router.navigate("/")}
          accessibilityRole="link"
          style={[styles.more, { width, height: width * 1.4 }]}
        >
          <Text style={styles.moreCount}>{item.left}</Text>
          <Text style={styles.moreLabel}>{item.label}</Text>
        </Pressable>
      )}
    </View>
  );
});

function OwnedTile({
  item,
  width,
  onOpen,
}: {
  readonly item: OwnedItem;
  readonly width: number;
  readonly onOpen: (cardId: string) => void;
}) {
  const printed = useShared(editions);
  return (
    <Pressable
      onPress={() => onOpen(item.card.id)}
      accessibilityRole="button"
      accessibilityLabel={item.aria}
      style={[styles.tile, { width }]}
    >
      <View importantForAccessibility="no-hide-descendants">
        <Card
          card={item.card}
          collectionName={item.collectionName}
          width={width}
          edition={editionOfCard(printed, item.card.id)}
        />
      </View>
      {item.fresh && <Text style={styles.fresh}>Nouveau</Text>}
      {item.quantity > 1 && <Text style={styles.quantity}>×{item.quantity}</Text>}
      <View style={styles.mastery}>
        <ToyIcon name={item.level} size={18} />
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
      style={[styles.chip, on && styles.chipOn, toyFace(on ? "gold" : "paper", "tag")]}
    >
      <RarityChip rarity={rarity} size={24} />
      <Text style={[styles.chipText, library.paperInk, on && styles.chipTextOn]}>{count}</Text>
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
        toyFace(on ? "gold" : "paper", "tag"),
      ]}
    >
      <Text
        style={[
          styles.chipText,
          muted && styles.chipTextMuted,
          library.paperInk,
          on && styles.chipTextOn,
        ]}
      >
        {label}
      </Text>
      {count !== null && count > 0 && <Text style={styles.chipCount}>{count}</Text>}
    </Pressable>
  );
}

/** The letters beside an alphabetical album: a tap, or the finger sliding down, leads to one. */
function LetterBar({
  letters,
  onJump,
}: {
  readonly letters: readonly AlbumLetter[];
  readonly onJump: (index: number) => void;
}) {
  const height = useRef(1);
  const [current, setCurrent] = useState<string | null>(null);
  const reached = letters.filter((entry) => entry.index !== null);
  const go = (entry: AlbumLetter | undefined) => {
    if (entry === undefined || entry.index === null) return;
    setCurrent(entry.letter);
    vibrate([8]);
    onJump(entry.index);
  };
  const at = (y: number) =>
    letters[
      Math.min(letters.length - 1, Math.max(0, Math.floor((y / height.current) * letters.length)))
    ];
  const step = (by: number) => {
    const from = reached.findIndex((entry) => entry.letter === current);
    go(reached[from === -1 ? 0 : from + by]);
  };
  return (
    <View
      style={styles.letters}
      onLayout={(event: LayoutChangeEvent) => {
        height.current = Math.max(1, event.nativeEvent.layout.height);
      }}
      onStartShouldSetResponder={() => true}
      onResponderTerminationRequest={() => false}
      onResponderGrant={(event) => go(at(event.nativeEvent.locationY))}
      onResponderMove={(event) => {
        const entry = at(event.nativeEvent.locationY);
        if (entry?.letter !== current) go(entry);
      }}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel="Aller à la lettre"
      accessibilityValue={{ text: current ?? reached[0]?.letter ?? "" }}
      accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
      onAccessibilityAction={(event) => step(event.nativeEvent.actionName === "increment" ? 1 : -1)}
    >
      {/* The finger is read on the bar itself, so that its height tells the letter. */}
      <View style={styles.letterColumn} pointerEvents="none">
        {letters.map((entry) => (
          <View key={entry.letter} style={styles.letterSlot}>
            <Text
              style={[
                styles.letter,
                entry.index === null && styles.letterOff,
                entry.letter === current && styles.letterOn,
              ]}
            >
              {entry.letter}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/** The collection tabs on one scrolling row, leaving room below for the cards. */
function TabRow({ dimmed, children }: { readonly dimmed: boolean; readonly children: ReactNode }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={[styles.bleed, dimmed && styles.dimmed]}
      contentContainerStyle={library.tabRow}
      accessibilityRole="tablist"
    >
      {children}
    </ScrollView>
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
  header: {
    gap: space.s6,
    paddingTop: space.s4,
    paddingBottom: space.s6,
    paddingHorizontal: GUTTER,
  },
  listHead: { gap: space.s5, paddingBottom: space.s6 },
  shelf: { flex: 1 },
  letters: {
    position: "absolute",
    top: space.s4,
    bottom: TAB_BAR_RISE + space.s8,
    right: 0,
    width: LETTER_ROOM,
  },
  // Slots of one height: the finger's height on the bar is the letter's rank.
  letterColumn: { flex: 1 },
  letterSlot: { flex: 1, alignItems: "center", justifyContent: "center" },
  letter: {
    fontFamily: fonts.ui.extrabold,
    fontSize: fontSizes.micro,
    color: colors.pageInk,
  },
  letterOff: { opacity: 0.3 },
  letterOn: { color: colors.gilt },
  titleRow: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
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
  quick: { flexDirection: "row" },
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
  // The écu alone: the search keeps the width of the row.
  ecusButton: { width: 48, justifyContent: "center", paddingHorizontal: 0 },
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
  groupTitle: {
    fontFamily: fonts.ui.extrabold,
    fontSize: fontSizes.body,
    color: paperColors.pageInk,
  },
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
  revise: { marginTop: space.s2 },
  emptyLine: {
    fontFamily: fonts.text.italic,
    fontSize: fontSizes.lead,
    color: colors.pageInkMuted,
    textAlign: "center",
    marginTop: space.s16,
  },
  grid: { paddingHorizontal: GUTTER, paddingTop: GRID_TOP, paddingBottom: TAB_BAR_RISE + 24 },
  gridLettered: { paddingRight: LETTER_ROOM + LETTER_GAP },
  gridRow: { gap: GAP, marginBottom: ROW_GAP },
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

/** The desk's outline and shadow, kept inside its clip. */
const DESK_RING = 12;

/** How far the desk's tooling takes the cards in from the screen's edges. */
const LIBRARY_INSET = ROOM_MARGIN + TOOLING_ROOM;

const SEARCH_MUTED = colors.paperInkMuted;

/** The cards on the desk, the tabs and the search cut from paper. */
const library = StyleSheet.create({
  room: { flex: 1, marginHorizontal: ROOM_MARGIN },
  // Wide enough for the frame's outline and shadow on three sides, cut at the foot.
  deskClip: {
    ...StyleSheet.absoluteFill,
    top: -DESK_RING,
    left: -DESK_RING,
    right: -DESK_RING,
    overflow: "hidden",
  },
  desk: {
    position: "absolute",
    top: DESK_RING,
    left: DESK_RING,
    right: DESK_RING,
    bottom: -DESK_RADIUS * 2,
  },
  // The cards slide in within the gilt tooling, never over it.
  inside: {
    flex: 1,
    marginTop: TOOLING_ROOM,
    marginHorizontal: TOOLING_ROOM,
    borderTopLeftRadius: DESK_RADIUS - TOOLING_ROOM,
    borderTopRightRadius: DESK_RADIUS - TOOLING_ROOM,
    overflow: "hidden",
  },
  header: { paddingTop: space.s4, paddingBottom: space.s4, gap: space.s4 },
  tabRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.s4,
    paddingHorizontal: GUTTER,
    paddingVertical: 2,
  },
  search: {
    borderWidth: toyValues.outlineWidth,
    borderColor: toyValues.outline,
    borderRadius: 14,
    backgroundColor: colors.paper,
    boxShadow: `inset 0 3px 0 ${toyMatters.paper.bottom}`,
  },
  searchInput: { color: colors.paperInk },
  // The raised Jouer button stands over the foot of the list.
  grid: { paddingBottom: TAB_BAR_RISE + space.s12 },
  paperInk: { color: colors.paperInk },
  paperInkMuted: { color: colors.paperInkMuted },
  tab: {
    borderWidth: toyValues.outlineWidth,
    marginBottom: 4,
    paddingHorizontal: space.s5,
    paddingVertical: space.s3,
    gap: space.s2,
  },
  tabName: { fontFamily: fonts.display, color: colors.paperInk },
  tabTrack: { backgroundColor: alpha(colors.paperInk, 0.18) },
});
