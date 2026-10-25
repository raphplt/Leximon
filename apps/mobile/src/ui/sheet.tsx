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
import { colors, fonts } from "@/theme";
import { Icon } from "./icon";
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
              <Icon name="close" size={20} color={colors.text} />
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
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(10, 12, 24, 0.6)" },
  sheet: {
    maxHeight: "88%",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: colors.sheet,
  },
  head: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 6,
  },
  title: { flex: 1, fontFamily: fonts.display, fontSize: 22, color: colors.text },
  close: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.backgroundRaised,
  },
  body: { gap: 14, paddingHorizontal: 20, paddingTop: 10 },
});
