import { router } from "expo-router";
import type { ReactNode } from "react";
import { KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TAB_BAR_RISE } from "@/shell/tab-bar";
import { colors, fonts } from "@/theme";
import { Icon } from "./icon";

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
}: {
  readonly kicker?: string;
  readonly title: string;
  readonly children: ReactNode;
  /** False where there is nowhere to go back to: the closed beta's door. */
  readonly closable?: boolean;
  /** Under the top bar and above the tabs, which already leave room and the way out. */
  readonly inTab?: boolean;
}) {
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView style={styles.page} behavior="padding">
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.content,
          inTab
            ? { paddingTop: 12, paddingBottom: TAB_BAR_RISE + 24 }
            : { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 32 },
        ]}
      >
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
                <Icon name="back" size={22} color={colors.text} />
              </Pressable>
            )}
          </View>
        )}
        {kicker !== undefined && <Text style={styles.kicker}>{kicker.toUpperCase()}</Text>}
        <Text style={styles.title} accessibilityRole="header">
          {title}
        </Text>
        <View style={styles.body}>{children}</View>
      </ScrollView>
      {/* The content scrolls under the status bar: a band of background keeps the clock legible. */}
      {!inTab && <View style={[styles.statusBand, { height: insets.top }]} />}
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
  return <Text style={[styles.paragraph, muted && styles.muted]}>{children}</Text>;
}

/** The error under a form, read out when it appears. */
export function FormError({ message }: { readonly message: string | null }) {
  if (message === null) return null;
  return (
    <Text style={styles.error} accessibilityRole="alert" accessibilityLiveRegion="polite">
      {message}
    </Text>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  statusBand: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.background,
  },
  content: { paddingHorizontal: 24 },
  top: { height: 44, flexDirection: "row", alignItems: "center", marginBottom: 12 },
  back: {
    width: 40,
    height: 40,
    marginLeft: -8,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  kicker: {
    fontFamily: fonts.ui.extrabold,
    fontSize: 12,
    letterSpacing: 2,
    color: colors.textMuted,
    marginBottom: 6,
  },
  title: { fontFamily: fonts.display, fontSize: 32, lineHeight: 38, color: colors.text },
  body: { gap: 16, marginTop: 20 },
  paragraph: { fontFamily: fonts.text.regular, fontSize: 18, lineHeight: 26, color: colors.text },
  muted: { color: colors.textMuted },
  error: { fontFamily: fonts.ui.bold, fontSize: 15, lineHeight: 21, color: colors.danger },
});
