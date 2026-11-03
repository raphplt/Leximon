import { speechToggleLabel } from "@leximon/view-model";
import { useState } from "react";
import { Pressable, StyleSheet } from "react-native";
import { readPreference, writePreference } from "@/feedback/feedback";
import { colors } from "@/theme";
import { Icon } from "@/ui/icon";
import type { SpokenWord } from "./spoken-word";

/**
 * Beside a word the catalogue's voice can say: a button to hear it again, and the speaker that
 * stops the words from being said, through the setting of the same name.
 */
export function SpeechButtons({
  word,
  label,
}: {
  readonly word: SpokenWord;
  /** The word itself, for the button's name. */
  readonly label: string;
}) {
  if (!word.available) return null;
  return (
    <>
      <Pressable
        onPress={word.play}
        accessibilityRole="button"
        accessibilityLabel={`Écouter ${label}`}
        style={[styles.listen, word.playing && styles.listening]}
      >
        <Icon name="play" size={18} color={word.playing ? colors.actionInk : colors.pageInk} />
      </Pressable>
      <SpeechToggle word={word} />
    </>
  );
}

/** With all sounds off nothing is said anyway: nothing to offer. */
function SpeechToggle({ word }: { readonly word: SpokenWord }) {
  const [on, setOn] = useState(() => readPreference("speech"));
  if (!readPreference("sound")) return null;
  const toggle = () => {
    writePreference("speech", !on);
    setOn(!on);
    if (on) word.stop();
  };
  return (
    <Pressable
      onPress={toggle}
      accessibilityRole="button"
      accessibilityLabel={speechToggleLabel(on)}
      style={styles.listen}
    >
      <Icon name={on ? "sound" : "soundOff"} size={18} color={colors.pageInk} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  listen: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.pageRaised,
  },
  listening: { backgroundColor: colors.action },
});
