import type { CreateClanRequest, MyClanResponse } from "@leximon/contract";
import { CLAN_SCHEDULE, clanRulesAt } from "@leximon/core";
import { isFeatureOpen, lockedToast } from "@leximon/view-model";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { api } from "@/api/client";
import { refusalText } from "@/clan/act";
import { useJoinClan } from "@/clan/use-join-clan";
import { TAB_BAR_RISE } from "@/shell/tab-bar";
import { fontSizes, fonts, paperColors, space } from "@/theme";
import { Button } from "@/ui/button";
import { Icon } from "@/ui/icon";
import { Panel } from "@/ui/panel";
import { Sheet } from "@/ui/sheet";
import { TextField } from "@/ui/text-field";
import { toast } from "@/ui/toast";
import { Lettering, Toy } from "@/ui/toy";
import { ClanForm } from "./clan-form";
import { ClanList } from "./clan-list";

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
  const [code, setCode] = useState(presetCode ?? "");
  const [founding, setFounding] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const join = useJoinClan(mine, onJoined);

  const enterByCode = () => {
    if (code.trim() === "") return;
    void join.enterByCode(code.trim());
  };

  const found = async (value: CreateClanRequest) => {
    setFounding(true);
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
      setFounding(false);
    }
  };

  const rules = clanRulesAt(CLAN_SCHEDULE, now);
  const canCreate = isFeatureOpen("create_clan", level, now);
  const openFounding = () =>
    canCreate ? setCreating(true) : toast(lockedToast("create_clan", now));

  return (
    <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <View accessible accessibilityRole="header" accessibilityLabel="Rejoindre un clan">
        <Lettering size={fontSizes.heading}>Rejoindre un clan</Lettering>
      </View>

      <ClanList join={join} />

      <Panel paper>
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
          disabled={join.busy !== null || code.trim() === ""}
          onPress={enterByCode}
        />
      </Panel>

      <Toy
        matter="paper"
        onPress={openFounding}
        bodyStyle={styles.foundToy}
        accessibilityRole="button"
      >
        <Icon name={canCreate ? "plus" : "lock"} size={18} color={ink.pageInk} />
        <Text style={styles.foundText}>Fonder un clan</Text>
      </Toy>

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
          busy={founding}
          error={createError}
          onSubmit={(value) => void found(value)}
        />
      </Sheet>
    </ScrollView>
  );
}

/** The code to enter lies on paper. */
const ink = paperColors;

const styles = StyleSheet.create({
  page: {
    gap: space.s7,
    paddingHorizontal: space.s8,
    paddingTop: space.s4,
    paddingBottom: TAB_BAR_RISE + 24,
  },
  small: {
    fontFamily: fonts.ui.medium,
    fontSize: fontSizes.label,
    lineHeight: 20,
    color: ink.pageInkMuted,
  },
  kicker: {
    fontFamily: fonts.ui.extrabold,
    fontSize: fontSizes.caption,
    letterSpacing: 2,
    color: ink.pageInkMuted,
  },
  foundToy: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.s4,
    minHeight: 52,
  },
  foundText: {
    fontFamily: fonts.ui.extrabold,
    fontSize: fontSizes.bodyLarge,
    color: ink.pageInk,
  },
});
