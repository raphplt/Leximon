"use client";

import type { ProfileResponse, Trade } from "@leximon/contract";
import { ApiError, type Catalog } from "@leximon/contract/client";
import {
  boxTabLabel,
  formatPlayerCode,
  historyLine,
  NO_OFFER_RECEIVED,
  NO_OFFER_SENT,
  type Notice,
  playerName,
  refusalMessage,
  splitTrades,
  type TradeBox,
  timeLeftLabel,
  tradeLevelLabel,
  tradeRulesNote,
  tradeSides,
  wordList,
} from "@leximon/view-model";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { loadCatalog } from "@/cards/catalog";
import { api } from "@/lib/api";
import { useNow } from "@/lib/use-now";
import { publishTraded } from "@/player/collection";
import { profile as ownProfile } from "@/player/player";
import { useProgress } from "@/progress/use-progress";
import { useShell } from "@/shell/shell-context";
import { Button } from "@/ui/button";
import { Icon } from "@/ui/icon";
import { Bone, WaitingScreen } from "@/ui/skeleton";
import { useToast } from "@/ui/toast";
import ui from "@/ui/ui.module.css";
import { CardRow, catalogCard } from "./card-thumb";
import { Counterpart } from "./counterpart";
import { ProposeTrade } from "./propose-trade";
import styles from "./trades.module.css";

type Tab = TradeBox | "propose";

interface Inbox {
  readonly trades: readonly Trade[];
  readonly nextCursor: string | null;
}

type Action = "accept" | "decline" | "cancel";

const DONE_MESSAGES: Readonly<Record<Action, string>> = {
  accept: "Échange conclu.",
  decline: "Offre refusée.",
  cancel: "Offre annulée.",
};

const OFFER_THUMB = 80;

/** Échanges: offers received and sent, their history, and a new offer. */
export function TradesScreen() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [inboxes, setInboxes] = useState<Readonly<Record<TradeBox, Inbox>> | null>(null);
  const [failed, setFailed] = useState(false);
  const [tab, setTab] = useState<Tab>("incoming");
  const [notice, setNotice] = useState<Notice | null>(null);
  const [busyTradeId, setBusyTradeId] = useState<string | null>(null);
  // « Proposer en échange » on a card sheet opens a new offer with that card given.
  const [preset, setPreset] = useState<string | null>(null);
  // « Proposer un échange » on a public profile opens a new offer to that player.
  const [presetPartner, setPresetPartner] = useState<string | null>(null);
  const now = useNow(30_000);
  const progress = useProgress();
  const { openCard } = useShell();
  const params = useSearchParams();
  const given = params.get("donne");
  const partnerParam = params.get("avec");
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (given === null && partnerParam === null) return;
    if (given !== null) setPreset(given);
    if (partnerParam !== null) setPresetPartner(partnerParam);
    setTab("propose");
    router.replace(pathname, { scroll: false });
  }, [given, partnerParam, router, pathname]);

  // Runs again each time the page is shown after a navigation (Activity), so offers stay fresh.
  const load = useCallback(async () => {
    setFailed(false);
    try {
      const [loadedCatalog, loadedProfile, incoming, outgoing] = await Promise.all([
        loadCatalog(),
        ownProfile.read(),
        api.fetchTrades("incoming"),
        api.fetchTrades("outgoing"),
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
    const page = await api.fetchTrades(box).catch(() => null);
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
      const result = await api.resolveTrade(trade.id, action, crypto.randomUUID());
      if (result.kind === "ok") {
        replaceTrade(box, result.trade);
        // The recipient accepts: they get what was given and give what was wanted.
        if (action === "accept") publishTraded(result.trade.give, result.trade.want);
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
            ? "Pas de connexion. Réessaie."
            : "Ça n'a pas marché. Réessaie.",
      });
    } finally {
      setBusyTradeId(null);
    }
  };

  const loadMore = async (box: TradeBox) => {
    const cursor = inboxes?.[box].nextCursor ?? null;
    if (cursor === null) return;
    try {
      const page = await api.fetchTrades(box, cursor);
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
      setNotice({ tone: "error", text: "Les offres plus anciennes ne se chargent pas." });
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
        <p className={styles.hint}>Impossible de charger tes échanges.</p>
        <Button variant="secondary" onClick={() => void load()}>
          Réessayer
        </Button>
      </main>
    );
  }

  if (catalog === null || profile === null || inboxes === null) return <TradesWaiting />;

  const tooLow = progress === null ? null : tradeLevelLabel(progress.level, profile.tradeMinLevel);
  const waiting = {
    incoming: splitTrades(inboxes.incoming.trades, now).pending.length,
    outgoing: splitTrades(inboxes.outgoing.trades, now).pending.length,
  };
  const wordOf = (cardId: string) => catalogCard(catalog, cardId).word;
  const open = (cardId: string) => openCard(cardId);

  return (
    <main className={styles.screen}>
      <header className={styles.header}>
        <h1 className={`${ui.display} ${styles.title}`}>Échanges</h1>
        <PlayerCode code={profile.playerCode} />
      </header>
      {tooLow !== null && <p className={styles.warning}>{tooLow}</p>}

      <div className={styles.tabs} role="tablist" aria-label="Offres">
        {(["incoming", "outgoing"] as const).map((box) => (
          <button
            key={box}
            type="button"
            role="tab"
            aria-selected={tab === box}
            className={styles.tab}
            onClick={() => selectTab(box)}
          >
            {boxTabLabel(box, waiting[box])}
          </button>
        ))}
        <button
          type="button"
          role="tab"
          aria-selected={tab === "propose"}
          className={styles.tab}
          onClick={() => selectTab("propose")}
        >
          Nouvelle offre
        </button>
      </div>

      {tab === "incoming" && (
        <Received
          catalog={catalog}
          inbox={inboxes.incoming}
          now={now}
          busyTradeId={busyTradeId}
          canAccept={tooLow === null}
          wordOf={wordOf}
          onResolve={(trade, action) => void resolve("incoming", trade, action)}
          onLoadMore={() => void loadMore("incoming")}
          onPropose={() => selectTab("propose")}
          onOpen={open}
        />
      )}

      {tab === "outgoing" && (
        <Sent
          inbox={inboxes.outgoing}
          now={now}
          busyTradeId={busyTradeId}
          wordOf={wordOf}
          onCancel={(trade) => void resolve("outgoing", trade, "cancel")}
          onLoadMore={() => void loadMore("outgoing")}
        />
      )}

      {/* Hidden rather than unmounted: an offer being prepared survives a look at the lists. */}
      <div hidden={tab !== "propose"}>
        <ProposeTrade
          catalog={catalog}
          ownCode={profile.playerCode}
          blocked={tooLow}
          preset={preset}
          presetPartner={presetPartner}
          onSent={onSent}
          onShowSent={() => selectTab("outgoing")}
          onOpen={open}
          notify={setNotice}
        />
      </div>

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

/** Widths of the three tabs, « Reçues », « Envoyées », « Nouvelle offre ». */
const WAITING_TABS = [82, 98, 132];

/**
 * The frame while the offers arrive: the title, the code, the tabs. Below them, nothing: an
 * empty box and a list of offers are too far apart for one shape to stand for both.
 */
function TradesWaiting() {
  return (
    <WaitingScreen className={styles.screen}>
      <header className={styles.header}>
        <h1 className={`${ui.display} ${styles.title}`}>Échanges</h1>
        <Bone className={styles.codeBone} />
      </header>
      <div className={styles.tabs}>
        {WAITING_TABS.map((width) => (
          <Bone key={width} className={styles.tabBone} style={{ width }} />
        ))}
      </div>
    </WaitingScreen>
  );
}

/** « Ton code K7QP 2MXA », copied with one tap. */
function PlayerCode({ code }: { readonly code: string }) {
  const toast = useToast();
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      toast("Code copié.");
    } catch {
      toast(`Copie impossible. Ton code : ${formatPlayerCode(code)}`);
    }
  };
  return (
    <button
      type="button"
      className={`${ui.chip} ${styles.codeChip}`}
      onClick={() => void copy()}
      aria-label={`Copier mon code joueur, ${code.split("").join(" ")}`}
    >
      Ton code <strong className={`${ui.display} ${styles.code}`}>{formatPlayerCode(code)}</strong>
      <Icon name="share" size={15} />
    </button>
  );
}

function Received({
  catalog,
  inbox,
  now,
  busyTradeId,
  canAccept,
  wordOf,
  onResolve,
  onLoadMore,
  onPropose,
  onOpen,
}: {
  readonly catalog: Catalog;
  readonly inbox: Inbox;
  readonly now: number;
  readonly busyTradeId: string | null;
  /** A recent account cannot accept yet. */
  readonly canAccept: boolean;
  readonly wordOf: (cardId: string) => string;
  readonly onResolve: (trade: Trade, action: Action) => void;
  readonly onLoadMore: () => void;
  readonly onPropose: () => void;
  readonly onOpen: (cardId: string) => void;
}) {
  const { pending, history } = splitTrades(inbox.trades, now);
  return (
    <>
      {pending.length === 0 ? (
        <div className={styles.empty}>
          <p className={styles.emptyText}>
            <em>{NO_OFFER_RECEIVED}</em>
          </p>
          <Button variant="secondary" onClick={onPropose}>
            Proposer un échange
          </Button>
        </div>
      ) : (
        <ul className={styles.offers}>
          {pending.map((trade) => (
            <li key={trade.id}>
              <ReceivedOffer
                catalog={catalog}
                trade={trade}
                now={now}
                busy={busyTradeId === trade.id}
                disabled={busyTradeId !== null}
                canAccept={canAccept}
                onResolve={(action) => onResolve(trade, action)}
                onOpen={onOpen}
              />
            </li>
          ))}
        </ul>
      )}
      <History box="incoming" trades={history} now={now} wordOf={wordOf} />
      {inbox.nextCursor !== null && (
        <Button variant="ghost" onClick={onLoadMore}>
          Voir les offres plus anciennes
        </Button>
      )}
    </>
  );
}

function ReceivedOffer({
  catalog,
  trade,
  now,
  busy,
  disabled,
  canAccept,
  onResolve,
  onOpen,
}: {
  readonly catalog: Catalog;
  readonly trade: Trade;
  readonly now: number;
  readonly busy: boolean;
  readonly disabled: boolean;
  readonly canAccept: boolean;
  readonly onResolve: (action: Action) => void;
  readonly onOpen: (cardId: string) => void;
}) {
  // Accepting gives cards away for good: one more tap to be sure.
  const [confirming, setConfirming] = useState(false);
  const sides = tradeSides(trade, "incoming");
  const name = playerName(sides.counterpart);
  const zoom = (card: { readonly id: string }) => onOpen(card.id);

  return (
    <article className={`${ui.panel} ${styles.offer}`} aria-label={`Offre de ${name}`}>
      <header className={styles.offerHeader}>
        <Counterpart player={sides.counterpart} />
        <p className={styles.timeLeft}>
          <Icon name="clock" size={13} />
          {now === 0 ? "" : timeLeftLabel(trade.expiresAt, now)}
        </p>
      </header>
      <div className={styles.sides}>
        <div>
          <p className={`${ui.kicker} ${styles.getting}`}>Tu reçois</p>
          <CardRow catalog={catalog} cardIds={sides.theirs} width={OFFER_THUMB} onZoom={zoom} />
        </div>
        <span className={styles.swap} aria-hidden="true">
          <Icon name="echange" size={24} />
        </span>
        <div>
          <p className={`${ui.kicker} ${styles.giving}`}>Tu donnes</p>
          <CardRow catalog={catalog} cardIds={sides.mine} width={OFFER_THUMB} onZoom={zoom} />
        </div>
      </div>
      <div className={styles.offerActions}>
        {confirming ? (
          <>
            <Button className={styles.grow} disabled={disabled} onClick={() => onResolve("accept")}>
              {busy ? "Échange…" : "Oui, échanger"}
            </Button>
            <Button variant="ghost" disabled={disabled} onClick={() => setConfirming(false)}>
              Pas encore
            </Button>
          </>
        ) : (
          <>
            <Button
              className={styles.grow}
              disabled={disabled || !canAccept}
              onClick={() => setConfirming(true)}
            >
              Accepter l'échange
            </Button>
            <Button variant="ghost" disabled={disabled} onClick={() => onResolve("decline")}>
              {busy ? "Un instant…" : "Refuser"}
            </Button>
          </>
        )}
      </div>
    </article>
  );
}

function Sent({
  inbox,
  now,
  busyTradeId,
  wordOf,
  onCancel,
  onLoadMore,
}: {
  readonly inbox: Inbox;
  readonly now: number;
  readonly busyTradeId: string | null;
  readonly wordOf: (cardId: string) => string;
  readonly onCancel: (trade: Trade) => void;
  readonly onLoadMore: () => void;
}) {
  const { pending, history } = splitTrades(inbox.trades, now);
  return (
    <div className={styles.sent}>
      {pending.length === 0 ? (
        <p className={styles.emptyText}>
          <em>{NO_OFFER_SENT}</em>
        </p>
      ) : (
        <ul className={styles.offers}>
          {pending.map((trade) => {
            const sides = tradeSides(trade, "outgoing");
            return (
              <li key={trade.id}>
                <article className={`${ui.panel} ${styles.sentOffer}`}>
                  <div className={styles.sentText}>
                    <Counterpart player={sides.counterpart} prefix="À " />
                    <p className={styles.sentWords}>
                      <em>{wordList(sides.mine, wordOf)}</em> contre{" "}
                      <em>{wordList(sides.theirs, wordOf)}</em>
                    </p>
                    <p className={styles.sentStatus}>
                      En attente ·{" "}
                      {now === 0 ? "" : timeLeftLabel(trade.expiresAt, now).toLowerCase()}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    disabled={busyTradeId !== null}
                    onClick={() => onCancel(trade)}
                  >
                    {busyTradeId === trade.id ? "Annulation…" : "Annuler l'offre"}
                  </Button>
                </article>
              </li>
            );
          })}
        </ul>
      )}
      <History box="outgoing" trades={history} now={now} wordOf={wordOf} />
      {inbox.nextCursor !== null && (
        <Button variant="ghost" onClick={onLoadMore}>
          Voir les offres plus anciennes
        </Button>
      )}
      <p className={styles.rules}>{tradeRulesNote(now)}</p>
    </div>
  );
}

function History({
  box,
  trades,
  now,
  wordOf,
}: {
  readonly box: TradeBox;
  readonly trades: readonly Trade[];
  readonly now: number;
  readonly wordOf: (cardId: string) => string;
}) {
  if (trades.length === 0) return null;
  return (
    <section className={styles.history} aria-labelledby={`${box}-history`}>
      <h2 id={`${box}-history`} className={ui.kicker}>
        Historique
      </h2>
      <ul className={styles.historyList}>
        {trades.map((trade) => (
          <li key={trade.id}>{historyLine(trade, box, now, wordOf)}</li>
        ))}
      </ul>
    </section>
  );
}
