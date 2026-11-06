"use client";

import { RARITY_LABELS } from "@leximon/contract";
import { cssFill, rarityStyles } from "@leximon/tokens";
import {
  allPicks,
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
  RECYCLE_PICK_ALL,
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
import { useMemo, useState } from "react";
import { play } from "@/booster/feedback";
import { useCatalog } from "@/cards/use-catalog";
import { RarityIcon } from "@/components/rarity-icon";
import { ownedCards } from "@/player/collection";
import { recycleChosen } from "@/player/ecus";
import { useShared } from "@/player/resource";
import { Button } from "@/ui/button";
import { Dialog } from "@/ui/dialog";
import { HelpTip } from "@/ui/help-tip";
import { Icon } from "@/ui/icon";
import { useToast } from "@/ui/toast";
import { ToyIcon } from "@/ui/toy";
import ui from "@/ui/ui.module.css";
import styles from "./recycle-dialog.module.css";

/** Pick the doubles to recycle, card by card, with sorts and filters, then recycle them at once. */
export function RecycleDialog({
  open,
  onClose,
}: {
  readonly open: boolean;
  readonly onClose: () => void;
}) {
  return (
    <Dialog open={open} title={RECYCLE_TITLE} onClose={onClose} variant="center">
      {open && <RecycleChoice onClose={onClose} />}
    </Dialog>
  );
}

function RecycleChoice({ onClose }: { readonly onClose: () => void }) {
  const catalog = useCatalog();
  const owned = useShared(ownedCards);
  const toast = useToast();
  const [state, setState] = useState<RecycleState>(RECYCLE_START);
  const [picks, setPicks] = useState<RecyclePicks>(new Map());
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const rules = ecuRules(Date.now());
  const cards = useMemo(() => (catalog === null ? [] : [...catalog.cardsById.values()]), [catalog]);
  const names = useMemo(
    () => new Map(catalog?.collections.map((c) => [c.id, shortName(c.name)]) ?? []),
    [catalog],
  );
  if (catalog === null || owned === null) return <p className={styles.rule}>{RECYCLE_PICK_RULE}</p>;

  const view = recycleView(rules, cards, names, owned, picks, state);
  const pick = (next: RecyclePicks) => {
    setPicks(next);
    setConfirming(false);
  };
  const recycle = () => {
    if (view.confirm !== null && !confirming) {
      setConfirming(true);
      return;
    }
    setBusy(true);
    recycleChosen(view.choice)
      .then((result) => {
        if (result.copies > 0) play("coins");
        toast(recycledToast(result));
        onClose();
      })
      .catch(() => toast(RECYCLE_FAILED))
      .finally(() => setBusy(false));
  };

  return (
    <div className={styles.choice}>
      <p className={styles.rule}>{RECYCLE_PICK_RULE}</p>

      <label className={styles.search}>
        <Icon name="search" size={18} />
        <span className={styles.hidden}>{RECYCLE_SEARCH}</span>
        <input
          className={styles.input}
          type="search"
          placeholder={RECYCLE_SEARCH}
          value={state.search}
          onChange={(event) => setState((s) => ({ ...s, search: event.target.value }))}
        />
      </label>

      <fieldset className={styles.chips}>
        <legend className={styles.hidden}>Trier</legend>
        {RECYCLE_SORTS.map((sort) => (
          <button
            key={sort}
            type="button"
            className={`${ui.chip} ${styles.chip}`}
            aria-pressed={state.sort === sort}
            onClick={() => setState((s) => ({ ...s, sort }))}
          >
            {RECYCLE_SORT_LABELS[sort]}
          </button>
        ))}
      </fieldset>
      {view.collections.length > 1 && (
        <fieldset className={styles.chips}>
          <legend className={styles.hidden}>Collection</legend>
          <button
            type="button"
            className={`${ui.chip} ${styles.chip}`}
            aria-pressed={state.collectionId === null}
            onClick={() => setState((s) => ({ ...s, collectionId: null }))}
          >
            {RECYCLE_ALL_COLLECTIONS}
          </button>
          {view.collections.map((collection) => (
            <button
              key={collection.id}
              type="button"
              className={`${ui.chip} ${styles.chip}`}
              aria-pressed={state.collectionId === collection.id}
              onClick={() => setState((s) => ({ ...s, collectionId: collection.id }))}
            >
              {collection.name}
            </button>
          ))}
        </fieldset>
      )}
      {view.rarities.length > 1 && (
        <fieldset className={styles.chips}>
          <legend className={styles.hidden}>Rareté</legend>
          <button
            type="button"
            className={`${ui.chip} ${styles.chip}`}
            aria-pressed={state.rarity === null}
            onClick={() => setState((s) => ({ ...s, rarity: null }))}
          >
            {RECYCLE_ALL_RARITIES}
          </button>
          {view.rarities.map((rarity) => (
            <button
              key={rarity}
              type="button"
              className={`${ui.chip} ${styles.chip} ${styles.gemChip}`}
              aria-pressed={state.rarity === rarity}
              aria-label={RARITY_LABELS[rarity]}
              onClick={() => setState((s) => ({ ...s, rarity }))}
            >
              <Gem rarity={rarity} />
            </button>
          ))}
        </fieldset>
      )}

      <div className={styles.tools}>
        <div className={styles.countRow}>
          <span className={styles.count}>{view.count}</span>
          <button
            type="button"
            className={ui.ghost}
            onClick={() => pick(clearedPicks(picks, view.rows))}
          >
            {RECYCLE_CLEAR}
          </button>
        </div>
        <div className={styles.chips}>
          <button
            type="button"
            className={`${ui.chip} ${styles.chip}`}
            onClick={() => pick(allPicks(picks, view.rows))}
          >
            {RECYCLE_PICK_ALL}
          </button>
          <button
            type="button"
            className={`${ui.chip} ${styles.chip}`}
            onClick={() => pick(extraPicks(rules, picks, view.rows))}
          >
            {RECYCLE_PICK_EXTRA}
          </button>
          <HelpTip label={`${RECYCLE_PICK_EXTRA}, la règle`}>{RECYCLE_PICK_EXTRA_HELP}</HelpTip>
        </div>
      </div>

      {view.empty !== null ? (
        <p className={styles.empty}>{view.empty}</p>
      ) : (
        <ul className={styles.rows}>
          {view.rows.map((row) => (
            <Row
              key={row.cardId}
              row={row}
              onToggle={() => pick(toggledPick(rules, picks, row))}
              onStep={(step) => pick(steppedPick(picks, row, step))}
            />
          ))}
        </ul>
      )}

      <div className={styles.footer}>
        {confirming && view.confirm !== null && <p className={styles.confirm}>{view.confirm}</p>}
        <Button wide variant="primary" disabled={busy || view.action === null} onClick={recycle}>
          {busy
            ? RECYCLE_BUSY
            : confirming
              ? RECYCLE_CONFIRM_ACTION
              : (view.action ?? RECYCLE_NONE_PICKED)}
        </Button>
        {confirming && (
          <Button wide variant="ghost" onClick={() => setConfirming(false)}>
            {RECYCLE_REVIEW}
          </Button>
        )}
      </div>
    </div>
  );
}

function Gem({ rarity }: { readonly rarity: RecycleRow["rarity"] }) {
  const style = rarityStyles[rarity];
  return (
    <span
      className={styles.gem}
      style={{ background: cssFill(style.band), color: style.bandInk }}
      aria-hidden="true"
    >
      <RarityIcon rarity={rarity} size="14px" />
    </span>
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
    <li className={styles.row} data-on={on || undefined}>
      <button
        type="button"
        className={styles.pick}
        aria-pressed={on}
        aria-label={row.aria}
        onClick={onToggle}
      >
        <span className={styles.box} aria-hidden="true">
          {on && <Icon name="check" size={16} />}
        </span>
        <Gem rarity={row.rarity} />
        <span className={styles.word}>
          <strong>{row.word}</strong>
          <span className={styles.owned}>{row.owned}</span>
          {on && <span className={styles.ownedGain}>{row.gain}</span>}
        </span>
      </button>
      <span className={styles.stepper}>
        <button
          type="button"
          className={styles.step}
          aria-label={`Un double de moins, ${row.word}`}
          disabled={row.picked === 0}
          onClick={() => onStep(-1)}
        >
          <Icon name="minus" size={16} />
        </button>
        <span className={styles.picked} aria-live="polite">
          {row.picked}
        </span>
        <button
          type="button"
          className={styles.step}
          aria-label={`Un double de plus, ${row.word}`}
          disabled={row.picked >= row.max}
          onClick={() => onStep(1)}
        >
          <Icon name="plus" size={16} />
        </button>
      </span>
      <span className={styles.gain} data-on={on || undefined}>
        {row.gain}
        <ToyIcon name="ecu" size={16} />
      </span>
    </li>
  );
}
