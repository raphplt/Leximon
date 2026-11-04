import type { ClanMember, ClanMessage, ClanRole } from "@leximon/contract";
import { canAct } from "@leximon/core";
import { toyMatters, toy as toyValues } from "@leximon/tokens";
import {
  chatPollDelay,
  EMPTY_DISCUSSION,
  eventText,
  insertMention,
  MESSAGE_PLACEHOLDER,
  mentionQuery,
  mergeMessages,
  messageSegments,
  messageTime,
  mutedUntilLabel,
  playerName,
  REMOVED_MESSAGE,
  writingBlock,
} from "@leximon/view-model";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  AppState,
  Pressable,
  ScrollView,
  type ScrollViewInstance,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { api } from "@/api/client";
import { refusalText } from "@/clan/act";
import { useShared } from "@/player/shared";
import { sanctions } from "@/player/state";
import { fontSizes, fonts, paperColors, radii, space } from "@/theme";
import { Avatar } from "@/ui/avatar";
import { Button } from "@/ui/button";
import { Icon } from "@/ui/icon";
import { Sheet } from "@/ui/sheet";
import { toast } from "@/ui/toast";
import { Leaf, toyFace } from "@/ui/toy";

/** Typing after an "@" asks for members once the keys pause this long. */
const MENTION_DELAY_MS = 150;
/** How close to the end the thread must be to follow new messages. */
const STICK_PX = 80;

type MessageItem = Extract<ClanMessage, { kind: "message" }>;

/**
 * Discussion and journal of the clan: messages and events in one thread, newest at the bottom,
 * the field to write under it.
 */
export function ClanChat({
  clanId,
  role,
  mutedUntil,
  now,
  wordOf,
}: {
  readonly clanId: string;
  readonly role: ClanRole;
  readonly mutedUntil: string | null;
  readonly now: number;
  readonly wordOf: (cardId: string) => string;
}) {
  const [messages, setMessages] = useState<readonly ClanMessage[] | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [draft, setDraft] = useState("");
  // The text as typed, for the caret moves that follow each change.
  const typedText = useRef("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [menu, setMenu] = useState<MessageItem | null>(null);
  const [focused, setFocused] = useState(true);
  const scroller = useRef<ScrollViewInstance>(null);
  const stickToBottom = useRef(true);
  const sanctionList = useShared(sanctions);
  // After a mention is put in, the caret goes after it rather than staying where it was.
  const [placedCaret, setPlacedCaret] = useState<number | null>(null);
  // Read by the selection events, which may arrive before the render that sets the caret.
  const expectedCaret = useRef<number | null>(null);
  const mention = useMentions(clanId, (text, caret) => {
    typedText.current = text;
    expectedCaret.current = caret;
    setDraft(text);
    setPlacedCaret(caret);
  });

  const lastId = messages?.at(-1)?.id;
  const loaded = messages !== null;

  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );

  const load = useCallback(async () => {
    const page = await api.fetchMessages(clanId).catch(() => null);
    if (page === null) return;
    setMessages([...page.messages].reverse());
    setHasMore(page.hasMore);
  }, [clanId]);

  useEffect(() => {
    void load();
  }, [load]);

  // What came since the last message received, while the tab is in view: often while the
  // discussion moves, less and less when it is quiet. A new message (`lastId`) starts over.
  useEffect(() => {
    if (!loaded || !focused) return;
    let quietPolls = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let polling = false;
    let stopped = false;
    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(poll, chatPollDelay(quietPolls));
    };
    const poll = async () => {
      if (polling) return;
      if (AppState.currentState !== "active") return schedule();
      polling = true;
      const page = await api
        .fetchMessages(clanId, lastId === undefined ? {} : { after: lastId })
        .catch(() => null);
      polling = false;
      if (stopped) return;
      if (page !== null && page.messages.length > 0) {
        quietPolls = 0;
        setMessages((current) => mergeMessages(current ?? [], [...page.messages].reverse()));
      } else {
        quietPolls++;
      }
      schedule();
    };
    // Back in the app: ask at once, then at the quick pace.
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") return;
      quietPolls = 0;
      void poll();
    });
    schedule();
    return () => {
      stopped = true;
      clearTimeout(timer);
      subscription.remove();
    };
  }, [clanId, lastId, loaded, focused]);

  const loadOlder = async () => {
    const first = messages?.[0];
    if (first === undefined) return;
    stickToBottom.current = false;
    const page = await api.fetchMessages(clanId, { before: first.id }).catch(() => null);
    if (page === null) return;
    setMessages((current) => [...[...page.messages].reverse(), ...(current ?? [])]);
    setHasMore(page.hasMore);
  };

  const send = async () => {
    const body = draft.trim();
    if (body === "" || sending) return;
    setSending(true);
    setError(null);
    try {
      const result = await api.postMessage(clanId, body);
      if (result.kind === "ok") {
        stickToBottom.current = true;
        setMessages((current) => mergeMessages(current ?? [], [result.value]));
        typedText.current = "";
        setDraft("");
        mention.close();
      } else {
        setError(refusalText(result.reason));
      }
    } catch {
      setError("Message non envoyé. Réessaie.");
    } finally {
      setSending(false);
    }
  };

  const remove = async (message: MessageItem) => {
    setMenu(null);
    const result = await api.deleteMessage(clanId, message.id).catch(() => null);
    if (result?.kind !== "ok") {
      toast(result === null ? "Ça n'a pas marché. Réessaie." : refusalText(result.reason));
      return;
    }
    setMessages(
      (current) =>
        current?.map((m) =>
          m.id === message.id && m.kind === "message"
            ? { ...m, body: null, removed: "deleted" }
            : m,
        ) ?? null,
    );
  };

  const report = async (message: MessageItem) => {
    setMenu(null);
    const result = await api.reportMessage(clanId, message.id).catch(() => null);
    toast(
      result?.kind === "ok"
        ? "Signalement envoyé. L'équipe va le lire."
        : "Le signalement a échoué. Réessaie.",
    );
  };

  const block = async (message: MessageItem) => {
    setMenu(null);
    const author = message.author;
    if (author === null) return;
    const result = await api.setBlocked(author.code, true).catch(() => null);
    if (result?.kind !== "ok") {
      toast("Ça n'a pas marché. Réessaie.");
      return;
    }
    setMessages(
      (current) =>
        current?.filter((m) => m.kind !== "message" || m.author?.code !== author.code) ?? null,
    );
    toast(`${playerName(author)} est bloqué. Ses messages disparaissent.`);
  };

  const sanctioned = sanctionList !== null ? writingBlock(sanctionList, now) : null;
  const clanMuted = mutedUntil !== null && Date.parse(mutedUntil) > now;
  const muted = clanMuted || sanctioned !== null;
  const moderates = canAct(role, "delete_message");
  const notice =
    error ??
    sanctioned ??
    (clanMuted && mutedUntil !== null ? mutedUntilLabel(mutedUntil, now) : null);

  return (
    <Leaf style={styles.chat}>
      <ScrollView
        ref={scroller}
        style={styles.thread}
        contentContainerStyle={styles.threadContent}
        keyboardShouldPersistTaps="handled"
        onScroll={(event) => {
          const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
          stickToBottom.current =
            contentSize.height - contentOffset.y - layoutMeasurement.height < STICK_PX;
        }}
        scrollEventThrottle={64}
        onContentSizeChange={() => {
          if (stickToBottom.current) scroller.current?.scrollToEnd({ animated: false });
        }}
        // The keyboard shrinks the thread: the last message stays in view.
        onLayout={() => {
          if (stickToBottom.current) scroller.current?.scrollToEnd({ animated: false });
        }}
      >
        {hasMore && (
          <Pressable
            onPress={() => void loadOlder()}
            style={styles.older}
            accessibilityRole="button"
          >
            <Text style={styles.olderText}>Messages plus anciens</Text>
          </Pressable>
        )}
        {messages === null ? (
          <Text style={styles.faint}>Un instant…</Text>
        ) : messages.length === 0 ? (
          <Text style={styles.empty}>{EMPTY_DISCUSSION}</Text>
        ) : (
          messages.map((message) =>
            message.kind === "event" ? (
              <View key={message.id} style={styles.event}>
                <Icon name="star" size={14} color={ink.rubric} />
                <Text style={styles.eventText}>{eventText(message.event, wordOf)}</Text>
              </View>
            ) : (
              <MessageRow
                key={message.id}
                message={message}
                now={now}
                onMenu={
                  message.body !== null && (message.mine || message.author !== null)
                    ? () => setMenu(message)
                    : null
                }
              />
            ),
          )
        )}
      </ScrollView>

      <View style={styles.compose}>
        {notice !== null && (
          <Text style={styles.composeError} accessibilityRole="alert">
            {notice}
          </Text>
        )}
        {mention.suggestions.length > 0 && (
          <View style={styles.mentions}>
            {mention.suggestions.map((member) => (
              <Pressable
                key={member.player.code}
                style={styles.mentionOption}
                onPress={() => mention.pick(member)}
                accessibilityRole="button"
              >
                <Avatar avatar={member.player.avatar} frame={null} size={24} />
                <Text style={styles.mentionName}>{playerName(member.player)}</Text>
              </Pressable>
            ))}
          </View>
        )}
        <View style={styles.composeRow}>
          <TextInput
            style={styles.field}
            maxLength={500}
            placeholder={MESSAGE_PLACEHOLDER}
            placeholderTextColor={ink.pageInkFaint}
            selectionColor={ink.rubric}
            cursorColor={ink.rubric}
            accessibilityLabel="Message au clan"
            value={draft}
            editable={!muted}
            multiline
            onChangeText={(text) => {
              typedText.current = text;
              setDraft(text);
              if (error !== null) setError(null);
            }}
            {...(placedCaret === null
              ? {}
              : { selection: { start: placedCaret, end: placedCaret } })}
            onSelectionChange={(event) => {
              const at = event.nativeEvent.selection.end;
              // The caret's old place may still come through before the one just set; once
              // there, the mention just put in is not one being typed.
              if (expectedCaret.current !== null) {
                if (at === expectedCaret.current) {
                  expectedCaret.current = null;
                  setPlacedCaret(null);
                }
                return;
              }
              mention.update(typedText.current, at);
            }}
          />
          <Pressable
            onPress={() => void send()}
            disabled={muted || sending || draft.trim() === ""}
            style={({ pressed }) => [
              styles.send,
              toyFace("gold", "round"),
              (muted || sending || draft.trim() === "") && styles.sendOff,
              pressed && styles.sendPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Envoyer"
          >
            <Icon name="send" size={20} color={toyValues.outline} />
          </Pressable>
        </View>
      </View>

      <Sheet
        open={menu !== null}
        title={menu === null ? "Message" : `Message de ${playerName(menu.author)}`}
        onClose={() => setMenu(null)}
      >
        {menu !== null && !menu.mine && (
          <>
            <Button label="Signaler" secondary onPress={() => void report(menu)} />
            <Button
              label={`Bloquer ${playerName(menu.author)}`}
              secondary
              onPress={() => void block(menu)}
            />
          </>
        )}
        {menu !== null && (menu.mine || moderates) && (
          <Button label="Effacer" secondary onPress={() => void remove(menu)} />
        )}
      </Sheet>
    </Leaf>
  );
}

function MessageRow({
  message,
  now,
  onMenu,
}: {
  readonly message: MessageItem;
  readonly now: number;
  readonly onMenu: (() => void) | null;
}) {
  return (
    <Pressable
      onLongPress={onMenu ?? undefined}
      style={[styles.row, message.mine && styles.rowMine]}
      accessibilityActions={onMenu === null ? [] : [{ name: "longpress", label: "Actions" }]}
      onAccessibilityAction={() => onMenu?.()}
    >
      {!message.mine && <Avatar avatar={message.author?.avatar ?? null} frame={null} size={30} />}
      <View style={[styles.bubbleWrap, message.mine && styles.bubbleWrapMine]}>
        <Text style={styles.who}>
          {playerName(message.author)} · {messageTime(message.createdAt, now)}
        </Text>
        {message.body === null ? (
          <Text style={styles.removed}>{REMOVED_MESSAGE[message.removed ?? "deleted"]}</Text>
        ) : (
          <Text
            style={[
              styles.bubble,
              message.mine && styles.bubbleMine,
              message.mine ? styles.bubbleGold : styles.bubblePaper,
            ]}
          >
            {messageSegments(message.body, message.mentions).map((segment, index) =>
              segment.kind === "text" ? (
                segment.text
              ) : (
                <Text
                  // biome-ignore lint/suspicious/noArrayIndexKey: segments never move
                  key={index}
                  style={segment.me ? styles.mentionMe : styles.mention}
                >
                  {segment.text}
                </Text>
              ),
            )}
          </Text>
        )}
      </View>
      {onMenu !== null && (
        <Pressable
          onPress={onMenu}
          hitSlop={8}
          style={styles.dots}
          accessibilityRole="button"
          accessibilityLabel={`Actions sur le message de ${playerName(message.author)}`}
        >
          <Icon name="dots" size={16} color={ink.pageInkFaint} />
        </Pressable>
      )}
    </Pressable>
  );
}

/** Suggestions after an "@": the members whose pseudo starts with what follows, once the keys pause. */
function useMentions(clanId: string, onInsert: (text: string, caret: number) => void) {
  const [suggestions, setSuggestions] = useState<readonly ClanMember[]>([]);
  const typed = useRef<{ text: string; caret: number; start: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const asked = useRef(0);

  const close = useCallback(() => {
    if (timer.current !== null) clearTimeout(timer.current);
    asked.current++;
    typed.current = null;
    setSuggestions([]);
  }, []);

  useEffect(() => close, [close]);

  const update = (text: string, caret: number) => {
    const found = mentionQuery(text, caret);
    if (found === null || found.query.trim() === "") {
      if (typed.current !== null) close();
      return;
    }
    if (typed.current?.text === text && typed.current.caret === caret) return;
    typed.current = { text, caret, start: found.start };
    if (timer.current !== null) clearTimeout(timer.current);
    const request = ++asked.current;
    timer.current = setTimeout(async () => {
      const members = await api.searchMembers(clanId, found.query.trim()).catch(() => []);
      if (request !== asked.current) return;
      setSuggestions(members.filter((member) => member.player.pseudo !== null));
    }, MENTION_DELAY_MS);
  };

  const pick = (member: ClanMember) => {
    const at = typed.current;
    if (at === null || member.player.pseudo === null) return;
    const next = insertMention(at.text, at, at.caret, member.player.pseudo);
    close();
    onInsert(next.text, next.caret);
  };

  return { suggestions, update, pick, close };
}

/** The thread lies on a leaf of paper. */
const ink = paperColors;

const styles = StyleSheet.create({
  chat: { flex: 1, marginHorizontal: space.s6, marginTop: space.s2, marginBottom: space.s6 },
  thread: { flex: 1 },
  threadContent: { gap: space.s6, paddingHorizontal: space.s8, paddingVertical: space.s6 },
  older: { alignSelf: "center", paddingVertical: space.s3 },
  olderText: {
    fontFamily: fonts.ui.bold,
    fontSize: fontSizes.label,
    color: ink.rubric,
    textDecorationLine: "underline",
  },
  faint: { fontFamily: fonts.ui.medium, fontSize: fontSizes.body, color: ink.pageInkFaint },
  empty: {
    fontFamily: fonts.text.italic,
    fontSize: fontSizes.subtitle,
    lineHeight: 25,
    color: ink.pageInkMuted,
    textAlign: "center",
    paddingVertical: space.s12,
  },
  event: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "center",
    gap: space.s3,
    paddingHorizontal: space.s6,
  },
  eventText: {
    flexShrink: 1,
    fontFamily: fonts.ui.semibold,
    fontSize: fontSizes.small,
    lineHeight: 19,
    color: ink.pageInkMuted,
    textAlign: "center",
  },
  row: { flexDirection: "row", alignItems: "flex-end", gap: space.s4 },
  rowMine: { justifyContent: "flex-end" },
  bubbleWrap: { flexShrink: 1, gap: 3, maxWidth: "80%" },
  bubbleWrapMine: { alignItems: "flex-end" },
  who: { fontFamily: fonts.ui.semibold, fontSize: fontSizes.caption, color: ink.pageInkFaint },
  bubble: {
    overflow: "hidden",
    paddingHorizontal: space.s7,
    paddingVertical: 9,
    borderRadius: radii.x3,
    borderBottomLeftRadius: radii.xs,
    backgroundColor: ink.pageRaised,
    color: ink.pageInk,
    fontFamily: fonts.ui.medium,
    fontSize: fontSizes.bodyLarge,
    lineHeight: 22,
  },
  bubbleMine: {
    borderBottomLeftRadius: radii.x3,
    borderBottomRightRadius: radii.xs,
    backgroundColor: ink.mention,
  },
  bubblePaper: {
    borderWidth: toyValues.outlineWidth,
    borderColor: toyValues.outline,
    backgroundColor: toyMatters.paper.top,
  },
  bubbleGold: {
    borderWidth: toyValues.outlineWidth,
    borderColor: toyValues.outline,
    backgroundColor: toyMatters.gold.top,
    color: toyValues.outline,
  },
  removed: {
    fontFamily: fonts.text.italic,
    fontSize: fontSizes.body,
    color: ink.pageInkFaint,
  },
  mention: { fontFamily: fonts.ui.extrabold, color: ink.rubric },
  mentionMe: { fontFamily: fonts.ui.extrabold, color: ink.rubric },
  dots: { paddingBottom: space.s4 },
  compose: {
    gap: space.s4,
    paddingHorizontal: space.s6,
    paddingTop: space.s4,
    paddingBottom: space.s5,
    borderTopWidth: 1,
    borderTopColor: ink.track,
    backgroundColor: "transparent",
  },
  composeError: { fontFamily: fonts.ui.bold, fontSize: fontSizes.label, color: ink.danger },
  mentions: {
    overflow: "hidden",
    borderWidth: toyValues.outlineWidth,
    borderColor: toyValues.outline,
    borderRadius: 14,
    backgroundColor: toyMatters.paper.top,
  },
  mentionOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.s5,
    minHeight: 44,
    paddingHorizontal: space.s6,
  },
  mentionName: { fontFamily: fonts.ui.bold, fontSize: fontSizes.body, color: ink.pageInk },
  composeRow: { flexDirection: "row", alignItems: "flex-end", gap: space.s4 },
  field: {
    flex: 1,
    minHeight: 46,
    maxHeight: 120,
    paddingHorizontal: space.s8,
    paddingTop: space.s6,
    paddingBottom: space.s6,
    color: ink.pageInk,
    fontFamily: fonts.ui.medium,
    fontSize: fontSizes.bodyLarge,
    borderWidth: toyValues.outlineWidth,
    borderColor: toyValues.outline,
    borderRadius: 14,
    backgroundColor: ink.paper,
    boxShadow: `inset 0 3px 0 ${toyMatters.paper.bottom}`,
  },
  send: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: ink.action,
  },
  sendOff: { opacity: 0.4 },
  sendPressed: { opacity: 0.8 },
});
