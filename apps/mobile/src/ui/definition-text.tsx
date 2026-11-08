import { definitionPieces, HIDDEN_WORD_HINT, HIDDEN_WORD_LABEL } from "@leximon/view-model";
import { StyleSheet, Text } from "react-native";
import { colors, fontSizes, fonts } from "@/theme";

/**
 * A definition where words of the same family are hidden: each one is a dark band that says why,
 * so it never passes for the word to find. Nested in the definition's own `Text`.
 */
export function DefinitionText({ text }: { readonly text: string }) {
  return definitionPieces(text).map((piece, index) =>
    piece.kind === "text" ? (
      piece.text
    ) : (
      <Text
        // biome-ignore lint/suspicious/noArrayIndexKey: pieces of one text, in order
        key={index}
        style={styles.hidden}
        accessibilityLabel={HIDDEN_WORD_HINT}
      >
        {` ${HIDDEN_WORD_LABEL.toUpperCase()} `}
      </Text>
    ),
  );
}

const styles = StyleSheet.create({
  hidden: {
    backgroundColor: colors.paperInk,
    color: colors.paper,
    fontFamily: fonts.ui.extrabold,
    fontSize: fontSizes.micro,
    letterSpacing: 0.8,
  },
});
