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
import { alpha, colors, fontSizes, fonts, IS_LIBRARY, paperColors, space } from "@/theme";
import { Icon } from "./icon";
import { OnPaperContext } from "./ink";
import { ToastHost } from "./toast";
import { Leaf } from "./toy";

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
        <Surface
          style={[styles.sheet, IS_LIBRARY && styles.paper, { paddingBottom: insets.bottom + 16 }]}
        >
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
              <Icon name="close" size={20} color={ink.pageInk} />
            </Pressable>
          </View>
          <ScrollView
            contentContainerStyle={styles.body}
            keyboardShouldPersistTaps="handled"
            bounces={false}
          >
            {/* What it holds reads on the sheet, whatever it rose from. */}
            <OnPaperContext.Provider value={IS_LIBRARY}>{children}</OnPaperContext.Provider>
          </ScrollView>
        </Surface>
        <ToastHost />
      </KeyboardAvoidingView>
    </Modal>
  );
}

/** A leaf of paper in « La Bibliothèque », a dark sheet elsewhere. */
const Surface = IS_LIBRARY ? Leaf : View;
const ink = paperColors;

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: alpha(colors.scrim, 0.6) },
  sheet: {
    maxHeight: "88%",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: colors.sheet,
  },
  paper: {
    backgroundColor: paperColors.paper,
    borderBottomWidth: 0,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  head: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.s6,
    paddingHorizontal: space.s10,
    paddingTop: space.s9,
    paddingBottom: space.s3,
  },
  title: { flex: 1, fontFamily: fonts.display, fontSize: fontSizes.title, color: ink.pageInk },
  close: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: ink.pageRaised,
  },
  body: { gap: space.s7, paddingHorizontal: space.s10, paddingTop: space.s5 },
});
