"use client";

import type { LevelCounts, ReviewRequest, ReviewSummaryResponse } from "@leximon/contract";
import { type Catalog, collectionName } from "@leximon/contract/client";
import { PRACTICE_SCHEDULE, practiceRulesAt, UNLOCK_SCHEDULE, unlockRulesAt } from "@leximon/core";
import type { ToyIconName, ToyMatterName } from "@leximon/tokens";
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
  reviewParagraph,
  reviewShelf,
  reviewWells,
  shelfXpLine,
  streakLine,
} from "@leximon/view-model";
import { type CSSProperties, type ReactNode, useEffect, useState } from "react";
import { readPreference, writePreference } from "@/booster/feedback";
import { type PackCollection, packOf, packVariables } from "@/booster/pack-looks";
import { CollectionSeal } from "@/components/collection-seal";
import { api } from "@/lib/api";
import { usePackShape } from "@/lib/use-pack-shape";
import { CountBadge, MainAction } from "@/library/play-pieces";
import { DailyLeaf, RiddleLeaf } from "@/play/desk-columns";
import desk from "@/play/desk-columns.module.css";
import { dailyChallenge, reviewSummary } from "@/player/collection";
import { useShared } from "@/player/resource";
import { todayRiddle } from "@/player/riddle";
import { useProgress } from "@/progress/use-progress";
import { TitleRule } from "@/ui/ornaments";
import { Bone } from "@/ui/skeleton";
import { Lettering, Toy, ToyIcon } from "@/ui/toy";
import ui from "@/ui/ui.module.css";
import { ChallengeHalves } from "./challenge-halves";
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
      <ChallengeHalves current="training" />
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
        {summary === null ? (
          <Bone className={styles.lineBone} />
        ) : (
          reviewParagraph(summary, now, noun)
        )}
      </p>
      <div className={styles.go}>
        <MainAction
          label={action?.label ?? "Commencer"}
          count={action === null ? undefined : String(action.count)}
          disabled={busy || action === null || action.disabled}
          onClick={() => onStart({})}
        />
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
const SHORTCUT_MARKS: Readonly<Record<string, ToyIconName>> = {
  rising: "rising",
  missed: "missed",
  recent: "recent",
};
/** The themes are one set of volumes: the same brown leather, told apart by their titles. */
const THEME_MATTER: ToyMatterName = "dark";

/** A collection's cover is cut from its sachet's cloth; the scope names the collection. */
function packOfScope(catalog: Catalog, cover: ReviewCover): PackCollection | null {
  if (cover.scope.kind !== "collection") return null;
  const id = cover.scope.id;
  const file = catalog.collections.find((collection) => collection.id === id);
  return file === undefined ? null : packOf(file);
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
        <TitleRule />
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
                mark={
                  <span className={styles.coverCoin}>
                    <ToyIcon name={SHORTCUT_MARKS[cover.kind] ?? "recent"} size={36} />
                  </span>
                }
                onPick={pick}
              />
            </li>
          ))}
        </ul>
      )}
      {shelf.collections.length > 0 && (
        <>
          <h3 className={styles.shelfTitle}>Les collections</h3>
          <TitleRule className={styles.shelfRule} />
          <ul className={styles.collections}>
            {shelf.collections.map((cover) => {
              const pack = packOfScope(catalog, cover);
              return (
                <li key={cover.key}>
                  <Cover
                    cover={cover}
                    size="large"
                    matter="blue"
                    pack={pack}
                    mark={pack === null ? null : <CollectionSeal collection={pack} size={58} />}
                    onPick={pick}
                  />
                </li>
              );
            })}
          </ul>
        </>
      )}
      {shelf.themes.length > 0 && (
        <>
          <h3 className={styles.shelfTitle}>Les thèmes</h3>
          <TitleRule className={styles.shelfRule} />
          <ul className={styles.themes}>
            {shelf.themes.map((cover) => (
              <li key={cover.key}>
                <Cover cover={cover} size="small" matter={THEME_MATTER} mark={null} onPick={pick} />
              </li>
            ))}
          </ul>
        </>
      )}
      {xpLine !== null && <p className={styles.note}>{xpLine}</p>}
    </section>
  );
}

/**
 * A book seen from the front: its leather (or, for a collection, its sachet's cloth), its title, how
 * much of it is learnt, what is due.
 */
function Cover({
  cover,
  size,
  matter,
  pack = null,
  mark,
  onPick,
}: {
  readonly cover: ReviewCover;
  readonly size: "large" | "small" | "short";
  readonly matter: ToyMatterName;
  readonly pack?: PackCollection | null;
  readonly mark: ReactNode;
  readonly onPick: (cover: ReviewCover) => void;
}) {
  const locked = cover.lockedAt !== null;
  const leather = locked ? "locked" : matter;
  const cloth = pack !== null && !locked;
  return (
    <button
      type="button"
      className={styles.cover}
      data-size={size}
      data-locked={locked || undefined}
      data-pack={cloth || undefined}
      data-light={leather === "paper" || leather === "gold" || undefined}
      style={
        cloth
          ? packVariables(pack)
          : ({
              "--cover-top": `var(--lx-toy-${leather}-top)`,
              "--cover-bottom": `var(--lx-toy-${leather}-bottom)`,
              "--cover-edge": `var(--lx-toy-${leather}-edge)`,
            } as CSSProperties)
      }
      aria-disabled={locked || undefined}
      aria-label={
        locked
          ? `${cover.name}, s'ouvre au niveau ${cover.lockedAt}`
          : `${cover.name}, ${cover.words}${cover.due > 0 ? `, dont ${cover.due} à revoir` : ""}. Lancer ${cover.go}.`
      }
      onClick={() => onPick(cover)}
    >
      {mark !== null && (
        <span className={styles.coverMark} aria-hidden="true">
          {mark}
        </span>
      )}
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
