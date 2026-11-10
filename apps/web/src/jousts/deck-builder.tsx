"use client";

import { type JoustDeckResponse, RARITY_LABELS } from "@leximon/contract";
import type { Rarity } from "@leximon/core";
import {
  COMPLETE_DECK,
  completeDeck,
  DECK_SORTS,
  type DeckSort,
  deckCostLegend,
  deckPoolGroups,
  deckRefusalText,
  deckRoomLine,
  deckRuleLine,
  plural,
  SAVE_DECK,
  sortDeckPool,
  toggleDeckCard,
} from "@leximon/view-model";
import { type CSSProperties, type ReactNode, useState } from "react";
import { play } from "@/booster/feedback";
import { useCatalog } from "@/cards/use-catalog";
import { api } from "@/lib/api";
import { useNarrow } from "@/lib/use-narrow";
import desk from "@/play/desk-columns.module.css";
import { catalogCard } from "@/trades/card-thumb";
import { Toy } from "@/ui/toy";
import styles from "./jousts.module.css";
import { CostGem, MiniCard } from "./pieces";

const ALL_RARITIES = "Toutes";

/**
 * The deck being composed: its places as real cards, the gauge of its points and what room is
 * left, « Compléter pour moi », and the words found that can enter it, by rarity. Saved on the
 * server, which checks it again.
 */
export function DeckBuilder({
  deck,
  initial,
  intro,
  onSaved,
}: {
  readonly deck: JoustDeckResponse;
  readonly initial: readonly string[];
  readonly intro?: ReactNode;
  readonly onSaved: () => void;
}) {
  const catalog = useCatalog();
  const narrow = useNarrow();
  const [chosen, setChosen] = useState<readonly string[]>(initial);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [rarity, setRarity] = useState<Rarity | null>(null);
  const [sort, setSort] = useState<DeckSort>("rarity");
  const costs = new Map(deck.candidates.map((candidate) => [candidate.cardId, candidate.cost]));
  const costOf = (cardId: string) => costs.get(cardId) ?? 0;
  const traps = new Map(deck.trapped.map((card) => [card.cardId, card.count]));
  const spent = chosen.reduce((total, id) => total + costOf(id), 0);
  const left = deck.candidates.filter((candidate) => !chosen.includes(candidate.cardId));
  const cheapestLeft = left.length === 0 ? null : Math.min(...left.map((c) => c.cost));
  const slotWidth = narrow ? 52 : 84;
  const poolWidth = narrow ? 92 : 116;

  const toggle = (cardId: string) => {
    const next = toggleDeckCard(chosen, cardId, costOf, deck);
    setChosen(next.deck);
    setMessage(next.refused);
    if (next.refused === null) play("cardSlide");
  };

  const complete = () => {
    setChosen(completeDeck(chosen, deck.candidates, deck));
    setMessage(null);
    play("cardSlide");
  };

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const result = await api.saveJoustDeck(chosen);
      if (result.kind === "saved") onSaved();
      else setMessage(deckRefusalText(result.reason));
    } catch {
      setMessage("Le serveur ne répond pas. Réessaie.");
    } finally {
      setSaving(false);
    }
  };

  const groups =
    catalog === null
      ? []
      : deckPoolGroups(
          deck.candidates.map((candidate) => ({
            ...candidate,
            card: catalogCard(catalog, candidate.cardId),
          })),
        );
  const shown = groups.filter((group) => rarity === null || group.rarity === rarity);
  const poolCard = (candidate: (typeof groups)[number]["cards"][number]) => {
    const taken = chosen.includes(candidate.cardId);
    const fits = spent + candidate.cost <= deck.budget && chosen.length < deck.size;
    return (
      <li key={candidate.cardId}>
        <button
          type="button"
          className={styles.poolCard}
          data-taken={taken || undefined}
          disabled={!taken && !fits}
          aria-pressed={taken}
          aria-label={`${candidate.card.word}, ${plural(candidate.cost, "point", "points")}`}
          onClick={() => toggle(candidate.cardId)}
        >
          <MiniCard
            card={candidate.card}
            width={poolWidth}
            cost={candidate.cost}
            trapped={traps.get(candidate.cardId) ?? 0}
          />
          {taken && <span className={styles.takenMark}>Dans le deck</span>}
        </button>
      </li>
    );
  };
  return (
    <div className={styles.builder}>
      {intro}
      <p className={styles.rule}>{deckRuleLine(deck.size, deck.budget)}</p>
      <ul className={styles.legend}>
        {deckCostLegend(Date.now()).map((item) => (
          <li key={item.rarity}>
            <CostGem rarity={item.rarity} cost={item.cost} />
            {RARITY_LABELS[item.rarity]}
          </li>
        ))}
      </ul>
      <section className={styles.tray}>
        <header className={styles.trayHead}>
          <span className={desk.leafKicker}>
            Ton deck · {chosen.length} / {plural(deck.size, "carte", "cartes")}
          </span>
          <div className={styles.gauge}>
            <span className={styles.gaugeLabel}>Points</span>
            <span className={styles.gaugeBar} aria-hidden="true">
              <span style={{ width: `${Math.min(100, (spent / deck.budget) * 100)}%` }} />
            </span>
            <span className={styles.gaugeFigure} aria-live="polite">
              {spent} / {deck.budget}
            </span>
          </div>
        </header>
        <div className={styles.slots} style={{ "--w": `${slotWidth}px` } as CSSProperties}>
          {Array.from({ length: deck.size }, (_, index) => {
            const cardId = chosen[index];
            if (cardId === undefined || catalog === null) {
              return (
                // biome-ignore lint/suspicious/noArrayIndexKey: places of the deck, in order
                <span key={index} className={styles.slot}>
                  {index + 1}
                </span>
              );
            }
            const card = catalogCard(catalog, cardId);
            return (
              <button
                key={cardId}
                type="button"
                className={styles.slotFilled}
                onClick={() => toggle(cardId)}
                aria-label={`Retirer ${card.word}`}
              >
                <MiniCard
                  card={card}
                  width={slotWidth}
                  cost={costOf(cardId)}
                  trapped={traps.get(cardId) ?? 0}
                  className={styles.dropIn}
                />
              </button>
            );
          })}
        </div>
        <p className={styles.room} aria-live="polite">
          {deckRoomLine(chosen.length, spent, deck, cheapestLeft)}
        </p>
        {message !== null && (
          <p className={styles.notice} role="alert">
            {message}
          </p>
        )}
        <div className={styles.builderActions}>
          <Toy
            matter="paper"
            className={styles.control}
            disabled={chosen.length >= deck.size}
            onClick={complete}
          >
            {COMPLETE_DECK}
          </Toy>
          <Toy
            matter={chosen.length >= deck.min ? "gold" : "locked"}
            className={styles.control}
            disabled={saving || chosen.length < deck.min}
            onClick={() => void save()}
          >
            {SAVE_DECK}
          </Toy>
        </div>
      </section>

      <span className={desk.leafKicker}>Tes cartes</span>
      <div className={styles.poolTools}>
        {groups.length > 1 && (
          <fieldset className={styles.filters} aria-label="Rareté">
            {[null, ...groups.map((group) => group.rarity)].map((each) => (
              <Toy
                key={each ?? "all"}
                matter={each === rarity ? "gold" : "paper"}
                className={styles.filter}
                aria-pressed={each === rarity}
                onClick={() => setRarity(each)}
              >
                {each === null ? ALL_RARITIES : RARITY_LABELS[each]}
              </Toy>
            ))}
          </fieldset>
        )}
        <fieldset className={styles.filters} aria-label="Ordre">
          {DECK_SORTS.map((each) => (
            <Toy
              key={each.id}
              matter={each.id === sort ? "gold" : "paper"}
              className={styles.filter}
              aria-pressed={each.id === sort}
              onClick={() => setSort(each.id)}
            >
              {each.label}
            </Toy>
          ))}
        </fieldset>
      </div>
      {sort === "rarity" ? (
        shown.map((group) => (
          <div key={group.rarity} className={styles.poolGroup}>
            <span className={styles.poolHead}>
              {RARITY_LABELS[group.rarity]} · {plural(group.cost, "point", "points")}
            </span>
            <ul className={styles.pool} style={{ "--w": `${poolWidth}px` } as CSSProperties}>
              {group.cards.map(poolCard)}
            </ul>
          </div>
        ))
      ) : (
        <ul className={styles.pool} style={{ "--w": `${poolWidth}px` } as CSSProperties}>
          {sortDeckPool(
            shown.flatMap((group) => group.cards),
            sort,
            traps,
          ).map(poolCard)}
        </ul>
      )}
    </div>
  );
}
