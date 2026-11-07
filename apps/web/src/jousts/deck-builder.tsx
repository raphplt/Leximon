"use client";

import type { JoustDeckResponse } from "@leximon/contract";
import {
  COMPLETE_DECK,
  completeDeck,
  deckRefusalText,
  plural,
  SAVE_DECK,
  toggleDeckCard,
} from "@leximon/view-model";
import { type ReactNode, useState } from "react";
import { play } from "@/booster/feedback";
import { useCatalog } from "@/cards/use-catalog";
import { api } from "@/lib/api";
import desk from "@/play/desk-columns.module.css";
import { catalogCard } from "@/trades/card-thumb";
import { Toy } from "@/ui/toy";
import styles from "./jousts.module.css";
import { MiniCard } from "./pieces";

/**
 * The deck being composed: its places, the gauge of its points, « Compléter pour moi », and the
 * words found that can enter it. Saved on the server, which checks it again.
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
  const [chosen, setChosen] = useState<readonly string[]>(initial);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const costs = new Map(deck.candidates.map((candidate) => [candidate.cardId, candidate.cost]));
  const costOf = (cardId: string) => costs.get(cardId) ?? 0;
  const traps = new Map(deck.trapped.map((card) => [card.cardId, card.count]));
  const spent = chosen.reduce((total, id) => total + costOf(id), 0);

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

  const pool = [...deck.candidates].sort(
    (a, b) => b.cost - a.cost || a.cardId.localeCompare(b.cardId),
  );
  return (
    <div className={styles.builder}>
      {intro}
      <div className={styles.builderBody}>
        <div className={styles.slots}>
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
                  cost={costOf(cardId)}
                  trapped={traps.get(cardId) ?? 0}
                  className={styles.dropIn}
                />
              </button>
            );
          })}
        </div>
        <div className={styles.gauge}>
          <span className={styles.gaugeLabel}>Points</span>
          <span className={styles.gaugeBar} aria-hidden="true">
            <span style={{ width: `${Math.min(100, (spent / deck.budget) * 100)}%` }} />
          </span>
          <span className={styles.gaugeFigure} aria-live="polite">
            {spent} / {deck.budget}
          </span>
        </div>
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
        <span className={desk.leafKicker}>Tes mots trouvés</span>
        {catalog !== null && (
          <ul className={styles.pool}>
            {pool.map((candidate) => {
              const card = catalogCard(catalog, candidate.cardId);
              const taken = chosen.includes(candidate.cardId);
              const fits = spent + candidate.cost <= deck.budget && chosen.length < deck.size;
              return (
                <li key={candidate.cardId}>
                  <button
                    type="button"
                    className={styles.poolCard}
                    data-taken={taken || undefined}
                    disabled={taken || !fits}
                    aria-label={`${card.word}, ${plural(candidate.cost, "point", "points")}`}
                    onClick={() => toggle(candidate.cardId)}
                  >
                    <MiniCard
                      card={card}
                      cost={candidate.cost}
                      trapped={traps.get(candidate.cardId) ?? 0}
                    />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
