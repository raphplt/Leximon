import type { ProfileResponse } from "@leximon/contract";
import { type Catalog, collectionName } from "@leximon/contract/client";
import type { IconName } from "@leximon/tokens";
import {
  canShareProfile,
  movePin,
  PIN_TEXTS,
  pinnedSlotsLabel,
  placePin,
  playerName,
  profilePath,
  replaceTitle,
  unpin,
  visibilityNote,
} from "@leximon/view-model";
import { type Href, router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { Card } from "@/cards/card";
import { catalogInHand, loadCatalog } from "@/cards/catalog";
import { WEB_URL } from "@/config";
import { useShared, useSharedFailed } from "@/player/shared";
import { profile } from "@/player/state";
import { useProfileActions } from "@/profile/profile-actions";
import { openCard } from "@/screens/trades/card-row";
import { fontSizes, fonts, paperColors, radii, space } from "@/theme";
import { Button } from "@/ui/button";
import { Icon } from "@/ui/icon";
import { Page, Paragraph } from "@/ui/page";
import { Panel } from "@/ui/panel";
import { TextButton } from "@/ui/text-button";
import { FeedbackSheet } from "./feedback-sheet";
import { PinPicker } from "./pin-picker";
import { ProfileHeader, StatsPanel } from "./profile-view";
import { PseudoSheet } from "./pseudo-sheet";

const PIN_WIDTH = 116;

const LINKS: readonly { readonly label: string; readonly icon: IconName; readonly href: Href }[] = [
  { label: "Niveaux", icon: "star", href: "/niveaux" },
  { label: "Réglages", icon: "reglages", href: "/reglages" },
  { label: "Mon compte", icon: "cle", href: "/compte" },
];

/** The player's own profile, also before others can see it, and the doors to the rest. */
export function ProfileScreen() {
  const me = useShared(profile);
  const failed = useSharedFailed(profile);
  const [choosing, setChoosing] = useState(false);
  const [feedback, setFeedback] = useState(false);
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

  const share = () => {
    if (me.pseudo === null) return;
    const url = `${WEB_URL}${profilePath(me.pseudo)}`;
    Share.share({ message: url, url, title: `${me.pseudo} sur Leximon` }).catch(() => undefined);
  };

  return (
    <Page title={name}>
      <ProfileHeader
        face={{
          avatar: me.avatar,
          frame: me.frame,
          title: me.title,
          level: me.level,
          code: me.playerCode,
          memberSince: me.member ? me.memberSince : null,
          clan: me.clan,
        }}
        onClan={() => router.dismissTo("/clan")}
      />

      <View style={styles.actions}>
        <View style={styles.grow}>
          <Button label="Apparence" secondary onPress={() => router.push("/atelier")} />
        </View>
        {canShareProfile(me) && (
          <View style={styles.grow}>
            <Button label="Partager" secondary onPress={share} />
          </View>
        )}
      </View>

      {note !== null && (
        <Panel paper>
          <Text style={styles.note}>{note}</Text>
          {!me.member && (
            <>
              <Button label="Créer mon compte" onPress={() => router.push("/compte")} />
              <TextButton label="Me connecter" onPress={() => router.push("/compte")} />
            </>
          )}
          {me.member && me.pseudo === null && (
            <Button label="Choisir mon pseudo" onPress={() => setChoosing(true)} />
          )}
        </Panel>
      )}

      {me.member ? (
        <PinnedCards me={me} catalog={catalog} />
      ) : (
        <Panel paper>
          <Text style={styles.note}>
            Avec un compte, tu peux épingler tes plus belles cartes ici.
          </Text>
        </Panel>
      )}

      <StatsPanel stats={me.stats} catalog={catalog} />

      <Panel paper style={styles.links}>
        {LINKS.map((link) => (
          <Pressable
            key={link.label}
            onPress={() => router.push(link.href)}
            accessibilityRole="link"
            style={({ pressed }) => [styles.link, pressed && styles.pressed]}
          >
            <Icon name={link.icon} size={20} color={ink.pageInk} />
            <Text style={styles.linkText}>{link.label}</Text>
            <Icon name="chev" size={16} color={ink.pageInkMuted} />
          </Pressable>
        ))}
        {me.member && me.pseudo !== null && (
          <Pressable
            onPress={() => setChoosing(true)}
            accessibilityRole="button"
            style={({ pressed }) => [styles.link, pressed && styles.pressed]}
          >
            <Icon name="plume" size={20} color={ink.pageInk} />
            <Text style={styles.linkText}>Changer de pseudo</Text>
            <Icon name="chev" size={16} color={ink.pageInkMuted} />
          </Pressable>
        )}
        <Pressable
          onPress={() => setFeedback(true)}
          accessibilityRole="button"
          style={({ pressed }) => [styles.link, pressed && styles.pressed]}
        >
          <Icon name="send" size={20} color={ink.pageInk} />
          <Text style={styles.linkText}>Écrire à l'équipe</Text>
          <Icon name="chev" size={16} color={ink.pageInkMuted} />
        </Pressable>
      </Panel>

      <PseudoSheet open={choosing} onClose={() => setChoosing(false)} />
      <FeedbackSheet open={feedback} onClose={() => setFeedback(false)} />
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
    <Panel paper>
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
                onPress={() => openCard(cardId, pinned)}
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
                <Icon name="close" size={14} color={ink.pageInk} />
              </Pressable>
              <View style={styles.tools}>
                <Pressable
                  style={[styles.tool, index === 0 && styles.toolOff]}
                  disabled={index === 0}
                  onPress={() => void actions.setPins(movePin(pinned, index, -1), null)}
                  accessibilityRole="button"
                  accessibilityLabel={`${PIN_TEXTS.earlier} ${word}`}
                >
                  <Icon name="back" size={16} color={ink.pageInk} />
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
                  <Icon name="chev" size={16} color={ink.pageInk} />
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
            <Icon name="plus" size={24} color={ink.pageInkMuted} />
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

/** The profile's blocks lie on paper in « La Bibliothèque ». */
const ink = paperColors;

const styles = StyleSheet.create({
  actions: { flexDirection: "row", gap: space.s5 },
  grow: { flex: 1 },
  note: {
    fontFamily: fonts.text.regular,
    fontSize: fontSizes.lead,
    lineHeight: 24,
    color: ink.pageInk,
  },
  panelHead: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
  panelTitle: { fontFamily: fonts.display, fontSize: fontSizes.title, color: ink.pageInk },
  meta: { fontFamily: fonts.ui.semibold, fontSize: fontSizes.small, color: ink.pageInkMuted },
  pinsScroll: { marginHorizontal: -18 },
  pins: { gap: space.s7, paddingHorizontal: space.s9, paddingTop: space.s4 },
  pin: { width: PIN_WIDTH, gap: space.s4 },
  placeholder: {
    width: PIN_WIDTH,
    height: PIN_WIDTH * 1.4,
    borderRadius: radii.md,
    backgroundColor: ink.pageRaised,
  },
  remove: {
    position: "absolute",
    top: -8,
    right: -8,
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: ink.sheet,
    backgroundColor: ink.pageRaised,
    alignItems: "center",
    justifyContent: "center",
  },
  tools: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  tool: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: ink.pageRaised,
    alignItems: "center",
    justifyContent: "center",
  },
  toolOff: { opacity: 0.35 },
  toolText: { paddingHorizontal: space.s3, paddingVertical: space.s3 },
  toolLabel: { fontFamily: fonts.ui.extrabold, fontSize: fontSizes.small, color: ink.pageInk },
  emptySlot: {
    width: PIN_WIDTH,
    height: PIN_WIDTH * 1.4,
    borderRadius: radii.lg,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: ink.rule,
    alignItems: "center",
    justifyContent: "center",
    gap: space.s3,
    padding: space.s4,
  },
  emptyText: {
    fontFamily: fonts.ui.bold,
    fontSize: fontSizes.small,
    color: ink.pageInkMuted,
    textAlign: "center",
  },
  links: { gap: 0, paddingVertical: space.s3 },
  link: { flexDirection: "row", alignItems: "center", gap: space.s7, minHeight: 52 },
  linkText: {
    flex: 1,
    fontFamily: fonts.ui.bold,
    fontSize: fontSizes.bodyLarge,
    color: ink.pageInk,
  },
  pressed: { opacity: 0.6 },
});
