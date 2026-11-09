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
  tradeGuide,
  tradeLevelLabel,
  tradeRulesNote,
  tradeSides,
  WISHES_TAB,
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
import { Button, ButtonLink } from "@/ui/button";
import { Icon } from "@/ui/icon";
import { BindingRule, GiltCorners } from "@/ui/ornaments";
import { Bone, WaitingScreen } from "@/ui/skeleton";
import { useToast } from "@/ui/toast";
import ui from "@/ui/ui.module.css";
import { CardRow, catalogCard } from "./card-thumb";
import { Counterpart } from "./counterpart";
import { ProposeTrade } from "./propose-trade";
import styles from "./trades.module.css";
import { WishesPanel } from "./wishes-panel";

type Tab = TradeBox | "propose" | "wishes";

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
      setNotice({ tone: "error", text: "Les offres plus anciennes n'ont pas pu être chargées." });
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
        <button
          type="button"
          role="tab"
          aria-selected={tab === "wishes"}
          className={styles.tab}
          onClick={() => selectTab("wishes")}
        >
          {WISHES_TAB}
        </button>
      </div>

      {tab === "incoming" && (
        <Received
          catalog={catalog}
          code={profile.playerCode}
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
          code={profile.playerCode}
          inbox={inboxes.outgoing}
          now={now}
          busyTradeId={busyTradeId}
          wordOf={wordOf}
          onCancel={(trade) => void resolve("outgoing", trade, "cancel")}
          onLoadMore={() => void loadMore("outgoing")}
          onPropose={() => selectTab("propose")}
        />
      )}

      {tab === "wishes" && (
        <WishesPanel
          catalog={catalog}
          onOpen={open}
          onPropose={(code) => {
            setPresetPartner(code);
            selectTab("propose");
          }}
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

/** Widths of the four tabs, « Reçues », « Envoyées », « Nouvelle offre », « Souhaits ». */
const WAITING_TABS = [82, 98, 132, 96];

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

/** « Ton code K7QP 2MXA », copied with one tap. `large`: the code alone, set out to be read aloud. */
function PlayerCode({ code, large = false }: { readonly code: string; readonly large?: boolean }) {
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
      className={`${ui.chip} ${styles.codeChip} ${large ? styles.codeLarge : ""}`}
      onClick={() => void copy()}
      aria-label={`Copier mon code joueur, ${code.split("").join(" ")}`}
    >
      {!large && "Ton code "}
      <strong className={styles.code}>{formatPlayerCode(code)}</strong>
      <Icon name="share" size={large ? 18 : 15} />
    </button>
  );
}

/** No offer waiting in the box: how a trade goes, the code to give, and where to begin. */
function NoOffer({
  text,
  code,
  now,
  onPropose,
}: {
  readonly text: string;
  readonly code: string;
  readonly now: number;
  readonly onPropose: () => void;
}) {
  return (
    <section
      className={`${styles.empty} ${styles.framed} ${ui.leaf}`}
      aria-labelledby="trade-guide"
    >
      <BindingRule />
      <p className={styles.emptyText}>
        <em>{text}</em>
      </p>
      <h2 id="trade-guide" className={`${ui.kicker} ${styles.guideTitle}`}>
        Comment échanger
      </h2>
      <ol className={styles.guide}>
        {tradeGuide(now).map((step, index) => (
          <li key={step.title} className={styles.guideStep}>
            <span className={styles.guideNumber} aria-hidden="true">
              {index + 1}
            </span>
            <h3 className={styles.guideStepTitle}>{step.title}</h3>
            <p className={styles.guideText}>{step.text}</p>
            {index === 1 && <PlayerCode code={code} large />}
          </li>
        ))}
      </ol>
      <div className={styles.guideActions}>
        <Button onClick={onPropose}>Proposer un échange</Button>
        <ButtonLink href="/amis" variant="secondary">
          Voir mes amis
        </ButtonLink>
      </div>
    </section>
  );
}

function Received({
  catalog,
  code,
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
  readonly code: string;
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
        <NoOffer text={NO_OFFER_RECEIVED} code={code} now={now} onPropose={onPropose} />
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
      <GiltCorners />
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
              Annuler
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
  code,
  inbox,
  now,
  busyTradeId,
  wordOf,
  onCancel,
  onLoadMore,
  onPropose,
}: {
  readonly code: string;
  readonly inbox: Inbox;
  readonly now: number;
  readonly busyTradeId: string | null;
  readonly wordOf: (cardId: string) => string;
  readonly onCancel: (trade: Trade) => void;
  readonly onLoadMore: () => void;
  readonly onPropose: () => void;
}) {
  const { pending, history } = splitTrades(inbox.trades, now);
  return (
    <div className={styles.sent}>
      {pending.length === 0 ? (
        <NoOffer text={NO_OFFER_SENT} code={code} now={now} onPropose={onPropose} />
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
    <section className={`${styles.history} ${ui.leaf}`} aria-labelledby={`${box}-history`}>
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
