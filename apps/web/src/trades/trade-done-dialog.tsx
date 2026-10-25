"use client";

import type { Trade } from "@leximon/contract";
import { type TradeDone, tradeDoneAction, tradeDoneTitle, tradesDone } from "@leximon/view-model";
import { usePathname, useRouter } from "next/navigation";
import { type CSSProperties, useEffect, useState } from "react";
import { keep, readKept } from "@/beta/arrival-store";
import { collectionName } from "@/cards/catalog";
import { useCatalog } from "@/cards/use-catalog";
import { Card } from "@/components/card";
import { api } from "@/lib/api";
import { ownedCards, refreshIfRead } from "@/player/collection";
import { mailbox } from "@/player/mail";
import { useShared } from "@/player/resource";
import { useShell } from "@/shell/shell-context";
import { Button } from "@/ui/button";
import { Dialog } from "@/ui/dialog";
import ui from "@/ui/ui.module.css";
import { catalogCard } from "./card-thumb";
import styles from "./trade-done.module.css";

const SHOWN_KEY = "leximon.tradesDone";
/** Enough to cover every letter still unread; older ids drop off. */
const SHOWN_KEPT = 40;
/** How fresh the mail must be when the player moves to another screen. */
const MAIL_MAX_AGE_MS = 2 * 60_000;

function readShown(): ReadonlySet<number> {
  try {
    const kept: unknown = JSON.parse(readKept(SHOWN_KEY) ?? "[]");
    return new Set(Array.isArray(kept) ? kept.filter((id) => typeof id === "number") : []);
  } catch {
    return new Set();
  }
}

/**
 * An offer the other player accepted while its sender was away: the cards that came in, big,
 * the next time the sender comes by. Once per letter in this browser; the mail keeps the letter.
 */
export function TradeDoneDialog() {
  const box = useShared(mailbox);
  const pathname = usePathname();
  const [shown, setShown] = useState<ReadonlySet<number>>(() => new Set());
  const [ready, setReady] = useState(false);
  /** `null` once looked for and not found on the first page of sent offers. */
  const [trades, setTrades] = useState<ReadonlyMap<string, Trade | null>>(new Map());

  useEffect(() => {
    setShown(readShown());
    setReady(true);
  }, []);

  // Moving between screens is when an acceptance can show up, without a poll of its own.
  // biome-ignore lint/correctness/useExhaustiveDependencies: on each new screen
  useEffect(() => {
    mailbox.read(MAIL_MAX_AGE_MS).catch(() => {});
  }, [pathname]);

  const next: TradeDone | undefined =
    ready && box !== null ? tradesDone(box.letters, shown)[0] : undefined;
  const tradeId = next?.tradeId;

  useEffect(() => {
    if (tradeId === undefined || trades.has(tradeId)) return;
    // The sender's copies changed on the other side: the album reads them again.
    refreshIfRead(ownedCards);
    api
      .fetchTrades("outgoing")
      .then((page) => page.trades)
      .catch(() => [])
      .then((found) => {
        // Shown without its cards when missing: the trade sits in Échanges all the same.
        setTrades(
          (current) =>
            new Map([
              ...current,
              [tradeId, null],
              ...found.map((trade) => [trade.id, trade] as const),
            ]),
        );
      });
  }, [tradeId, trades]);

  const close = () => {
    if (next === undefined) return;
    const after = new Set([...shown, next.letterId]);
    setShown(after);
    keep(SHOWN_KEY, JSON.stringify([...after].slice(-SHOWN_KEPT)));
  };

  return (
    <Dialog
      open={next !== undefined && trades.has(next.tradeId)}
      title={next === undefined ? "Échange conclu" : tradeDoneTitle(next.player)}
      onClose={close}
      variant="center"
      hideTitle
    >
      {next !== undefined && (
        <Moment
          key={next.letterId}
          done={next}
          trade={trades.get(next.tradeId) ?? null}
          onClose={close}
        />
      )}
    </Dialog>
  );
}

function Moment({
  done,
  trade,
  onClose,
}: {
  readonly done: TradeDone;
  readonly trade: Trade | null;
  readonly onClose: () => void;
}) {
  const catalog = useCatalog();
  const router = useRouter();
  const { openCard } = useShell();
  // The sender gave `give` and asked for `want`: what they wanted is what came in.
  const received = trade?.want ?? [];
  const given = trade?.give ?? [];
  const width = received.length > 1 ? 118 : 168;

  const act = () => {
    onClose();
    const only = received[0];
    if (received.length === 1 && only !== undefined) openCard(only);
    else router.push("/album");
  };

  return (
    <div className={styles.moment}>
      <span className={styles.rays} aria-hidden="true" />
      <div className={styles.inner}>
        <p className={`${ui.kicker} ${styles.kicker}`}>Échange conclu</p>
        <h2 className={`${ui.display} ${ui.pop} ${styles.title}`}>{tradeDoneTitle(done.player)}</h2>

        {catalog !== null && received.length > 0 && (
          <>
            <ul className={styles.cards}>
              {received.map((cardId, index) => {
                const card = catalogCard(catalog, cardId);
                return (
                  <li
                    key={cardId}
                    className={`${styles.card} ${ui.pop}`}
                    style={{ animationDelay: `${160 + index * 140}ms` } as CSSProperties}
                  >
                    <button
                      type="button"
                      className={styles.cardButton}
                      onClick={() => {
                        onClose();
                        openCard(cardId);
                      }}
                      aria-label={`Lire ${card.word}`}
                    >
                      <Card
                        card={card}
                        collectionName={collectionName(catalog, card.collectionId)}
                        width={width}
                      />
                    </button>
                  </li>
                );
              })}
            </ul>
            {given.length > 0 && (
              <p className={styles.given}>
                Contre{" "}
                {given.map((cardId, index) => (
                  <span key={cardId}>
                    {index > 0 && (index === given.length - 1 ? " et " : ", ")}
                    <em>{catalogCard(catalog, cardId).word}</em>
                  </span>
                ))}
                .
              </p>
            )}
          </>
        )}

        <Button wide className={styles.action} onClick={act}>
          {received.length === 0 ? "Voir mes échanges" : tradeDoneAction(received.length)}
        </Button>
        <Button wide variant="ghost" className={styles.later} onClick={onClose}>
          Plus tard
        </Button>
      </div>
    </div>
  );
}
