import { createContext, useContext } from "react";
import { colors, type Palette, paperColors } from "@/theme";

/** Whether what is drawn lies on a leaf of paper, set by the leaf itself. */
export const OnPaperContext = createContext(false);

/**
 * The colors to read with where a piece is drawn: brown ink on paper, the room's own elsewhere.
 * A shared piece (a paragraph, a field, a link) reads them, so a screen only lays its leaf.
 */
export function useInk(): Palette {
  return useContext(OnPaperContext) ? paperColors : colors;
}
