import { editionColors, mixHex, toyMatters, toy as toyValues } from "@leximon/tokens";
import {
  EDITION_ALBUM_ACTION,
  EDITION_FAILED,
  EDITION_PLAIN,
  EDITIONS_NOTE,
  EDITIONS_TITLE,
  editionAlbumDone,
  editionName,
  editionOfCard,
} from "@leximon/view-model";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { api } from "@/api/client";
import { useShared } from "@/player/shared";
import { editions } from "@/player/state";
import { colors, fontSizes, fonts, paperColors, space } from "@/theme";
import { Button } from "@/ui/button";
import { toast } from "@/ui/toast";

/**
 * The library editions a patron prints this owned card in, or the whole album. Nothing shows for
 * a player who owns none: the offer is never made here.
 */
export function EditionPicker({ cardId }: { readonly cardId: string }) {
  const mine = useShared(editions);
  const [busy, setBusy] = useState(false);
  if (mine === null || mine.owned.length === 0) return null;
  const current = editionOfCard(mine, cardId);

  const choose = async (edition: string | null) => {
    if (busy || edition === current) return;
    setBusy(true);
    editions.publish({ ...mine, cards: { ...mine.cards, [cardId]: edition } });
    try {
      const result = await api.setCardEdition(cardId, edition);
      if (result.kind === "refused") throw new Error(result.reason);
    } catch {
      toast(EDITION_FAILED);
      editions.refresh();
    } finally {
      setBusy(false);
    }
  };

  const wholeAlbum = async () => {
    if (busy) return;
    setBusy(true);
    editions.publish({ ...mine, album: current, cards: {} });
    try {
      const result = await api.setAlbumEdition(current);
      if (result.kind === "refused") throw new Error(result.reason);
      toast(editionAlbumDone(current));
    } catch {
      toast(EDITION_FAILED);
      editions.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.picker}>
      <Text style={styles.kicker}>{EDITIONS_TITLE.toUpperCase()}</Text>
      <View style={styles.options} accessibilityLabel={EDITIONS_TITLE}>
        {[null, ...mine.owned].map((edition) => {
          const tones = editionColors(edition);
          const chosen = edition === current;
          return (
            <Pressable
              key={edition ?? "plain"}
              onPress={() => void choose(edition)}
              disabled={busy}
              accessibilityRole="button"
              accessibilityState={{ selected: chosen, disabled: busy }}
              style={[styles.option, chosen && styles.chosen]}
            >
              <View
                style={[
                  styles.swatch,
                  tones === null
                    ? styles.plain
                    : { backgroundColor: tones.paper, borderColor: tones.ink },
                ]}
              >
                {tones !== null && <View style={[styles.dot, { backgroundColor: tones.ink }]} />}
              </View>
              <Text style={styles.label}>
                {edition === null ? EDITION_PLAIN : editionName(edition)}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Button label={EDITION_ALBUM_ACTION} secondary small disabled={busy} onPress={wholeAlbum} />
      <Text style={styles.note}>{EDITIONS_NOTE}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  picker: { gap: space.s4, alignItems: "flex-start" },
  kicker: {
    fontFamily: fonts.displayBold,
    fontSize: fontSizes.body,
    color: paperColors.pageInkMuted,
  },
  options: { flexDirection: "row", flexWrap: "wrap", gap: space.s3 },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.s3,
    minHeight: 40,
    paddingLeft: space.s3,
    paddingRight: space.s6,
    borderWidth: 2,
    borderColor: mixHex(colors.paper, toyValues.outline, 0.35),
    borderRadius: 999,
    backgroundColor: colors.paper,
  },
  chosen: {
    borderColor: toyValues.outline,
    backgroundColor: mixHex(colors.paper, toyMatters.gold.top, 0.35),
    boxShadow: `0 3px 0 ${toyValues.outline}`,
  },
  swatch: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  plain: {
    backgroundColor: colors.paper,
    borderColor: mixHex(colors.paper, toyValues.outline, 0.45),
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  label: {
    fontFamily: fonts.ui.extrabold,
    fontSize: fontSizes.small,
    color: paperColors.pageInk,
  },
  note: {
    fontFamily: fonts.ui.medium,
    fontSize: fontSizes.small,
    lineHeight: 19,
    color: paperColors.pageInkMuted,
  },
});
