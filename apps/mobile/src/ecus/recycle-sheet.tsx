import { RARITY_LABELS } from "@leximon/contract";
import { toyMatters, toy as toyValues } from "@leximon/tokens";
import {
  clearedPicks,
  ecuRules,
  extraPicks,
  RECYCLE_ALL_COLLECTIONS,
  RECYCLE_ALL_RARITIES,
  RECYCLE_BUSY,
  RECYCLE_CLEAR,
  RECYCLE_CONFIRM_ACTION,
  RECYCLE_FAILED,
  RECYCLE_NONE_PICKED,
  RECYCLE_PICK_EXTRA,
  RECYCLE_PICK_EXTRA_HELP,
  RECYCLE_PICK_RULE,
  RECYCLE_REVIEW,
  RECYCLE_SEARCH,
  RECYCLE_SORT_LABELS,
  RECYCLE_SORTS,
  RECYCLE_START,
  RECYCLE_TITLE,
  type RecyclePicks,
  type RecycleRow,
  type RecycleState,
  recycledToast,
  recycleView,
  shortName,
  steppedPick,
  toggledPick,
} from "@leximon/view-model";
import { type ReactNode, useMemo, useState, useSyncExternalStore } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useCatalog } from "@/cards/use-catalog";
import { play } from "@/feedback/feedback";
import { ownedCards } from "@/player/collection";
import { recycleChosen } from "@/player/ecus";
import { useShared } from "@/player/shared";
import { alpha, fontSizes, fonts, paperColors, space } from "@/theme";
import { Button } from "@/ui/button";
import { Chip } from "@/ui/chip";
import { Icon } from "@/ui/icon";
import { RarityChip } from "@/ui/rarity-icon";
import { SearchField } from "@/ui/search-field";
import { Sheet } from "@/ui/sheet";
import { toast } from "@/ui/toast";
import { ToyIcon } from "@/ui/toy";

let shown = false;
const listeners = new Set<() => void>();

function show(next: boolean): void {
  shown = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Picking the doubles to recycle, over any screen. */
export function openRecycle(): void {
  show(true);
}

/** Pick the doubles to recycle, card by card, with sorts and filters, then recycle them at once. */
export function RecycleHost() {
  const open = useSyncExternalStore(subscribe, () => shown);
  const catalog = useCatalog();
  const owned = useShared(ownedCards);
  const [state, setState] = useState<RecycleState>(RECYCLE_START);
  const [picks, setPicks] = useState<RecyclePicks>(new Map());
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [helping, setHelping] = useState(false);
  const cards = useMemo(() => (catalog === null ? [] : [...catalog.cardsById.values()]), [catalog]);
  const names = useMemo(
    () => new Map(catalog?.collections.map((c) => [c.id, shortName(c.name)]) ?? []),
    [catalog],
  );
  const rules = ecuRules(Date.now());
  const view = owned === null ? null : recycleView(rules, cards, names, owned, picks, state);

  const close = () => {
    show(false);
    setState(RECYCLE_START);
    setPicks(new Map());
    setConfirming(false);
    setHelping(false);
  };
  const pick = (next: RecyclePicks) => {
    setPicks(next);
    setConfirming(false);
  };
  const recycle = () => {
    if (view === null) return;
    if (view.confirm !== null && !confirming) {
      setConfirming(true);
      return;
    }
    setBusy(true);
    recycleChosen(view.choice)
      .then((result) => {
        if (result.copies > 0) play("coins");
        toast(recycledToast(result));
        close();
      })
      .catch(() => toast(RECYCLE_FAILED))
      .finally(() => setBusy(false));
  };

  const footer =
    view === null ? undefined : (
      <>
        {confirming && view.confirm !== null && <Text style={styles.confirm}>{view.confirm}</Text>}
        <Button
          label={
            busy
              ? RECYCLE_BUSY
              : confirming
                ? RECYCLE_CONFIRM_ACTION
                : (view.action ?? RECYCLE_NONE_PICKED)
          }
          disabled={busy || view.action === null}
          onPress={recycle}
        />
        {confirming && (
          <Button label={RECYCLE_REVIEW} secondary onPress={() => setConfirming(false)} />
        )}
      </>
    );

  return (
    <Sheet open={open} title={RECYCLE_TITLE} onClose={close} footer={footer}>
      <Text style={styles.rule}>{RECYCLE_PICK_RULE}</Text>
      {view !== null && (
        <>
          <SearchField
            compact
            value={state.search}
            label={RECYCLE_SEARCH}
            onChange={(search) => setState((s) => ({ ...s, search }))}
          />
          <View style={styles.filters}>
            <ChipRow label="Trier">
              {RECYCLE_SORTS.map((sort) => (
                <Chip
                  key={sort}
                  label={RECYCLE_SORT_LABELS[sort]}
                  on={state.sort === sort}
                  onPress={() => setState((s) => ({ ...s, sort }))}
                />
              ))}
            </ChipRow>
            {view.collections.length > 1 && (
              <ChipRow label="Collection">
                <Chip
                  label={RECYCLE_ALL_COLLECTIONS}
                  on={state.collectionId === null}
                  onPress={() => setState((s) => ({ ...s, collectionId: null }))}
                />
                {view.collections.map((collection) => (
                  <Chip
                    key={collection.id}
                    label={collection.name}
                    on={state.collectionId === collection.id}
                    onPress={() => setState((s) => ({ ...s, collectionId: collection.id }))}
                  />
                ))}
              </ChipRow>
            )}
            {view.rarities.length > 1 && (
              <ChipRow label="Rareté">
                <Chip
                  label={RECYCLE_ALL_RARITIES}
                  on={state.rarity === null}
                  onPress={() => setState((s) => ({ ...s, rarity: null }))}
                />
                {view.rarities.map((rarity) => (
                  <Pressable
                    key={rarity}
                    onPress={() => setState((s) => ({ ...s, rarity }))}
                    accessibilityRole="button"
                    accessibilityLabel={RARITY_LABELS[rarity]}
                    accessibilityState={{ selected: state.rarity === rarity }}
                    style={[styles.gemChip, state.rarity === rarity && styles.gemChipOn]}
                  >
                    <RarityChip rarity={rarity} size={22} />
                  </Pressable>
                ))}
              </ChipRow>
            )}
          </View>

          <View style={styles.tools}>
            <Text style={styles.count}>{view.count}</Text>
            <View style={styles.toolRow}>
              <Chip
                label={RECYCLE_PICK_EXTRA}
                onPress={() => pick(extraPicks(rules, picks, view.rows))}
              />
              <Pressable
                onPress={() => setHelping((was) => !was)}
                hitSlop={10}
                style={[styles.round, helping && styles.roundOn]}
                accessibilityRole="button"
                accessibilityLabel={`${RECYCLE_PICK_EXTRA}, la règle`}
                accessibilityState={{ expanded: helping }}
              >
                <Icon name="help" size={20} color={ink.pageInkMuted} />
              </Pressable>
              <Pressable
                onPress={() => pick(clearedPicks(picks, view.rows))}
                hitSlop={8}
                style={styles.clear}
                accessibilityRole="button"
              >
                <Text style={styles.clearText}>{RECYCLE_CLEAR}</Text>
              </Pressable>
            </View>
            {helping && <Text style={styles.help}>{RECYCLE_PICK_EXTRA_HELP}</Text>}
          </View>

          {view.empty !== null ? (
            <Text style={styles.empty}>{view.empty}</Text>
          ) : (
            <View style={styles.rows}>
              {view.rows.map((row) => (
                <Row
                  key={row.cardId}
                  row={row}
                  onToggle={() => pick(toggledPick(rules, picks, row))}
                  onStep={(step) => pick(steppedPick(picks, row, step))}
                />
              ))}
            </View>
          )}
        </>
      )}
    </Sheet>
  );
}

/** A line of chips that scrolls sideways, so that the filters leave the height to the list. */
function ChipRow({ label, children }: { readonly label: string; readonly children: ReactNode }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      accessibilityLabel={label}
      contentContainerStyle={styles.chips}
    >
      {children}
    </ScrollView>
  );
}

function Row({
  row,
  onToggle,
  onStep,
}: {
  readonly row: RecycleRow;
  readonly onToggle: () => void;
  readonly onStep: (step: 1 | -1) => void;
}) {
  const on = row.picked > 0;
  return (
    <View style={[styles.row, on && styles.rowOn]}>
      <Pressable
        onPress={onToggle}
        style={styles.pick}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: on }}
        accessibilityLabel={row.aria}
      >
        <View style={[styles.box, on && styles.boxOn]}>
          {on && <Icon name="check" size={15} color={toyValues.outline} />}
        </View>
        <RarityChip rarity={row.rarity} size={22} />
        <View style={styles.word}>
          <Text style={styles.wordText} numberOfLines={1}>
            {row.word}
          </Text>
          <Text style={[styles.owned, on && styles.gain]} numberOfLines={1}>
            {on ? row.gain : row.owned}
          </Text>
        </View>
      </Pressable>
      <View style={styles.stepper}>
        <Pressable
          onPress={() => onStep(-1)}
          disabled={row.picked === 0}
          hitSlop={4}
          style={[styles.step, row.picked === 0 && styles.stepOff]}
          accessibilityRole="button"
          accessibilityLabel={`Un double de moins, ${row.word}`}
        >
          <Icon name="minus" size={16} color={toyValues.outline} />
        </Pressable>
        <Text style={styles.picked}>{row.picked}</Text>
        <Pressable
          onPress={() => onStep(1)}
          disabled={row.picked >= row.max}
          hitSlop={4}
          style={[styles.step, row.picked >= row.max && styles.stepOff]}
          accessibilityRole="button"
          accessibilityLabel={`Un double de plus, ${row.word}`}
        >
          <Icon name="plus" size={16} color={toyValues.outline} />
        </Pressable>
      </View>
      {on && <ToyIcon name="ecu" size={18} />}
    </View>
  );
}

/** It is read on a sheet, a leaf of paper. */
const ink = paperColors;

const styles = StyleSheet.create({
  rule: {
    fontFamily: fonts.ui.medium,
    fontSize: fontSizes.label,
    lineHeight: 20,
    color: ink.pageInkMuted,
  },
  filters: { gap: space.s4 },
  chips: { flexDirection: "row", gap: space.s3 },
  gemChip: {
    minHeight: 36,
    paddingHorizontal: space.s4,
    justifyContent: "center",
    borderWidth: toyValues.outlineWidth,
    borderColor: toyValues.outline,
    borderRadius: 12,
    backgroundColor: ink.paper,
    marginBottom: 2,
  },
  gemChipOn: {
    backgroundImage: `linear-gradient(180deg, ${toyMatters.gold.top} 50%, ${toyMatters.gold.bottom} 50%)`,
  },
  tools: {
    gap: space.s3,
    paddingTop: space.s5,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: ink.rule,
  },
  count: { fontFamily: fonts.ui.extrabold, fontSize: fontSizes.label, color: ink.pageInk },
  toolRow: { flexDirection: "row", alignItems: "center", gap: space.s3 },
  round: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 15,
  },
  roundOn: { backgroundColor: alpha(toyValues.outline, 0.1) },
  clear: { marginLeft: "auto" },
  clearText: { fontFamily: fonts.ui.bold, fontSize: fontSizes.label, color: ink.rubric },
  help: {
    padding: space.s5,
    borderWidth: toyValues.outlineWidth,
    borderColor: toyValues.outline,
    borderRadius: 14,
    backgroundColor: ink.track,
    fontFamily: fonts.ui.medium,
    fontSize: fontSizes.label,
    lineHeight: 20,
    color: ink.pageInk,
  },
  empty: {
    paddingVertical: space.s8,
    textAlign: "center",
    fontFamily: fonts.ui.medium,
    fontSize: fontSizes.label,
    color: ink.pageInkMuted,
  },
  rows: { gap: space.s2 },
  // A card per line: a tap on its left picks or unpicks it, the stepper sets how many copies go.
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.s3,
    paddingVertical: space.s2,
    paddingHorizontal: space.s4,
    borderWidth: 2,
    borderColor: "transparent",
    borderRadius: 14,
    backgroundColor: ink.pageRaised,
  },
  rowOn: { borderColor: toyMatters.gold.edge, backgroundColor: alpha(toyMatters.gold.top, 0.25) },
  pick: { flex: 1, flexDirection: "row", alignItems: "center", gap: space.s4, minHeight: 44 },
  box: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: toyValues.outline,
    borderRadius: 7,
    backgroundColor: ink.paper,
  },
  boxOn: { backgroundColor: toyMatters.gold.top },
  word: { flex: 1, minWidth: 0 },
  wordText: { fontFamily: fonts.ui.extrabold, fontSize: fontSizes.body, color: ink.pageInk },
  owned: { fontFamily: fonts.ui.medium, fontSize: fontSizes.small, color: ink.pageInkMuted },
  gain: { fontFamily: fonts.ui.extrabold, color: ink.success },
  stepper: { flexDirection: "row", alignItems: "center", gap: 2 },
  step: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: toyValues.outline,
    borderRadius: 16,
    backgroundImage: `linear-gradient(180deg, ${toyMatters.paper.top} 50%, ${toyMatters.paper.bottom} 50%)`,
    boxShadow: `0 2px 0 ${toyValues.outline}`,
  },
  stepOff: { opacity: 0.35 },
  picked: {
    minWidth: 22,
    textAlign: "center",
    fontFamily: fonts.ui.extrabold,
    fontSize: fontSizes.body,
    fontVariant: ["tabular-nums"],
    color: ink.pageInk,
  },
  confirm: {
    fontFamily: fonts.ui.bold,
    fontSize: fontSizes.label,
    lineHeight: 20,
    color: ink.rubric,
  },
});
