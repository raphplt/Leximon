import type { DirectoryPlayer, PlayerSort } from "@leximon/contract";
import {
  CLANLESS_LABEL,
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
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<PlayerSort>("active");
  const [clanless, setClanless] = useState(false);
  const [players, setPlayers] = useState<readonly DirectoryPlayer[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

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
        <Panel style={styles.players}>
          {players.map((entry, index) => (
            <PlayerRow key={entry.player.code} entry={entry} first={index === 0} />
          ))}
        </Panel>
      )}
      {cursor !== null && <TextButton label="Voir plus de joueurs" onPress={() => void more()} />}
    </>
  );
}

/** The row leads to the profile, where everything one can do with a player already is. */
function PlayerRow({ entry, first }: { readonly entry: DirectoryPlayer; readonly first: boolean }) {
  const { player, clan } = entry;
  return (
    <Pressable
      style={[styles.player, !first && styles.playerRule]}
      onPress={() => {
        if (player.pseudo !== null) {
          router.push({ pathname: "/joueur/[pseudo]", params: { pseudo: player.pseudo } });
        }
      }}
      accessibilityRole="link"
      accessibilityLabel={`${player.pseudo}, niveau ${player.level}`}
    >
      <Avatar avatar={player.avatar} frame={player.frame} size={44} />
      <View style={styles.text}>
        <Text style={styles.name} numberOfLines={1}>
          {player.pseudo}
        </Text>
        <Text style={styles.small} numberOfLines={1}>
          {clan === null ? `Niveau ${player.level}` : `Niveau ${player.level} · ${clan.name}`}
        </Text>
      </View>
      {clan !== null && <Emblem emblem={clan.emblem} size={28} level={clan.level} />}
      <Icon name="chev" size={16} color={colors.textMuted} />
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
  players: { paddingVertical: 4, paddingHorizontal: 14, gap: 0 },
  player: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 66 },
  playerRule: { borderTopWidth: 1, borderTopColor: colors.track },
  text: { flex: 1, gap: 2 },
  name: { fontFamily: fonts.ui.extrabold, fontSize: 16, color: colors.text },
  small: { fontFamily: fonts.ui.medium, fontSize: 14, color: colors.textMuted },
});
