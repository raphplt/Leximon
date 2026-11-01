import { Image, StyleSheet } from "react-native";
import { SHOWS_THEME_CHOICE } from "@/theme";

const TILES = {
  paper: require("../../assets/matter/paper.webp"),
  leather: require("../../assets/matter/leather.webp"),
} as const;

/** The grain of a surface in Le Livre, over its color. The current look has none. */
export function Matter({ kind }: { readonly kind: keyof typeof TILES }) {
  if (!SHOWS_THEME_CHOICE) return null;
  return (
    <Image
      source={TILES[kind]}
      resizeMode="repeat"
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      accessible={false}
    />
  );
}
