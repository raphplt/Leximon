import type { ClanEntryMode, ClanSummary } from "@leximon/contract";
import {
  capitalize,
  clanSubline,
  entryModeLabel,
  joinLabel,
  NO_CLAN_FOUND,
  NO_CLAN_YET,
} from "@leximon/view-model";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { api } from "@/api/client";
import { Banner, Emblem } from "@/clan/emblem";
import type { ClanJoin } from "@/clan/use-join-clan";
import { colors, fonts } from "@/theme";
import { Button } from "@/ui/button";
import { Chip } from "@/ui/chip";
import { Icon } from "@/ui/icon";
import { Panel } from "@/ui/panel";
import { TextButton } from "@/ui/text-button";

const ENTRY_FILTERS: readonly (ClanEntryMode | undefined)[] = [
  undefined,
  "open",
  "request",
  "invite",
];

/**
 * Every clan, by name and way in. Each row leads to the clan's page. `join` adds the button that
 * enters a clan, for a player who may join one.
 */
export function ClanList({ join }: { readonly join: ClanJoin | null }) {
  const [query, setQuery] = useState("");
  const [entry, setEntry] = useState<ClanEntryMode | undefined>(undefined);
  const [clans, setClans] = useState<readonly ClanSummary[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);

  const filter = useCallback(
    (cursorValue: string | null) => ({
      q: query.trim(),
      cursor: cursorValue,
      ...(entry === undefined ? {} : { entry }),
    }),
    [query, entry],
  );

  // Searches as the name is typed, once the player pauses.
  useEffect(() => {
    const timer = setTimeout(
      async () => {
        const page = await api.fetchClans(filter(null)).catch(() => null);
        setClans(page?.clans ?? []);
        setCursor(page?.nextCursor ?? null);
      },
      query === "" ? 0 : 300,
    );
    return () => clearTimeout(timer);
  }, [query, filter]);

  const more = async () => {
    if (cursor === null) return;
    const page = await api.fetchClans(filter(cursor)).catch(() => null);
    if (page === null) return;
    setClans((current) => [...(current ?? []), ...page.clans]);
    setCursor(page.nextCursor);
  };

  return (
    <>
      <View style={styles.search}>
        <Icon name="search" size={18} color={colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          value={query}
          maxLength={30}
          placeholder="Nom du clan"
          placeholderTextColor={colors.textFaint}
          selectionColor={colors.accent}
          accessibilityLabel="Nom du clan"
          autoCorrect={false}
          onChangeText={setQuery}
        />
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
      >
        {ENTRY_FILTERS.map((mode) => (
          <Chip
            key={mode ?? "all"}
            label={mode === undefined ? "Tous" : capitalize(entryModeLabel(mode))}
            on={entry === mode}
            onPress={() => setEntry(mode)}
          />
        ))}
      </ScrollView>

      {clans === null ? (
        <Text style={styles.faint}>Un instant…</Text>
      ) : clans.length === 0 ? (
        <Text style={styles.empty}>{query.trim() === "" ? NO_CLAN_YET : NO_CLAN_FOUND}</Text>
      ) : (
        clans.map((clan) => (
          <Panel key={clan.id} style={styles.clanRow}>
            <Banner cardId={clan.banner} />
            <Pressable
              style={styles.clanHead}
              onPress={() => router.push({ pathname: "/clan/[id]", params: { id: clan.id } })}
              accessibilityRole="link"
            >
              <Emblem emblem={clan.emblem} size={44} level={clan.level} />
              <View style={styles.clanText}>
                <Text style={styles.clanName}>{clan.name}</Text>
                <Text style={styles.small}>{clanSubline(clan)}</Text>
              </View>
            </Pressable>
            {join !== null && <JoinButton clan={clan} join={join} />}
          </Panel>
        ))
      )}
      {cursor !== null && <TextButton label="Voir plus de clans" onPress={() => void more()} />}
    </>
  );
}

/** Enters the clan, asks to, or takes the request back. */
export function JoinButton({
  clan,
  join,
}: {
  readonly clan: ClanSummary;
  readonly join: ClanJoin;
}) {
  if (join.requests.includes(clan.id)) {
    return (
      <TextButton
        label="Retirer ma demande"
        disabled={join.busy !== null}
        onPress={() => void join.withdraw(clan.id)}
      />
    );
  }
  return (
    <Button
      label={joinLabel(clan.entryMode, false)}
      secondary={clan.entryMode !== "open"}
      disabled={join.busy !== null || clan.entryMode === "invite"}
      onPress={() => void join.join(clan.id)}
    />
  );
}

const styles = StyleSheet.create({
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
  chips: { gap: 8 },
  faint: { fontFamily: fonts.ui.medium, fontSize: 15, color: colors.textFaint },
  empty: {
    fontFamily: fonts.text.italic,
    fontSize: 18,
    lineHeight: 25,
    color: colors.textMuted,
    textAlign: "center",
    paddingVertical: 12,
  },
  clanRow: { overflow: "hidden" },
  clanHead: { flexDirection: "row", alignItems: "center", gap: 16 },
  clanText: { flex: 1, gap: 2 },
  clanName: { fontFamily: fonts.display, fontSize: 19, color: colors.text },
  small: { fontFamily: fonts.ui.medium, fontSize: 14, lineHeight: 20, color: colors.textMuted },
});
