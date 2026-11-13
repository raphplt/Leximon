import { type ReactNode, useRef } from "react";
import {
  type StyleProp,
  useWindowDimensions,
  View,
  type ViewInstance,
  type ViewStyle,
} from "react-native";
import Animated, {
  useAnimatedKeyboard,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";

/**
 * Lifts its content above the keyboard, frame-synced with the native keyboard animation.
 * Measures its bottom gap from the screen edge so tab bars below are subtracted cleanly.
 */
export function KeyboardLift({
  style,
  children,
}: {
  readonly style?: StyleProp<ViewStyle>;
  readonly children: ReactNode;
}) {
  const box = useRef<ViewInstance>(null);
  const { height: windowHeight } = useWindowDimensions();
  const bottomGap = useSharedValue(0);
  const keyboard = useAnimatedKeyboard();

  const measure = () => {
    box.current?.measureInWindow((_x, y, _width, height) => {
      bottomGap.value = Math.max(0, windowHeight - (y + height));
    });
  };

  const animated = useAnimatedStyle(() => ({
    flex: 1,
    marginBottom: Math.max(0, keyboard.height.value - bottomGap.value),
  }));

  return (
    <View ref={box} style={style} onLayout={measure}>
      <Animated.View style={animated}>{children}</Animated.View>
    </View>
  );
}
