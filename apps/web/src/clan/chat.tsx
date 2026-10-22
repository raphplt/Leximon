"use client";

import type { ClanMember, ClanMessage, ClanRefusal, ClanRole } from "@leximon/contract";
import { canAct } from "@leximon/core";
import {
  clanRefusalMessage,
  EMPTY_DISCUSSION,
  eventText,
  insertMention,
  MESSAGE_PLACEHOLDER,
  mentionQuery,
  messageSegments,
  messageTime,
  mutedUntilLabel,
  playerName,
  REMOVED_MESSAGE,
  writingBlock,
} from "@leximon/view-model";
import {
  type FormEvent,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { Avatar } from "@/components/avatar";
import { setBlocked } from "@/lib/api";
import { sanctions } from "@/player/clan";
import { useShared } from "@/player/resource";
import { Icon } from "@/ui/icon";
import { useToast } from "@/ui/toast";
import ui from "@/ui/ui.module.css";
import { deleteMessage, fetchMessages, postMessage, reportMessage, searchMembers } from "./api";
import styles from "./clan.module.css";

/** The open discussion asks for what came since every few seconds (no WebSockets). */
const POLL_MS = 4_000;
/** Typing after an "@" asks for members once the keys pause this long. */
const MENTION_DELAY_MS = 150;

type MessageItem = Extract<ClanMessage, { kind: "message" }>;

/**
 * Discussion and journal of the clan: messages and events in one thread, newest at
 * the bottom. Used on the clan page and in the panel the Jouer screen opens.
 */
export function ClanChat({
  clanId,
  role,
  mutedUntil,
  online,
  now,
  wordOf,
  compact = false,
}: {
  readonly clanId: string;
  readonly role: ClanRole;
  readonly mutedUntil: string | null;
  /** « 7 en ligne », or nothing when the members are not known. */
  readonly online: string | null;
  readonly now: number;
  readonly wordOf: (cardId: string) => string;
  /** In the side panel: no frame, the height of the panel. */
  readonly compact?: boolean;
}) {
  const [messages, setMessages] = useState<readonly ClanMessage[] | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [menu, setMenu] = useState<number | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const toast = useToast();
  const sanctionList = useShared(sanctions);
  const input = useRef<HTMLInputElement>(null);
  const mention = useMentions(clanId, (text, caret) => {
    setDraft(text);
    requestAnimationFrame(() => input.current?.setSelectionRange(caret, caret));
  });

  const lastId = messages?.at(-1)?.id;
  const loaded = messages !== null;

  const load = useCallback(async () => {
    const page = await fetchMessages(clanId).catch(() => null);
    if (page === null) return;
    setMessages([...page.messages].reverse());
    setHasMore(page.hasMore);
  }, [clanId]);

  useEffect(() => {
    void load();
  }, [load]);

  // What came since the last message received, while the page is in view.
  useEffect(() => {
    if (!loaded) return;
    const timer = setInterval(async () => {
      if (document.visibilityState !== "visible") return;
      const page = await fetchMessages(clanId, lastId === undefined ? {} : { after: lastId }).catch(
        () => null,
      );
      if (page === null || page.messages.length === 0) return;
      setMessages((current) => merge(current ?? [], [...page.messages].reverse()));
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [clanId, lastId, loaded]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: scrolls when a message arrives
  useEffect(() => {
    const element = scroller.current;
    if (element !== null && stickToBottom.current) element.scrollTop = element.scrollHeight;
  }, [lastId]);

  const loadOlder = async () => {
    const first = messages?.[0];
    if (first === undefined) return;
    const page = await fetchMessages(clanId, { before: first.id }).catch(() => null);
    if (page === null) return;
    setMessages((current) => [...[...page.messages].reverse(), ...(current ?? [])]);
    setHasMore(page.hasMore);
  };

  const send = async (event: FormEvent) => {
    event.preventDefault();
    const body = draft.trim();
    if (body === "" || sending) return;
    setSending(true);
    setError(null);
    try {
      const result = await postMessage(clanId, body);
      if (result.kind === "ok") {
        stickToBottom.current = true;
        setMessages((current) => merge(current ?? [], [result.value]));
        setDraft("");
      } else {
        setError(refusalText(result.reason));
      }
    } catch {
      setError("Pas envoyé. Réessaie.");
    } finally {
      setSending(false);
    }
  };

  const remove = async (message: MessageItem) => {
    setMenu(null);
    const result = await deleteMessage(clanId, message.id).catch(() => null);
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
    const result = await reportMessage(clanId, message.id).catch(() => null);
    toast(result?.kind === "ok" ? "Signalé. On regarde." : "Ça n'a pas marché. Réessaie.");
  };

  const block = async (message: MessageItem) => {
    setMenu(null);
    const author = message.author;
    if (author === null) return;
    const result = await setBlocked(author.code, true).catch(() => null);
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

  const sanctioned = now > 0 && sanctionList !== null ? writingBlock(sanctionList, now) : null;
  const clanMuted = mutedUntil !== null && now > 0 && Date.parse(mutedUntil) > now;
  const muted = clanMuted || sanctioned !== null;
  const moderates = canAct(role, "delete_message");

  return (
    <section className={compact ? styles.chatCompact : `${ui.panel} ${styles.chat}`}>
      {!compact && (
        <header className={styles.chatHead}>
          <div>
            <h2 className={styles.chatTitle}>Discussion et journal</h2>
            {online !== null && <p className={styles.small}>{online}</p>}
          </div>
          <span className={styles.faint}>Modérée</span>
        </header>
      )}
      <div
        ref={scroller}
        className={styles.thread}
        onScroll={(event) => {
          const element = event.currentTarget;
          stickToBottom.current =
            element.scrollHeight - element.scrollTop - element.clientHeight < 80;
        }}
      >
        {hasMore && (
          <button type="button" className={styles.older} onClick={() => void loadOlder()}>
            Messages plus anciens
          </button>
        )}
        {messages === null ? (
          <p className={styles.faint}>Un instant…</p>
        ) : messages.length === 0 ? (
          <p className={styles.emptyThread}>
            <em>{EMPTY_DISCUSSION}</em>
          </p>
        ) : (
          messages.map((message) =>
            message.kind === "event" ? (
              <p key={message.id} className={styles.event}>
                <Icon name="star" size={14} />
                {eventText(message.event, wordOf)}
              </p>
            ) : (
              <div key={message.id} className={message.mine ? styles.rowMine : styles.row}>
                <Avatar
                  avatar={message.author?.avatar ?? null}
                  frame={null}
                  size={30}
                  className={styles.chatAvatar}
                />
                <div className={styles.bubbleWrap}>
                  <p className={styles.who}>
                    {playerName(message.author)} · {now > 0 && messageTime(message.createdAt, now)}
                  </p>
                  {message.body === null ? (
                    <p className={styles.bubbleRemoved}>
                      {REMOVED_MESSAGE[message.removed ?? "deleted"]}
                    </p>
                  ) : (
                    <p className={message.mine ? styles.bubbleMine : styles.bubble}>
                      {messageSegments(message.body, message.mentions).map((segment, index) =>
                        segment.kind === "text" ? (
                          segment.text
                        ) : (
                          <span
                            // biome-ignore lint/suspicious/noArrayIndexKey: segments never move
                            key={index}
                            className={segment.me ? styles.mentionMe : styles.mention}
                          >
                            {segment.text}
                          </span>
                        ),
                      )}
                    </p>
                  )}
                </div>
                {message.body !== null && (message.mine ? true : message.author !== null) && (
                  <div className={styles.menuWrap}>
                    <button
                      type="button"
                      className={styles.dots}
                      aria-label={`Actions sur le message de ${playerName(message.author)}`}
                      aria-expanded={menu === message.id}
                      onClick={() => setMenu(menu === message.id ? null : message.id)}
                    >
                      <Icon name="dots" size={16} />
                    </button>
                    {menu === message.id && (
                      <div className={message.mine ? styles.menuLeft : styles.menu}>
                        {!message.mine && (
                          <>
                            <button
                              type="button"
                              className={styles.menuItem}
                              onClick={() => void report(message)}
                            >
                              <Icon name="flag" size={15} />
                              Signaler
                            </button>
                            <button
                              type="button"
                              className={styles.menuItemDanger}
                              onClick={() => void block(message)}
                            >
                              <Icon name="block" size={15} />
                              Bloquer {playerName(message.author)}
                            </button>
                          </>
                        )}
                        {(message.mine || moderates) && (
                          <button
                            type="button"
                            className={styles.menuItemDanger}
                            onClick={() => void remove(message)}
                          >
                            <Icon name="close" size={15} />
                            Effacer
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ),
          )
        )}
      </div>
      <form className={styles.compose} onSubmit={(event) => void send(event)}>
        {(error !== null || muted) && (
          <p role="alert" className={styles.composeError}>
            {error ?? sanctioned ?? (mutedUntil === null ? "" : mutedUntilLabel(mutedUntil, now))}
          </p>
        )}
        <div className={styles.composeRow}>
          <label className={styles.composeField}>
            <span className={styles.visuallyHidden}>Message au clan</span>
            <MentionSuggestions
              clanId={clanId}
              suggestions={mention.suggestions}
              active={mention.active}
              onPick={mention.pick}
            />
            <input
              ref={input}
              className={ui.field}
              maxLength={500}
              placeholder={MESSAGE_PLACEHOLDER}
              value={draft}
              disabled={muted}
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={mention.suggestions.length > 0}
              aria-controls={`mentions-${clanId}`}
              aria-activedescendant={
                mention.suggestions.length > 0 ? `mention-${clanId}-${mention.active}` : undefined
              }
              onChange={(event) => {
                setDraft(event.target.value);
                mention.update(event.target.value, event.target.selectionStart);
                if (error !== null) setError(null);
              }}
              onSelect={(event) =>
                mention.update(event.currentTarget.value, event.currentTarget.selectionStart)
              }
              onKeyDown={mention.onKeyDown}
              onBlur={mention.close}
            />
          </label>
          <button
            type="submit"
            className={styles.sendButton}
            aria-label="Envoyer"
            disabled={muted || sending || draft.trim() === ""}
          >
            <Icon name="send" size={20} />
          </button>
        </div>
      </form>
    </section>
  );
}

/**
 * Suggestions after an "@": the members whose pseudo starts with what follows, asked for once the
 * keys pause. Arrows move, Entrée or Tab picks, Échap closes.
 */
function useMentions(clanId: string, onInsert: (text: string, caret: number) => void) {
  const [suggestions, setSuggestions] = useState<readonly ClanMember[]>([]);
  const [active, setActive] = useState(0);
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

  const update = (text: string, caret: number | null) => {
    const found = caret === null ? null : mentionQuery(text, caret);
    if (found === null || found.query.trim() === "" || caret === null) {
      close();
      return;
    }
    typed.current = { text, caret, start: found.start };
    if (timer.current !== null) clearTimeout(timer.current);
    const request = ++asked.current;
    timer.current = setTimeout(async () => {
      const members = await searchMembers(clanId, found.query.trim()).catch(() => []);
      if (request !== asked.current) return;
      setSuggestions(members.filter((member) => member.player.pseudo !== null));
      setActive(0);
    }, MENTION_DELAY_MS);
  };

  const pick = (member: ClanMember) => {
    const at = typed.current;
    if (at === null || member.player.pseudo === null) return;
    const next = insertMention(at.text, at, at.caret, member.player.pseudo);
    close();
    onInsert(next.text, next.caret);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (suggestions.length === 0) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive((current) => (current + step + suggestions.length) % suggestions.length);
    } else if (event.key === "Enter" || event.key === "Tab") {
      const member = suggestions[active];
      if (member === undefined) return;
      event.preventDefault();
      pick(member);
    } else if (event.key === "Escape") {
      event.preventDefault();
      close();
    }
  };

  return { suggestions, active, update, pick, close, onKeyDown };
}

function MentionSuggestions({
  clanId,
  suggestions,
  active,
  onPick,
}: {
  readonly clanId: string;
  readonly suggestions: readonly ClanMember[];
  readonly active: number;
  readonly onPick: (member: ClanMember) => void;
}) {
  if (suggestions.length === 0) return null;
  return (
    <div id={`mentions-${clanId}`} role="listbox" className={styles.mentions}>
      {suggestions.map((member, index) => (
        <div
          key={member.player.code}
          id={`mention-${clanId}-${index}`}
          role="option"
          tabIndex={-1}
          aria-selected={index === active}
          className={index === active ? styles.mentionOptionActive : styles.mentionOption}
          // Before the field loses focus, which would close the list.
          onMouseDown={(event) => {
            event.preventDefault();
            onPick(member);
          }}
        >
          <Avatar avatar={member.player.avatar} frame={null} size={24} />
          {playerName(member.player)}
        </div>
      ))}
    </div>
  );
}

/** Adds what is new, by id, in order: a poll and a message just sent may bring the same one. */
function merge(current: readonly ClanMessage[], incoming: readonly ClanMessage[]): ClanMessage[] {
  const known = new Set(current.map((message) => message.id));
  return [...current, ...incoming.filter((message) => !known.has(message.id))].sort(
    (a, b) => a.id - b.id,
  );
}

export function refusalText(reason: ClanRefusal | "account_locked"): string {
  return reason === "account_locked" ? "Ton compte est suspendu." : clanRefusalMessage(reason);
}
