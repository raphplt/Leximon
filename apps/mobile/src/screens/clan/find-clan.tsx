import type {
  ClanEntryMode,
  ClanSummary,
  CreateClanRequest,
  MyClanResponse,
} from "@leximon/contract";
import type { ClanResult } from "@leximon/contract/client";
import { CLAN_SCHEDULE, clanRulesAt } from "@leximon/core";
import {
  capitalize,
  clanSubline,
  entryModeLabel,
  isFeatureOpen,
  joinLabel,
  lockedToast,
  NO_CLAN_FOUND,
  NO_CLAN_YET,
} from "@leximon/view-model";
import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { api } from "@/api/client";
import { refusalText } from "@/clan/act";
import { Banner, Emblem } from "@/clan/emblem";
import { myClan } from "@/player/state";
import { TAB_BAR_RISE } from "@/shell/tab-bar";
import { colors, fonts } from "@/theme";
import { Button } from "@/ui/button";
import { Chip } from "@/ui/chip";
import { Icon } from "@/ui/icon";
import { Panel } from "@/ui/panel";
import { Sheet } from "@/ui/sheet";
import { TextButton } from "@/ui/text-button";
import { TextField } from "@/ui/text-field";
import { toast } from "@/ui/toast";
import { ClanForm } from "./clan-form";

const ENTRY_FILTERS: readonly (ClanEntryMode | undefined)[] = [
  undefined,
  "open",
  "request",
  "invite",
];

/**
 * Without a clan: find one by its name, enter by an invitation code, or found
 * one from the level that opens it.
 */
export function FindClan({
  mine,
  level,
  now,
  presetCode,
  onJoined,
}: {
  readonly mine: MyClanResponse;
  readonly level: number;
  readonly now: number;
  /** From an invitation link. */
  readonly presetCode: string | null;
  readonly onJoined: (clanId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [entry, setEntry] = useState<ClanEntryMode | undefined>(undefined);
  const [clans, setClans] = useState<readonly ClanSummary[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [code, setCode] = useState(presetCode ?? "");
  const [busy, setBusy] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

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

  const settle = async (
    key: string,
    action: () => Promise<ClanResult<{ outcome: "joined" | "requested"; clanId: string }>>,
  ) => {
    setBusy(key);
    try {
      const result = await action();
      if (result.kind === "refused") {
        toast(refusalText(result.reason));
        return;
      }
      if (result.value.outcome === "joined") {
        onJoined(result.value.clanId);
        return;
      }
      toast("Demande envoyée.");
      myClan.publish({ ...mine, requests: [...mine.requests, result.value.clanId] });
    } catch {
      toast("Ça n'a pas marché. Réessaie.");
    } finally {
      setBusy(null);
    }
  };

  const withdraw = async (clanId: string) => {
    setBusy(clanId);
    const result = await api.withdrawRequest(clanId).catch(() => null);
    setBusy(null);
    if (result?.kind !== "ok") {
      toast("Ça n'a pas marché. Réessaie.");
      return;
    }
    myClan.publish({ ...mine, requests: mine.requests.filter((id) => id !== clanId) });
  };

  const enterByCode = () => {
    if (code.trim() === "") return;
    void settle("code", () => api.joinByCode(code.trim()));
  };

  const found = async (value: CreateClanRequest) => {
    setBusy("create");
    setCreateError(null);
    try {
      const result = await api.createClan(value);
      if (result.kind === "ok") {
        setCreating(false);
        onJoined(result.value.clanId);
      } else {
        setCreateError(refusalText(result.reason));
      }
    } catch {
      setCreateError("Ça n'a pas marché. Réessaie.");
    } finally {
      setBusy(null);
    }
  };

  const rules = clanRulesAt(CLAN_SCHEDULE, now);
  const canCreate = isFeatureOpen("create_clan", level, now);

  return (
    <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <Text style={styles.title} accessibilityRole="header">
        Trouve ton clan
      </Text>

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
        clans.map((clan) => {
          const requested = mine.requests.includes(clan.id);
          return (
            <Panel key={clan.id} style={styles.clanRow}>
              <Banner cardId={clan.banner} />
              <View style={styles.clanHead}>
                <Emblem emblem={clan.emblem} size={44} level={clan.level} />
                <View style={styles.clanText}>
                  <Text style={styles.clanName}>{clan.name}</Text>
                  <Text style={styles.small}>{clanSubline(clan)}</Text>
                </View>
              </View>
              {requested ? (
                <TextButton
                  label="Retirer ma demande"
                  disabled={busy !== null}
                  onPress={() => void withdraw(clan.id)}
                />
              ) : (
                <Button
                  label={joinLabel(clan.entryMode, false)}
                  secondary={clan.entryMode !== "open"}
                  disabled={busy !== null || clan.entryMode === "invite"}
                  onPress={() => void settle(clan.id, () => api.joinClan(clan.id))}
                />
              )}
            </Panel>
          );
        })
      )}
      {cursor !== null && <TextButton label="Voir plus de clans" onPress={() => void more()} />}

      <Panel>
        <Text style={styles.kicker}>UN CODE D'INVITATION</Text>
        <Text style={styles.small}>Il ouvre n'importe quel clan, même sur invitation.</Text>
        <TextField
          label="Code d'invitation"
          value={code}
          maxLength={20}
          placeholder="ABCD1234"
          autoCapitalize="characters"
          autoCorrect={false}
          returnKeyType="go"
          onChangeText={(text) => setCode(text.toUpperCase())}
          onSubmitEditing={enterByCode}
        />
        <Button
          label="Entrer"
          disabled={busy !== null || code.trim() === ""}
          onPress={enterByCode}
        />
      </Panel>

      <Pressable
        onPress={() => (canCreate ? setCreating(true) : toast(lockedToast("create_clan", now)))}
        accessibilityRole="button"
        style={styles.found}
      >
        <Icon name={canCreate ? "plus" : "lock"} size={18} color={colors.text} />
        <Text style={styles.foundText}>Fonder un clan</Text>
      </Pressable>

      <Sheet open={creating} title="Fonder un clan" onClose={() => setCreating(false)}>
        <ClanForm
          initial={{
            name: "",
            motto: "",
            entryMode: "open",
            emblem: {
              engraving: rules.emblemEngravings[0] ?? "",
              colors: [rules.emblemColors[0] ?? "sang", rules.emblemColors[1] ?? "or"],
            },
          }}
          choices={{ engravings: rules.emblemEngravings, colors: rules.emblemColors }}
          submitLabel="Fonder le clan"
          busy={busy === "create"}
          error={createError}
          onSubmit={(value) => void found(value)}
        />
      </Sheet>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { gap: 14, paddingHorizontal: 16, paddingTop: 8, paddingBottom: TAB_BAR_RISE + 24 },
  title: { fontFamily: fonts.display, fontSize: 30, color: colors.text },
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
  kicker: {
    fontFamily: fonts.ui.extrabold,
    fontSize: 12,
    letterSpacing: 2,
    color: colors.textMuted,
  },
  found: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 52,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: colors.track,
  },
  foundText: { fontFamily: fonts.ui.extrabold, fontSize: 16, color: colors.text },
});
