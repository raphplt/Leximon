"use client";

import type { WishesResponse, WishSeekersResponse } from "@leximon/contract";
import type { Catalog } from "@leximon/contract/client";
import {
  PROPOSE_TO_SEEKER,
  playerName,
  REMOVE_WISH,
  seekerLine,
  seekersNote,
  WISH_SEEKERS_TITLE,
  WISHES_TITLE,
  wishesNote,
} from "@leximon/view-model";
import { useCallback, useEffect, useState } from "react";
import { Avatar } from "@/components/avatar";
import { api } from "@/lib/api";
import { Button } from "@/ui/button";
import { LoadFailed } from "@/ui/load-failed";
import ui from "@/ui/ui.module.css";
import { CardRow, catalogCard } from "./card-thumb";
import styles from "./trades.module.css";

type Loaded =
  | { readonly state: "loading" }
  | { readonly state: "failed" }
  | {
      readonly state: "ready";
      readonly seekers: WishSeekersResponse;
      readonly wishes: WishesResponse;
    };

/** The players who look for the player's doubles, then the words the player looks for. */
export function WishesPanel({
  catalog,
  onOpen,
  onPropose,
}: {
  readonly catalog: Catalog;
  readonly onOpen: (cardId: string) => void;
  readonly onPropose: (code: string) => void;
}) {
  const [loaded, setLoaded] = useState<Loaded>({ state: "loading" });
  const [removing, setRemoving] = useState<string | null>(null);
  const load = useCallback(() => {
    Promise.all([api.fetchWishSeekers(), api.fetchWishes()])
      .then(([seekers, wishes]) => setLoaded({ state: "ready", seekers, wishes }))
      .catch(() => setLoaded({ state: "failed" }));
  }, []);
  useEffect(load, [load]);

  if (loaded.state === "failed") return <LoadFailed onRetry={load} />;
  if (loaded.state === "loading") return null;
  const { seekers, wishes } = loaded;

  const remove = async (cardId: string) => {
    setRemoving(cardId);
    try {
      await api.removeWish(cardId);
      setLoaded({
        ...loaded,
        wishes: { wishes: wishes.wishes.filter((wish) => wish.cardId !== cardId) },
      });
    } catch {
      // The word stays listed: the player may try again.
    } finally {
      setRemoving(null);
    }
  };

  return (
    <>
      <section className={`${styles.history} ${ui.leaf}`} aria-labelledby="wish-seekers">
        <h2 id="wish-seekers" className={styles.wishTitle}>
          {WISH_SEEKERS_TITLE}
        </h2>
        <ul className={styles.seekers}>
          {seekers.players.map(({ player, cardIds }) => (
            <li key={player.code} className={styles.seeker}>
              <div className={styles.seekerHead}>
                <Avatar avatar={player.avatar} frame={player.frame} size={40} />
                <span className={styles.seekerName}>{seekerLine(player, cardIds)}</span>
                <Button
                  onClick={() => onPropose(player.code)}
                  aria-label={`${PROPOSE_TO_SEEKER} à ${playerName(player)}`}
                >
                  {PROPOSE_TO_SEEKER}
                </Button>
              </div>
              <CardRow
                catalog={catalog}
                cardIds={cardIds}
                width={72}
                onZoom={(card) => onOpen(card.id)}
              />
            </li>
          ))}
        </ul>
        <p className={styles.wishNote}>{seekersNote(seekers.players.length)}</p>
      </section>

      <section className={`${styles.history} ${ui.leaf}`} aria-labelledby="wishes">
        <h2 id="wishes" className={styles.wishTitle}>
          {WISHES_TITLE}
        </h2>
        <ul className={styles.wishes}>
          {wishes.wishes.map((wish) => (
            <li key={wish.cardId} className={styles.wish}>
              <CardRow
                catalog={catalog}
                cardIds={[wish.cardId]}
                width={72}
                onZoom={(card) => onOpen(card.id)}
              />
              <button
                type="button"
                className={styles.wishRemove}
                disabled={removing === wish.cardId}
                onClick={() => void remove(wish.cardId)}
                aria-label={`${REMOVE_WISH} ${catalogCard(catalog, wish.cardId).word}`}
              >
                {REMOVE_WISH}
              </button>
            </li>
          ))}
        </ul>
        <p className={styles.wishNote}>{wishesNote(wishes.wishes.length)}</p>
      </section>
    </>
  );
}
