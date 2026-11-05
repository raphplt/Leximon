"use client";

import type { JoustDeckResponse, JoustsResponse, PlayerBadge } from "@leximon/contract";
import { collectionName, type LaunchJoustResult } from "@leximon/contract/client";
import {
  accessText,
  DECK_AUTO,
  DECK_RULES,
  deckRefusalText,
  deckSummary,
  EDIT_DECK,
  JOUSTS_RULES,
  joustLine,
  LAUNCH_FRIENDLY,
  LAUNCH_RANKED,
  launchRefusalText,
  NO_FRIENDS_TO_DEFY,
  NO_JOUSTS,
  PLAY_JOUST,
  playerName,
  SAVE_DECK,
  sortJousts,
  toggleDeckCard,
} from "@leximon/view-model";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useCatalog } from "@/cards/use-catalog";
import { Avatar } from "@/components/avatar";
import { Card } from "@/components/card";
import { api } from "@/lib/api";
import { useNow } from "@/lib/use-now";
import { cardLabel, catalogCard } from "@/trades/card-thumb";
import { Button, ButtonLink } from "@/ui/button";
import { Dialog } from "@/ui/dialog";
import { LoadFailed } from "@/ui/load-failed";
import ui from "@/ui/ui.module.css";
import styles from "./jousts.module.css";

type Loaded =
  | { readonly state: "loading" }
  | { readonly state: "failed" }
  | { readonly state: "ready"; readonly jousts: JoustsResponse; readonly deck: JoustDeckResponse };

/** The jousts' hall: the deck, launching a joust, and the player's jousts. */
export function JoustsScreen() {
  const router = useRouter();
  const [loaded, setLoaded] = useState<Loaded>({ state: "loading" });
  const [refusal, setRefusal] = useState<string | null>(null);
  const [launching, setLaunching] = useState(false);
  const [deckOpen, setDeckOpen] = useState(false);
  const [friendsOpen, setFriendsOpen] = useState(false);
  // Kept until the server answers: a retry after a lost answer never launches twice.
  const pendingKey = useRef<string | null>(null);
  const now = useNow(60_000);

  const load = useCallback(() => {
    Promise.all([api.fetchJousts(), api.fetchJoustDeck()])
      .then(([jousts, deck]) => setLoaded({ state: "ready", jousts, deck }))
      .catch(() => setLoaded({ state: "failed" }));
  }, []);
  useEffect(load, [load]);

  const launch = async (request: Parameters<typeof api.launchJoust>[0]) => {
    if (loaded.state !== "ready") return;
    const key = pendingKey.current ?? crypto.randomUUID();
    pendingKey.current = key;
    setLaunching(true);
    setRefusal(null);
    let result: LaunchJoustResult;
    try {
      result = await api.launchJoust(request, key);
    } catch {
      setRefusal("Le serveur ne répond pas. Réessaie.");
      setLaunching(false);
      return;
    }
    pendingKey.current = null;
    setLaunching(false);
    if (result.kind === "launched") {
      router.push(`/joutes/${result.joustId}`);
      return;
    }
    setFriendsOpen(false);
    setRefusal(launchRefusalText(result.reason, loaded.jousts.opensAtLevel));
  };

  if (loaded.state === "failed") {
    return (
      <main className={styles.page}>
        <LoadFailed onRetry={load} />
      </main>
    );
  }
  if (loaded.state === "loading") return <main className={styles.page} />;
  const { jousts, deck } = loaded;
  const closed = accessText(jousts.access, jousts.opensAtLevel);

  return (
    <main className={styles.page}>
      <h1 className={`${ui.display} ${styles.title}`}>Joutes</h1>
      {closed !== null ? (
        <section className={`${ui.panel} ${styles.panel}`}>
          <p className={styles.line}>{closed}</p>
          {jousts.access === "account_required" && (
            <ButtonLink href="/compte">Créer mon compte</ButtonLink>
          )}
          {jousts.access === "pseudo_required" && (
            <ButtonLink href="/profil">Choisir mon pseudo</ButtonLink>
          )}
        </section>
      ) : (
        <>
          <section className={`${ui.panel} ${styles.panel}`}>
            <p className={styles.line}>{JOUSTS_RULES}</p>
            <div className={styles.actions}>
              <Button
                glow
                disabled={launching || !jousts.deckReady}
                onClick={() => void launch({ kind: "ranked" })}
              >
                {LAUNCH_RANKED}
              </Button>
              <Button
                variant="secondary"
                disabled={launching || !jousts.deckReady}
                onClick={() => setFriendsOpen(true)}
              >
                {LAUNCH_FRIENDLY}
              </Button>
            </div>
            {!jousts.deckReady && (
              <p className={styles.notice}>{launchRefusalText("deck_too_small", 0)}</p>
            )}
            {refusal !== null && (
              <p className={styles.notice} role="alert">
                {refusal}
              </p>
            )}
          </section>
          <DeckPanel deck={deck} onEdit={() => setDeckOpen(true)} />
          <section className={`${ui.panel} ${styles.panel}`}>
            <h2 className={ui.kicker}>Tes joutes</h2>
            {jousts.jousts.length === 0 ? (
              <p className={styles.line}>{NO_JOUSTS}</p>
            ) : (
              <ul className={styles.list}>
                {sortJousts(jousts.jousts).map((joust) => {
                  const line = joustLine(joust, jousts.questions, now || Date.now());
                  return (
                    <li key={joust.id} className={styles.row}>
                      <Avatar
                        avatar={joust.opponent?.avatar ?? null}
                        frame={joust.opponent?.frame ?? null}
                        size={44}
                      />
                      <div className={styles.rowText}>
                        <p className={styles.rowTitle}>{line.title}</p>
                        <p className={styles.rowDetail}>{line.detail}</p>
                      </div>
                      {line.toPlay ? (
                        <ButtonLink href={`/joutes/${joust.id}`} small>
                          {PLAY_JOUST}
                        </ButtonLink>
                      ) : (
                        <Link href={`/joutes/${joust.id}`} className={styles.rowLink}>
                          Voir
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
          <DeckDialog
            open={deckOpen}
            deck={deck}
            onClose={() => setDeckOpen(false)}
            onSaved={() => {
              setDeckOpen(false);
              load();
            }}
          />
          <FriendsDialog
            open={friendsOpen}
            busy={launching}
            onClose={() => setFriendsOpen(false)}
            onPick={(code) => void launch({ kind: "friendly", opponentCode: code })}
          />
        </>
      )}
    </main>
  );
}

function DeckPanel({
  deck,
  onEdit,
}: {
  readonly deck: JoustDeckResponse;
  readonly onEdit: () => void;
}) {
  const catalog = useCatalog();
  const cost = deckCost(deck, deck.cardIds);
  return (
    <section className={`${ui.panel} ${styles.panel}`}>
      <h2 className={ui.kicker}>Ton deck</h2>
      <p className={styles.line}>
        {deckSummary(deck.cardIds.length, deck.size, cost, deck.budget)}.{" "}
        {deck.saved ? "" : DECK_AUTO}
      </p>
      {catalog !== null && deck.cardIds.length > 0 && (
        <ul className={styles.deck}>
          {deck.cardIds.map((cardId) => {
            const card = catalogCard(catalog, cardId);
            return (
              <li key={cardId} aria-label={cardLabel(card)}>
                <Card
                  card={card}
                  collectionName={collectionName(catalog, card.collectionId)}
                  width={84}
                />
              </li>
            );
          })}
        </ul>
      )}
      <div className={styles.actions}>
        <Button variant="secondary" small onClick={onEdit}>
          {EDIT_DECK}
        </Button>
      </div>
    </section>
  );
}

function deckCost(deck: JoustDeckResponse, cardIds: readonly string[]): number {
  const costs = new Map(deck.candidates.map((candidate) => [candidate.cardId, candidate.cost]));
  return cardIds.reduce((total, id) => total + (costs.get(id) ?? 0), 0);
}

function DeckDialog({
  open,
  deck,
  onClose,
  onSaved,
}: {
  readonly open: boolean;
  readonly deck: JoustDeckResponse;
  readonly onClose: () => void;
  readonly onSaved: () => void;
}) {
  const catalog = useCatalog();
  const [chosen, setChosen] = useState<readonly string[]>(deck.cardIds);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (open) {
      setChosen(deck.cardIds);
      setMessage(null);
    }
  }, [open, deck.cardIds]);
  const costs = new Map(deck.candidates.map((candidate) => [candidate.cardId, candidate.cost]));
  const costOf = (cardId: string) => costs.get(cardId) ?? 0;

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

  const candidates = [...deck.candidates].sort(
    (a, b) => b.cost - a.cost || a.cardId.localeCompare(b.cardId),
  );
  return (
    <Dialog open={open} title="Ton deck" onClose={onClose}>
      <div className={styles.dialogBody}>
        <p className={styles.line}>{DECK_RULES}</p>
        <p className={styles.deckCount} aria-live="polite">
          {deckSummary(chosen.length, deck.size, deckCost(deck, chosen), deck.budget)}
        </p>
        {message !== null && (
          <p className={styles.notice} role="alert">
            {message}
          </p>
        )}
        {catalog !== null && (
          <ul className={styles.pick}>
            {candidates.map((candidate) => {
              const card = catalogCard(catalog, candidate.cardId);
              const inDeck = chosen.includes(candidate.cardId);
              return (
                <li key={candidate.cardId}>
                  <button
                    type="button"
                    className={`${styles.pickCard} ${inDeck ? styles.picked : ""}`}
                    aria-pressed={inDeck}
                    aria-label={`${cardLabel(card)}, ${candidate.cost} points`}
                    onClick={() => {
                      const next = toggleDeckCard(chosen, candidate.cardId, costOf, deck);
                      setChosen(next.deck);
                      setMessage(next.refused);
                    }}
                  >
                    <Card
                      card={card}
                      collectionName={collectionName(catalog, card.collectionId)}
                      width={96}
                    />
                    <span className={styles.cost}>{candidate.cost} pts</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <Button wide disabled={saving || chosen.length < deck.min} onClick={() => void save()}>
          {SAVE_DECK}
        </Button>
      </div>
    </Dialog>
  );
}

function FriendsDialog({
  open,
  busy,
  onClose,
  onPick,
}: {
  readonly open: boolean;
  readonly busy: boolean;
  readonly onClose: () => void;
  readonly onPick: (code: string) => void;
}) {
  const [players, setPlayers] = useState<readonly PlayerBadge[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!open) return;
    setFailed(false);
    api
      .fetchJoustOpponents()
      .then((response) => setPlayers(response.players))
      .catch(() => setFailed(true));
  }, [open]);

  return (
    <Dialog open={open} title={LAUNCH_FRIENDLY} onClose={onClose}>
      <div className={styles.dialogBody}>
        {failed && <p className={styles.notice}>Le serveur ne répond pas. Réessaie.</p>}
        {players !== null && players.length === 0 && (
          <p className={styles.line}>{NO_FRIENDS_TO_DEFY}</p>
        )}
        {players !== null && players.length > 0 && (
          <ul className={styles.list}>
            {players.map((player) => (
              <li key={player.code} className={styles.row}>
                <Avatar avatar={player.avatar} frame={player.frame} size={40} />
                <p className={`${styles.rowTitle} ${styles.rowText}`}>{playerName(player)}</p>
                <Button small disabled={busy} onClick={() => onPick(player.code)}>
                  Défier
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Dialog>
  );
}
