import {
  ATELIER_TABS,
  type AtelierItem,
  type AtelierTab,
  atelierItems,
  cosmeticLockedToast,
  cosmeticStateLabel,
  wornToast,
} from "@leximon/view-model";
import { useState } from "react";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useNow, useSharedFailed } from "@/player/shared";
import { profile } from "@/player/state";
import { useProfileActions } from "@/profile/profile-actions";
import { colors, fonts } from "@/theme";
import { Avatar } from "@/ui/avatar";
import { Button } from "@/ui/button";
import { Icon } from "@/ui/icon";
import { Page, Paragraph } from "@/ui/page";
import { Segmented } from "@/ui/segmented";
import { toast } from "@/ui/toast";

/** Titles are words, wider than a face: two to a row. */
const COLUMNS: Readonly<Record<AtelierTab, number>> = { avatars: 3, frames: 3, titles: 2 };
const GAP = 10;

/** The atelier: what the coffrets gave, worn on the profile with one tap. */
export function AtelierScreen() {
  const actions = useProfileActions();
  const me = actions.profile;
  const failed = useSharedFailed(profile);
  const now = useNow(60_000);
  const window = useWindowDimensions();
  const [tab, setTab] = useState<AtelierTab>("avatars");

  const choose = (item: AtelierItem) => {
    if (item.state === "worn") return;
    if (item.state !== "owned") {
      toast(cosmeticLockedToast(item));
      return;
    }
    const change =
      tab === "avatars"
        ? { avatar: item.id }
        : tab === "frames"
          ? { frame: item.id }
          : { title: item.id };
    void actions.update(change, { success: wornToast(tab) });
  };

  const items = me === null ? [] : atelierItems(tab, me, now);
  const columns = COLUMNS[tab];
  // The page's side margins, then the gaps between the columns.
  const itemWidth = Math.floor((window.width - 48 - GAP * (columns - 1)) / columns);
  const previewSize = tab === "titles" ? 72 : itemWidth - 28;

  return (
    <Page title="Apparence">
      <View style={styles.head}>
        <Avatar avatar={me?.avatar ?? null} frame={me?.frame ?? null} size={72} />
        {me?.title != null && <Text style={styles.wornTitle}>{me.title}</Text>}
      </View>
      <Segmented
        options={ATELIER_TABS.map((entry) => ({ value: entry.tab, label: entry.label }))}
        value={tab}
        onChange={setTab}
      />
      {me === null ? (
        failed ? (
          <>
            <Paragraph muted>L'atelier ne se charge pas.</Paragraph>
            <Button label="Réessayer" secondary onPress={() => profile.refresh()} />
          </>
        ) : (
          <Paragraph muted>Un instant…</Paragraph>
        )
      ) : (
        <View style={styles.grid}>
          {items.map((item) => {
            const closed = item.state === "locked" || item.state === "in_coffret";
            return (
              <Pressable
                key={item.id}
                disabled={actions.busy}
                onPress={() => choose(item)}
                accessibilityRole="button"
                accessibilityState={{ selected: item.state === "worn" }}
                accessibilityLabel={`${item.name}, ${cosmeticStateLabel(item)}`}
                style={({ pressed }) => [
                  styles.item,
                  { width: itemWidth },
                  item.state === "worn" && styles.itemWorn,
                  pressed && styles.pressed,
                ]}
              >
                <View style={closed && styles.closed}>
                  <Preview tab={tab} item={item} wornAvatar={me.avatar} size={previewSize} />
                </View>
                {tab !== "titles" && (
                  <Text style={styles.name} numberOfLines={1}>
                    {item.name}
                  </Text>
                )}
                <View style={styles.state}>
                  {item.state === "worn" && <Icon name="check" size={13} color={colors.success} />}
                  {closed && <Icon name="lock" size={12} color={colors.textFaint} />}
                  <Text
                    style={[
                      styles.stateText,
                      item.state === "worn" && styles.stateWorn,
                      item.state === "owned" && styles.stateOwned,
                    ]}
                  >
                    {cosmeticStateLabel(item)}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      )}
    </Page>
  );
}

function Preview({
  tab,
  item,
  wornAvatar,
  size,
}: {
  readonly tab: AtelierTab;
  readonly item: AtelierItem;
  readonly wornAvatar: string;
  readonly size: number;
}) {
  if (tab === "titles") {
    return (
      <View style={[styles.titleBox, { height: size }]}>
        <Text style={styles.titlePill}>{item.name}</Text>
      </View>
    );
  }
  // A frame is tried on the avatar worn; an avatar in the simple frame.
  return tab === "avatars" ? (
    <Avatar avatar={item.id} frame="simple" size={size} />
  ) : (
    <Avatar avatar={wornAvatar} frame={item.id} size={size} />
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", gap: 14, marginTop: -6 },
  wornTitle: {
    overflow: "hidden",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: colors.kraft,
    color: colors.kraftTitle,
    fontFamily: fonts.display,
    fontSize: 15,
  },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: GAP },
  item: {
    alignItems: "center",
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 6,
    borderRadius: 16,
    backgroundColor: colors.panel,
    borderWidth: 2,
    borderColor: "transparent",
  },
  itemWorn: { borderColor: colors.success },
  pressed: { opacity: 0.7 },
  closed: { opacity: 0.4 },
  name: { fontFamily: fonts.ui.bold, fontSize: 13, color: colors.text },
  state: { flexDirection: "row", alignItems: "center", gap: 4 },
  stateText: { fontFamily: fonts.ui.extrabold, fontSize: 12, color: colors.textFaint },
  stateWorn: { color: colors.success },
  stateOwned: { color: colors.accent },
  titleBox: { alignSelf: "stretch", alignItems: "center", justifyContent: "center" },
  titlePill: {
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: colors.kraft,
    color: colors.kraftTitle,
    fontFamily: fonts.display,
    fontSize: 14,
    textAlign: "center",
  },
});
