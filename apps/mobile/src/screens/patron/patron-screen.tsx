import type { MonthCosmeticView, PatronResponse } from "@leximon/contract";
import {
  claimableLabel,
  PATRON_CLAIM,
  PATRON_CLAIM_BUSY,
  PATRON_CLAIMABLE_TITLE,
  PATRON_CLAIMED,
  PATRON_LOAD_FAILED,
  PATRON_MANAGED_ON_WEB,
  PATRON_MEMBER_TITLE,
  patronStatus,
} from "@leximon/view-model";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { api } from "@/api/client";
import { profile } from "@/player/state";
import { fontSizes, fonts, space } from "@/theme";
import { Button } from "@/ui/button";
import { useInk } from "@/ui/ink";
import { Page, Paragraph } from "@/ui/page";
import { Panel } from "@/ui/panel";
import { toast } from "@/ui/toast";

/**
 * The subscriber's page, read only: the stores forbid selling outside their payment, so nothing
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

  const status = patron === null ? null : patronStatus(patron, Date.now());
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
          {status !== null && (
            <Panel paper>
              <Text style={[styles.headline, { color: ink.pageInk }]} accessibilityRole="header">
                {status.headline}
              </Text>
              {status.lines.map((line) => (
                <Paragraph key={line}>{line}</Paragraph>
              ))}
              {status.warning !== null && (
                <Text style={[styles.warning, { color: ink.rubric }]}>{status.warning}</Text>
              )}
              <Paragraph muted>{PATRON_MANAGED_ON_WEB}</Paragraph>
            </Panel>
          )}
          {patron.claimable.length > 0 && <Claimable items={patron.claimable} onClaimed={load} />}
        </>
      )}
    </Page>
  );
}

function Claimable({
  items,
  onClaimed,
}: {
  readonly items: readonly MonthCosmeticView[];
  readonly onClaimed: () => Promise<void>;
}) {
  const ink = useInk();
  const [claiming, setClaiming] = useState<string | null>(null);

  const claim = async (month: string) => {
    setClaiming(month);
    try {
      const result = await api.claimPatronCosmetic(month);
      if (result.kind === "claimed") {
        toast(PATRON_CLAIMED);
        profile.refresh();
      }
      await onClaimed();
    } catch {
      toast(PATRON_LOAD_FAILED);
    } finally {
      setClaiming(null);
    }
  };

  return (
    <Panel paper>
      <Text style={[styles.headline, { color: ink.pageInk }]} accessibilityRole="header">
        {PATRON_CLAIMABLE_TITLE}
      </Text>
      {items.map((item) => (
        <View key={item.month} style={styles.claim}>
          <Text style={[styles.claimLabel, { color: ink.pageInk }]}>{claimableLabel(item)}</Text>
          <Button
            small
            label={claiming === item.month ? PATRON_CLAIM_BUSY : PATRON_CLAIM}
            disabled={claiming !== null}
            onPress={() => void claim(item.month)}
          />
        </View>
      ))}
    </Panel>
  );
}

const styles = StyleSheet.create({
  headline: { fontFamily: fonts.display, fontSize: fontSizes.titleSmall, lineHeight: 25 },
  warning: { fontFamily: fonts.ui.bold, fontSize: fontSizes.body, lineHeight: 21 },
  claim: { flexDirection: "row", alignItems: "center", gap: space.s6 },
  claimLabel: { flex: 1, fontFamily: fonts.ui.bold, fontSize: fontSizes.body, lineHeight: 21 },
});
