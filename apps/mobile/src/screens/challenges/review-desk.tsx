import type {
  DailyChallengeResponse,
  LevelCounts,
  ReviewRequest,
  ReviewSummaryResponse,
  RiddleResponse,
} from "@leximon/contract";
import { type Catalog, collectionName } from "@leximon/contract/client";
import { PRACTICE_SCHEDULE, practiceRulesAt, UNLOCK_SCHEDULE, unlockRulesAt } from "@leximon/core";
import { room, type ToyMatterName, toyMatters, toy as toyValues } from "@leximon/tokens";
import {
  DESK_TEXTS,
  DIFFICULTY_OPTIONS,
  dailyView,
  FORMAT_PREFERENCE,
  formatOptions,
  isFeatureOpen,
  lengthOptions,
  memoryLine,
  memoryParts,
  PACK_NOUNS,
  paceOptions,
  practiceEmptyLine,
  REVIEW_DIFFICULTY_TITLE,
  REVIEW_FORMATS_TITLE,
  REVIEW_LENGTH_TITLE,
  REVIEW_PACE_TITLE,
  REVIEW_SETTINGS_TITLE,
  REVIEW_SOUND_LABEL,
  type ReviewCover,
  reviewAction,
  reviewLine,
  reviewShelf,
  reviewWells,
  riddleAction,
  riddleNature,
  riddleProgressLine,
  riddleSlots,
  shelfXpLine,
  streakLine,
} from "@leximon/view-model";
import { router, useFocusEffect } from "expo-router";
import { type ReactNode, useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInUp } from "react-native-reanimated";
import { api } from "@/api/client";
import { readPreference, writePreference } from "@/feedback/feedback";
import { CountBadge, MainAction } from "@/library/play-pieces";
import { dailyChallenge, reviewSummary } from "@/player/collection";
import { useShared } from "@/player/shared";
import { progress } from "@/player/state";
import { TAB_BAR_RISE } from "@/shell/tab-bar";
import { alpha, colors, fontSizes, fonts, paperColors, radii, space } from "@/theme";
import { Icon } from "@/ui/icon";
import { Panel } from "@/ui/panel";
import { Lettering, Toy, ToyBody, ToyIcon } from "@/ui/toy";

const NOUN = PACK_NOUNS.sachet;

/** Everything here is read on paper. */
const ink = paperColors;

/** Each leaf rises in turn when the screen appears, as on Jouer. */
function Rising({ index, children }: { readonly index: number; readonly children: ReactNode }) {
  return (
    <Animated.View entering={FadeInUp.delay(index * 70).duration(280)}>{children}</Animated.View>
  );
}

/**
 * The Défis screen at rest: the review on top, the daily challenge and the riddle, the shelf of
 * scopes to practise on, and the player's memory by level.
 */
export function ReviewDesk({
  catalog,
  now,
  busy,
  notice,
  error,
  onStart,
}: {
  readonly catalog: Catalog | null;
  readonly now: number;
  readonly busy: boolean;
  readonly notice: string | null;
  readonly error: string | null;
  readonly onStart: (request: ReviewRequest) => void;
}) {
  const summary = useShared(reviewSummary);
  const daily = useShared(dailyChallenge);
  const [riddle, setRiddle] = useState<RiddleResponse | null>(null);
  // Read again each time the screen is shown: a series or the riddle may have changed them.
  useFocusEffect(
    useCallback(() => {
      reviewSummary.refresh();
      dailyChallenge.refresh();
      api
        .fetchRiddle()
        .then(setRiddle)
        // The riddle is an extra: the rest of the screen works without it.
        .catch(() => setRiddle(null));
    }, []),
  );
  const rules = unlockRulesAt(UNLOCK_SCHEDULE, now);
  const canStart = !busy && summary !== null && !reviewAction(summary).disabled;
  return (
    <ScrollView contentContainerStyle={styles.page}>
      <View accessibilityRole="header">
        <Lettering size={fontSizes.heading}>Défis</Lettering>
      </View>
      <Rising index={0}>
        <Review summary={summary} now={now} busy={busy} onStart={onStart} />
      </Rising>
      {notice !== null && (
        <Text style={styles.notice} accessibilityLiveRegion="polite">
          {notice}
        </Text>
      )}
      {error !== null && (
        <Text style={styles.error} accessibilityRole="alert">
          {error}
        </Text>
      )}
      {daily !== null && (
        <Rising index={1}>
          <DailyLeaf
            daily={daily}
            onStart={
              canStart
                ? () =>
                    onStart({
                      length: practiceRulesAt(PRACTICE_SCHEDULE, now).dailyChallengeLength,
                    })
                : undefined
            }
          />
        </Rising>
      )}
      {riddle !== null && (
        <Rising index={2}>
          <RiddleLeaf riddle={riddle} />
        </Rising>
      )}
      {summary !== null && catalog !== null && (
        <Rising index={3}>
          <Shelf
            summary={summary}
            catalog={catalog}
            now={now}
            busy={busy}
            themesLevel={rules.levels.practice_choice}
            onStart={onStart}
          />
        </Rising>
      )}
      {summary !== null && (
        <Rising index={4}>
          <MemoryLeaf summary={summary} now={now} />
        </Rising>
      )}
    </ScrollView>
  );
}

/** Small capitals above a title, on paper. */
function PaperKicker({ children }: { readonly children: string }) {
  return <Text style={styles.kicker}>{children.toUpperCase()}</Text>;
}

/** The review: what waits, said in figures and in words, and the gold button. */
function Review({
  summary,
  now,
  busy,
  onStart,
}: {
  readonly summary: ReviewSummaryResponse | null;
  readonly now: number;
  readonly busy: boolean;
  readonly onStart: (request: ReviewRequest) => void;
}) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const action = summary === null ? null : reviewAction(summary);
  const disabled = busy || action === null || action.disabled;
  return (
    <Panel paper style={styles.review}>
      <View style={styles.reviewHead}>
        <PaperKicker>Ta révision</PaperKicker>
        <Text style={styles.title} accessibilityRole="header">
          Réviser tes mots
        </Text>
      </View>
      <View style={styles.wells}>
        {summary === null
          ? ["due", "fresh", "rising"].map((key) => (
              <View key={key} style={styles.well}>
                <Text style={[styles.wellFigure, styles.wellEmpty]}>–</Text>
              </View>
            ))
          : reviewWells(summary).map((well) => (
              <View key={well.key} style={styles.well} accessible>
                <Text
                  style={[
                    styles.wellFigure,
                    well.gilt && styles.wellGilt,
                    well.figure === 0 && styles.wellEmpty,
                  ]}
                >
                  {well.figure}
                </Text>
                <Text style={styles.wellLabel}>{well.label}</Text>
              </View>
            ))}
      </View>
      <Text style={styles.line}>{summary === null ? " " : reviewLine(summary, now, NOUN)}</Text>
      <View style={styles.go}>
        <MainAction
          label={action?.label ?? "Commencer"}
          count={action === null ? undefined : String(action.count)}
          disabled={disabled}
          onPress={() => onStart({})}
        />
        {action !== null && !action.disabled && (
          <Text style={styles.estimate}>{action.estimate}</Text>
        )}
      </View>
      {settingsOpen && summary !== null && <Settings summary={summary} />}
      <View style={styles.settings}>
        <Toy
          matter="paper"
          shape="round"
          style={styles.settingsToy}
          accessibilityRole="button"
          accessibilityLabel={REVIEW_SETTINGS_TITLE}
          accessibilityState={{ expanded: settingsOpen }}
          onPress={() => setSettingsOpen((open) => !open)}
        >
          <ToyIcon name="settings" size={26} />
        </Toy>
      </View>
    </Panel>
  );
}

type SettingsChange = Parameters<typeof api.updatePreferences>[0];

/**
 * Length of a series, pace of the new words, kinds of questions and difficulty, kept on the
 * account; the voice that says the word stays on this phone, like the other sounds.
 */
function Settings({ summary }: { readonly summary: ReviewSummaryResponse }) {
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const [speech, setSpeech] = useState(() => readPreference("speech"));
  const save = async (change: SettingsChange) => {
    setSaving(true);
    setFailed(false);
    try {
      await api.updatePreferences(change);
      reviewSummary.refresh();
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  };
  return (
    <View style={styles.sheet}>
      <Text style={styles.sheetTitle}>{REVIEW_LENGTH_TITLE.toUpperCase()}</Text>
      <View style={styles.options}>
        {lengthOptions(summary).map((option) => (
          <Option
            key={option.value}
            label={option.label}
            on={option.value === summary.settings.length}
            disabled={saving}
            onPress={() => void save({ reviewLength: option.value })}
          />
        ))}
      </View>
      <Text style={styles.sheetTitle}>{REVIEW_PACE_TITLE.toUpperCase()}</Text>
      <View style={styles.options}>
        {paceOptions(summary).map((option) => (
          <Option
            key={option.value}
            label={option.label}
            on={option.value === summary.settings.newWordsPerDay}
            disabled={saving}
            onPress={() => void save({ newWordsPerDay: option.value })}
          />
        ))}
      </View>
      <Text style={styles.sheetTitle}>{REVIEW_FORMATS_TITLE.toUpperCase()}</Text>
      <View style={styles.options}>
        {formatOptions(summary).map((option) => (
          <Option
            key={option.key}
            label={option.label}
            on={option.on}
            disabled={saving}
            onPress={() => void save({ [FORMAT_PREFERENCE[option.key]]: !option.on })}
          />
        ))}
        <Option
          label={REVIEW_SOUND_LABEL}
          on={speech}
          disabled={false}
          onPress={() => {
            writePreference("speech", !speech);
            setSpeech(!speech);
          }}
        />
      </View>
      <Text style={styles.sheetTitle}>{REVIEW_DIFFICULTY_TITLE.toUpperCase()}</Text>
      <View style={styles.options}>
        {DIFFICULTY_OPTIONS.map((option) => (
          <Option
            key={option.value}
            label={option.label}
            on={option.value === summary.settings.difficulty}
            disabled={saving}
            onPress={() => void save({ reviewDifficulty: option.value })}
          />
        ))}
      </View>
      {failed && (
        <Text style={styles.error} accessibilityRole="alert">
          Le serveur ne répond pas. Réessaie.
        </Text>
      )}
    </View>
  );
}

/** One choice of a setting: gold once picked. */
function Option({
  label,
  on,
  disabled,
  onPress,
}: {
  readonly label: string;
  readonly on: boolean;
  readonly disabled: boolean;
  readonly onPress: () => void;
}) {
  return (
    <Toy
      matter={on ? "gold" : "paper"}
      style={styles.optionToy}
      bodyStyle={styles.optionBody}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: on, disabled }}
      disabled={disabled}
      onPress={onPress}
    >
      <Text style={styles.optionToyText}>{label}</Text>
    </Toy>
  );
}

/** A small badge of leather at the head of a leaf. */
function LeafBadge({
  matter,
  children,
}: {
  readonly matter: ToyMatterName;
  readonly children: ReactNode;
}) {
  return (
    <ToyBody matter={matter} shape="tile" style={styles.badge}>
      {children}
    </ToyBody>
  );
}

function DoneMark() {
  return (
    <View style={styles.done} importantForAccessibility="no-hide-descendants">
      <Icon name="check" size={16} color={colors.inkOnColor} />
    </View>
  );
}

/** The daily challenge: `onStart` launches its series, and the leaf is a button until the goal is met. */
function DailyLeaf({
  daily,
  onStart,
}: {
  readonly daily: DailyChallengeResponse;
  readonly onStart: (() => void) | undefined;
}) {
  const view = dailyView(daily, NOUN);
  const label = `${DESK_TEXTS.daily}. ${view.title}. ${view.text}`;
  const content = (
    <Panel paper style={styles.leaf}>
      <View style={styles.leafHead}>
        <LeafBadge matter="red">
          <ToyIcon name="challenge" size={26} />
        </LeafBadge>
        <View style={styles.leafTitles}>
          <PaperKicker>{DESK_TEXTS.daily}</PaperKicker>
          <Text style={styles.leafTitle}>{view.title}</Text>
        </View>
        {view.done && <DoneMark />}
      </View>
      <View style={styles.pips} importantForAccessibility="no-hide-descendants">
        {view.bars.map((bar, at) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: one pip per question, in order
          <View key={at} style={[styles.pip, styles[bar]]} />
        ))}
      </View>
      <Text style={styles.leafText}>{view.text}</Text>
      {!view.done && onStart !== undefined && <Text style={styles.leafGo}>{view.action}</Text>}
    </Panel>
  );
  if (view.done || onStart === undefined) {
    return (
      <View accessible accessibilityLabel={label}>
        {content}
      </View>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onStart}
      style={({ pressed }) => pressed && styles.pressed}
    >
      {content}
    </Pressable>
  );
}

function RiddleLeaf({ riddle }: { readonly riddle: RiddleResponse }) {
  const started = riddle.step > 0 || riddle.outcome !== null;
  const slots = riddleSlots(riddle);
  const nature = riddleNature(riddle.partOfSpeech, riddle.letters);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${DESK_TEXTS.riddle}, n° ${riddle.number}. ${nature}.`}
      onPress={() => router.push("/enigme")}
      style={({ pressed }) => pressed && styles.pressed}
    >
      <Panel paper style={styles.leaf}>
        <View style={styles.leafHead}>
          <LeafBadge matter="gold">
            <Icon name="plume" size={22} color={toyValues.outline} />
          </LeafBadge>
          <View style={styles.leafTitles}>
            <PaperKicker>{`${DESK_TEXTS.riddle} · n° ${riddle.number}`}</PaperKicker>
            <Text style={styles.leafTitle}>{nature}</Text>
          </View>
          {riddle.outcome === "found" && <DoneMark />}
        </View>
        {/* The word in printing type: the letters uncovered on their blocks, the others hollow. */}
        <View style={styles.type} importantForAccessibility="no-hide-descendants">
          {slots.map((letter, at) => (
            <View
              // biome-ignore lint/suspicious/noArrayIndexKey: one block per letter, in order
              key={at}
              style={[styles.block, letter === null && styles.blockHollow]}
            >
              <Text style={styles.blockLetter}>{letter ?? " "}</Text>
            </View>
          ))}
        </View>
        {started && <Text style={styles.leafText}>{riddleProgressLine(riddle)}</Text>}
        {riddle.outcome === null && <Text style={styles.leafGo}>{riddleAction(riddle)}</Text>}
      </Panel>
    </Pressable>
  );
}

const SHORTCUT_MATTERS: Readonly<Record<string, ToyMatterName>> = {
  rising: "gold",
  missed: "red",
  recent: "paper",
};
const SHORTCUT_MARKS: Readonly<Record<string, string>> = { rising: "▲", missed: "✕", recent: "✦" };
const COLLECTION_MATTERS: readonly ToyMatterName[] = ["blue", "red", "green"];
const THEME_MATTERS: readonly ToyMatterName[] = ["green", "red", "blue", "dark", "paper", "gold"];

/** The first letter of a name, past its article: « Les Fondateurs » shows an F. */
function initialOf(name: string): string {
  return (name.replace(/^(les|le|la|l')\s*/i, "").charAt(0) || name.charAt(0)).toUpperCase();
}

/** What to practise on: book covers seen from the front, each one a door. */
function Shelf({
  summary,
  catalog,
  now,
  busy,
  themesLevel,
  onStart,
}: {
  readonly summary: ReviewSummaryResponse;
  readonly catalog: Catalog;
  readonly now: number;
  readonly busy: boolean;
  readonly themesLevel: number;
  readonly onStart: (request: ReviewRequest) => void;
}) {
  const player = useShared(progress);
  const themesOpen = player !== null && isFeatureOpen("practice_choice", player.level, now);
  const shelf = reviewShelf(
    summary,
    (id) => collectionName(catalog, id),
    themesOpen ? null : themesLevel,
  );
  const empty = shelf.shortcuts.length + shelf.collections.length + shelf.themes.length === 0;
  const xpLine = shelfXpLine(summary);
  const pick = (cover: ReviewCover) => {
    if (cover.lockedAt === null && !busy) onStart({ scope: cover.scope });
  };
  return (
    <Panel paper style={styles.shelf}>
      <View style={styles.head}>
        <PaperKicker>Une collection, un thème, tes mots</PaperKicker>
        <Text style={styles.title} accessibilityRole="header">
          S'entraîner sur…
        </Text>
      </View>
      {empty && (
        <Text style={styles.line}>
          {practiceEmptyLine(practiceRulesAt(PRACTICE_SCHEDULE, now).minWords, NOUN)}
        </Text>
      )}
      {shelf.shortcuts.map((cover) => (
        <Cover
          key={cover.key}
          cover={cover}
          size="short"
          matter={SHORTCUT_MATTERS[cover.kind] ?? "paper"}
          mark={SHORTCUT_MARKS[cover.kind] ?? "✦"}
          onPick={pick}
        />
      ))}
      {shelf.collections.length > 0 && (
        <>
          <Text style={styles.shelfTitle}>LES COLLECTIONS</Text>
          {shelf.collections.map((cover, at) => (
            <Cover
              key={cover.key}
              cover={cover}
              size="large"
              matter={COLLECTION_MATTERS[at % COLLECTION_MATTERS.length] ?? "blue"}
              mark={initialOf(cover.name)}
              onPick={pick}
            />
          ))}
        </>
      )}
      {shelf.themes.length > 0 && (
        <>
          <Text style={styles.shelfTitle}>LES THÈMES</Text>
          <View style={styles.themes}>
            {shelf.themes.map((cover, at) => (
              <View key={cover.key} style={styles.theme}>
                <Cover
                  cover={cover}
                  size="small"
                  matter={THEME_MATTERS[at % THEME_MATTERS.length] ?? "green"}
                  mark={initialOf(cover.name)}
                  onPick={pick}
                />
              </View>
            ))}
          </View>
        </>
      )}
      {xpLine !== null && <Text style={styles.note}>{xpLine}</Text>}
    </Panel>
  );
}

/** A book seen from the front: its leather, its title, how much of it is learnt, what is due. */
function Cover({
  cover,
  size,
  matter,
  mark,
  onPick,
}: {
  readonly cover: ReviewCover;
  readonly size: "large" | "small" | "short";
  readonly matter: ToyMatterName;
  readonly mark: string;
  readonly onPick: (cover: ReviewCover) => void;
}) {
  const locked = cover.lockedAt !== null;
  const leather = toyMatters[locked ? "locked" : matter];
  const light = !locked && (matter === "paper" || matter === "gold");
  const face = {
    backgroundImage: `linear-gradient(160deg, ${leather.top}, ${leather.bottom})`,
    boxShadow: `inset 0 -4px 0 ${leather.edge}, 0 4px 0 ${toyValues.outline}`,
  };
  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: locked }}
        accessibilityLabel={
          locked
            ? `${cover.name}, s'ouvre au niveau ${cover.lockedAt}`
            : `${cover.name}, ${cover.words}${cover.due > 0 ? `, dont ${cover.due} à revoir` : ""}. Lancer ${cover.go}.`
        }
        onPress={() => onPick(cover)}
        style={({ pressed }) => [
          styles.cover,
          coverSizes[size],
          face,
          pressed && !locked && styles.coverPressed,
        ]}
      >
        <View style={[styles.spine, { backgroundColor: leather.edge }]} />
        <View style={styles.fillet} pointerEvents="none" />
        <View style={styles.coverRow}>
          {size !== "small" && (
            <ToyBody
              matter="gold"
              shape="round"
              style={size === "large" ? styles.markLarge : styles.mark}
            >
              <Text style={[styles.markText, size === "large" && styles.markTextLarge]}>
                {mark}
              </Text>
            </ToyBody>
          )}
          <View style={styles.coverText}>
            <Lettering size={size === "large" ? 18 : 15} numberOfLines={2}>
              {cover.name}
            </Lettering>
            <Text style={[styles.coverWords, light && styles.coverWordsLight]}>
              {locked ? `Niveau ${cover.lockedAt}` : cover.words}
            </Text>
          </View>
        </View>
        {!locked && <LevelBar levels={cover.levels} />}
      </Pressable>
      {locked ? (
        <View style={styles.coverLock} pointerEvents="none">
          <ToyIcon name="lock" size={22} />
        </View>
      ) : (
        cover.due > 0 && <CountBadge count={String(cover.due)} style={styles.coverBadge} />
      )}
    </View>
  );
}

/** Blank page, sketch, ink and gilding, on one bar. */
function LevelBar({ levels }: { readonly levels: LevelCounts }) {
  return (
    <View style={styles.tiers} importantForAccessibility="no-hide-descendants">
      <View style={[TIERS.blank, { flexGrow: levels.blank }]} />
      <View style={[TIERS.sketch, { flexGrow: levels.sketch }]} />
      <View style={[TIERS.ink, { flexGrow: levels.ink }]} />
      <View style={[TIERS.gilded, { flexGrow: levels.gilded }]} />
    </View>
  );
}

/** The owned words by level, and when the next one comes back. */
function MemoryLeaf({
  summary,
  now,
}: {
  readonly summary: ReviewSummaryResponse;
  readonly now: number;
}) {
  const streak = streakLine(summary.streak);
  return (
    <Panel paper style={styles.leaf}>
      <PaperKicker>Ta mémoire</PaperKicker>
      <LevelBar levels={summary.levels} />
      <View style={styles.tierFigures}>
        {memoryParts(summary.levels).map((part) => (
          <Text key={part.level} style={styles.tierFigure}>
            <Text style={styles.tierCount}>{part.count}</Text> {part.label}
          </Text>
        ))}
      </View>
      <Text style={styles.leafText}>{memoryLine(summary, now)}</Text>
      {streak !== null && <Text style={styles.leafText}>{streak}</Text>}
    </Panel>
  );
}

/** The bar's levels, in the toys' leathers. */
const TIERS = StyleSheet.create({
  blank: { backgroundColor: toyMatters.paper.top },
  sketch: { backgroundColor: toyMatters.paper.edge },
  ink: {
    backgroundImage: `linear-gradient(180deg, ${toyMatters.blue.top}, ${toyMatters.blue.bottom})`,
  },
  gilded: {
    backgroundImage: `linear-gradient(180deg, ${toyMatters.gold.top}, ${toyMatters.gold.bottom})`,
  },
});

const coverSizes = StyleSheet.create({
  short: { minHeight: 76 },
  large: { minHeight: 104, paddingVertical: space.s7 },
  small: { minHeight: 92, paddingVertical: space.s7 },
});

const styles = StyleSheet.create({
  page: {
    gap: space.s8,
    paddingHorizontal: space.s8,
    paddingTop: space.s4,
    paddingBottom: TAB_BAR_RISE + 24,
  },
  kicker: {
    fontFamily: fonts.ui.extrabold,
    fontSize: fontSizes.caption,
    letterSpacing: 2,
    color: ink.pageInkMuted,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: fontSizes.title,
    lineHeight: 26,
    color: ink.pageInk,
  },
  notice: {
    fontFamily: fonts.ui.semibold,
    fontSize: fontSizes.body,
    lineHeight: 21,
    color: colors.pageInk,
  },
  error: {
    fontFamily: fonts.ui.bold,
    fontSize: fontSizes.body,
    lineHeight: 21,
    color: ink.danger,
  },
  review: { gap: space.s8 },
  head: { gap: space.s2 },
  reviewHead: { gap: space.s2, paddingRight: 52 },
  wells: { flexDirection: "row", gap: space.s5 },
  well: {
    flex: 1,
    minHeight: 84,
    alignItems: "center",
    justifyContent: "center",
    gap: space.s2,
    paddingVertical: space.s5,
    paddingHorizontal: space.s3,
    borderRadius: radii.xxl,
    backgroundColor: ink.well,
  },
  wellFigure: {
    fontFamily: fonts.display,
    fontSize: fontSizes.display,
    lineHeight: 44,
    color: ink.pageInk,
  },
  wellGilt: { color: ink.gilt },
  wellEmpty: { color: ink.pageInkFaint },
  wellLabel: {
    fontFamily: fonts.ui.extrabold,
    fontSize: fontSizes.small,
    textAlign: "center",
    color: ink.pageInkMuted,
  },
  line: {
    fontFamily: fonts.text.regular,
    fontSize: fontSizes.body,
    lineHeight: 22,
    color: ink.pageInkMuted,
  },
  go: { alignItems: "center", gap: space.s4 },
  estimate: {
    fontFamily: fonts.text.italic,
    fontSize: fontSizes.label,
    color: ink.pageInkMuted,
    textAlign: "center",
  },
  settings: { position: "absolute", top: space.s7, right: space.s7 },
  settingsToy: { width: 46, height: 46 },
  sheet: { gap: space.s6 },
  sheetTitle: {
    fontFamily: fonts.ui.extrabold,
    fontSize: fontSizes.small,
    letterSpacing: 1.5,
    color: ink.pageInkMuted,
  },
  options: { flexDirection: "row", flexWrap: "wrap", gap: space.s4 },
  optionToy: { height: 44 },
  optionBody: { paddingHorizontal: space.s8 },
  optionToyText: {
    fontFamily: fonts.ui.extrabold,
    fontSize: fontSizes.label,
    color: toyValues.outline,
  },
  leaf: { gap: space.s6 },
  pressed: { transform: [{ translateY: 2 }] },
  leafHead: { flexDirection: "row", alignItems: "center", gap: space.s6 },
  badge: { width: 46, height: 46, alignItems: "center", justifyContent: "center" },
  leafTitles: { flex: 1, gap: space.s1 },
  leafTitle: {
    fontFamily: fonts.display,
    fontSize: fontSizes.subtitle,
    lineHeight: 23,
    color: ink.pageInk,
  },
  done: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: ink.success,
  },
  pips: { flexDirection: "row", gap: space.s3 },
  pip: { flex: 1, height: 8, borderRadius: 4 },
  right: { backgroundColor: ink.success },
  wrong: { backgroundColor: ink.danger },
  empty: { backgroundColor: ink.well },
  leafText: {
    fontFamily: fonts.ui.medium,
    fontSize: fontSizes.body,
    lineHeight: 21,
    color: ink.pageInkMuted,
  },
  leafGo: { fontFamily: fonts.ui.extrabold, fontSize: fontSizes.body, color: ink.rubric },
  type: { flexDirection: "row", gap: space.s2 },
  block: {
    flex: 1,
    maxWidth: 28,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.xs,
    borderWidth: 2,
    borderColor: ink.pageInkMuted,
    backgroundColor: ink.pageRaised,
  },
  blockHollow: { borderColor: ink.rule, backgroundColor: "transparent" },
  blockLetter: { fontFamily: fonts.display, fontSize: fontSizes.bodyLarge, color: ink.pageInk },
  shelf: { gap: space.s7 },
  shelfTitle: {
    marginTop: space.s5,
    fontFamily: fonts.ui.extrabold,
    fontSize: fontSizes.micro,
    letterSpacing: 2,
    color: ink.pageInkMuted,
  },
  themes: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    // Rows wide apart: each count badge stands out over the cover above.
    rowGap: space.s9,
  },
  theme: { width: "48%" },
  cover: {
    justifyContent: "center",
    gap: space.s5,
    marginBottom: 4,
    paddingVertical: space.s6,
    paddingLeft: space.s12,
    paddingRight: space.s7,
    borderWidth: toyValues.outlineWidth,
    borderColor: toyValues.outline,
    borderTopLeftRadius: radii.xs,
    borderBottomLeftRadius: radii.xs,
    borderTopRightRadius: radii.xl,
    borderBottomRightRadius: radii.xl,
    overflow: "hidden",
  },
  coverPressed: { transform: [{ translateY: 3 }] },
  // The spine's hinge along the left edge.
  spine: { position: "absolute", top: 0, bottom: 0, left: 0, width: 9 },
  // A fine gilt fillet framing the cover, as on a bound book.
  fillet: {
    position: "absolute",
    top: 5,
    bottom: 7,
    left: 15,
    right: 6,
    borderWidth: 1.5,
    borderColor: room.shelf.gilt,
    borderTopLeftRadius: 3,
    borderBottomLeftRadius: 3,
    borderTopRightRadius: 9,
    borderBottomRightRadius: 9,
    opacity: 0.7,
  },
  coverRow: { flexDirection: "row", alignItems: "center", gap: space.s6 },
  mark: { width: 42, height: 42, borderWidth: 2 },
  markLarge: { width: 54, height: 54, borderWidth: 2 },
  markText: { fontFamily: fonts.display, fontSize: 20, color: toyValues.outline },
  markTextLarge: { fontSize: 26 },
  coverText: { flex: 1, minWidth: 0, gap: space.s2 },
  coverWords: {
    fontFamily: fonts.ui.extrabold,
    fontSize: fontSizes.caption,
    color: alpha(toyMatters.paper.top, 0.85),
  },
  // Paper and gold covers are light: their words go in ink.
  coverWordsLight: { color: alpha(toyValues.outline, 0.75) },
  coverBadge: { position: "absolute", top: -10, right: -8 },
  coverLock: { position: "absolute", top: 8, right: 10 },
  tiers: {
    flexDirection: "row",
    height: 10,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: toyValues.outline,
    borderRadius: 6,
    backgroundColor: toyMatters.paper.top,
  },
  tierFigures: { flexDirection: "row", flexWrap: "wrap", rowGap: space.s1 },
  tierFigure: {
    width: "50%",
    fontFamily: fonts.ui.bold,
    fontSize: fontSizes.small,
    color: ink.pageInkMuted,
  },
  tierCount: { fontFamily: fonts.ui.extrabold, color: ink.pageInk },
  note: {
    fontFamily: fonts.ui.medium,
    fontSize: fontSizes.small,
    lineHeight: 18,
    color: ink.pageInkFaint,
  },
});
