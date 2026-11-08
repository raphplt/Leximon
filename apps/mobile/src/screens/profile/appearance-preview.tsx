import { toyMatters, toy as toyValues } from "@leximon/tokens";
import { APPEARANCE_PREVIEW_NOTE, APPEARANCE_TRYING, type Appearance } from "@leximon/view-model";
import { StyleSheet, Text, View } from "react-native";
import { colors, fontSizes, fonts, paperColors, radii, space } from "@/theme";
import { Avatar } from "@/ui/avatar";
import { LevelMedal } from "@/ui/level";
import { ProfileBanner } from "@/ui/profile-banner";
import { toyFace } from "@/ui/toy";

/** The profile card as others will see it, drawn from the draft: every choice shows here first. */
export function AppearancePreview({
  look,
  name,
  level,
  trying,
}: {
  readonly look: Appearance;
  readonly name: string;
  readonly level: number;
  /** A piece tried on rather than owned. */
  readonly trying: boolean;
}) {
  return (
    <View style={styles.preview}>
      <View style={[styles.card, toyFace("paper", "tile")]}>
        <ProfileBanner
          banner={{ motif: look.bannerMotif, tint: look.bannerTint }}
          style={styles.cloth}
        />
        {trying && <Text style={styles.trying}>{APPEARANCE_TRYING}</Text>}
        <View style={styles.body}>
          <Avatar avatar={look.avatar} frame={look.frame} size={84} label="Avatar" />
          <Text style={styles.name} numberOfLines={1}>
            {name}
          </Text>
          <View style={styles.headline}>
            <LevelMedal level={level} size={26} labelled />
            {look.title !== null && <Text style={styles.title}>{look.title}</Text>}
          </View>
        </View>
      </View>
      <Text style={styles.note}>{APPEARANCE_PREVIEW_NOTE}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  preview: { gap: space.s4 },
  card: { overflow: "hidden", paddingBottom: space.s8 },
  cloth: {
    height: 84,
    borderBottomWidth: 3,
    borderColor: toyValues.outline,
  },
  trying: {
    position: "absolute",
    top: space.s4,
    left: space.s4,
    overflow: "hidden",
    paddingHorizontal: space.s5,
    borderWidth: 2,
    borderColor: toyValues.outline,
    borderRadius: radii.pill,
    backgroundColor: toyMatters.gold.top,
    color: toyValues.outline,
    fontFamily: fonts.ui.extrabold,
    fontSize: fontSizes.caption,
  },
  body: { alignItems: "center", gap: space.s3, marginTop: -44, paddingHorizontal: space.s6 },
  name: { fontFamily: fonts.display, fontSize: fontSizes.heading, color: paperColors.pageInk },
  headline: { flexDirection: "row", alignItems: "center", gap: space.s4, minHeight: 26 },
  title: { fontFamily: fonts.ui.bold, fontSize: fontSizes.body, color: paperColors.pageInk },
  note: {
    fontFamily: fonts.ui.medium,
    fontSize: fontSizes.small,
    color: colors.pageInkMuted,
    textAlign: "center",
  },
});
