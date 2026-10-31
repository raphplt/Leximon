import type { DirectoryPlayer } from "@leximon/contract";
import {
  NO_PLAYER_FOUND,
  noPlayerYet,
  PLAYER_SEARCH_LABEL,
  playerListNote,
} from "@leximon/view-model";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { api } from "@/api/client";
import { Emblem } from "@/clan/emblem";
import { useShared } from "@/player/shared";
import { profile } from "@/player/state";
import { colors, fonts } from "@/theme";
import { Avatar } from "@/ui/avatar";
import { Button } from "@/ui/button";
import { Icon } from "@/ui/icon";
import { Panel } from "@/ui/panel";
import { TextButton } from "@/ui/text-button";

/** Every public profile, the latest seen first. */
export function PlayerList() {
  const me = useShared(profile);
  const [query, setQuery] = useState("");
  const [players, setPlayers] = useState<readonly DirectoryPlayer[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  const read = useCallback(async (q: string, isCurrent: () => boolean) => {
    const page = await api.fetchPublicPlayers({ q }).catch(() => null);
    if (!isCurrent()) return;
    setFailed(page === null);
    setPlayers(page?.players ?? null);
    setCursor(page?.nextCursor ?? null);
  }, []);

  // Searches as the pseudo is typed, once the player pauses.
  useEffect(() => {
    let current = true;
    const q = query.trim();
    const timer = setTimeout(() => void read(q, () => current), q === "" ? 0 : 300);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [query, read]);

  const more = async () => {
    if (cursor === null) return;
    const page = await api.fetchPublicPlayers({ q: query.trim(), cursor }).catch(() => null);
    if (page === null) return;
    // The list follows activity: someone back in the game may come round again.
    setPlayers((shown) => {
      const known = new Set((shown ?? []).map((entry) => entry.player.code));
      return [...(shown ?? []), ...page.players.filter((entry) => !known.has(entry.player.code))];
    });
    setCursor(page.nextCursor);
  };

  const note = me === null ? null : playerListNote(me);
  return (
    <>
      {note !== null && <Text style={styles.note}>{note}</Text>}
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
      {failed ? (
        <>
          <Text style={styles.faint}>Le serveur ne répond pas.</Text>
          <Button label="Réessayer" secondary onPress={() => void read(query.trim(), () => true)} />
        </>
      ) : players === null ? (
        <Text style={styles.faint}>Un instant…</Text>
      ) : players.length === 0 ? (
        <Text style={styles.empty}>
          {query.trim() !== "" ? NO_PLAYER_FOUND : noPlayerYet(me?.publicFromLevel ?? 8)}
        </Text>
      ) : (
        players.map((entry) => <PlayerRow key={entry.player.code} entry={entry} />)
      )}
      {cursor !== null && <TextButton label="Voir plus de joueurs" onPress={() => void more()} />}
    </>
  );
}

/** The row leads to the profile, where everything one can do with a player already is. */
function PlayerRow({ entry }: { readonly entry: DirectoryPlayer }) {
  const { player, clan } = entry;
  return (
    <Pressable
      onPress={() => {
        if (player.pseudo !== null) {
          router.push({ pathname: "/joueur/[pseudo]", params: { pseudo: player.pseudo } });
        }
      }}
      accessibilityRole="link"
    >
      <Panel style={styles.row}>
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
  row: { flexDirection: "row", alignItems: "center", gap: 14 },
  text: { flex: 1, gap: 2 },
  name: { fontFamily: fonts.display, fontSize: 18, color: colors.text },
  small: { fontFamily: fonts.ui.medium, fontSize: 14, color: colors.textMuted },
});
