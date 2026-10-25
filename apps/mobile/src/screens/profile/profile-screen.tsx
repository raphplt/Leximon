import type { ProfileResponse } from "@leximon/contract";
import { type Catalog, collectionName } from "@leximon/contract/client";
import type { IconName } from "@leximon/tokens";
import {
  canShareProfile,
  formatPlayerCode,
  memberSinceLabel,
  movePin,
  PIN_TEXTS,
  pinnedSlotsLabel,
  placePin,
  playerName,
  profileHeadline,
  profilePath,
  replaceTitle,
  statTiles,
  unpin,
  visibilityNote,
} from "@leximon/view-model";
import { type Href, router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { Card } from "@/cards/card";
import { catalogInHand, loadCatalog } from "@/cards/catalog";
import { Emblem } from "@/clan/emblem";
import { WEB_URL } from "@/config";
import { useShared, useSharedFailed } from "@/player/shared";
import { profile } from "@/player/state";
import { useProfileActions } from "@/profile/profile-actions";
import { openCard } from "@/screens/trades/card-row";
import { colors, fonts } from "@/theme";
import { Avatar } from "@/ui/avatar";
import { Button } from "@/ui/button";
import { Icon } from "@/ui/icon";
import { Page, Paragraph } from "@/ui/page";
import { Panel } from "@/ui/panel";
import { PinPicker } from "./pin-picker";
import { PseudoSheet } from "./pseudo-sheet";

const PIN_WIDTH = 116;

const LINKS: readonly { readonly label: string; readonly icon: IconName; readonly href: Href }[] = [
  { label: "Amis", icon: "amis", href: "/amis" },
  { label: "Chemin des niveaux", icon: "star", href: "/niveaux" },
  { label: "Mon compte", icon: "cle", href: "/compte" },
];

/** The player's own profile, also before others can see it, and the doors to the rest. */
export function ProfileScreen() {
  const me = useShared(profile);
  const failed = useSharedFailed(profile);
  const [choosing, setChoosing] = useState(false);
  const [catalog, setCatalog] = useState<Catalog | null>(catalogInHand);

  useEffect(() => {
    loadCatalog().then(setCatalog, () => undefined);
  }, []);

  if (me === null) {
    return (
      <Page title="Profil">
        {failed ? (
          <>
            <Paragraph muted>Ton profil ne se charge pas.</Paragraph>
            <Button label="Réessayer" secondary onPress={() => profile.refresh()} />
          </>
        ) : (
          <Paragraph muted>Un instant…</Paragraph>
        )}
      </Page>
    );
  }

  const name = me.member ? playerName({ code: me.playerCode, pseudo: me.pseudo }) : "Invité";
  const note = visibilityNote(me);
  const subline = [
    `Code joueur ${formatPlayerCode(me.playerCode)}`,
    me.member ? memberSinceLabel(me.memberSince) : null,
  ].filter((part) => part !== null);

  const share = () => {
    if (me.pseudo === null) return;
    const url = `${WEB_URL}${profilePath(me.pseudo)}`;
    Share.share({ message: url, url, title: `${me.pseudo} sur Leximon` }).catch(() => undefined);
  };

  return (
    <Page title={name}>
      <View style={styles.identity}>
        <Avatar avatar={me.avatar} frame={me.frame} size={92} label="Avatar" />
        <View style={styles.names}>
          <Text style={styles.headline}>{profileHeadline(me.title, me.level)}</Text>
          {me.clan !== null && (
            <Pressable
              onPress={() => router.dismissTo("/clan")}
              accessibilityRole="link"
              style={styles.clan}
            >
              <Emblem emblem={me.clan.emblem} size={26} level={me.clan.level} />
              <Text style={styles.clanName}>{me.clan.name}</Text>
            </Pressable>
          )}
          <Text style={styles.subline}>{subline.join(" · ")}</Text>
        </View>
      </View>

      <View style={styles.actions}>
        <View style={styles.grow}>
          <Button label="Atelier" secondary onPress={() => router.push("/atelier")} />
        </View>
        {canShareProfile(me) && (
          <View style={styles.grow}>
            <Button label="Partager" secondary onPress={share} />
          </View>
        )}
      </View>

      {note !== null && (
        <Panel>
          <Text style={styles.note}>{note}</Text>
          {!me.member && <Button label="Créer mon compte" onPress={() => router.push("/compte")} />}
          {me.member && me.pseudo === null && (
            <Button label="Choisir mon pseudo" onPress={() => setChoosing(true)} />
          )}
        </Panel>
      )}

      {me.member ? (
        <PinnedCards me={me} catalog={catalog} />
      ) : (
        <Panel>
          <Text style={styles.note}>Avec un compte, tu épingles tes plus belles cartes ici.</Text>
        </Panel>
      )}

      <Stats me={me} catalog={catalog} />

      <Panel style={styles.links}>
        {LINKS.map((link) => (
          <Pressable
            key={link.label}
            onPress={() => router.push(link.href)}
            accessibilityRole="link"
            style={({ pressed }) => [styles.link, pressed && styles.pressed]}
          >
            <Icon name={link.icon} size={20} color={colors.text} />
            <Text style={styles.linkText}>{link.label}</Text>
            <Icon name="chev" size={16} color={colors.textMuted} />
          </Pressable>
        ))}
        {me.member && me.pseudo !== null && (
          <Pressable
            onPress={() => setChoosing(true)}
            accessibilityRole="button"
            style={({ pressed }) => [styles.link, pressed && styles.pressed]}
          >
            <Icon name="plume" size={20} color={colors.text} />
            <Text style={styles.linkText}>Changer de pseudo</Text>
            <Icon name="chev" size={16} color={colors.textMuted} />
          </Pressable>
        )}
      </Panel>

      <PseudoSheet open={choosing} onClose={() => setChoosing(false)} />
    </Page>
  );
}

/**
 * The pinned cards, arranged in place: an empty place opens the picker, each card moves earlier
 * or later, changes for another or leaves. A touch on the card opens its sheet.
 */
function PinnedCards({
  me,
  catalog,
}: {
  readonly me: ProfileResponse;
  readonly catalog: Catalog | null;
}) {
  const actions = useProfileActions();
  /** The place being filled: an index replaces its card, `null` takes a free place. */
  const [picking, setPicking] = useState<{ readonly at: number | null } | null>(null);
  const { pinned, pinnedSlots: slots } = me;
  const empty = Math.max(0, slots - pinned.length);
  const wordOf = (cardId: string | undefined) =>
    (cardId === undefined ? undefined : catalog?.cardsById.get(cardId)?.word) ?? "cette carte";

  const place = (cardId: string) => {
    const at = picking?.at ?? null;
    setPicking(null);
    const change = placePin(pinned, slots, cardId, at);
    if (change.ok) {
      void actions.setPins(change.cardIds, at === null ? PIN_TEXTS.pinned : PIN_TEXTS.replaced);
    }
  };

  return (
    <Panel>
      <View style={styles.panelHead}>
        <Text style={styles.panelTitle}>Cartes épinglées</Text>
        <Text style={styles.meta}>{pinnedSlotsLabel(slots)}</Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.pins}
        style={styles.pinsScroll}
      >
        {pinned.map((cardId, index) => {
          const card = catalog?.cardsById.get(cardId);
          const word = wordOf(cardId);
          return (
            <View key={cardId} style={styles.pin}>
              <Pressable
                onPress={() => openCard(cardId)}
                accessibilityRole="button"
                accessibilityLabel={`Ouvrir ${word}`}
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
              <Pressable
                style={styles.remove}
                onPress={() => void actions.setPins(unpin(pinned, cardId), PIN_TEXTS.removed)}
                accessibilityRole="button"
                accessibilityLabel={`${PIN_TEXTS.remove} ${word}`}
                hitSlop={6}
              >
                <Icon name="close" size={14} color={colors.text} />
              </Pressable>
              <View style={styles.tools}>
                <Pressable
                  style={[styles.tool, index === 0 && styles.toolOff]}
                  disabled={index === 0}
                  onPress={() => void actions.setPins(movePin(pinned, index, -1), null)}
                  accessibilityRole="button"
                  accessibilityLabel={`${PIN_TEXTS.earlier} ${word}`}
                >
                  <Icon name="back" size={16} color={colors.text} />
                </Pressable>
                <Pressable
                  style={styles.toolText}
                  onPress={() => setPicking({ at: index })}
                  accessibilityRole="button"
                  accessibilityLabel={`${PIN_TEXTS.change} ${word}`}
                >
                  <Text style={styles.toolLabel}>{PIN_TEXTS.change}</Text>
                </Pressable>
                <Pressable
                  style={[styles.tool, index === pinned.length - 1 && styles.toolOff]}
                  disabled={index === pinned.length - 1}
                  onPress={() => void actions.setPins(movePin(pinned, index, 1), null)}
                  accessibilityRole="button"
                  accessibilityLabel={`${PIN_TEXTS.later} ${word}`}
                >
                  <Icon name="chev" size={16} color={colors.text} />
                </Pressable>
              </View>
            </View>
          );
        })}
        {Array.from({ length: empty }, (_, index) => (
          <Pressable
            // biome-ignore lint/suspicious/noArrayIndexKey: empty places have no identity
            key={`empty-${index}`}
            style={styles.emptySlot}
            onPress={() => setPicking({ at: null })}
            accessibilityRole="button"
          >
            <Icon name="plus" size={24} color={colors.textMuted} />
            <Text style={styles.emptyText}>{PIN_TEXTS.emptySlot}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <PinPicker
        open={picking !== null}
        title={
          picking === null || picking.at === null
            ? PIN_TEXTS.pickerTitle
            : replaceTitle(wordOf(pinned[picking.at]))
        }
        catalog={catalog}
        pinned={pinned}
        onPick={place}
        onClose={() => setPicking(null)}
      />
    </Panel>
  );
}

/** The profile in figures. */
function Stats({
  me,
  catalog,
}: {
  readonly me: ProfileResponse;
  readonly catalog: Catalog | null;
}) {
  const tiles = statTiles(me.stats, catalog === null ? null : catalog.cardsById.size);
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
  headline: { fontFamily: fonts.ui.extrabold, fontSize: 16, color: colors.accent },
  clan: { flexDirection: "row", alignItems: "center", gap: 8 },
  clanName: { fontFamily: fonts.ui.bold, fontSize: 15, color: colors.text },
  subline: { fontFamily: fonts.ui.medium, fontSize: 13, lineHeight: 18, color: colors.textMuted },
  actions: { flexDirection: "row", gap: 10 },
  grow: { flex: 1 },
  note: { fontFamily: fonts.text.regular, fontSize: 17, lineHeight: 24, color: colors.text },
  panelHead: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
  panelTitle: { fontFamily: fonts.display, fontSize: 22, color: colors.text },
  meta: { fontFamily: fonts.ui.semibold, fontSize: 13, color: colors.textMuted },
  pinsScroll: { marginHorizontal: -18 },
  pins: { gap: 14, paddingHorizontal: 18, paddingTop: 8 },
  pin: { width: PIN_WIDTH, gap: 8 },
  placeholder: {
    width: PIN_WIDTH,
    height: PIN_WIDTH * 1.4,
    borderRadius: 10,
    backgroundColor: colors.backgroundRaised,
  },
  remove: {
    position: "absolute",
    top: -8,
    right: -8,
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.sheet,
    backgroundColor: colors.backgroundRaised,
    alignItems: "center",
    justifyContent: "center",
  },
  tools: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  tool: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.backgroundRaised,
    alignItems: "center",
    justifyContent: "center",
  },
  toolOff: { opacity: 0.35 },
  toolText: { paddingHorizontal: 6, paddingVertical: 6 },
  toolLabel: { fontFamily: fonts.ui.extrabold, fontSize: 13, color: colors.text },
  emptySlot: {
    width: PIN_WIDTH,
    height: PIN_WIDTH * 1.4,
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: colors.outline,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    padding: 8,
  },
  emptyText: {
    fontFamily: fonts.ui.bold,
    fontSize: 13,
    color: colors.textMuted,
    textAlign: "center",
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
  links: { gap: 0, paddingVertical: 6 },
  link: { flexDirection: "row", alignItems: "center", gap: 14, minHeight: 52 },
  linkText: { flex: 1, fontFamily: fonts.ui.bold, fontSize: 16, color: colors.text },
  pressed: { opacity: 0.6 },
});
