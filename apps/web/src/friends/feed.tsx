"use client";

import type { FeedEvent, FriendReactionKind } from "@leximon/contract";
import { collectionName } from "@leximon/contract/client";
import {
  FEED_EMPTY,
  feedLine,
  feedReactions,
  messageTime,
  withReaction,
} from "@leximon/view-model";
import { useEffect, useState } from "react";
import { useCatalog } from "@/cards/use-catalog";
import { Avatar } from "@/components/avatar";
import { api } from "@/lib/api";
import { profile } from "@/player/player";
import { useShared } from "@/player/resource";
import { useShell } from "@/shell/shell-context";
import { Button } from "@/ui/button";
import { Bone } from "@/ui/skeleton";
import { useToast } from "@/ui/toast";
import ui from "@/ui/ui.module.css";
import styles from "./friends.module.css";

/** What friends found lately, with the reactions they got. */
export function FriendFeed({ now }: { readonly now: number }) {
  const [events, setEvents] = useState<readonly FeedEvent[] | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [failed, setFailed] = useState(false);
  const [picking, setPicking] = useState<number | null>(null);
  const me = useShared(profile);
  const catalog = useCatalog();
  const toast = useToast();
  const { openCard } = useShell();

  useEffect(() => {
    api
      .fetchFeed()
      .then((page) => {
        setEvents(page.events);
        setHasMore(page.hasMore);
      })
      .catch(() => setFailed(true));
  }, []);

  const loadOlder = async () => {
    const last = events?.at(-1);
    if (last === undefined) return;
    const page = await api.fetchFeed(last.id).catch(() => null);
    if (page === null) return;
    setEvents((current) => [...(current ?? []), ...page.events]);
    setHasMore(page.hasMore);
  };

  const choose = async (event: FeedEvent, reaction: FriendReactionKind) => {
    setPicking(null);
    const next = event.mine === reaction ? null : reaction;
    const swap = (to: FeedEvent) =>
      setEvents((current) => current?.map((e) => (e.id === event.id ? to : e)) ?? null);
    swap(withReaction(event, next));
    try {
      const result = await api.react(event.id, next);
      if (result.kind === "refused") throw new Error(result.reason);
    } catch {
      swap(event);
      toast("Réaction perdue en route. Réessaie.");
    }
  };

  return (
    <section className={`${ui.panel} ${styles.card}`}>
      <p className={ui.kicker}>Le fil des amis</p>
      {events === null ? (
        failed ? (
          <p className={styles.small}>Le fil ne répond pas.</p>
        ) : (
          <Bone className={styles.feedBone} />
        )
      ) : events.length === 0 ? (
        <p className={styles.empty}>{FEED_EMPTY}</p>
      ) : (
        <ul className={styles.feed}>
          {events.map((event) => {
            const self = me !== null && event.player.code === me.playerCode;
            const card = "cardId" in event ? (catalog?.cardsById.get(event.cardId) ?? null) : null;
            const collection =
              event.kind === "collection_complete" && catalog !== null
                ? collectionName(catalog, event.collectionId)
                : null;
            const line = feedLine(event, self, card, collection);
            const reactions = feedReactions(event, { self, picking: picking === event.id });
            return (
              <li key={event.id} className={styles.event}>
                <Avatar avatar={event.player.avatar} frame={null} size={36} />
                <div className={styles.eventBody}>
                  <p className={styles.eventLine}>
                    {line.before}
                    {line.word !== null &&
                      (card !== null ? (
                        <button
                          type="button"
                          className={styles.eventWord}
                          onClick={() => openCard(card.id)}
                        >
                          {line.word}
                        </button>
                      ) : (
                        <em>{line.word}</em>
                      ))}
                    {line.after}
                  </p>
                  <div className={styles.reactions}>
                    <span className={styles.faint}>{messageTime(event.createdAt, now)}</span>
                    {reactions.chips.map((chip) =>
                      self ? (
                        <span key={chip.id} className={styles.reaction}>
                          {chip.label} · {chip.count}
                        </span>
                      ) : (
                        <button
                          key={chip.id}
                          type="button"
                          className={styles.reaction}
                          aria-pressed={chip.mine}
                          onClick={() => void choose(event, chip.id)}
                        >
                          {chip.label}
                          {chip.count > 0 && ` · ${chip.count}`}
                        </button>
                      ),
                    )}
                    {reactions.canReact && (
                      <button
                        type="button"
                        className={`${styles.reaction} ${styles.react}`}
                        onClick={() => setPicking(event.id)}
                      >
                        Réagir
                      </button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {hasMore && (
        <Button variant="ghost" small onClick={() => void loadOlder()}>
          Plus ancien
        </Button>
      )}
    </section>
  );
}
