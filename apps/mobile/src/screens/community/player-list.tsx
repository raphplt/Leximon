import type { DirectoryPlayer, PlayerSort } from "@leximon/contract";
import { type Catalog, collectionName } from "@leximon/contract/client";
import {
  CLANLESS_LABEL,
  NO_PINNED_CARD,
  NO_PLAYER_FOR_FILTER,
  NO_PLAYER_FOUND,
  noPlayerYet,
  PLAYER_SEARCH_LABEL,
  PLAYER_SORTS,
  playerListNote,
} from "@leximon/view-model";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { api } from "@/api/client";
import { Card } from "@/cards/card";
import { catalogInHand, loadCatalog } from "@/cards/catalog";
import { Emblem } from "@/clan/emblem";
import { useShared } from "@/player/shared";
import { profile } from "@/player/state";
import { colors, fonts } from "@/theme";
import { Avatar } from "@/ui/avatar";
import { Button } from "@/ui/button";
import { Chip } from "@/ui/chip";
import { Icon } from "@/ui/icon";
import { Panel } from "@/ui/panel";
import { TextButton } from "@/ui/text-button";

const CARD_WIDTH = 86;
const CARD_HEIGHT = 120;

/** The fan of a player's cards, the last ones turning away from the middle. */
const CARD_TILTS = [-5, 0, 5];

interface Filter {
  readonly q: string;
  readonly sort: PlayerSort;
  readonly clanless: boolean;
}

function asQuery({ q, sort, clanless }: Filter, cursor: string | null) {
  return { q, sort, cursor, ...(clanless ? { clanless: "1" as const } : {}) };
}

/** Every public profile, by the sort the player chose. */
export function PlayerList() {
  const me = useShared(profile);
  const [catalog, setCatalog] = useState<Catalog | null>(catalogInHand);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<PlayerSort>("active");
  const [clanless, setClanless] = useState(false);
  const [players, setPlayers] = useState<readonly DirectoryPlayer[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    loadCatalog().then(setCatalog, () => undefined);
  }, []);

  const read = useCallback(async (filter: Filter, isCurrent: () => boolean) => {
    const page = await api.fetchPublicPlayers(asQuery(filter, null)).catch(() => null);
    if (!isCurrent()) return;
    setFailed(page === null);
    setPlayers(page?.players ?? null);
    setCursor(page?.nextCursor ?? null);
  }, []);

  // Searches as the pseudo is typed, once the player pauses.
  useEffect(() => {
    let current = true;
    const q = query.trim();
    const timer = setTimeout(
      () => void read({ q, sort, clanless }, () => current),
      q === "" ? 0 : 300,
    );
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [query, sort, clanless, read]);

  const more = async () => {
    if (cursor === null) return;
    const filter = { q: query.trim(), sort, clanless };
    const page = await api.fetchPublicPlayers(asQuery(filter, cursor)).catch(() => null);
    if (page === null) return;
    // The list follows activity: someone back in the game may come round again.
    setPlayers((shown) => {
      const known = new Set((shown ?? []).map((entry) => entry.player.code));
      return [...(shown ?? []), ...page.players.filter((entry) => !known.has(entry.player.code))];
    });
    setCursor(page.nextCursor);
  };

  const note = me === null ? null : playerListNote(me);
  const filtered = sort === "near" || clanless;
  const empty =
    query.trim() !== ""
      ? NO_PLAYER_FOUND
      : filtered
        ? NO_PLAYER_FOR_FILTER
        : noPlayerYet(me?.publicFromLevel ?? 8);
  return (
    <>
      <View style={styles.search}>
        <Icon name="search" size={18} color={colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          value={query}
          maxLength={30}
          placeholder={PLAYER_SEARCH_LABEL}
          placeholderTextColor={colors.textFaint}
          selectionColor={colors.accent}
          accessibilityLabel={PLAYER_SEARCH_LABEL}
          autoCorrect={false}
          autoCapitalize="none"
          onChangeText={setQuery}
        />
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
      >
        {PLAYER_SORTS.map((option) => (
          <Chip
            key={option.id}
            label={option.label}
            on={sort === option.id}
            onPress={() => setSort(option.id)}
          />
        ))}
        <View style={styles.chipsGap} />
        <Chip label={CLANLESS_LABEL} on={clanless} onPress={() => setClanless((on) => !on)} />
      </ScrollView>
      {note !== null && <Text style={styles.note}>{note}</Text>}
      {failed ? (
        <>
          <Text style={styles.faint}>Le serveur ne répond pas.</Text>
          <Button
            label="Réessayer"
            secondary
            onPress={() => void read({ q: query.trim(), sort, clanless }, () => true)}
          />
        </>
      ) : players === null ? (
        <Text style={styles.faint}>Un instant…</Text>
      ) : players.length === 0 ? (
        <Text style={styles.empty}>{empty}</Text>
      ) : (
        players.map((entry) => (
          <PlayerCard key={entry.player.code} entry={entry} catalog={catalog} />
        ))
      )}
      {cursor !== null && <TextButton label="Voir plus de joueurs" onPress={() => void more()} />}
    </>
  );
}

/** The card leads to the profile, where everything one can do with a player already is. */
function PlayerCard({
  entry,
  catalog,
}: {
  readonly entry: DirectoryPlayer;
  readonly catalog: Catalog | null;
}) {
  const { player, clan, pinned } = entry;
  return (
    <Pressable
      onPress={() => {
        if (player.pseudo !== null) {
          router.push({ pathname: "/joueur/[pseudo]", params: { pseudo: player.pseudo } });
        }
      }}
      accessibilityRole="link"
      accessibilityLabel={`${player.pseudo}, niveau ${player.level}`}
    >
      <Panel style={styles.player}>
        <View style={styles.shelf}>
          {pinned.length === 0 ? (
            <>
              {CARD_TILTS.map((tilt) => (
                <View key={tilt} style={[styles.slot, { transform: [{ rotate: `${tilt}deg` }] }]} />
              ))}
              <View style={styles.shelfEmpty}>
                <Text style={styles.shelfEmptyText}>{NO_PINNED_CARD}</Text>
              </View>
            </>
          ) : (
            pinned.map((cardId, index) => {
              const card = catalog?.cardsById.get(cardId);
              const tilt = CARD_TILTS[pinned.length === 1 ? 1 : index] ?? 0;
              return (
                <View
                  key={cardId}
                  style={[styles.shelfCard, { transform: [{ rotate: `${tilt}deg` }] }]}
                >
                  {card === undefined || catalog === null ? (
                    <View style={styles.placeholder} />
                  ) : (
                    <Card
                      card={card}
                      collectionName={collectionName(catalog, card.collectionId)}
                      width={CARD_WIDTH}
                    />
                  )}
                </View>
              );
            })
          )}
        </View>
        <View style={styles.identity}>
          <Avatar avatar={player.avatar} frame={player.frame} size={48} />
          <View style={styles.text}>
            <Text style={styles.name} numberOfLines={1}>
              {player.pseudo}
            </Text>
            <Text style={styles.small} numberOfLines={1}>
              {clan === null ? `Niveau ${player.level}` : `Niveau ${player.level} · ${clan.name}`}
            </Text>
          </View>
          {clan !== null && <Emblem emblem={clan.emblem} size={30} level={clan.level} />}
        </View>
      </Panel>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  note: { fontFamily: fonts.ui.medium, fontSize: 15, lineHeight: 21, color: colors.textMuted },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 50,
    paddingHorizontal: 16,
    borderRadius: 25,
    backgroundColor: colors.well,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontFamily: fonts.ui.semibold,
    fontSize: 16,
    paddingVertical: 10,
  },
  faint: { fontFamily: fonts.ui.medium, fontSize: 15, color: colors.textFaint },
  empty: {
    fontFamily: fonts.text.italic,
    fontSize: 18,
    lineHeight: 25,
    color: colors.textMuted,
    textAlign: "center",
    paddingVertical: 12,
  },
  chips: { gap: 8 },
  chipsGap: { width: 1, marginVertical: 8, backgroundColor: colors.track },
  player: { padding: 0, gap: 0, overflow: "hidden" },
  // The cards stand on a shelf and overflow its bottom, tucked behind the player's name.
  shelf: {
    flexDirection: "row",
    justifyContent: "center",
    height: 142,
    paddingTop: 16,
    overflow: "hidden",
    backgroundColor: colors.well,
  },
  shelfCard: { marginHorizontal: -6 },
  placeholder: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 8,
    backgroundColor: colors.track,
  },
  slot: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    marginHorizontal: -6,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: colors.track,
    borderRadius: 8,
  },
  shelfEmpty: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center" },
  shelfEmptyText: { fontFamily: fonts.text.italic, fontSize: 15, color: colors.textMuted },
  identity: { flexDirection: "row", alignItems: "center", gap: 14, padding: 14 },
  text: { flex: 1, gap: 2 },
  name: { fontFamily: fonts.display, fontSize: 18, color: colors.text },
  small: { fontFamily: fonts.ui.medium, fontSize: 14, color: colors.textMuted },
});
