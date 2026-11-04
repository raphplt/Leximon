import { newsToShow } from "@leximon/view-model";
import { router } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { useEffect, useMemo, useState } from "react";
import { Modal, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { usePlayerView } from "@/player/use-player-view";
import { alpha, colors, fontSizes, fonts, paperColors, space } from "@/theme";
import { Button } from "@/ui/button";
import { TextButton } from "@/ui/text-button";
import { Leaf } from "@/ui/toy";
import { NewsEntries } from "./news-entries";

const STORAGE_KEY = "leximon_news_seen";

/** Storage can fail: then the news shows at each launch, which is harmless. */
function readSeen(): string | null {
  try {
    return SecureStore.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeSeen(date: string): void {
  SecureStore.setItemAsync(STORAGE_KEY, date).catch(() => {
    // Not remembered: the pop-up comes back next launch.
  });
}

/**
 * What changed since the player last looked, once per change and per device. A new player is
 * spared the news of the past.
 */
export function NewsHost() {
  const level = usePlayerView().progress?.level ?? null;
  const window = useWindowDimensions();
  const [seen, setSeen] = useState(readSeen);
  const news = useMemo(() => (level === null ? null : newsToShow(seen, level)), [seen, level]);

  useEffect(() => {
    if (news !== null && news.entries.length === 0 && news.seen !== null && news.seen !== seen) {
      writeSeen(news.seen);
    }
  }, [news, seen]);

  const close = () => {
    if (news?.seen == null) return;
    writeSeen(news.seen);
    setSeen(news.seen);
  };

  return (
    <Modal
      visible={news !== null && news.entries.length > 0}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={close}
    >
      <View style={styles.backdrop}>
        <Leaf style={[styles.leaf, { width: Math.min(420, window.width - 32) }]}>
          <ScrollView contentContainerStyle={styles.inner}>
            <Text style={styles.title} accessibilityRole="header">
              Nouveautés
            </Text>
            <NewsEntries entries={news?.entries ?? []} />
            <Button label="Retour au jeu" onPress={close} />
            <TextButton
              label="Toutes les nouveautés"
              onPress={() => {
                close();
                router.push("/nouveautes");
              }}
            />
          </ScrollView>
        </Leaf>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: space.s24,
    backgroundColor: alpha(colors.scrim, 0.82),
  },
  leaf: { maxHeight: "100%", backgroundColor: paperColors.paper },
  inner: { gap: space.s9, padding: 22 },
  title: {
    fontFamily: fonts.display,
    fontSize: fontSizes.titleLarge,
    lineHeight: 31,
    color: paperColors.pageInk,
  },
});
