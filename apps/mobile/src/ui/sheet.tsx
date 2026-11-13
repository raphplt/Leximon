import { type ReactNode, useEffect, useMemo } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { scheduleOnRN } from "react-native-worklets";
import { alpha, colors, fontSizes, fonts, paperColors, space } from "@/theme";
import { Icon } from "./icon";
import { ToastHost } from "./toast";
import { Leaf } from "./toy";

const DISMISS_DISTANCE = 110;
const DISMISS_VELOCITY = 700;
const DISMISS_DROP = 420;

/** A panel that rises from the bottom over the screen: a member, the clan's options, a form. */
export function Sheet({
  open,
  title,
  onClose,
  children,
  footer,
  tall = false,
}: {
  readonly open: boolean;
  readonly title: string;
  readonly onClose: () => void;
  readonly children: ReactNode;
  /** Stays at the bottom while the content scrolls: the action of a long list. */
  readonly footer?: ReactNode;
  /** Takes nearly the whole screen, for a long editor such as the deck. */
  readonly tall?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const translateY = useSharedValue(0);

  useEffect(() => {
    if (open) translateY.value = 0;
  }, [open, translateY]);

  const dismissPan = useMemo(() => {
    const close = () => onClose();
    return Gesture.Pan()
      .activeOffsetY(6)
      .onUpdate((event) => {
        translateY.value = Math.max(0, event.translationY);
      })
      .onEnd((event) => {
        if (event.translationY > DISMISS_DISTANCE || event.velocityY > DISMISS_VELOCITY) {
          translateY.value = withTiming(
            DISMISS_DROP,
            { duration: 180, easing: Easing.out(Easing.quad) },
            (done) => {
              if (done) scheduleOnRN(close);
            },
          );
          return;
        }
        translateY.value = withSpring(0, { damping: 24, stiffness: 280 });
      })
      .onFinalize((_, success) => {
        if (!success) translateY.value = withSpring(0, { damping: 24, stiffness: 280 });
      });
  }, [onClose, translateY]);

  const sheetMotion = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));
  const backdropMotion = useAnimatedStyle(() => ({
    opacity: Math.max(0.15, 1 - translateY.value / DISMISS_DROP),
  }));

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <GestureHandlerRootView style={styles.root}>
        <Animated.View style={[styles.backdrop, backdropMotion]}>
          <KeyboardAvoidingView
            style={[styles.avoid, { paddingTop: insets.top + 12 }]}
            behavior="padding"
          >
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={onClose}
              accessibilityLabel="Fermer"
              accessibilityRole="button"
            />
            <Animated.View style={[styles.frame, tall && styles.tall, sheetMotion]}>
              <Leaf
                style={[
                  styles.sheet,
                  tall && styles.tallFill,
                  { paddingBottom: insets.bottom + 16 },
                ]}
              >
                <GestureDetector gesture={dismissPan}>
                  <View collapsable={false}>
                    <View style={styles.grabberWrap}>
                      <View style={styles.grabber} />
                    </View>
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
                  </View>
                </GestureDetector>
                <ScrollView
                  contentContainerStyle={styles.body}
                  keyboardShouldPersistTaps="handled"
                  bounces={false}
                >
                  {children}
                </ScrollView>
                {footer !== undefined && <View style={styles.footer}>{footer}</View>}
              </Leaf>
            </Animated.View>
            <ToastHost />
          </KeyboardAvoidingView>
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const ink = paperColors;

const styles = StyleSheet.create({
  root: { flex: 1 },
  backdrop: { flex: 1, backgroundColor: alpha(colors.scrim, 0.6) },
  avoid: { flex: 1, justifyContent: "flex-end" },
  frame: { width: "100%", maxWidth: 560, alignSelf: "center", maxHeight: "88%" },
  sheet: {
    width: "100%",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: paperColors.paper,
    borderBottomWidth: 0,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  tall: { height: "94%", maxHeight: "94%" },
  tallFill: { flex: 1 },
  grabberWrap: { alignItems: "center", paddingTop: space.s5, paddingBottom: space.s1 },
  grabber: { width: 40, height: 4, borderRadius: 2, backgroundColor: ink.rule },
  head: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.s6,
    paddingHorizontal: space.s10,
    paddingTop: space.s4,
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
  body: {
    gap: space.s7,
    paddingHorizontal: space.s10,
    paddingTop: space.s5,
    paddingBottom: space.s10,
  },
  footer: {
    gap: space.s4,
    paddingHorizontal: space.s10,
    paddingTop: space.s6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: ink.rule,
  },
});
