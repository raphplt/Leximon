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
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { api } from "@/api/client";
import { Emblem } from "@/clan/emblem";
import { useShared } from "@/player/shared";
import { profile } from "@/player/state";
import { colors, fontSizes, fonts, paperColors, space } from "@/theme";
import { Avatar } from "@/ui/avatar";
import { Button } from "@/ui/button";
import { Chip } from "@/ui/chip";
import { Icon } from "@/ui/icon";
import { Panel } from "@/ui/panel";
import { PatronBadge } from "@/ui/patron-badge";
import { SearchField } from "@/ui/search-field";
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
      <SearchField value={query} label={PLAYER_SEARCH_LABEL} maxLength={30} onChange={setQuery} />
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
        <Panel paper style={styles.players}>
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
  const { player, clan, patron } = entry;
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
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>
            {player.pseudo}
          </Text>
          <PatronBadge mark={patron} compact />
        </View>
        <Text style={styles.small} numberOfLines={1}>
          {clan === null ? `Niveau ${player.level}` : `Niveau ${player.level} · ${clan.name}`}
        </Text>
      </View>
      {clan !== null && <Emblem emblem={clan.emblem} size={28} level={clan.level} />}
      <Icon name="chev" size={16} color={ink.pageInkMuted} />
    </Pressable>
  );
}

/** The players are listed on paper. */
const ink = paperColors;

const styles = StyleSheet.create({
  note: {
    fontFamily: fonts.ui.medium,
    fontSize: fontSizes.body,
    lineHeight: 21,
    color: colors.pageInkMuted,
  },
  faint: { fontFamily: fonts.ui.medium, fontSize: fontSizes.body, color: colors.pageInkFaint },
  empty: {
    fontFamily: fonts.text.italic,
    fontSize: fontSizes.subtitle,
    lineHeight: 25,
    color: colors.pageInkMuted,
    textAlign: "center",
    paddingVertical: space.s6,
  },
  chips: { gap: space.s4 },
  chipsGap: { width: 1, marginVertical: space.s4, backgroundColor: colors.track },
  players: { paddingVertical: space.s2, paddingHorizontal: space.s7, gap: 0 },
  player: { flexDirection: "row", alignItems: "center", gap: space.s6, minHeight: 66 },
  playerRule: { borderTopWidth: 1, borderTopColor: ink.track },
  text: { flex: 1, gap: space.s1 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: space.s3 },
  name: {
    flexShrink: 1,
    fontFamily: fonts.ui.extrabold,
    fontSize: fontSizes.bodyLarge,
    color: ink.pageInk,
  },
  small: { fontFamily: fonts.ui.medium, fontSize: fontSizes.label, color: ink.pageInkMuted },
});
