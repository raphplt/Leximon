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
import { randomUUID } from "expo-crypto";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Pressable,
  ScrollView,
  type ScrollViewInstance,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { api } from "@/api/client";
import { catalogInHand, loadCatalog } from "@/cards/catalog";
import { publishTraded } from "@/player/collection";
import { useNow, useShared } from "@/player/shared";
import {
  incomingOffers,
  profile as ownProfile,
  progress as progressResource,
} from "@/player/state";
import { TAB_BAR_RISE } from "@/shell/tab-bar";
import { colors, fonts } from "@/theme";
import { Button } from "@/ui/button";
import { Icon } from "@/ui/icon";
import { Panel } from "@/ui/panel";
import { Segmented } from "@/ui/segmented";
import { TextButton } from "@/ui/text-button";
import { CardRow, catalogCard } from "./card-row";
import { Counterpart } from "./counterpart";
import { ProposeTrade } from "./propose-trade";

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

const OFFER_THUMB = 96;

/**
 * Échanges: offers received and sent, their history, and a new offer. `given` and `partner`
 * open a new offer at once: a card from its sheet, a player from their profile.
 */
export function TradesScreen({
  given,
  partner,
}: {
  readonly given: string | null;
  readonly partner: string | null;
}) {
  const [catalog, setCatalog] = useState<Catalog | null>(catalogInHand);
  const [profile, setProfile] = useState<ProfileResponse | null>(ownProfile.current);
  const [inboxes, setInboxes] = useState<Readonly<Record<TradeBox, Inbox>> | null>(null);
  const [failed, setFailed] = useState(false);
  const [tab, setTab] = useState<Tab>("incoming");
  const [notice, setNotice] = useState<Notice | null>(null);
  const [busyTradeId, setBusyTradeId] = useState<string | null>(null);
  const [preset, setPreset] = useState<string | null>(null);
  const [presetPartner, setPresetPartner] = useState<string | null>(null);
  const now = useNow(30_000);
  const progress = useShared(progressResource);
  const scroll = useRef<ScrollViewInstance>(null);

  useEffect(() => {
    if (given === null && partner === null) return;
    if (given !== null) setPreset(given);
    if (partner !== null) setPresetPartner(partner);
    setTab("propose");
    setNotice(null);
    router.setParams({ donne: undefined, avec: undefined });
  }, [given, partner]);

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
      incomingOffers.publish(splitTrades(incoming.trades, Date.now()).pending.length);
    } catch {
      setFailed(true);
    }
  }, []);

  // Each time the tab comes back into view: an offer may have arrived meanwhile.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

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
      const result = await api.resolveTrade(trade.id, action, randomUUID());
      if (result.kind === "ok") {
        replaceTrade(box, result.trade);
        // The recipient accepts: they get what was given and give what was wanted.
        if (action === "accept") publishTraded(result.trade.give, result.trade.want);
        if (box === "incoming") incomingOffers.refresh();
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

  if (failed && inboxes === null) {
    return (
      <View style={styles.failed}>
        <Text style={styles.hint}>Impossible de charger tes échanges.</Text>
        <Button label="Réessayer" secondary onPress={() => void load()} />
      </View>
    );
  }

  const ready = catalog !== null && profile !== null && inboxes !== null;
  const tooLow =
    progress === null || profile === null
      ? null
      : tradeLevelLabel(progress.level, profile.tradeMinLevel);
  const waiting = {
    incoming: inboxes === null ? 0 : splitTrades(inboxes.incoming.trades, now).pending.length,
    outgoing: inboxes === null ? 0 : splitTrades(inboxes.outgoing.trades, now).pending.length,
  };

  return (
    <View style={styles.screen}>
      <ScrollView
        ref={scroll}
        contentContainerStyle={styles.page}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.title} accessibilityRole="header">
            Échanges
          </Text>
          {profile !== null && <PlayerCode code={profile.playerCode} />}
        </View>
        {tooLow !== null && <Text style={styles.warning}>{tooLow}</Text>}
        <Segmented
          options={[
            { value: "incoming", label: boxTabLabel("incoming", waiting.incoming) },
            { value: "outgoing", label: boxTabLabel("outgoing", waiting.outgoing) },
            { value: "propose", label: "Nouvelle offre" },
          ]}
          value={tab}
          onChange={selectTab}
        />
        {ready && tab === "incoming" && (
          <Received
            catalog={catalog}
            inbox={inboxes.incoming}
            now={now}
            busyTradeId={busyTradeId}
            canAccept={tooLow === null}
            wordOf={(id) => catalogCard(catalog, id).word}
            onResolve={(trade, action) => void resolve("incoming", trade, action)}
            onLoadMore={() => void loadMore("incoming")}
            onPropose={() => selectTab("propose")}
          />
        )}
        {ready && tab === "outgoing" && (
          <Sent
            inbox={inboxes.outgoing}
            now={now}
            busyTradeId={busyTradeId}
            wordOf={(id) => catalogCard(catalog, id).word}
            onCancel={(trade) => void resolve("outgoing", trade, "cancel")}
            onLoadMore={() => void loadMore("outgoing")}
          />
        )}
        {/* Hidden rather than unmounted: an offer being prepared survives a look at the lists. */}
        {ready && (
          <View style={tab !== "propose" && styles.hidden}>
            <ProposeTrade
              catalog={catalog}
              ownCode={profile.playerCode}
              blocked={tooLow}
              preset={preset}
              presetPartner={presetPartner}
              onSent={onSent}
              onShowSent={() => selectTab("outgoing")}
              onStep={() => scroll.current?.scrollTo({ y: 0, animated: false })}
              notify={setNotice}
            />
          </View>
        )}
      </ScrollView>
      {/* Floats at the top: the offer just answered leaves the list, and its result stays in view. */}
      {notice !== null && <NoticeBanner notice={notice} onClose={() => setNotice(null)} />}
    </View>
  );
}

function NoticeBanner({
  notice,
  onClose,
}: {
  readonly notice: Notice;
  readonly onClose: () => void;
}) {
  const error = notice.tone === "error";
  return (
    <View
      style={[styles.notice, error && styles.noticeError]}
      accessibilityLiveRegion="polite"
      accessibilityRole={error ? "alert" : "text"}
    >
      <Text style={styles.noticeText}>
        {notice.text}
        {notice.albumLink === true && (
          <Text style={styles.noticeLink} onPress={() => router.navigate("/album")}>
            {" "}
            Voir mon album
          </Text>
        )}
      </Text>
      <Pressable
        onPress={onClose}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="Fermer le message"
      >
        <Icon name="close" size={18} color={colors.text} />
      </Pressable>
    </View>
  );
}

/** « Ton code K7QP 2MXA »: selectable, and sent with the share sheet. */
function PlayerCode({ code }: { readonly code: string }) {
  const share = () => {
    void Share.share({ message: `Mon code joueur Leximon : ${formatPlayerCode(code)}` });
  };
  return (
    <Pressable
      onPress={share}
      style={styles.codeChip}
      accessibilityRole="button"
      accessibilityLabel={`Partager mon code joueur, ${code.split("").join(" ")}`}
    >
      <Text style={styles.codeLabel}>Ton code</Text>
      <Text style={styles.code} selectable>
        {formatPlayerCode(code)}
      </Text>
      <Icon name="share" size={15} color={colors.textMuted} />
    </Pressable>
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
}) {
  const { pending, history } = splitTrades(inbox.trades, now);
  return (
    <>
      {pending.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>{NO_OFFER_RECEIVED}</Text>
          <Button label="Proposer un échange" secondary onPress={onPropose} />
        </View>
      ) : (
        pending.map((trade) => (
          <ReceivedOffer
            key={trade.id}
            catalog={catalog}
            trade={trade}
            now={now}
            busy={busyTradeId === trade.id}
            disabled={busyTradeId !== null}
            canAccept={canAccept}
            onResolve={(action) => onResolve(trade, action)}
          />
        ))
      )}
      <History box="incoming" trades={history} now={now} wordOf={wordOf} />
      {inbox.nextCursor !== null && (
        <TextButton label="Voir les offres plus anciennes" onPress={onLoadMore} />
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
}: {
  readonly catalog: Catalog;
  readonly trade: Trade;
  readonly now: number;
  readonly busy: boolean;
  readonly disabled: boolean;
  readonly canAccept: boolean;
  readonly onResolve: (action: Action) => void;
}) {
  // Accepting gives cards away for good: one more tap to be sure.
  const [confirming, setConfirming] = useState(false);
  const sides = tradeSides(trade, "incoming");
  return (
    <Panel accessibilityLabel={`Offre de ${playerName(sides.counterpart)}`}>
      <View style={styles.offerHeader}>
        <Counterpart player={sides.counterpart} />
        <View style={styles.timeLeft}>
          <Icon name="clock" size={13} color={colors.textMuted} />
          <Text style={styles.timeLeftText}>{timeLeftLabel(trade.expiresAt, now)}</Text>
        </View>
      </View>
      <View style={styles.sides}>
        <View style={styles.side}>
          <Text style={[styles.kicker, styles.getting]}>TU REÇOIS</Text>
          <CardRow catalog={catalog} cardIds={sides.theirs} width={OFFER_THUMB} />
        </View>
        <View style={styles.swap} importantForAccessibility="no-hide-descendants">
          <Icon name="echange" size={22} color={colors.textMuted} />
        </View>
        <View style={styles.side}>
          <Text style={[styles.kicker, styles.giving]}>TU DONNES</Text>
          <CardRow catalog={catalog} cardIds={sides.mine} width={OFFER_THUMB} />
        </View>
      </View>
      <View style={styles.offerActions}>
        {confirming ? (
          <>
            <Button
              label={busy ? "Échange…" : "Oui, échanger"}
              disabled={disabled}
              onPress={() => onResolve("accept")}
            />
            <TextButton label="Annuler" disabled={disabled} onPress={() => setConfirming(false)} />
          </>
        ) : (
          <>
            <Button
              label="Accepter l'échange"
              disabled={disabled || !canAccept}
              onPress={() => setConfirming(true)}
            />
            <TextButton
              label={busy ? "Un instant…" : "Refuser"}
              disabled={disabled}
              onPress={() => onResolve("decline")}
            />
          </>
        )}
      </View>
    </Panel>
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
    <>
      {pending.length === 0 ? (
        <Text style={styles.emptyText}>{NO_OFFER_SENT}</Text>
      ) : (
        pending.map((trade) => {
          const sides = tradeSides(trade, "outgoing");
          return (
            <Panel key={trade.id}>
              <Counterpart player={sides.counterpart} prefix="À " />
              <Text style={styles.sentWords}>
                <Text style={styles.italic}>{wordList(sides.mine, wordOf)}</Text> contre{" "}
                <Text style={styles.italic}>{wordList(sides.theirs, wordOf)}</Text>
              </Text>
              <Text style={styles.sentStatus}>
                En attente · {timeLeftLabel(trade.expiresAt, now).toLowerCase()}
              </Text>
              <Button
                label={busyTradeId === trade.id ? "Annulation…" : "Annuler l'offre"}
                secondary
                disabled={busyTradeId !== null}
                onPress={() => onCancel(trade)}
              />
            </Panel>
          );
        })
      )}
      <History box="outgoing" trades={history} now={now} wordOf={wordOf} />
      {inbox.nextCursor !== null && (
        <TextButton label="Voir les offres plus anciennes" onPress={onLoadMore} />
      )}
      <Text style={styles.rules}>{tradeRulesNote(now)}</Text>
    </>
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
    <View style={styles.history}>
      <Text style={styles.kicker} accessibilityRole="header">
        HISTORIQUE
      </Text>
      {trades.map((trade) => (
        <Text key={trade.id} style={styles.historyLine}>
          {historyLine(trade, box, now, wordOf)}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  page: { gap: 16, paddingHorizontal: 16, paddingTop: 8, paddingBottom: TAB_BAR_RISE + 24 },
  failed: { flex: 1, justifyContent: "center", gap: 16, paddingHorizontal: 24 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 10,
  },
  title: { fontFamily: fonts.display, fontSize: 30, color: colors.text },
  codeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 38,
    paddingHorizontal: 14,
    borderRadius: 19,
    backgroundColor: colors.panel,
  },
  codeLabel: { fontFamily: fonts.ui.semibold, fontSize: 13, color: colors.textMuted },
  code: { fontFamily: fonts.display, fontSize: 16, color: colors.text, letterSpacing: 1 },
  warning: { fontFamily: fonts.ui.bold, fontSize: 15, lineHeight: 21, color: colors.accent },
  hidden: { display: "none" },
  hint: { fontFamily: fonts.ui.semibold, fontSize: 16, color: colors.text, textAlign: "center" },
  empty: { gap: 14, paddingVertical: 12 },
  emptyText: {
    fontFamily: fonts.text.italic,
    fontSize: 18,
    lineHeight: 25,
    color: colors.textMuted,
    textAlign: "center",
  },
  kicker: {
    fontFamily: fonts.ui.extrabold,
    fontSize: 12,
    letterSpacing: 2,
    color: colors.textMuted,
  },
  getting: { color: colors.success },
  giving: { color: colors.danger },
  offerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  timeLeft: { flexDirection: "row", alignItems: "center", gap: 4 },
  timeLeftText: { fontFamily: fonts.ui.semibold, fontSize: 13, color: colors.textMuted },
  sides: { flexDirection: "row", alignItems: "center", gap: 8 },
  side: { flex: 1, gap: 8, alignItems: "center" },
  swap: { alignItems: "center", paddingTop: 20 },
  offerActions: { gap: 4, marginTop: 4 },
  sentWords: { fontFamily: fonts.text.regular, fontSize: 17, lineHeight: 24, color: colors.text },
  italic: { fontFamily: fonts.text.italic },
  sentStatus: { fontFamily: fonts.ui.semibold, fontSize: 13, color: colors.textMuted },
  history: { gap: 8, marginTop: 8 },
  historyLine: {
    fontFamily: fonts.ui.medium,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
  },
  rules: { fontFamily: fonts.ui.medium, fontSize: 13, lineHeight: 19, color: colors.textFaint },
  notice: {
    position: "absolute",
    top: 8,
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.success,
    backgroundColor: colors.sheet,
  },
  noticeError: { borderColor: colors.danger },
  noticeText: { flex: 1, fontFamily: fonts.ui.semibold, fontSize: 15, color: colors.text },
  noticeLink: { color: colors.accent, textDecorationLine: "underline" },
});
