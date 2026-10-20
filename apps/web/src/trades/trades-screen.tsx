"use client";

import type { CatalogCard, ProfileResponse, Trade } from "@leximon/contract";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { type Catalog, loadCatalog } from "@/cards/catalog";
import { usePageView } from "@/lib/analytics";
import { ApiError, fetchProfile, fetchTrades, resolveTrade } from "@/lib/api";
import { useNow } from "@/lib/use-now";
import { CardRow, CardZoom } from "./card-thumb";
import {
  effectiveStatus,
  formatPlayerCode,
  type Notice,
  refusalMessage,
  splitTrades,
  statusLabel,
  type TradeBox,
  timeLeftLabel,
  tradeableFromLabel,
  tradeSides,
} from "./offer";
import { ProposeTrade } from "./propose-trade";
import styles from "./trades.module.css";

type Tab = TradeBox | "propose";

const TABS: readonly { readonly id: Tab; readonly label: string }[] = [
  { id: "incoming", label: "Reçues" },
  { id: "outgoing", label: "Envoyées" },
  { id: "propose", label: "Proposer" },
];

interface Inbox {
  readonly trades: readonly Trade[];
  readonly nextCursor: string | null;
}

type Action = "accept" | "decline" | "cancel";

const DONE_MESSAGES: Readonly<Record<Action, string>> = {
  accept: "Échange conclu ! Tes nouvelles cartes t'attendent dans ton album.",
  decline: "Offre refusée.",
  cancel: "Offre annulée.",
};

const PENDING_THUMB = 92;
const HISTORY_THUMB = 60;

export function TradesScreen() {
  usePageView("trades");
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [inboxes, setInboxes] = useState<Readonly<Record<TradeBox, Inbox>> | null>(null);
  const [failed, setFailed] = useState(false);
  const [tab, setTab] = useState<Tab>("incoming");
  const [notice, setNotice] = useState<Notice | null>(null);
  const [busyTradeId, setBusyTradeId] = useState<string | null>(null);
  const [zoomed, setZoomed] = useState<CatalogCard | null>(null);
  const now = useNow(30_000);

  // Runs again each time the page is shown after a navigation (Activity), so offers stay fresh.
  const load = useCallback(async () => {
    setFailed(false);
    try {
      const [loadedCatalog, loadedProfile, incoming, outgoing] = await Promise.all([
        loadCatalog(),
        fetchProfile(),
        fetchTrades("incoming"),
        fetchTrades("outgoing"),
      ]);
      setCatalog(loadedCatalog);
      setProfile(loadedProfile);
      setInboxes({ incoming, outgoing });
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const reloadBox = async (box: TradeBox) => {
    const page = await fetchTrades(box).catch(() => null);
    if (page !== null) setInboxes((current) => current && { ...current, [box]: page });
  };

  const replaceTrade = (box: TradeBox, trade: Trade) => {
    setInboxes(
      (current) =>
        current && {
          ...current,
          [box]: {
            ...current[box],
            trades: current[box].trades.map((t) => (t.id === trade.id ? trade : t)),
          },
        },
    );
  };

  const resolve = async (box: TradeBox, trade: Trade, action: Action) => {
    setBusyTradeId(trade.id);
    setNotice(null);
    try {
      const result = await resolveTrade(trade.id, action);
      if (result.kind === "ok") {
        replaceTrade(box, result.trade);
        setNotice({ tone: "success", text: DONE_MESSAGES[action], albumLink: action === "accept" });
      } else {
        setNotice({ tone: "error", text: refusalMessage(result.reason) });
        await reloadBox(box);
      }
    } catch (error) {
      setNotice({
        tone: "error",
        text:
          error instanceof ApiError && error.status === null
            ? "Pas de connexion pour l'instant. Réessaie dans un moment."
            : "Ça n'a pas marché. Réessaie dans un moment.",
      });
    } finally {
      setBusyTradeId(null);
    }
  };

  const loadMore = async (box: TradeBox) => {
    const cursor = inboxes?.[box].nextCursor ?? null;
    if (cursor === null) return;
    try {
      const page = await fetchTrades(box, cursor);
      setInboxes(
        (current) =>
          current && {
            ...current,
            [box]: {
              trades: [...current[box].trades, ...page.trades],
              nextCursor: page.nextCursor,
            },
          },
      );
    } catch {
      setNotice({ tone: "error", text: "Les offres plus anciennes n'ont pas pu se charger." });
    }
  };

  const onSent = (trade: Trade) => {
    setInboxes(
      (current) =>
        current && {
          ...current,
          outgoing: { ...current.outgoing, trades: [trade, ...current.outgoing.trades] },
        },
    );
  };

  const selectTab = (next: Tab) => {
    setTab(next);
    setNotice(null);
  };

  if (failed) {
    return (
      <main className={styles.screen}>
        <div className={styles.center}>
          <p className={styles.hint}>Impossible de charger tes échanges.</p>
          <button type="button" className={styles.secondary} onClick={() => void load()}>
            Réessayer
          </button>
        </div>
      </main>
    );
  }

  if (catalog === null || profile === null || inboxes === null) {
    return (
      <main className={styles.screen}>
        <p className={styles.hint}>Un instant…</p>
      </main>
    );
  }

  const tooRecent = now === 0 ? null : tradeableFromLabel(profile.canTradeFrom, now);
  const incomingPending = splitTrades(inboxes.incoming.trades, now).pending.length;

  return (
    <main className={styles.screen}>
      <header className={styles.header}>
        <p className={styles.kicker}>Carte contre carte</p>
        <h1 className={styles.title}>Échanges</h1>
      </header>

      <PlayerCode code={profile.playerCode} tooRecent={tooRecent} />

      <fieldset className={styles.tabs}>
        <legend className={styles.visuallyHidden}>Rubriques des échanges</legend>
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={styles.tab}
            aria-pressed={tab === item.id}
            onClick={() => selectTab(item.id)}
          >
            {item.label}
            {item.id === "incoming" && incomingPending > 0 && (
              <span className={styles.badge}>
                {incomingPending}
                <span className={styles.visuallyHidden}> en attente</span>
              </span>
            )}
          </button>
        ))}
      </fieldset>

      {tab !== "propose" && (
        <TradeList
          box={tab}
          catalog={catalog}
          inbox={inboxes[tab]}
          now={now}
          busyTradeId={busyTradeId}
          canAccept={tooRecent === null}
          onResolve={(trade, action) => void resolve(tab, trade, action)}
          onLoadMore={() => void loadMore(tab)}
          onPropose={() => selectTab("propose")}
          onZoom={setZoomed}
        />
      )}

      {/* Hidden rather than unmounted: an offer being prepared survives a look at the lists. */}
      <div hidden={tab !== "propose"}>
        <ProposeTrade
          catalog={catalog}
          ownCode={profile.playerCode}
          tooRecent={tooRecent}
          onSent={onSent}
          onShowSent={() => selectTab("outgoing")}
          onZoom={setZoomed}
          notify={setNotice}
        />
      </div>

      <CardZoom catalog={catalog} card={zoomed} onClose={() => setZoomed(null)} />

      {/* Floats at the top: the offer just answered leaves the list, and its result stays in view. */}
      <div className={styles.toastArea} role="status" aria-live="polite">
        {notice !== null && (
          <div className={notice.tone === "error" ? styles.toastError : styles.toast}>
            <p className={styles.toastText}>
              {notice.text}
              {notice.albumLink === true && (
                <>
                  {" "}
                  <Link href="/album">Voir mon album</Link>
                </>
              )}
            </p>
            <button
              type="button"
              className={styles.toastClose}
              onClick={() => setNotice(null)}
              aria-label="Fermer le message"
            >
              ×
            </button>
          </div>
        )}
      </div>
    </main>
  );
}

function PlayerCode({
  code,
  tooRecent,
}: {
  readonly code: string;
  readonly tooRecent: string | null;
}) {
  const [copied, setCopied] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shown = useRef<HTMLSpanElement>(null);

  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current);
    },
    [],
  );

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied("Code copié !");
    } catch {
      // No clipboard access (old browser, permission refused): select it for a manual copy.
      if (shown.current !== null) window.getSelection()?.selectAllChildren(shown.current);
      setCopied("Copie automatique impossible : le code est sélectionné, copie-le à la main.");
    }
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(null), 3000);
  };

  return (
    <section className={styles.codeCard} aria-labelledby="player-code-label">
      <p id="player-code-label" className={styles.codeLabel}>
        Ton code joueur
      </p>
      <div className={styles.codeRow}>
        <span className={styles.code}>
          <span ref={shown} aria-hidden="true">
            {formatPlayerCode(code)}
          </span>
          {/* Read letter by letter, as a code is. */}
          <span className={styles.visuallyHidden}>{code.split("").join(" ")}</span>
        </span>
        <button type="button" className={styles.copy} onClick={() => void copy()}>
          Copier
        </button>
      </div>
      <p className={styles.codeHint} role="status" aria-live="polite">
        {copied ?? "Donne-le à tes amis pour qu'ils te proposent des échanges."}
      </p>
      {tooRecent !== null && <p className={styles.codeWarning}>{tooRecent}</p>}
    </section>
  );
}

function TradeList({
  box,
  catalog,
  inbox,
  now,
  busyTradeId,
  canAccept,
  onResolve,
  onLoadMore,
  onPropose,
  onZoom,
}: {
  readonly box: TradeBox;
  readonly catalog: Catalog;
  readonly inbox: Inbox;
  readonly now: number;
  readonly busyTradeId: string | null;
  /** A recent account cannot accept yet (D-026). */
  readonly canAccept: boolean;
  readonly onResolve: (trade: Trade, action: Action) => void;
  readonly onLoadMore: () => void;
  readonly onPropose: () => void;
  readonly onZoom: (card: CatalogCard) => void;
}) {
  const { pending, history } = splitTrades(inbox.trades, now);

  if (inbox.trades.length === 0) {
    return (
      <div className={styles.empty}>
        <p className={styles.hint}>
          {box === "incoming"
            ? "Aucune offre reçue pour l'instant. Partage ton code joueur pour en recevoir !"
            : "Tu n'as encore proposé aucun échange."}
        </p>
        <button type="button" className={styles.primary} onClick={onPropose}>
          Proposer un échange
        </button>
      </div>
    );
  }

  return (
    <>
      <section aria-labelledby={`${box}-pending`}>
        <h2 id={`${box}-pending`} className={styles.sectionTitle}>
          En attente
        </h2>
        {pending.length === 0 ? (
          <p className={styles.muted}>
            {box === "incoming"
              ? "Aucune offre à examiner."
              : "Aucune offre en attente de réponse."}
          </p>
        ) : (
          <ul className={styles.offers}>
            {pending.map((trade) => (
              <li key={trade.id}>
                <PendingOffer
                  box={box}
                  catalog={catalog}
                  trade={trade}
                  now={now}
                  busy={busyTradeId === trade.id}
                  disabled={busyTradeId !== null}
                  canAccept={canAccept}
                  onResolve={(action) => onResolve(trade, action)}
                  onZoom={onZoom}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {history.length > 0 && (
        <section aria-labelledby={`${box}-history`}>
          <h2 id={`${box}-history`} className={styles.sectionTitle}>
            Historique récent
          </h2>
          <ul className={styles.offers}>
            {history.map((trade) => (
              <li key={trade.id}>
                <PastOffer box={box} catalog={catalog} trade={trade} now={now} onZoom={onZoom} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {inbox.nextCursor !== null && (
        <button type="button" className={styles.secondary} onClick={onLoadMore}>
          Voir les offres plus anciennes
        </button>
      )}
    </>
  );
}

function PendingOffer({
  box,
  catalog,
  trade,
  now,
  busy,
  disabled,
  canAccept,
  onResolve,
  onZoom,
}: {
  readonly box: TradeBox;
  readonly catalog: Catalog;
  readonly trade: Trade;
  readonly now: number;
  readonly busy: boolean;
  readonly disabled: boolean;
  readonly canAccept: boolean;
  readonly onResolve: (action: Action) => void;
  readonly onZoom: (card: CatalogCard) => void;
}) {
  // Accepting gives cards away for good: one more tap to be sure.
  const [confirming, setConfirming] = useState(false);
  const sides = tradeSides(trade, box);
  const code = formatPlayerCode(sides.counterpartCode);

  return (
    <article
      className={styles.offer}
      aria-label={`Offre ${box === "incoming" ? "de" : "à"} ${code}`}
    >
      <header className={styles.offerHeader}>
        <span className={styles.counterpart}>
          {box === "incoming" ? "De" : "À"} <strong>{code}</strong>
        </span>
        <span className={styles.timeLeft}>
          {now === 0 ? "" : timeLeftLabel(trade.expiresAt, now)}
        </span>
      </header>
      <p className={styles.sideLabel}>Tu reçois</p>
      <CardRow catalog={catalog} cardIds={sides.theirs} width={PENDING_THUMB} onZoom={onZoom} />
      <p className={styles.sideLabel}>Tu donnes</p>
      <CardRow catalog={catalog} cardIds={sides.mine} width={PENDING_THUMB} onZoom={onZoom} />

      <div className={styles.offerActions}>
        {box === "outgoing" && (
          <button
            type="button"
            className={styles.secondarySmall}
            disabled={disabled}
            onClick={() => onResolve("cancel")}
          >
            {busy ? "Annulation…" : "Annuler l'offre"}
          </button>
        )}
        {box === "incoming" && !confirming && (
          <>
            <button
              type="button"
              className={styles.primarySmall}
              disabled={disabled || !canAccept}
              onClick={() => setConfirming(true)}
            >
              Accepter
            </button>
            <button
              type="button"
              className={styles.secondarySmall}
              disabled={disabled}
              onClick={() => onResolve("decline")}
            >
              {busy ? "Un instant…" : "Refuser"}
            </button>
          </>
        )}
        {box === "incoming" && confirming && (
          <>
            <button
              type="button"
              className={styles.primarySmall}
              disabled={disabled}
              onClick={() => onResolve("accept")}
            >
              {busy ? "Échange…" : "Oui, échanger"}
            </button>
            <button
              type="button"
              className={styles.secondarySmall}
              disabled={disabled}
              onClick={() => setConfirming(false)}
            >
              Pas encore
            </button>
          </>
        )}
      </div>
      {box === "incoming" && !canAccept && (
        <p className={styles.acceptHint}>Tu pourras accepter dès que ton compte aura 3 jours.</p>
      )}
    </article>
  );
}

function PastOffer({
  box,
  catalog,
  trade,
  now,
  onZoom,
}: {
  readonly box: TradeBox;
  readonly catalog: Catalog;
  readonly trade: Trade;
  readonly now: number;
  readonly onZoom: (card: CatalogCard) => void;
}) {
  const sides = tradeSides(trade, box);
  const status = effectiveStatus(trade, now);
  return (
    <article className={styles.pastOffer}>
      <header className={styles.offerHeader}>
        <span className={styles.counterpart}>
          {box === "incoming" ? "De" : "À"}{" "}
          <strong>{formatPlayerCode(sides.counterpartCode)}</strong>
        </span>
        <span className={status === "completed" ? styles.statusDone : styles.status}>
          {statusLabel(status)}
        </span>
      </header>
      <div className={styles.pastSides}>
        <div>
          <p className={styles.sideLabel}>
            {status === "completed" ? "Tu as reçu" : "Tu recevais"}
          </p>
          <CardRow catalog={catalog} cardIds={sides.theirs} width={HISTORY_THUMB} onZoom={onZoom} />
        </div>
        <div>
          <p className={styles.sideLabel}>
            {status === "completed" ? "Tu as donné" : "Tu donnais"}
          </p>
          <CardRow catalog={catalog} cardIds={sides.mine} width={HISTORY_THUMB} onZoom={onZoom} />
        </div>
      </div>
    </article>
  );
}
