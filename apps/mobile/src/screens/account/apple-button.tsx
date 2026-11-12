import * as AppleAuthentication from "expo-apple-authentication";
import { Platform, StyleSheet, View } from "react-native";

/**
 * Native Apple Sign-In button using Apple's system control so localization and brand guidelines
 * match iOS requirements automatically.
 */
export function AppleButton({
  busy,
  disabled = false,
  buttonType = AppleAuthentication.AppleAuthenticationButtonType.CONTINUE,
  onPress,
}: {
  readonly busy: boolean;
  readonly disabled?: boolean;
  readonly buttonType?: AppleAuthentication.AppleAuthenticationButtonType;
  readonly onPress: () => void;
}) {
  if (Platform.OS !== "ios") return null;
  const off = busy || disabled;
  return (
    <View pointerEvents={off ? "none" : "auto"} style={[styles.wrap, off && styles.off]}>
      <AppleAuthentication.AppleAuthenticationButton
        buttonType={buttonType}
        buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
        cornerRadius={26}
        style={styles.button}
        onPress={onPress}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: "100%" },
  off: { opacity: 0.6 },
  button: { width: "100%", height: 52 },
});
