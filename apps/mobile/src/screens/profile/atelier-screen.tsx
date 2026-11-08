import { toy as toyValues } from "@leximon/tokens";
import {
  APPEARANCE_RESET,
  APPEARANCE_SAVE,
  APPEARANCE_SAVE_BUSY,
  APPEARANCE_SAVED,
  APPEARANCE_UNSAVED,
  type Appearance,
  ATELIER_NEW_TAB,
  ATELIER_NEW_TAB_KEY,
  ATELIER_TABS,
  type AtelierItem,
  type AtelierTab,
  appearanceBlock,
  appearanceBuyAction,
  appearanceChanges,
  atelierItems,
  type CosmeticTab,
  chosenIn,
  cosmeticStateLabel,
  draftItems,
  isAppearanceChanged,
  NEW_TAB_BADGE,
  playerName,
  savedAppearance,
  withChoice,
} from "@leximon/view-model";
import * as SecureStore from "expo-secure-store";
import { useState } from "react";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useNow, useSharedFailed } from "@/player/shared";
import { profile } from "@/player/state";
import { useProfileActions } from "@/profile/profile-actions";
import { alpha, colors, fontSizes, fonts, paperColors, radii, space } from "@/theme";
import { Avatar } from "@/ui/avatar";
import { Button } from "@/ui/button";
import { Icon } from "@/ui/icon";
import { Page, Paragraph } from "@/ui/page";
import { Segmented } from "@/ui/segmented";
import { Sheet } from "@/ui/sheet";
import { toyFace } from "@/ui/toy";
import { AppearancePreview } from "./appearance-preview";
import { BannerPanel, BuyBanner } from "./banner-panel";
import { LockSeal, sunkCall, sunkInk, sunkTile, tryingRing } from "./lock-seal";

/** Titles are words, wider than a face: two to a row. */
const COLUMNS: Readonly<Record<CosmeticTab, number>> = { avatars: 3, frames: 3, titles: 2 };
const GAP = 10;

/** Storage can fail: then no badge, rather than one that never goes. */
function newTabFresh(): boolean {
  try {
    return SecureStore.getItem(ATELIER_NEW_TAB_KEY) === null;
  } catch {
    return false;
  }
}

/**
 * The atelier: avatars, frames, titles and banners chosen on a draft, shown at once on the
 * profile card above them, worn only once saved. A piece not yet owned may be tried on.
 */
export function AtelierScreen() {
  const actions = useProfileActions();
  const me = actions.profile;
  const failed = useSharedFailed(profile);
  const now = useNow(60_000);
  const window = useWindowDimensions();
  const [tab, setTab] = useState<AtelierTab>("avatars");
  const [fresh, setFresh] = useState(newTabFresh);
  const [draft, setDraft] = useState<Appearance | null>(null);
  const [buying, setBuying] = useState(false);

  const look = me === null ? null : (draft ?? savedAppearance(me));
  const changed = me !== null && look !== null && isAppearanceChanged(me, look);
  const block = me !== null && look !== null && changed ? appearanceBlock(me, look, now) : null;

  const save = async () => {
    if (me === null || look === null) return;
    const problem = await actions.update(appearanceChanges(me, look), {
      success: APPEARANCE_SAVED,
    });
    if (problem === null) setDraft(null);
  };

  const items =
    me === null || look === null || tab === "banners"
      ? []
      : draftItems(atelierItems(tab, me, now), (item) => item.id === chosenIn(tab, look));
  const columns = tab === "banners" ? 2 : COLUMNS[tab];
  // The page's side margins, then the gaps between the columns.
  const itemWidth = Math.floor((window.width - 48 - GAP * (columns - 1)) / columns);
  const previewSize = tab === "titles" ? 72 : itemWidth - 28;

  const bar = changed ? (
    <View style={styles.bar}>
      <Text style={styles.barText}>{block?.text ?? APPEARANCE_UNSAVED}</Text>
      <View style={styles.barButtons}>
        <View style={styles.grow}>
          <Button label={APPEARANCE_RESET} secondary small onPress={() => setDraft(null)} />
        </View>
        <View style={styles.grow}>
          {block?.kind === "for_sale" ? (
            <Button label={appearanceBuyAction(block)} small onPress={() => setBuying(true)} />
          ) : (
            <Button
              label={actions.busy ? APPEARANCE_SAVE_BUSY : APPEARANCE_SAVE}
              small
              disabled={actions.busy || block !== null}
              onPress={() => void save()}
            />
          )}
        </View>
      </View>
    </View>
  ) : undefined;

  return (
    <Page title="Apparence" {...(bar === undefined ? {} : { footer: bar })}>
      {me !== null && look !== null && (
        <AppearancePreview
          look={look}
          name={me.member ? playerName({ code: me.playerCode, pseudo: me.pseudo }) : "Invité"}
          level={me.level}
          trying={block !== null}
        />
      )}
      <Segmented
        options={ATELIER_TABS.map((entry) => ({
          value: entry.tab,
          label: entry.label,
          badge: fresh && entry.tab === ATELIER_NEW_TAB ? NEW_TAB_BADGE : undefined,
        }))}
        value={tab}
        onChange={(next) => {
          setTab(next);
          if (next !== ATELIER_NEW_TAB || !fresh) return;
          setFresh(false);
          SecureStore.setItemAsync(ATELIER_NEW_TAB_KEY, "1").catch(() => {
            // Not remembered: the badge comes back next time.
          });
        }}
      />
      {me === null || look === null ? (
        failed ? (
          <>
            <Paragraph muted>L'atelier ne se charge pas.</Paragraph>
            <Button label="Réessayer" secondary onPress={() => profile.refresh()} />
          </>
        ) : (
          <Paragraph muted>Un instant…</Paragraph>
        )
      ) : tab === "banners" ? (
        <BannerPanel me={me} now={now} look={look} onLook={setDraft} width={window.width - 48} />
      ) : (
        <View style={styles.grid}>
          {items.map((item) => {
            const closed = item.state === "locked" || item.state === "in_coffret";
            return (
              <Pressable
                key={item.id}
                onPress={() => setDraft(withChoice(look, tab, item.id))}
                accessibilityRole="button"
                accessibilityState={{ selected: item.chosen }}
                accessibilityLabel={`${item.name}, ${cosmeticStateLabel(item)}`}
                style={({ pressed }) => [
                  styles.item,
                  { width: itemWidth },
                  item.state === "worn" && styles.itemWorn,
                  closed
                    ? sunkTile
                    : [styles.toy, toyFace(item.state === "worn" ? "gold" : "paper", "tile")],
                  item.chosen && closed && tryingRing,
                  pressed && styles.pressed,
                ]}
              >
                <View>
                  <View style={closed && styles.closed}>
                    <Preview tab={tab} item={item} wornAvatar={look.avatar} size={previewSize} />
                  </View>
                  {closed && <LockSeal />}
                </View>
                {tab !== "titles" && (
                  <Text style={[styles.name, closed && styles.sunk]} numberOfLines={1}>
                    {item.name}
                  </Text>
                )}
                <View style={styles.state}>
                  {item.state === "worn" && <Icon name="check" size={13} color={wornInk} />}
                  <Text
                    style={[
                      styles.stateText,
                      item.state === "worn" && styles.stateWorn,
                      item.state === "owned" && styles.stateOwned,
                      item.state === "locked" && styles.sunk,
                      item.state === "in_coffret" && styles.call,
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
      <Sheet
        open={buying && block?.kind === "for_sale"}
        title={block?.kind === "for_sale" ? block.name : ""}
        onClose={() => setBuying(false)}
      >
        {buying && block?.kind === "for_sale" && look !== null && (
          <BuyBanner
            motif={block.motif}
            name={block.name}
            price={block.price}
            tint={look.bannerTint}
            onDone={(bought) => {
              setBuying(false);
              // Bought: the rest of the draft is worn with it, as one save.
              if (bought) void save();
            }}
          />
        )}
      </Sheet>
    </Page>
  );
}

function Preview({
  tab,
  item,
  wornAvatar,
  size,
}: {
  readonly tab: CosmeticTab;
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

/** Each piece is a paper tile, the one worn is gold. */
const ink = paperColors;
const wornInk = toyValues.outline;

const styles = StyleSheet.create({
  bar: {
    gap: space.s5,
    padding: space.s6,
    borderWidth: toyValues.outlineWidth,
    borderColor: toyValues.outline,
    borderRadius: radii.xxl,
    backgroundColor: alpha(toyValues.outline, 0.95),
    boxShadow: `0 10px 24px ${toyValues.drop}`,
  },
  barText: { fontFamily: fonts.ui.bold, fontSize: fontSizes.body, color: colors.inkOnColor },
  barButtons: { flexDirection: "row", gap: space.s4 },
  grow: { flex: 1 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: GAP },
  item: {
    alignItems: "center",
    gap: space.s3,
    paddingVertical: space.s6,
    paddingHorizontal: space.s3,
    borderRadius: radii.xxl,
    backgroundColor: ink.panel,
    borderWidth: 2,
    borderColor: "transparent",
  },
  itemWorn: { borderColor: ink.success },
  toy: { marginBottom: 4 },
  pressed: { opacity: 0.7 },
  closed: { opacity: 0.3 },
  sunk: { color: sunkInk },
  call: { color: sunkCall },
  name: { fontFamily: fonts.ui.bold, fontSize: fontSizes.small, color: ink.pageInk },
  state: { flexDirection: "row", alignItems: "center", gap: space.s2 },
  stateText: {
    fontFamily: fonts.ui.extrabold,
    fontSize: fontSizes.caption,
    color: ink.pageInkFaint,
  },
  stateWorn: { color: wornInk },
  stateOwned: { color: ink.rubric },
  titleBox: { alignSelf: "stretch", alignItems: "center", justifyContent: "center" },
  titlePill: {
    overflow: "hidden",
    paddingHorizontal: space.s4,
    paddingVertical: space.s2,
    borderRadius: radii.sm,
    backgroundColor: ink.kraft,
    color: ink.kraftTitle,
    fontFamily: fonts.display,
    fontSize: fontSizes.label,
    textAlign: "center",
  },
});
