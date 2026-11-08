import { definitionPieces, HIDDEN_WORD_HINT, HIDDEN_WORD_LABEL } from "@leximon/view-model";
import styles from "./definition-text.module.css";

/**
 * A definition where words of the same family are hidden: each one is a dark band that says why,
 * so it never passes for the word to find.
 */
export function DefinitionText({ text }: { readonly text: string }) {
  return definitionPieces(text).map((piece, index) =>
    piece.kind === "text" ? (
      piece.text
    ) : (
      <span
        // biome-ignore lint/suspicious/noArrayIndexKey: pieces of one text, in order
        key={index}
        className={styles.hidden}
        role="img"
        aria-label={HIDDEN_WORD_HINT}
        title={HIDDEN_WORD_HINT}
      >
        {HIDDEN_WORD_LABEL}
      </span>
    ),
  );
}
