import type { ProfileClan, ProfileStats } from "@leximon/contract";
import { type Catalog, collectionName } from "@leximon/contract/client";
import { formatPlayerCode, memberSinceLabel, statTiles } from "@leximon/view-model";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Card } from "@/cards/card";
import { Emblem } from "@/clan/emblem";
import { openCard } from "@/screens/trades/card-row";
import { colors, fonts } from "@/theme";
import { Avatar } from "@/ui/avatar";
import { LevelMedal } from "@/ui/level";
import { Panel } from "@/ui/panel";

export interface ProfileFace {
  readonly avatar: string;
  readonly frame: string;
  readonly title: string | null;
  readonly level: number;
  /** `null` on a private profile: only the pseudo and the avatar show. */
  readonly code: string | null;
  readonly memberSince: string | null;
  readonly clan: ProfileClan | null;
}

/** Under the profile's name: avatar in its frame, title and level, clan, code. */
export function ProfileHeader({
  face,
  onClan,
}: {
  readonly face: ProfileFace;
  /** Where the clan's name leads: the player's own clan page, else nowhere. */
  readonly onClan?: () => void;
}) {
  const subline = [
    face.code === null ? null : `Code joueur ${formatPlayerCode(face.code)}`,
    face.memberSince === null ? null : memberSinceLabel(face.memberSince),
  ].filter((part) => part !== null);
  const clan =
    face.clan === null ? null : (
      <>
        <Emblem emblem={face.clan.emblem} size={26} level={face.clan.level} />
        <Text style={styles.clanName}>{face.clan.name}</Text>
      </>
    );
  return (
    <View style={styles.identity}>
      <Avatar avatar={face.avatar} frame={face.frame} size={92} label="Avatar" />
      <View style={styles.names}>
        {face.code !== null && (
          <View style={styles.headline}>
            <LevelMedal level={face.level} size={32} labelled />
            {face.title !== null && <Text style={styles.headlineText}>{face.title}</Text>}
          </View>
        )}
        {clan !== null &&
          (onClan === undefined ? (
            <View style={styles.clan}>{clan}</View>
          ) : (
            <Pressable onPress={onClan} accessibilityRole="link" style={styles.clan}>
              {clan}
            </Pressable>
          ))}
        {subline.length > 0 && <Text style={styles.subline}>{subline.join(" · ")}</Text>}
      </View>
    </View>
  );
}

const PIN_WIDTH = 116;

/** Someone's pinned cards, as others see them. */
export function PinnedCards({
  pinned,
  catalog,
}: {
  readonly pinned: readonly string[];
  readonly catalog: Catalog | null;
}) {
  return (
    <Panel>
      <Text style={styles.panelTitle}>Cartes épinglées</Text>
      {pinned.length === 0 ? (
        <Text style={styles.muted}>Vitrine vide.</Text>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.pins}
          style={styles.pinsScroll}
        >
          {pinned.map((cardId) => {
            const card = catalog?.cardsById.get(cardId);
            return (
              <Pressable
                key={cardId}
                onPress={() => openCard(cardId)}
                accessibilityRole="button"
                accessibilityLabel={`Ouvrir ${card?.word ?? "la carte"}`}
              >
                {card === undefined || catalog === null ? (
                  <View style={styles.placeholder} />
                ) : (
                  <Card
                    card={card}
                    collectionName={collectionName(catalog, card.collectionId)}
                    width={PIN_WIDTH}
                  />
                )}
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </Panel>
  );
}

/** The profile in figures. */
export function StatsPanel({
  stats,
  catalog,
}: {
  readonly stats: ProfileStats;
  readonly catalog: Catalog | null;
}) {
  const tiles = statTiles(stats, catalog === null ? null : catalog.cardsById.size);
  return (
    <Panel>
      <Text style={styles.panelTitle}>En chiffres</Text>
      <View style={styles.tiles}>
        {tiles.map((tile) => (
          <View key={tile.label} style={styles.tile}>
            <Text style={styles.tileValue}>{tile.value}</Text>
            <Text style={styles.tileLabel}>{tile.label}</Text>
          </View>
        ))}
      </View>
    </Panel>
  );
}

const styles = StyleSheet.create({
  identity: { flexDirection: "row", alignItems: "center", gap: 16, marginTop: -6 },
  names: { flex: 1, gap: 4 },
  headline: { flexDirection: "row", alignItems: "center", gap: 8 },
  headlineText: { fontFamily: fonts.ui.extrabold, fontSize: 16, color: colors.accent },
  clan: { flexDirection: "row", alignItems: "center", gap: 8 },
  clanName: { fontFamily: fonts.ui.bold, fontSize: 15, color: colors.text },
  subline: { fontFamily: fonts.ui.medium, fontSize: 13, lineHeight: 18, color: colors.textMuted },
  panelTitle: { fontFamily: fonts.display, fontSize: 22, color: colors.text },
  muted: { fontFamily: fonts.ui.medium, fontSize: 14, color: colors.textMuted },
  pinsScroll: { marginHorizontal: -18 },
  pins: { gap: 14, paddingHorizontal: 18, paddingTop: 4 },
  placeholder: {
    width: PIN_WIDTH,
    height: PIN_WIDTH * 1.4,
    borderRadius: 10,
    backgroundColor: colors.backgroundRaised,
  },
  tiles: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  tile: {
    flexGrow: 1,
    flexBasis: "45%",
    gap: 2,
    padding: 12,
    borderRadius: 14,
    backgroundColor: colors.background,
  },
  tileValue: { fontFamily: fonts.display, fontSize: 24, color: colors.text },
  tileLabel: { fontFamily: fonts.ui.semibold, fontSize: 13, color: colors.textMuted },
});
