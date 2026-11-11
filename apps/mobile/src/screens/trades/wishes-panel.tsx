import type { WishesResponse, WishSeekersResponse } from "@leximon/contract";
import type { Catalog } from "@leximon/contract/client";
import {
  PROPOSE_TO_SEEKER,
  playerName,
  REMOVE_WISH,
  seekerLine,
  seekersNote,
  WISH_SEEKERS_TITLE,
  WISHES_TITLE,
  wishesNote,
} from "@leximon/view-model";
import { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { api } from "@/api/client";
import { fontSizes, fonts, paperColors, space } from "@/theme";
import { Avatar } from "@/ui/avatar";
import { Button } from "@/ui/button";
import { TitleRule } from "@/ui/ornaments";
import { OnPaper } from "@/ui/panel";
import { TextButton } from "@/ui/text-button";
import { CardRow, catalogCard } from "./card-row";

type Loaded =
  | { readonly state: "loading" }
  | { readonly state: "failed" }
  | {
      readonly state: "ready";
      readonly seekers: WishSeekersResponse;
      readonly wishes: WishesResponse;
    };

const WISH_THUMB = 72;

/** The players who look for the player's doubles, then the words the player looks for. */
export function WishesPanel({
  catalog,
  onPropose,
}: {
  readonly catalog: Catalog;
  readonly onPropose: (code: string) => void;
}) {
  const [loaded, setLoaded] = useState<Loaded>({ state: "loading" });
  const [removing, setRemoving] = useState<string | null>(null);
  const load = useCallback(() => {
    setLoaded({ state: "loading" });
    Promise.all([api.fetchWishSeekers(), api.fetchWishes()])
      .then(([seekers, wishes]) => setLoaded({ state: "ready", seekers, wishes }))
      .catch(() => setLoaded({ state: "failed" }));
  }, []);
  useEffect(load, [load]);

  if (loaded.state === "failed") {
    return (
      <OnPaper>
        <View style={styles.section}>
          <Text style={styles.note}>Impossible de charger tes souhaits.</Text>
          <Button label="Réessayer" secondary onPress={load} />
        </View>
      </OnPaper>
    );
  }
  if (loaded.state === "loading") return null;
  const { seekers, wishes } = loaded;

  const remove = async (cardId: string) => {
    setRemoving(cardId);
    try {
      await api.removeWish(cardId);
      setLoaded({
        ...loaded,
        wishes: { wishes: wishes.wishes.filter((wish) => wish.cardId !== cardId) },
      });
    } catch {
      // The word stays listed: the player may try again.
    } finally {
      setRemoving(null);
    }
  };

  return (
    <>
      <OnPaper>
        <View style={styles.section}>
          <View style={styles.titled}>
            <Text style={styles.title} accessibilityRole="header">
              {WISH_SEEKERS_TITLE}
            </Text>
            <TitleRule />
          </View>
          {seekers.players.map(({ player, cardIds }) => (
            <View key={player.code} style={styles.seeker}>
              <View style={styles.seekerHead}>
                <Avatar avatar={player.avatar} frame={player.frame} size={40} />
                <Text style={styles.seekerLine}>{seekerLine(player, cardIds)}</Text>
              </View>
              <CardRow catalog={catalog} cardIds={cardIds} width={WISH_THUMB} />
              <Button
                label={PROPOSE_TO_SEEKER}
                small
                accessibilityLabel={`${PROPOSE_TO_SEEKER} à ${playerName(player)}`}
                onPress={() => onPropose(player.code)}
              />
            </View>
          ))}
          <Text style={styles.note}>{seekersNote(seekers.players.length)}</Text>
        </View>
      </OnPaper>

      <OnPaper>
        <View style={styles.section}>
          <View style={styles.titled}>
            <Text style={styles.title} accessibilityRole="header">
              {WISHES_TITLE}
            </Text>
            <TitleRule />
          </View>
          {wishes.wishes.length > 0 && (
            <View style={styles.wishes}>
              {wishes.wishes.map((wish) => (
                <View key={wish.cardId} style={styles.wish}>
                  <CardRow catalog={catalog} cardIds={[wish.cardId]} width={WISH_THUMB} />
                  <TextButton
                    label={REMOVE_WISH}
                    disabled={removing === wish.cardId}
                    accessibilityLabel={`${REMOVE_WISH} ${catalogCard(catalog, wish.cardId).word}`}
                    onPress={() => void remove(wish.cardId)}
                  />
                </View>
              ))}
            </View>
          )}
          <Text style={styles.note}>{wishesNote(wishes.wishes.length)}</Text>
        </View>
      </OnPaper>
    </>
  );
}

const ink = paperColors;

const styles = StyleSheet.create({
  section: { gap: space.s6 },
  titled: { gap: space.s3 },
  title: { fontFamily: fonts.display, fontSize: fontSizes.title, color: ink.pageInk },
  seeker: { gap: space.s4 },
  seekerHead: { flexDirection: "row", alignItems: "center", gap: space.s5 },
  seekerLine: {
    flex: 1,
    fontFamily: fonts.ui.bold,
    fontSize: fontSizes.bodyLarge,
    lineHeight: 22,
    color: ink.pageInk,
  },
  wishes: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: space.s6 },
  wish: { alignItems: "center" },
  note: {
    fontFamily: fonts.ui.medium,
    fontSize: fontSizes.small,
    lineHeight: 19,
    color: ink.pageInkMuted,
  },
});
