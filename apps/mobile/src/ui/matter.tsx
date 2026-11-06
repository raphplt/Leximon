import { matter } from "@leximon/tokens";
import { useState } from "react";
import { Image, type LayoutChangeEvent, StyleSheet, View } from "react-native";

const TILES = {
  paper: require("../../assets/matter/paper.webp"),
  leather: require("../../assets/matter/leather.webp"),
  cloth: require("../../assets/matter/cloth.webp"),
} as const;

type Kind = keyof typeof TILES;

/**
 * Lays the tile out by hand: on Android, `resizeMode="repeat"` draws it once in the corner. The
 * views share one decoded image, so a full page costs a few dozen plain views.
 */
function Tiles({ kind }: { readonly kind: Kind }) {
  const [grid, setGrid] = useState({ columns: 0, rows: 0 });
  const measure = ({ nativeEvent: { layout } }: LayoutChangeEvent) => {
    const columns = Math.ceil(layout.width / matter.size);
    const rows = Math.ceil(layout.height / matter.size);
    if (columns !== grid.columns || rows !== grid.rows) setGrid({ columns, rows });
  };
  return (
    <View style={styles.fill} onLayout={measure} pointerEvents="none" accessible={false}>
      <View style={[styles.grid, { width: grid.columns * matter.size }]}>
        {Array.from({ length: grid.columns * grid.rows }, (_, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: identical tiles that never move
          <Image key={index} source={TILES[kind]} style={styles.tile} />
        ))}
      </View>
    </View>
  );
}

/** The grain of paper, leather or cloth, over the color of the surface it fills. */
export function Matter({ kind }: { readonly kind: Kind }) {
  return <Tiles kind={kind} />;
}

const styles = StyleSheet.create({
  fill: { ...StyleSheet.absoluteFill, overflow: "hidden" },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  tile: { width: matter.size, height: matter.size },
});
