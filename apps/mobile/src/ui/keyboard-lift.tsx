import { type ReactNode, useEffect, useRef, useState } from "react";
import {
  Keyboard,
  Platform,
  type StyleProp,
  View,
  type ViewInstance,
  type ViewStyle,
} from "react-native";

/**
 * Lifts its content above the keyboard, by what the keyboard covers of it. It measures itself in
 * the window: inside the tabs, under the top bar, `KeyboardAvoidingView` cannot know where it is.
 */
export function KeyboardLift({
  style,
  children,
}: {
  readonly style?: StyleProp<ViewStyle>;
  readonly children: ReactNode;
}) {
  const box = useRef<ViewInstance>(null);
  const [lift, setLift] = useState(0);
  useEffect(() => {
    const showing = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hiding = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const shown = Keyboard.addListener(showing, (event) => {
      box.current?.measureInWindow((_x, y, _width, height) => {
        setLift(Math.max(0, y + height - event.endCoordinates.screenY));
      });
    });
    const hidden = Keyboard.addListener(hiding, () => setLift(0));
    return () => {
      shown.remove();
      hidden.remove();
    };
  }, []);
  return (
    <View ref={box} style={style}>
      <View style={{ flex: 1, marginBottom: lift }}>{children}</View>
    </View>
  );
}
