import type {
  ProfileBanner as Banner,
  PatronMarkView,
  ProfileClan,
  ProfileJousts,
  ProfileStats,
} from "@leximon/contract";
import { type Catalog, collectionName } from "@leximon/contract/client";
import { alpha, lettering, toy as toyValues } from "@leximon/tokens";
import {
  capitalize,
  formatPlayerCode,
  leagueNumeral,
  memberSinceLabel,
  PROFILE_JOUSTS_TITLE,
  profileJoustTiles,
  statTiles,
} from "@leximon/view-model";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Card } from "@/cards/card";
import { Emblem } from "@/clan/emblem";
import { Shield } from "@/screens/jousts/league-pieces";
import { openCard } from "@/screens/trades/card-row";
import { colors, fontSizes, fonts, paperColors, radii, space } from "@/theme";
import { Avatar } from "@/ui/avatar";
import { Icon } from "@/ui/icon";
import { LevelMedal } from "@/ui/level";
import { Panel } from "@/ui/panel";
import { PatronBadge } from "@/ui/patron-badge";
import { ProfileBanner } from "@/ui/profile-banner";

export interface ProfileFace {
  readonly avatar: string;
  readonly frame: string;
  readonly title: string | null;
  readonly level: number;
  /** `null` on a private profile: only the pseudo and the avatar show. */
  readonly code: string | null;
  readonly memberSince: string | null;
  readonly clan: ProfileClan | null;
  readonly banner: Banner;
  readonly patron?: PatronMarkView;
}

/** Under the profile's name: the banner, avatar in its frame over it, title and level, clan, code. */
export function ProfileHeader({
  face,
  onClan,
}: {
  readonly face: ProfileFace;
  /** Where the clan's name leads. */
  readonly onClan?: () => void;
}) {
  const clan =
    face.clan === null ? null : (
      <>
        <Emblem emblem={face.clan.emblem} size={26} level={face.clan.level} />
        <Text style={styles.clanName}>{face.clan.name}</Text>
      </>
    );
  return (
    <View>
      <View>
        <ProfileBanner banner={face.banner} style={styles.cloth} />
        {face.memberSince !== null && (
          <View style={styles.since}>
            <Icon name="calendar" size={14} color={lettering.fill} />
            <Text style={styles.sinceText}>{capitalize(memberSinceLabel(face.memberSince))}</Text>
          </View>
        )}
      </View>
      <View style={styles.identity}>
        <Avatar avatar={face.avatar} frame={face.frame} size={92} label="Avatar" />
        <View style={styles.names}>
          {face.code !== null && (
            <View style={styles.headline}>
              <LevelMedal level={face.level} size={32} labelled />
              {face.title !== null && <Text style={styles.headlineText}>{face.title}</Text>}
            </View>
          )}
          {face.patron != null && <PatronBadge mark={face.patron} />}
          {clan !== null &&
            (onClan === undefined ? (
              <View style={styles.clan}>{clan}</View>
            ) : (
              <Pressable onPress={onClan} accessibilityRole="link" style={styles.clan}>
                {clan}
              </Pressable>
            ))}
          {face.code !== null && (
            <Text style={styles.subline}>Code joueur {formatPlayerCode(face.code)}</Text>
          )}
        </View>
      </View>
    </View>
  );
}

/** How far the avatar climbs onto the banner. */
const CLOTH_OVERLAP = 36;

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
    <Panel paper>
      <Text style={styles.panelTitle}>Cartes épinglées</Text>
      {pinned.length === 0 ? (
        <Text style={styles.muted}>Aucune carte épinglée.</Text>
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
                onPress={() => openCard(cardId, pinned)}
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

/** The ranked jousts: the league's shield and name, then the week and the jousts played. */
export function JoustsPanel({ jousts }: { readonly jousts: ProfileJousts }) {
  const { league, tiles } = profileJoustTiles(jousts);
  return (
    <Panel paper>
      <View style={styles.joustsHead}>
        <Shield league={jousts.league} numeral={leagueNumeral(jousts.league)} size={38} />
        <View>
          <Text style={styles.panelTitle}>{PROFILE_JOUSTS_TITLE}</Text>
          <Text style={styles.joustsLeague}>{league}</Text>
        </View>
      </View>
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
    <Panel paper>
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

/** The pinned cards and the figures lie on paper; the identity stays in the room. */
const ink = paperColors;

const styles = StyleSheet.create({
  cloth: {
    height: 72,
    overflow: "hidden",
    borderRadius: radii.lg,
    borderWidth: toyValues.outlineWidth,
    borderColor: toyValues.outline,
  },
  // In the cloth's top corner, away from the avatar, and as far from the edge as the avatar is.
  since: {
    position: "absolute",
    top: space.s6,
    right: space.s6,
    flexDirection: "row",
    alignItems: "center",
    gap: space.s2,
    paddingVertical: space.s1,
    paddingHorizontal: space.s4,
    borderRadius: radii.pill,
    backgroundColor: alpha(lettering.outline, 0.7),
  },
  sinceText: { fontFamily: fonts.ui.bold, fontSize: fontSizes.caption, color: lettering.fill },
  // The avatar sits astride the cloth's lower edge; the words start under it.
  identity: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space.s8,
    marginTop: -CLOTH_OVERLAP,
    paddingHorizontal: space.s6,
  },
  names: { flex: 1, gap: space.s2, paddingTop: CLOTH_OVERLAP + space.s3 },
  headline: { flexDirection: "row", alignItems: "center", gap: space.s4 },
  headlineText: {
    fontFamily: fonts.ui.extrabold,
    fontSize: fontSizes.bodyLarge,
    color: colors.rubric,
  },
  clan: { flexDirection: "row", alignItems: "center", gap: space.s4 },
  clanName: { fontFamily: fonts.ui.bold, fontSize: fontSizes.body, color: colors.pageInk },
  subline: {
    fontFamily: fonts.ui.medium,
    fontSize: fontSizes.small,
    lineHeight: 18,
    color: colors.pageInkMuted,
  },
  panelTitle: { fontFamily: fonts.display, fontSize: fontSizes.title, color: ink.pageInk },
  joustsHead: { flexDirection: "row", alignItems: "center", gap: space.s6 },
  joustsLeague: { fontFamily: fonts.ui.bold, fontSize: fontSizes.body, color: colors.rubric },
  muted: { fontFamily: fonts.ui.medium, fontSize: fontSizes.label, color: ink.pageInkMuted },
  pinsScroll: { marginHorizontal: -18 },
  pins: { gap: space.s7, paddingHorizontal: space.s9, paddingTop: space.s2 },
  placeholder: {
    width: PIN_WIDTH,
    height: PIN_WIDTH * 1.4,
    borderRadius: radii.md,
    backgroundColor: ink.pageRaised,
  },
  tiles: { flexDirection: "row", flexWrap: "wrap", gap: space.s5 },
  tile: {
    flexGrow: 1,
    flexBasis: "45%",
    gap: space.s1,
    padding: space.s6,
    borderRadius: radii.xl,
    backgroundColor: ink.well,
  },
  tileValue: { fontFamily: fonts.display, fontSize: fontSizes.titleLarge, color: ink.pageInk },
  tileLabel: {
    fontFamily: fonts.ui.semibold,
    fontSize: fontSizes.small,
    color: ink.pageInkMuted,
  },
});
