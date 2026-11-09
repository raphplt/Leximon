import type { CabinetArticle, CabinetCitation, CatalogCabinet } from "@leximon/contract";
import {
  CABINET_ETYMOLOGY_TITLE,
  CABINET_FAILED,
  CABINET_FAMILY_TITLE,
  CABINET_HISTORY_NOTE,
  CABINET_HISTORY_TITLE,
  CABINET_LITTRE_TITLE,
  CABINET_LOCKED,
  CABINET_LOCKED_ACTION,
  CABINET_MISSING,
  CABINET_SOURCES,
  CABINET_TITLE,
  CABINET_USAGE_NOTE,
  CABINET_USAGE_TITLE,
  type CabinetUsage,
  centuryLabel,
  citationSource,
  familyGroups,
  type UsagePoint,
  usageChart,
  usageLine,
  usagePointAt,
} from "@leximon/view-model";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Line, Path } from "react-native-svg";
import { useCabinet } from "@/cards/cabinet";
import { useShared } from "@/player/shared";
import { editions } from "@/player/state";
import { alpha, fontSizes, fonts, paperColors, space } from "@/theme";
import { Button } from "@/ui/button";
import { useInk } from "@/ui/ink";
import { Page, Paragraph } from "@/ui/page";
import { Panel } from "@/ui/panel";
import { Leaf } from "@/ui/toy";

/**
 * The cabinet of a word, for a paying patron: its use in books since 1800, its Littré article and
 * its family. The files are public; this screen is what a patron's subscription opens.
 */
export function CabinetScreen({ cardId }: { readonly cardId: string }) {
  const access = useShared(editions);
  const { state, retry } = useCabinet(cardId);
  const title = state.kind === "ready" ? state.cabinet.word : CABINET_TITLE;
  return (
    <Page {...(state.kind === "ready" ? { kicker: CABINET_TITLE } : {})} title={title}>
      {access === null ? null : !access.cabinet ? (
        <Panel paper>
          <Paragraph>{CABINET_LOCKED}</Paragraph>
          <Button label={CABINET_LOCKED_ACTION} secondary onPress={() => router.push("/mecene")} />
        </Panel>
      ) : state.kind === "failed" ? (
        <Panel paper>
          <Paragraph>{CABINET_FAILED}</Paragraph>
          <Button label="Réessayer" secondary onPress={retry} />
        </Panel>
      ) : state.kind === "missing" ? (
        <Panel paper>
          <Paragraph>{CABINET_MISSING}</Paragraph>
        </Panel>
      ) : state.kind === "ready" ? (
        <CabinetView cabinet={state.cabinet} />
      ) : null}
    </Page>
  );
}

function CabinetView({ cabinet }: { readonly cabinet: CatalogCabinet }) {
  const ink = useInk();
  const groups = familyGroups(cabinet.family);
  return (
    <>
      <Leaf style={styles.section}>
        <Text style={styles.heading}>{CABINET_USAGE_TITLE}</Text>
        <Text style={styles.lead}>{usageLine(cabinet.usage)}</Text>
        {cabinet.usage !== null && <UsageChart usage={cabinet.usage} />}
        <Text style={styles.note}>{CABINET_USAGE_NOTE}</Text>
      </Leaf>

      {cabinet.articles.length > 0 && (
        <Leaf style={styles.section}>
          <Text style={styles.heading}>{CABINET_LITTRE_TITLE}</Text>
          {cabinet.articles.map((article, index) => (
            // Homographs keep the Littré's order, which never changes within a file.
            // biome-ignore lint/suspicious/noArrayIndexKey: see above
            <Article key={index} word={cabinet.word} article={article} />
          ))}
        </Leaf>
      )}

      {groups.length > 0 && (
        <Leaf style={styles.section}>
          <Text style={styles.heading}>{CABINET_FAMILY_TITLE}</Text>
          {groups.map((group) => (
            <View key={group.relation} style={styles.familyRow}>
              <Text style={styles.familyLabel}>{group.label}</Text>
              <View style={styles.members}>
                {group.members.map((member) => (
                  <FamilyWord key={member.word} word={member.word} cardId={member.cardId} />
                ))}
              </View>
            </View>
          ))}
        </Leaf>
      )}

      <Text style={[styles.sources, { color: ink.pageInkMuted }]}>{CABINET_SOURCES}</Text>
    </>
  );
}

function FamilyWord({ word, cardId }: { readonly word: string; readonly cardId: string | null }) {
  if (cardId === null) return <Text style={styles.member}>{word}</Text>;
  return (
    <Text
      style={[styles.member, styles.memberLink]}
      accessibilityRole="link"
      onPress={() => router.push({ pathname: "/carte/[id]", params: { id: cardId } })}
    >
      {word}
    </Text>
  );
}

const PLOT_HEIGHT = 150;

/** The word's use, decade by decade. A touch reads the nearest decade; the peak keeps its mark. */
function UsageChart({ usage }: { readonly usage: CabinetUsage }) {
  const [width, setWidth] = useState(0);
  const [pointed, setPointed] = useState<UsagePoint | null>(null);
  const chart = width > 0 ? usageChart(usage, width, PLOT_HEIGHT) : null;
  const shown = chart === null ? null : (pointed ?? chart.peak);
  return (
    <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)} style={styles.chart}>
      {chart !== null && shown !== null && (
        <>
          <Text style={styles.readout} accessibilityLiveRegion="polite">
            <Text style={styles.readoutValue}>{shown.rate}</Text> {shown.decade}
          </Text>
          <Pressable
            accessibilityRole="image"
            accessibilityLabel={`Courbe d'usage, au plus haut dans les ${chart.peak.decade}`}
            onPressIn={(event) => setPointed(usagePointAt(chart, event.nativeEvent.locationX))}
          >
            <Svg width={width} height={PLOT_HEIGHT}>
              <Path d={chart.area} fill={alpha(paperColors.pageInk, 0.1)} />
              <Line
                x1={0}
                x2={width}
                y1={PLOT_HEIGHT}
                y2={PLOT_HEIGHT}
                stroke={paperColors.pageInkMuted}
                strokeWidth={1}
              />
              <Path
                d={chart.line}
                fill="none"
                stroke={paperColors.pageInk}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {pointed !== null && (
                <Line
                  x1={shown.x}
                  x2={shown.x}
                  y1={0}
                  y2={PLOT_HEIGHT}
                  stroke={paperColors.pageInkMuted}
                  strokeWidth={1}
                />
              )}
            </Svg>
            <View style={[styles.dot, { left: shown.x - 6, top: shown.y - 6 }]} />
          </Pressable>
          <View style={styles.ticks}>
            {chart.ticks.map((tick) => (
              <Text key={tick.label} style={[styles.tick, { left: tick.x - 20 }]}>
                {tick.label}
              </Text>
            ))}
          </View>
        </>
      )}
    </View>
  );
}

function Article({ word, article }: { readonly word: string; readonly article: CabinetArticle }) {
  return (
    <View style={styles.article}>
      <Text style={styles.entry}>
        <Text style={styles.headword}>{word.toUpperCase()}</Text>{" "}
        <Text style={styles.nature}>{article.nature}</Text>
      </Text>
      {article.senses.map((sense, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: senses keep the Littré's order
        <View key={index} style={styles.sense}>
          <Text style={styles.definition}>
            {sense.number !== null && <Text style={styles.number}>{sense.number}° </Text>}
            {sense.definition}
          </Text>
          <Citations citations={sense.citations} />
        </View>
      ))}
      {article.etymology !== null && (
        <>
          <Text style={styles.subheading}>{CABINET_ETYMOLOGY_TITLE.toUpperCase()}</Text>
          <Text style={styles.definition}>{article.etymology}</Text>
        </>
      )}
      {article.history.length > 0 && (
        <>
          <Text style={styles.subheading}>{CABINET_HISTORY_TITLE.toUpperCase()}</Text>
          <Text style={styles.note}>{CABINET_HISTORY_NOTE}</Text>
          {article.history.map((item) => (
            <View key={item.century} style={styles.sense}>
              <Text style={styles.century}>{centuryLabel(item.century)}</Text>
              <Citations citations={item.citations} />
            </View>
          ))}
        </>
      )}
    </View>
  );
}

function Citations({ citations }: { readonly citations: readonly CabinetCitation[] }) {
  if (citations.length === 0) return null;
  return (
    <View style={styles.citations}>
      {citations.map((citation) => {
        const source = citationSource(citation);
        return (
          <View key={citation.text}>
            <Text style={styles.quote}>« {citation.text} »</Text>
            {source !== "" && <Text style={styles.source}>{source}</Text>}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.s5, padding: space.s8 },
  heading: {
    fontFamily: fonts.display,
    fontSize: fontSizes.titleSmall,
    lineHeight: 26,
    color: paperColors.pageInk,
  },
  lead: {
    fontFamily: fonts.ui.semibold,
    fontSize: fontSizes.body,
    lineHeight: 22,
    color: paperColors.pageInk,
  },
  note: {
    fontFamily: fonts.ui.medium,
    fontSize: fontSizes.caption,
    lineHeight: 17,
    color: paperColors.pageInkMuted,
  },
  chart: { gap: space.s2 },
  readout: {
    fontFamily: fonts.ui.medium,
    fontSize: fontSizes.label,
    color: paperColors.pageInkMuted,
  },
  readoutValue: { fontFamily: fonts.ui.extrabold, color: paperColors.pageInk },
  dot: {
    position: "absolute",
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: paperColors.paper,
    backgroundColor: paperColors.pageInk,
  },
  ticks: { height: 18 },
  tick: {
    position: "absolute",
    width: 40,
    textAlign: "center",
    fontFamily: fonts.ui.bold,
    fontSize: fontSizes.caption,
    color: paperColors.pageInkMuted,
  },
  article: { gap: space.s4 },
  entry: {
    fontFamily: fonts.text.regular,
    fontSize: fontSizes.bodyLarge,
    color: paperColors.pageInk,
  },
  headword: { fontFamily: fonts.text.medium, letterSpacing: 1 },
  nature: { fontFamily: fonts.text.italic },
  sense: { gap: space.s2 },
  number: { fontFamily: fonts.ui.extrabold },
  definition: {
    fontFamily: fonts.text.regular,
    fontSize: fontSizes.body,
    lineHeight: 22,
    color: paperColors.pageInk,
  },
  subheading: {
    fontFamily: fonts.displayBold,
    marginTop: space.s4,
    fontSize: fontSizes.body,
    color: paperColors.pageInkMuted,
  },
  century: { fontFamily: fonts.ui.extrabold, fontSize: fontSizes.body, color: paperColors.pageInk },
  citations: {
    gap: space.s3,
    paddingLeft: space.s5,
    borderLeftWidth: 2,
    borderLeftColor: paperColors.rule,
  },
  quote: {
    fontFamily: fonts.text.italic,
    fontSize: fontSizes.body,
    lineHeight: 21,
    color: paperColors.pageInk,
  },
  source: {
    fontFamily: fonts.ui.semibold,
    fontSize: fontSizes.caption,
    color: paperColors.pageInkMuted,
  },
  familyRow: { gap: space.s2 },
  familyLabel: {
    fontFamily: fonts.ui.extrabold,
    fontSize: fontSizes.label,
    color: paperColors.pageInkMuted,
  },
  members: { flexDirection: "row", flexWrap: "wrap", columnGap: space.s7, rowGap: space.s3 },
  member: { fontFamily: fonts.ui.bold, fontSize: fontSizes.bodyLarge, color: paperColors.pageInk },
  memberLink: { textDecorationLine: "underline" },
  sources: { fontFamily: fonts.ui.medium, fontSize: fontSizes.caption, lineHeight: 17 },
});
