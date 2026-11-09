import type { PatronThanksResponse } from "@leximon/contract";
import {
  THANKS_EMPTY,
  THANKS_FAILED,
  THANKS_PAGE_INTRO,
  THANKS_PAGE_TITLE,
  thanksGroups,
} from "@leximon/view-model";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { api } from "@/api/client";
import { fontSizes, fonts, paperColors, space } from "@/theme";
import { Button } from "@/ui/button";
import { useInk } from "@/ui/ink";
import { Page, Paragraph } from "@/ui/page";
import { Panel } from "@/ui/panel";
import { PatronBadge } from "@/ui/patron-badge";
import { Leaf } from "@/ui/toy";

/** The page of thanks: the patrons named, founders first, each leading to their profile. */
export function PatronsScreen() {
  const ink = useInk();
  const [thanks, setThanks] = useState<PatronThanksResponse | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    setFailed(false);
    api
      .fetchPatronThanks()
      .then(setThanks)
      .catch(() => setFailed(true));
  }, []);
  useEffect(load, [load]);

  const groups = thanks === null ? [] : thanksGroups(thanks.patrons);
  return (
    <Page title={THANKS_PAGE_TITLE}>
      <Text style={[styles.intro, { color: ink.pageInk }]}>{THANKS_PAGE_INTRO}</Text>
      {failed ? (
        <Panel paper>
          <Paragraph>{THANKS_FAILED}</Paragraph>
          <Button label="Réessayer" secondary onPress={load} />
        </Panel>
      ) : thanks === null ? (
        <ActivityIndicator color={ink.pageInkMuted} />
      ) : groups.length === 0 ? (
        <Panel paper>
          <Paragraph>{THANKS_EMPTY}</Paragraph>
        </Panel>
      ) : (
        groups.map((group) => (
          <Leaf key={group.title} style={styles.group}>
            <View style={styles.heading}>
              <Text style={styles.title} accessibilityRole="header">
                {group.title}
              </Text>
              <PatronBadge mark={group.founder ? "founder" : "patron"} compact />
            </View>
            <View style={styles.names}>
              {group.pseudos.map((pseudo) => (
                <Text
                  key={pseudo}
                  style={styles.name}
                  accessibilityRole="link"
                  onPress={() => router.push({ pathname: "/joueur/[pseudo]", params: { pseudo } })}
                >
                  {pseudo}
                </Text>
              ))}
            </View>
          </Leaf>
        ))
      )}
    </Page>
  );
}

const styles = StyleSheet.create({
  intro: { fontFamily: fonts.ui.semibold, fontSize: fontSizes.body, lineHeight: 22 },
  group: { gap: space.s5, padding: space.s8 },
  heading: { flexDirection: "row", alignItems: "center", gap: space.s4 },
  title: {
    fontFamily: fonts.ui.extrabold,
    fontSize: fontSizes.subtitle,
    color: paperColors.pageInk,
  },
  names: { flexDirection: "row", flexWrap: "wrap", columnGap: space.s10, rowGap: space.s4 },
  name: { fontFamily: fonts.ui.bold, fontSize: fontSizes.bodyLarge, color: paperColors.pageInk },
});
