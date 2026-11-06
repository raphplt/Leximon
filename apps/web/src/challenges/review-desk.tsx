"use client";

import type { LevelCounts, ReviewRequest, ReviewSummaryResponse } from "@leximon/contract";
import { type Catalog, collectionName } from "@leximon/contract/client";
import { PRACTICE_SCHEDULE, practiceRulesAt, UNLOCK_SCHEDULE, unlockRulesAt } from "@leximon/core";
import type { ToyMatterName } from "@leximon/tokens";
import {
  DIFFICULTY_OPTIONS,
  FORMAT_PREFERENCE,
  formatOptions,
  isFeatureOpen,
  lengthOptions,
  memoryLine,
  memoryParts,
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
  shelfXpLine,
  streakLine,
} from "@leximon/view-model";
import { type CSSProperties, useEffect, useState } from "react";
import { readPreference, writePreference } from "@/booster/feedback";
import { api } from "@/lib/api";
import { usePackShape } from "@/lib/use-pack-shape";
import { CountBadge, MainAction } from "@/library/play-pieces";
import { DailyLeaf, RiddleLeaf } from "@/play/desk-columns";
import desk from "@/play/desk-columns.module.css";
import { dailyChallenge, reviewSummary } from "@/player/collection";
import { useShared } from "@/player/resource";
import { todayRiddle } from "@/player/riddle";
import { useProgress } from "@/progress/use-progress";
import { Bone } from "@/ui/skeleton";
import { Lettering, Toy, ToyIcon } from "@/ui/toy";
import ui from "@/ui/ui.module.css";
import styles from "./review-desk.module.css";

/** Each leaf rises in turn when the screen appears, as on Jouer. */
const rise = (index: number) => ({ "--rise": index }) as CSSProperties;

/**
 * The Défis screen at rest: the review across the top, the shelf of scopes to practise on, and
 * beside it the daily challenge, the riddle and the player's memory by level.
 */
export function ReviewDesk({
  catalog,
  now,
  busy,
  notice,
  error,
  onStart,
}: {
  readonly catalog: Catalog;
  readonly now: number;
  readonly busy: boolean;
  readonly notice: string | null;
  readonly error: string | null;
  readonly onStart: (request: ReviewRequest) => void;
}) {
  const summary = useShared(reviewSummary);
  const daily = useShared(dailyChallenge);
  const riddle = useShared(todayRiddle);
  // Read again each time the screen is shown: a series or the riddle may have changed them.
  useEffect(() => {
    reviewSummary.refresh();
    dailyChallenge.refresh();
    todayRiddle.refresh();
  }, []);
  const rules = unlockRulesAt(UNLOCK_SCHEDULE, now);
  return (
    <div className={styles.screen}>
      <Lettering className={styles.pageTitle}>Défis</Lettering>
      <Review summary={summary} now={now} busy={busy} onStart={onStart} />
      {notice !== null && (
        <p className={styles.notice} role="status">
          {notice}
        </p>
      )}
      {error !== null && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      <div className={styles.lower}>
        {summary !== null && (
          <Shelf
            summary={summary}
            catalog={catalog}
            now={now}
            busy={busy}
            themesLevel={rules.levels.practice_choice}
            onStart={onStart}
          />
        )}
        <aside className={styles.side} aria-label="Aujourd'hui">
          {daily !== null && (
            <DailyLeaf
              daily={daily}
              index={2}
              onStart={
                busy || summary === null || reviewAction(summary).disabled
                  ? undefined
                  : () =>
                      onStart({
                        length: practiceRulesAt(PRACTICE_SCHEDULE, now).dailyChallengeLength,
                      })
              }
            />
          )}
          {riddle !== null && <RiddleLeaf riddle={riddle} index={3} />}
          {summary !== null && <MemoryLeaf summary={summary} now={now} />}
        </aside>
      </div>
    </div>
  );
}

/** The hero, across the screen: what waits, said in figures and in words, and the gold button. */
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
  const { noun } = usePackShape();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const action = summary === null ? null : reviewAction(summary);
  return (
    <section
      className={`${ui.panel} ${ui.leaf} ${styles.review} ${desk.rising}`}
      style={rise(0)}
      aria-labelledby="review-title"
    >
      <header className={styles.reviewHead}>
        <span className={desk.leafKicker}>Ta révision</span>
        <h2 id="review-title" className={styles.reviewTitle}>
          Réviser tes mots
        </h2>
      </header>
      <div className={styles.wells}>
        {summary === null
          ? ["due", "fresh", "rising"].map((key) => (
              <div key={key} className={styles.well}>
                <Bone className={styles.lineBone} />
              </div>
            ))
          : reviewWells(summary).map((well) => (
              <div
                key={well.key}
                className={styles.well}
                data-gilt={well.gilt || undefined}
                data-empty={well.figure === 0 || undefined}
              >
                <span className={styles.wellFigure}>{well.figure}</span>
                <span className={styles.wellLabel}>{well.label}</span>
              </div>
            ))}
      </div>
      <p className={styles.line}>
        {summary === null ? <Bone className={styles.lineBone} /> : reviewLine(summary, now, noun)}
      </p>
      <div className={styles.go}>
        <MainAction
          label={action?.label ?? "Commencer"}
          count={action === null ? undefined : String(action.count)}
          disabled={busy || action === null || action.disabled}
          onClick={() => onStart({})}
        />
        {action !== null && !action.disabled && (
          <span className={styles.estimate}>{action.estimate}</span>
        )}
      </div>
      <Toy
        matter="paper"
        shape="round"
        className={styles.settings}
        aria-label={REVIEW_SETTINGS_TITLE}
        aria-expanded={settingsOpen}
        aria-controls="review-settings"
        onClick={() => setSettingsOpen((open) => !open)}
      >
        <ToyIcon name="settings" size={26} />
      </Toy>
      {settingsOpen && summary !== null && <Settings summary={summary} />}
    </section>
  );
}

type SettingsChange = Parameters<typeof api.updatePreferences>[0];

/**
 * Length of a series, pace of the new words, kinds of questions and difficulty, kept on the
 * account; the voice that says the word stays on this device, like the other sounds.
 */
function Settings({ summary }: { readonly summary: ReviewSummaryResponse }) {
  const [saving, setSaving] = useState(false);
  const [speech, setSpeech] = useState(() => readPreference("speech"));
  const save = async (change: SettingsChange) => {
    setSaving(true);
    try {
      await api.updatePreferences(change);
      reviewSummary.refresh();
    } finally {
      setSaving(false);
    }
  };
  return (
    <div id="review-settings" className={styles.sheet}>
      <h3 className={styles.sheetTitle}>{REVIEW_LENGTH_TITLE}</h3>
      <div className={styles.options}>
        {lengthOptions(summary).map((option) => (
          <Toy
            key={option.value}
            matter={option.value === summary.settings.length ? "gold" : "paper"}
            className={styles.option}
            aria-pressed={option.value === summary.settings.length}
            disabled={saving}
            onClick={() => void save({ reviewLength: option.value })}
          >
            {option.label}
          </Toy>
        ))}
      </div>
      <h3 className={styles.sheetTitle}>{REVIEW_PACE_TITLE}</h3>
      <div className={styles.options}>
        {paceOptions(summary).map((option) => (
          <Toy
            key={option.value}
            matter={option.value === summary.settings.newWordsPerDay ? "gold" : "paper"}
            className={styles.option}
            aria-pressed={option.value === summary.settings.newWordsPerDay}
            disabled={saving}
            onClick={() => void save({ newWordsPerDay: option.value })}
          >
            {option.label}
          </Toy>
        ))}
      </div>
      <h3 className={styles.sheetTitle}>{REVIEW_FORMATS_TITLE}</h3>
      <div className={styles.options}>
        {formatOptions(summary).map((option) => (
          <Toy
            key={option.key}
            matter={option.on ? "gold" : "paper"}
            className={styles.option}
            aria-pressed={option.on}
            disabled={saving}
            onClick={() => void save({ [FORMAT_PREFERENCE[option.key]]: !option.on })}
          >
            {option.label}
          </Toy>
        ))}
        <Toy
          matter={speech ? "gold" : "paper"}
          className={styles.option}
          aria-pressed={speech}
          onClick={() => {
            writePreference("speech", !speech);
            setSpeech(!speech);
          }}
        >
          {REVIEW_SOUND_LABEL}
        </Toy>
      </div>
      <h3 className={styles.sheetTitle}>{REVIEW_DIFFICULTY_TITLE}</h3>
      <div className={styles.options}>
        {DIFFICULTY_OPTIONS.map((option) => (
          <Toy
            key={option.value}
            matter={option.value === summary.settings.difficulty ? "gold" : "paper"}
            className={styles.option}
            aria-pressed={option.value === summary.settings.difficulty}
            disabled={saving}
            onClick={() => void save({ reviewDifficulty: option.value })}
          >
            {option.label}
          </Toy>
        ))}
      </div>
    </div>
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
  const progress = useProgress();
  const { noun } = usePackShape();
  const themesOpen = progress !== null && isFeatureOpen("practice_choice", progress.level, now);
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
    <section
      className={`${ui.panel} ${ui.leaf} ${styles.practice} ${desk.rising}`}
      style={rise(1)}
      aria-labelledby="practice-title"
    >
      <header className={styles.practiceHead}>
        <span className={desk.leafKicker}>Une collection, un thème, tes mots</span>
        <h2 id="practice-title" className={styles.sectionTitle}>
          S'entraîner sur…
        </h2>
      </header>
      {empty && (
        <p className={styles.note}>
          {practiceEmptyLine(practiceRulesAt(PRACTICE_SCHEDULE, now).minWords, noun)}
        </p>
      )}
      {shelf.shortcuts.length > 0 && (
        <ul className={styles.shortcuts}>
          {shelf.shortcuts.map((cover) => (
            <li key={cover.key}>
              <Cover
                cover={cover}
                size="short"
                matter={SHORTCUT_MATTERS[cover.kind] ?? "paper"}
                mark={SHORTCUT_MARKS[cover.kind] ?? "✦"}
                onPick={pick}
              />
            </li>
          ))}
        </ul>
      )}
      {shelf.collections.length > 0 && (
        <>
          <h3 className={styles.shelfTitle}>Les collections</h3>
          <ul className={styles.collections}>
            {shelf.collections.map((cover, at) => (
              <li key={cover.key}>
                <Cover
                  cover={cover}
                  size="large"
                  matter={COLLECTION_MATTERS[at % COLLECTION_MATTERS.length] ?? "blue"}
                  mark={initialOf(cover.name)}
                  onPick={pick}
                />
              </li>
            ))}
          </ul>
        </>
      )}
      {shelf.themes.length > 0 && (
        <>
          <h3 className={styles.shelfTitle}>Les thèmes</h3>
          <ul className={styles.themes}>
            {shelf.themes.map((cover, at) => (
              <li key={cover.key}>
                <Cover
                  cover={cover}
                  size="small"
                  matter={THEME_MATTERS[at % THEME_MATTERS.length] ?? "green"}
                  mark={initialOf(cover.name)}
                  onPick={pick}
                />
              </li>
            ))}
          </ul>
        </>
      )}
      {xpLine !== null && <p className={styles.note}>{xpLine}</p>}
    </section>
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
  const leather = locked ? "locked" : matter;
  return (
    <button
      type="button"
      className={styles.cover}
      data-size={size}
      data-locked={locked || undefined}
      data-light={leather === "paper" || leather === "gold" || undefined}
      style={
        {
          "--cover-top": `var(--lx-toy-${leather}-top)`,
          "--cover-bottom": `var(--lx-toy-${leather}-bottom)`,
          "--cover-edge": `var(--lx-toy-${leather}-edge)`,
        } as CSSProperties
      }
      aria-disabled={locked || undefined}
      aria-label={
        locked
          ? `${cover.name}, s'ouvre au niveau ${cover.lockedAt}`
          : `${cover.name}, ${cover.words}${cover.due > 0 ? `, dont ${cover.due} à revoir` : ""}. Lancer ${cover.go}.`
      }
      onClick={() => onPick(cover)}
    >
      <span className={styles.coverMark} aria-hidden="true">
        {mark}
      </span>
      <span className={styles.coverText}>
        <Lettering className={styles.coverName}>{cover.name}</Lettering>
        <span className={styles.coverWords}>
          {locked ? `Niveau ${cover.lockedAt}` : cover.words}
        </span>
      </span>
      {!locked && <LevelBar levels={cover.levels} className={styles.coverTiers} />}
      {locked ? (
        <span className={styles.coverLock} aria-hidden="true">
          <ToyIcon name="lock" size={22} />
        </span>
      ) : (
        <>
          {cover.due > 0 && <CountBadge count={String(cover.due)} className={styles.coverBadge} />}
          <span className={styles.coverGo} aria-hidden="true">
            {cover.go} ›
          </span>
        </>
      )}
    </button>
  );
}

function LevelBar({
  levels,
  className,
}: {
  readonly levels: LevelCounts;
  readonly className?: string | undefined;
}) {
  return (
    <span className={`${styles.tiers} ${className ?? ""}`} aria-hidden="true">
      <span className={styles.tierBlank} style={{ flexGrow: levels.blank }} />
      <span className={styles.tierSketch} style={{ flexGrow: levels.sketch }} />
      <span className={styles.tierInk} style={{ flexGrow: levels.ink }} />
      <span className={styles.tierGilt} style={{ flexGrow: levels.gilded }} />
    </span>
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
  const parts = memoryParts(summary.levels);
  const streak = streakLine(summary.streak);
  return (
    <section
      className={`${ui.leaf} ${desk.leaf} ${desk.rising}`}
      style={rise(4)}
      aria-label="Ta mémoire"
    >
      <span className={desk.leafKicker}>Ta mémoire</span>
      <LevelBar levels={summary.levels} />
      <div className={styles.tierFigures}>
        {parts.map((part) => (
          <span key={part.level} className={styles.tierFigure}>
            <ToyIcon name={part.level} size={18} />
            <b>{part.count}</b> {part.label}
          </span>
        ))}
      </div>
      <span className={desk.leafText}>{memoryLine(summary, now)}</span>
      {streak !== null && <span className={desk.leafText}>{streak}</span>}
    </section>
  );
}
