import type { ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { alpha, SHOWS_THEME_CHOICE as BOOK, colors, fontSizes, fonts, space } from "@/theme";
import { Icon } from "./icon";
import { Matter } from "./matter";
import { ToastHost } from "./toast";

/** A panel that rises from the bottom over the screen: a member, the clan's options, a form. */
export function Sheet({
  open,
  title,
  onClose,
  children,
}: {
  readonly open: boolean;
  readonly title: string;
  readonly onClose: () => void;
  readonly children: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.backdrop} behavior="padding">
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityLabel="Fermer"
          accessibilityRole="button"
        />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
          {BOOK && (
            <>
              <Matter kind="paper" />
              <View style={styles.binding}>
                <Matter kind="leather" />
              </View>
            </>
          )}
          <View style={styles.head}>
            <Text style={styles.title} accessibilityRole="header" numberOfLines={2}>
              {title}
            </Text>
            <Pressable
              onPress={onClose}
              hitSlop={10}
              style={styles.close}
              accessibilityRole="button"
              accessibilityLabel="Fermer"
            >
              <Icon name="close" size={20} color={colors.pageInk} />
            </Pressable>
          </View>
          <ScrollView
            contentContainerStyle={styles.body}
            keyboardShouldPersistTaps="handled"
            bounces={false}
          >
            {children}
          </ScrollView>
        </View>
        <ToastHost />
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: alpha(colors.scrim, 0.6) },
  sheet: {
    maxHeight: "88%",
    borderTopLeftRadius: BOOK ? 0 : 24,
    borderTopRightRadius: BOOK ? 0 : 24,
    backgroundColor: BOOK ? colors.page : colors.sheet,
  },
  /** The band of leather that holds the sheet. */
  binding: {
    height: space.s4,
    overflow: "hidden",
    borderBottomWidth: 1,
    borderBottomColor: colors.gilt,
    backgroundColor: colors.binding,
  },
  head: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.s6,
    paddingHorizontal: space.s10,
    paddingTop: space.s9,
    paddingBottom: space.s3,
  },
  title: { flex: 1, fontFamily: fonts.display, fontSize: fontSizes.title, color: colors.pageInk },
  close: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: BOOK ? "transparent" : colors.pageRaised,
  },
  body: { gap: space.s7, paddingHorizontal: space.s10, paddingTop: space.s5 },
});
