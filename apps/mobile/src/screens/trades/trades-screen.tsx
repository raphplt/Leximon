import type { ProfileResponse, Trade } from "@leximon/contract";
import { ApiError, type Catalog } from "@leximon/contract/client";
import { toyMatters, toy as toyValues } from "@leximon/tokens";
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
import { alpha, colors, fontSizes, fonts, IS_LIBRARY, paperColors, radii, space } from "@/theme";
import { Button } from "@/ui/button";
import { Icon } from "@/ui/icon";
import { OnPaper, Panel } from "@/ui/panel";
import { Segmented } from "@/ui/segmented";
import { TextButton } from "@/ui/text-button";
import { Lettering, toyFace } from "@/ui/toy";
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
          {IS_LIBRARY ? (
            <View accessibilityRole="header">
              <Lettering size={fontSizes.heading}>Échanges</Lettering>
            </View>
          ) : (
            <Text style={styles.title} accessibilityRole="header">
              Échanges
            </Text>
          )}
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
            code={profile.playerCode}
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
            code={profile.playerCode}
            inbox={inboxes.outgoing}
            now={now}
            busyTradeId={busyTradeId}
            wordOf={(id) => catalogCard(catalog, id).word}
            onCancel={(trade) => void resolve("outgoing", trade, "cancel")}
            onLoadMore={() => void loadMore("outgoing")}
            onPropose={() => selectTab("propose")}
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
        <Icon name="close" size={18} color={colors.pageInk} />
      </Pressable>
    </View>
  );
}

/**
 * « Ton code K7QP 2MXA »: selectable, and sent with the share sheet. `large`: the code alone, set
 * out to be read aloud.
 */
function PlayerCode({ code, large = false }: { readonly code: string; readonly large?: boolean }) {
  const share = () => {
    void Share.share({ message: `Mon code joueur Leximon : ${formatPlayerCode(code)}` });
  };
  return (
    <Pressable
      onPress={share}
      style={[
        styles.codeChip,
        large && styles.codeChipLarge,
        IS_LIBRARY && [styles.codeToy, toyFace("paper", "tag")],
      ]}
      accessibilityRole="button"
      accessibilityLabel={`Partager mon code joueur, ${code.split("").join(" ")}`}
    >
      {!large && <Text style={styles.codeLabel}>Ton code</Text>}
      <Text
        style={[styles.code, large && styles.codeLarge, IS_LIBRARY && styles.codeWell]}
        selectable
      >
        {formatPlayerCode(code)}
      </Text>
      <Icon name="share" size={large ? 18 : 15} color={ink.pageInkMuted} />
    </Pressable>
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
    <OnPaper>
      <View style={styles.empty}>
        <Text style={styles.emptyText}>{text}</Text>
        <Text style={[styles.kicker, styles.guideTitle]} accessibilityRole="header">
          COMMENT ÉCHANGER
        </Text>
        {tradeGuide(now).map((step, index) => (
          <View key={step.title} style={styles.guideStep}>
            <View style={[styles.guideNumber, IS_LIBRARY && styles.guideNumberGilt]}>
              <Text style={[styles.guideNumberText, IS_LIBRARY && styles.guideNumberGiltText]}>
                {index + 1}
              </Text>
            </View>
            <View style={styles.guideBody}>
              <Text style={styles.guideStepTitle}>{step.title}</Text>
              <Text style={styles.guideText}>{step.text}</Text>
              {index === 1 && <PlayerCode code={code} large />}
            </View>
          </View>
        ))}
        <Button label="Proposer un échange" onPress={onPropose} />
        <Button label="Voir mes amis" secondary onPress={() => router.push("/amis")} />
      </View>
    </OnPaper>
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
}) {
  const { pending, history } = splitTrades(inbox.trades, now);
  return (
    <>
      {pending.length === 0 ? (
        <NoOffer text={NO_OFFER_RECEIVED} code={code} now={now} onPropose={onPropose} />
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
    <Panel paper accessibilityLabel={`Offre de ${playerName(sides.counterpart)}`}>
      <View style={styles.offerHeader}>
        <Counterpart player={sides.counterpart} />
        <View style={styles.timeLeft}>
          <Icon name="clock" size={13} color={ink.pageInkMuted} />
          <Text style={styles.timeLeftText}>{timeLeftLabel(trade.expiresAt, now)}</Text>
        </View>
      </View>
      <View style={styles.sides}>
        <View style={styles.side}>
          <Text style={[styles.kicker, styles.getting]}>TU REÇOIS</Text>
          <CardRow catalog={catalog} cardIds={sides.theirs} width={OFFER_THUMB} />
        </View>
        <View style={styles.swap} importantForAccessibility="no-hide-descendants">
          <Icon name="echange" size={22} color={ink.pageInkMuted} />
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
    <>
      {pending.length === 0 ? (
        <NoOffer text={NO_OFFER_SENT} code={code} now={now} onPropose={onPropose} />
      ) : (
        pending.map((trade) => {
          const sides = tradeSides(trade, "outgoing");
          return (
            <Panel key={trade.id} paper>
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
    <OnPaper>
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
    </OnPaper>
  );
}

/** The offers, the history and the empty boxes are read on paper in « La Bibliothèque ». */
const ink = paperColors;

const styles = StyleSheet.create({
  screen: { flex: 1 },
  page: {
    gap: space.s8,
    paddingHorizontal: space.s8,
    paddingTop: space.s4,
    paddingBottom: TAB_BAR_RISE + 24,
  },
  failed: { flex: 1, justifyContent: "center", gap: space.s8, paddingHorizontal: space.s12 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: space.s5,
  },
  title: { fontFamily: fonts.display, fontSize: fontSizes.heading, color: colors.pageInk },
  codeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.s4,
    minHeight: 38,
    paddingHorizontal: space.s7,
    borderRadius: 19,
    backgroundColor: colors.panel,
  },
  codeToy: { marginBottom: 3 },
  codeLabel: {
    fontFamily: fonts.ui.semibold,
    fontSize: fontSizes.small,
    color: ink.pageInkMuted,
  },
  codeChipLarge: { alignSelf: "flex-start", minHeight: 48, marginTop: space.s3 },
  // Plain letters, wide apart: a code is read aloud or copied by hand, never guessed at.
  code: {
    fontFamily: fonts.ui.extrabold,
    fontSize: fontSizes.bodyLarge,
    color: ink.pageInk,
    letterSpacing: 2,
    fontVariant: ["tabular-nums"],
  },
  codeLarge: { fontSize: fontSizes.title },
  codeWell: {
    overflow: "hidden",
    paddingHorizontal: space.s4,
    paddingVertical: 1,
    borderRadius: 6,
    backgroundColor: alpha(toyMatters.paper.edge, 0.45),
  },
  warning: {
    fontFamily: fonts.ui.bold,
    fontSize: fontSizes.body,
    lineHeight: 21,
    color: colors.rubric,
  },
  hidden: { display: "none" },
  hint: {
    fontFamily: fonts.ui.semibold,
    fontSize: fontSizes.bodyLarge,
    color: colors.pageInk,
    textAlign: "center",
  },
  empty: { gap: space.s7, paddingVertical: space.s6 },
  guideTitle: { textAlign: "center", marginTop: space.s2 },
  // The number stands in the margin of its step.
  guideStep: { flexDirection: "row", gap: space.s5 },
  guideNumber: {
    alignItems: "center",
    justifyContent: "center",
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.action,
  },
  guideNumberText: {
    fontFamily: fonts.ui.extrabold,
    fontSize: fontSizes.body,
    color: colors.actionInk,
  },
  guideNumberGilt: {
    borderWidth: toyValues.outlineWidth,
    borderColor: toyValues.outline,
    backgroundColor: toyMatters.gold.bottom,
  },
  guideNumberGiltText: { color: toyValues.outline },
  guideBody: { flex: 1, gap: space.s2 },
  guideStepTitle: {
    fontFamily: fonts.ui.extrabold,
    fontSize: fontSizes.bodyLarge,
    lineHeight: 32,
    color: ink.pageInk,
  },
  guideText: {
    fontFamily: fonts.text.regular,
    fontSize: fontSizes.body,
    lineHeight: 21,
    color: ink.pageInkMuted,
  },
  emptyText: {
    fontFamily: fonts.text.italic,
    fontSize: fontSizes.subtitle,
    lineHeight: 25,
    color: ink.pageInkMuted,
    textAlign: "center",
  },
  kicker: {
    fontFamily: fonts.ui.extrabold,
    fontSize: fontSizes.caption,
    letterSpacing: 2,
    color: ink.pageInkMuted,
  },
  getting: { color: ink.success },
  giving: { color: ink.danger },
  offerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.s4,
  },
  timeLeft: { flexDirection: "row", alignItems: "center", gap: space.s2 },
  timeLeftText: {
    fontFamily: fonts.ui.semibold,
    fontSize: fontSizes.small,
    color: ink.pageInkMuted,
  },
  sides: { flexDirection: "row", alignItems: "center", gap: space.s4 },
  side: { flex: 1, gap: space.s4, alignItems: "center" },
  swap: { alignItems: "center", paddingTop: space.s10 },
  offerActions: { gap: space.s2, marginTop: space.s2 },
  sentWords: {
    fontFamily: fonts.text.regular,
    fontSize: fontSizes.lead,
    lineHeight: 24,
    color: ink.pageInk,
  },
  italic: { fontFamily: fonts.text.italic },
  sentStatus: {
    fontFamily: fonts.ui.semibold,
    fontSize: fontSizes.small,
    color: ink.pageInkMuted,
  },
  history: { gap: space.s4, marginTop: space.s4 },
  historyLine: {
    fontFamily: fonts.ui.medium,
    fontSize: fontSizes.label,
    lineHeight: 20,
    color: ink.pageInkMuted,
  },
  rules: {
    fontFamily: fonts.ui.medium,
    fontSize: fontSizes.small,
    lineHeight: 19,
    color: colors.pageInkFaint,
  },
  notice: {
    position: "absolute",
    top: 8,
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: space.s6,
    padding: space.s7,
    borderRadius: radii.xxl,
    borderWidth: 2,
    borderColor: colors.success,
    backgroundColor: colors.sheet,
  },
  noticeError: { borderColor: colors.danger },
  noticeText: {
    flex: 1,
    fontFamily: fonts.ui.semibold,
    fontSize: fontSizes.body,
    color: colors.pageInk,
  },
  noticeLink: { color: colors.rubric, textDecorationLine: "underline" },
});
