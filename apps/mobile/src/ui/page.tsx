import { lettering } from "@leximon/tokens";
import { router } from "expo-router";
import { type ReactNode, useState } from "react";
import { KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { DESK_RADIUS, DESK_RIM, Desk, Room } from "@/library/play-pieces";
import { TAB_BAR_RISE } from "@/shell/tab-bar";
import { colors, fontSizes, fonts, space } from "@/theme";
import { Icon } from "./icon";
import { useInk } from "./ink";
import { KeyboardLift } from "./keyboard-lift";
import { Lettering } from "./toy";

/** Maximum width of page content on tablets so lines and grids stay balanced. */
export const PAGE_MAX_WIDTH = 600;

/** The height left free under the content for a footer of two lines and its buttons. */
const FOOTER_ROOM = 170;

/** Leaves the page; a page opened from a link, with nothing behind it, leads to the game. */
function back() {
  if (router.canGoBack()) router.back();
  else router.replace("/");
}

/** A page outside the tabs: a way back, a kicker and a title, then its content, above the keyboard. */
export function Page({
  kicker,
  title,
  children,
  closable = true,
  inTab = false,
  desk = false,
  fill = false,
  footer,
}: {
  readonly kicker?: string;
  readonly title: string;
  readonly children: ReactNode;
  /** False where there is nowhere to go back to: the closed beta's door. */
  readonly closable?: boolean;
  /** Under the top bar and above the tabs, which already leave room and the way out. */
  readonly inTab?: boolean;
  /** The page lies on the desk of the reading room: a card, read up close. */
  readonly desk?: boolean;
  /** The page holds in the screen and its content scrolls where it says: the levels' road. */
  readonly fill?: boolean;
  /** Held at the bottom over the content, which leaves room under itself: a bar of unsaved changes. */
  readonly footer?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const [footerHeight, setFooterHeight] = useState(0);
  const onDesk = desk && !inTab;
  const padding = [
    styles.content,
    inTab
      ? { paddingTop: space.s6, paddingBottom: TAB_BAR_RISE + 24 }
      : onDesk
        ? { paddingTop: space.s4, paddingBottom: space.s16 }
        : { paddingTop: insets.top + 8, paddingBottom: insets.bottom + (fill ? 12 : 32) },
    footer !== undefined && {
      paddingBottom: insets.bottom + (footerHeight > 0 ? footerHeight + space.s8 : FOOTER_ROOM),
    },
  ];
  const inside = (
    <>
      {!inTab && (
        <View style={styles.top}>
          {closable && (
            <Pressable
              onPress={back}
              style={styles.back}
              accessibilityRole="button"
              accessibilityLabel="Retour"
              hitSlop={8}
            >
              <Icon name="back" size={22} color={colors.pageInk} />
            </Pressable>
          )}
        </View>
      )}
      {kicker !== undefined && <Text style={styles.kicker}>{kicker}</Text>}
      <View accessibilityRole="header">
        <Lettering size={fontSizes.headingLarge}>{title}</Lettering>
      </View>
      <View style={[styles.body, fill && styles.filled]}>{children}</View>
    </>
  );
  const scroll = fill ? (
    <View style={[styles.filled, padding]}>{inside}</View>
  ) : (
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={padding}>
      {inside}
    </ScrollView>
  );
  const frame = (
    <>
      {onDesk ? (
        <Room>
          <View
            style={[styles.desk, { marginTop: insets.top + 6, marginBottom: insets.bottom + 6 }]}
          >
            {/* A card read up close, as in a sheet on the web: the leather without its tooling. */}
            <Desk style={StyleSheet.absoluteFill} tooled={false} />
            {/* The page slides under the turned-in edge, not over it. */}
            <View style={styles.deskInside}>{scroll}</View>
          </View>
        </Room>
      ) : !inTab ? (
        // The tabs already stand in the reading room; a page of its own brings it along.
        <Room>{scroll}</Room>
      ) : (
        scroll
      )}
      {footer !== undefined && (
        <View
          style={[styles.footer, { bottom: insets.bottom + space.s6 }]}
          pointerEvents="box-none"
          onLayout={(event) => setFooterHeight(event.nativeEvent.layout.height)}
        >
          <View style={styles.footerInner}>{footer}</View>
        </View>
      )}
      {/* The content scrolls under the status bar: a band of background keeps the clock legible. */}
      {!inTab && !onDesk && <View style={[styles.statusBand, { height: insets.top }]} />}
    </>
  );
  if (inTab) {
    return <KeyboardLift style={[styles.page, styles.inRoom]}>{frame}</KeyboardLift>;
  }
  return (
    <KeyboardAvoidingView style={styles.page} behavior="padding">
      {frame}
    </KeyboardAvoidingView>
  );
}

/** A paragraph of a page. */
export function Paragraph({
  children,
  muted = false,
}: {
  readonly children: ReactNode;
  readonly muted?: boolean;
}) {
  const ink = useInk();
  return (
    <Text style={[styles.paragraph, { color: muted ? ink.pageInkMuted : ink.pageInk }]}>
      {children}
    </Text>
  );
}

/** The error under a form, read out when it appears. */
export function FormError({ message }: { readonly message: string | null }) {
  const ink = useInk();
  if (message === null) return null;
  return (
    <Text
      style={[styles.error, { color: ink.danger }]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      {message}
    </Text>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.page },
  // A page of a tab lies in the reading room the tabs already stand in.
  inRoom: { backgroundColor: "transparent" },
  statusBand: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.page,
  },
  content: {
    width: "100%",
    maxWidth: PAGE_MAX_WIDTH,
    alignSelf: "center",
    paddingHorizontal: space.s12,
  },
  footer: { position: "absolute", left: space.s8, right: space.s8, alignItems: "center" },
  footerInner: { width: "100%", maxWidth: PAGE_MAX_WIDTH - space.s8 * 2 },
  desk: { flex: 1, marginHorizontal: 6 },
  deskInside: {
    flex: 1,
    margin: DESK_RIM,
    borderRadius: DESK_RADIUS - DESK_RIM,
    overflow: "hidden",
  },
  top: { height: 44, flexDirection: "row", alignItems: "center", marginBottom: space.s6 },
  back: {
    width: 40,
    height: 40,
    marginLeft: -8,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  kicker: {
    fontFamily: fonts.displayBold,
    fontSize: fontSizes.body,
    color: lettering.kicker,
    marginBottom: space.s3,
  },
  body: { gap: space.s8, marginTop: space.s10 },
  filled: { flex: 1 },
  paragraph: {
    fontFamily: fonts.text.regular,
    fontSize: fontSizes.subtitle,
    lineHeight: 26,
  },
  error: {
    fontFamily: fonts.ui.bold,
    fontSize: fontSizes.body,
    lineHeight: 21,
  },
});
