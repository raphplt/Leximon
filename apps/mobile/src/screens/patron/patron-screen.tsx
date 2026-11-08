import type { MonthCosmeticView, PatronResponse } from "@leximon/contract";
import { mixHex, toyMatters, toy as toyValues } from "@leximon/tokens";
import {
  claimableLabel,
  PATRON_CARD_KICKER,
  PATRON_CLAIM,
  PATRON_CLAIM_BUSY,
  PATRON_CLAIMABLE_TITLE,
  PATRON_CLAIMED,
  PATRON_LOAD_FAILED,
  PATRON_MANAGED_ON_WEB,
  PATRON_MEMBER_TITLE,
  patronStatus,
  playerName,
} from "@leximon/view-model";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { api } from "@/api/client";
import { useShared } from "@/player/shared";
import { profile } from "@/player/state";
import { colors, fontSizes, fonts, paperColors, space } from "@/theme";
import { Avatar } from "@/ui/avatar";
import { Button } from "@/ui/button";
import { Icon } from "@/ui/icon";
import { useInk } from "@/ui/ink";
import { Page, Paragraph } from "@/ui/page";
import { Panel } from "@/ui/panel";
import { PatronBadge } from "@/ui/patron-badge";
import { toast } from "@/ui/toast";
import { Kicker, Leaf, Lettering, Lettrine, Toy, ToyBody } from "@/ui/toy";

const AVATAR = 92;

/**
 * The subscriber's card, read only: the stores forbid selling outside their payment, so nothing
 * here buys, links to the web or shows a price.
 */
export function PatronScreen() {
  const ink = useInk();
  const [patron, setPatron] = useState<PatronResponse | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setFailed(false);
    try {
      setPatron(await api.fetchPatron());
    } catch {
      setFailed(true);
    }
  }, []);
  useEffect(() => void load(), [load]);

  return (
    <Page title={PATRON_MEMBER_TITLE}>
      {patron === null ? (
        failed ? (
          <Panel paper>
            <Paragraph>{PATRON_LOAD_FAILED}</Paragraph>
            <Button label="Réessayer" secondary onPress={() => void load()} />
          </Panel>
        ) : (
          <ActivityIndicator color={ink.pageInkMuted} />
        )
      ) : (
        <>
          <PatronCard patron={patron} />
          {patron.claimable.map((item) => (
            <ClaimTile key={item.month} item={item} onClaimed={load} />
          ))}
        </>
      )}
    </Page>
  );
}

function PatronCard({ patron }: { readonly patron: PatronResponse }) {
  const me = useShared(profile);
  const status = patronStatus(patron, Date.now());
  if (status === null) return null;
  return (
    <Leaf style={styles.card}>
      <View style={styles.cardHead}>
        <View style={styles.crowned}>
          <View style={styles.crown}>
            <Icon name="crown" size={30} color={toyMatters.gold.top} />
          </View>
          <Avatar avatar={me?.avatar ?? null} frame={me?.frame ?? null} size={AVATAR} />
        </View>
        <View style={styles.cardName}>
          <Kicker>{PATRON_CARD_KICKER}</Kicker>
          <Text style={styles.name} accessibilityRole="header">
            {me === null ? "" : playerName({ code: me.playerCode, pseudo: me.pseudo })}
          </Text>
          <PatronBadge mark={patron.mark ?? "patron"} />
        </View>
      </View>
      <Lettering size={fontSizes.title}>{status.headline}</Lettering>
      {status.lines.map((line) => (
        <Text key={line} style={styles.text}>
          {line}
        </Text>
      ))}
      {status.warning !== null && <Text style={styles.warning}>{status.warning}</Text>}
      <Text style={styles.muted}>{PATRON_MANAGED_ON_WEB}</Text>
    </Leaf>
  );
}

/** A month's cosmetic waiting for its patron, as a coffret to open. */
function ClaimTile({
  item,
  onClaimed,
}: {
  readonly item: MonthCosmeticView;
  readonly onClaimed: () => Promise<void>;
}) {
  const [claiming, setClaiming] = useState(false);

  const claim = async () => {
    setClaiming(true);
    try {
      const result = await api.claimPatronCosmetic(item.month);
      if (result.kind === "claimed") {
        toast(PATRON_CLAIMED);
        profile.refresh();
      }
      await onClaimed();
    } catch {
      toast(PATRON_LOAD_FAILED);
    } finally {
      setClaiming(false);
    }
  };

  return (
    <View style={styles.claim}>
      <View style={styles.claimRow}>
        <ToyBody matter="gold" shape="tile" style={styles.claimIcon}>
          <Lettrine icon="chest" matter="red" size={48} />
        </ToyBody>
        <View style={styles.claimText}>
          <Kicker>{PATRON_CLAIMABLE_TITLE}</Kicker>
          <Text style={styles.claimLabel}>{claimableLabel(item)}</Text>
        </View>
      </View>
      <Toy
        matter="gold"
        style={styles.claimButton}
        disabled={claiming}
        accessibilityRole="button"
        onPress={() => void claim()}
      >
        <Lettering size={fontSizes.subtitle}>
          {claiming ? PATRON_CLAIM_BUSY : PATRON_CLAIM}
        </Lettering>
      </Toy>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.s5, padding: space.s8 },
  cardHead: { flexDirection: "row", alignItems: "center", gap: space.s6 },
  // The crown sits on the frame, like the badge beside a patron's name.
  crowned: { alignItems: "center", paddingTop: 20 },
  crown: { position: "absolute", top: 0, zIndex: 1, transform: [{ rotate: "-8deg" }] },
  cardName: { flex: 1, alignItems: "flex-start", gap: space.s2 },
  name: {
    fontFamily: fonts.display,
    fontSize: fontSizes.title,
    lineHeight: 28,
    color: paperColors.pageInk,
  },
  text: {
    fontFamily: fonts.ui.semibold,
    fontSize: fontSizes.body,
    lineHeight: 22,
    color: paperColors.pageInk,
  },
  warning: {
    fontFamily: fonts.ui.bold,
    fontSize: fontSizes.body,
    lineHeight: 21,
    color: toyMatters.red.bottom,
  },
  muted: {
    fontFamily: fonts.ui.semibold,
    fontSize: fontSizes.small,
    lineHeight: 19,
    color: paperColors.pageInkMuted,
  },
  claim: {
    gap: space.s5,
    padding: space.s6,
    borderWidth: toyValues.outlineWidth,
    borderColor: toyValues.outline,
    borderRadius: 18,
    backgroundColor: mixHex(colors.paper, toyMatters.gold.top, 0.3),
    boxShadow: `0 4px 0 ${toyValues.outline}`,
  },
  claimRow: { flexDirection: "row", alignItems: "center", gap: space.s6 },
  claimIcon: { width: 60, height: 60, alignItems: "center", justifyContent: "center" },
  claimText: { flex: 1, gap: space.s2 },
  claimLabel: {
    fontFamily: fonts.ui.extrabold,
    fontSize: fontSizes.bodyLarge,
    lineHeight: 22,
    color: paperColors.pageInk,
  },
  claimButton: { height: 48 },
});
