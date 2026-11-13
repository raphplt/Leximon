import { matter } from "@leximon/tokens";
import { Canvas, Fill, ImageShader, useImage } from "@shopify/react-native-skia";
import { StyleSheet, View } from "react-native";

const TILES = {
  paper: require("../../assets/matter/paper.webp"),
  leather: require("../../assets/matter/leather.webp"),
  cloth: require("../../assets/matter/cloth.webp"),
} as const;

type Kind = keyof typeof TILES;

/** The grain of paper, leather or cloth, drawn as a single GPU-repeated Skia ImageShader. */
export function Matter({ kind }: { readonly kind: Kind }) {
  const image = useImage(TILES[kind]);
  return (
    <View style={styles.fill} pointerEvents="none" accessible={false}>
      <Canvas style={StyleSheet.absoluteFill}>
        {image !== null && (
          <Fill>
            <ImageShader
              image={image}
              tx="repeat"
              ty="repeat"
              fit="fill"
              rect={{ x: 0, y: 0, width: matter.size, height: matter.size }}
            />
          </Fill>
        )}
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { ...StyleSheet.absoluteFill, overflow: "hidden" },
});
