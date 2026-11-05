"use client";

import type { MailKind, MailLetter } from "@leximon/contract";
import {
  CARNET_TITLE,
  capitalize,
  carnetCasePhrase,
  claimableMailTitle,
  coffretsMailTitle,
  letterView,
  MAIL_EMPTY,
  MAIL_NEWS,
  MAIL_OLDER,
  MAIL_TODO,
  REFERRAL_CLAIMED,
  referralRewardTitle,
  SLIPPING_AWAY,
  slippingDetail,
  tierName,
  welcomeMailTitle,
  welcomeToday,
} from "@leximon/view-model";
import Link from "next/link";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { useCatalog } from "@/cards/use-catalog";
import { useClaim } from "@/clan/claim";
import { api } from "@/lib/api";
import { mailbox } from "@/player/mail";
import { wallet } from "@/player/player";
import { Dialog } from "@/ui/dialog";
import { Icon, type IconName } from "@/ui/icon";
import { useToast } from "@/ui/toast";
import styles from "./panels.module.css";
import { useShell } from "./shell-context";
import { usePlayerView } from "./use-player-view";

/** Back on the tab after this long, the mail is read again: letters arrive through the queue. */
const STALE_MS = 60_000;

const LETTER_ICONS: Readonly<Record<MailKind, IconName>> = {
  offer_received: "echange",
  offer_completed: "echange",
  offer_declined: "echange",
  clan_mention: "chat",
  clan_request: "clan",
  friend_request: "amis",
  friend_accepted: "amis",
  referral_arrived: "amis",
  referral_qualified: "sachet",
  friend_reaction: "amis",
};

interface Row {
  readonly key: string;
  readonly icon: IconName;
  readonly title: ReactNode;
  readonly detail: string;
  readonly when?: string;
  readonly fresh?: boolean;
  readonly href?: string;
  readonly action?: () => void;
}

/**
 * The mail: what waits to be done, read from the game's state (coffrets, goal boosters, a word
 * slipping away), then the news the queue wrote (offers, mentions, requests).
 * Opening it marks the letters read; those new to this opening stay highlighted until it closes.
 */
export function MailPanel({
  open,
  onClose,
}: {
  readonly open: boolean;
  readonly onClose: () => void;
}) {
  const view = usePlayerView();
  const { openCoffret, openChat, openWelcome, openCarnet } = useShell();
  const claim = useClaim();
  const toast = useToast();
  const box = view.mailbox;
  const [fresh, setFresh] = useState<ReadonlySet<number>>(new Set());
  const [older, setOlder] = useState<{ letters: MailLetter[]; hasMore: boolean } | null>(null);
  const readAt = useRef(0);

  useEffect(() => {
    if (open) {
      readAt.current = Date.now();
      mailbox.refresh();
    } else {
      setFresh(new Set());
      setOlder(null);
    }
  }, [open]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== "visible" || Date.now() - readAt.current < STALE_MS) return;
      readAt.current = Date.now();
      mailbox.refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  // Marks what the open mail shows as read, once per new letter.
  useEffect(() => {
    if (!open || box === null) return;
    const unread = box.letters.filter((letter) => !letter.read).map((letter) => letter.id);
    const top = box.letters[0]?.id;
    if (unread.length === 0 || top === undefined) return;
    setFresh((current) => new Set([...current, ...unread]));
    api
      .markMailRead(top)
      .then((left) => {
        const current = mailbox.current();
        if (current === null) return;
        mailbox.publish({
          ...current,
          unread: left,
          letters: current.letters.map((letter) =>
            letter.id <= top ? { ...letter, read: true } : letter,
          ),
        });
      })
      .catch(() => {
        // Still unread: marked the next time the mail opens.
      });
  }, [open, box]);

  const todo: Row[] = [];
  const welcomeDay = welcomeToday(view.welcome);
  if (welcomeDay !== null) {
    todo.push({
      key: "welcome",
      icon: "coffret",
      title: welcomeMailTitle(welcomeDay.day),
      detail: capitalize(welcomeDay.phrase),
      action: () => openWelcome(),
    });
  }
  const carnetCase = view.carnet?.next ?? null;
  if (carnetCase !== null) {
    todo.push({
      key: "carnet",
      icon: "coffret",
      title: `${CARNET_TITLE}, case ${carnetCase.case}`,
      detail: capitalize(carnetCasePhrase(view.carnet, carnetCase.case)),
      action: () => openCarnet(),
    });
  }
  if (view.coffrets.length > 0) {
    todo.push({
      key: "coffrets",
      icon: "coffret",
      title: coffretsMailTitle(view.coffrets),
      detail: "Niveaux",
      action: () => openCoffret(),
    });
  }
  for (const reward of box?.referralRewards ?? []) {
    todo.push({
      key: `referral-${reward.refereeCode}`,
      icon: "sachet",
      title: referralRewardTitle(reward),
      detail: "Lien d'ami",
      action: () => {
        api
          .claimReferral(reward.refereeCode)
          .then((result) => {
            if (result.kind === "refused" && result.reason === "reserve_full") {
              toast("Ta réserve est pleine. Ouvre un sachet d'abord.");
              return;
            }
            if (result.kind === "claimed") {
              wallet.publish(result.wallet);
              toast(REFERRAL_CLAIMED);
            }
            const current = mailbox.current();
            if (current !== null) {
              mailbox.publish({
                ...current,
                referralRewards: current.referralRewards.filter(
                  (r) => r.refereeCode !== reward.refereeCode,
                ),
              });
            }
          })
          .catch(() => toast("Ça n'a pas marché. Réessaie."));
      },
    });
  }
  if (view.claimable.length > 0) {
    todo.push({
      key: "goal",
      icon: "clan",
      title: claimableMailTitle(view.claimable.length),
      detail: `Objectif de clan · ${view.claimable.map((c) => tierName(c.tier)).join(", ")}`,
      action: () => {
        for (const goal of view.claimable) void claim(goal);
      },
    });
  }

  const letters = [...(box?.letters ?? []), ...(older?.letters ?? [])];
  const news: Row[] = letters.map((letter) => {
    const shown = letterView(letter, view.now === 0 ? Date.now() : view.now);
    return {
      key: `letter-${letter.id}`,
      icon: LETTER_ICONS[letter.kind],
      title: shown.title,
      detail: shown.detail,
      when: shown.when,
      fresh: !letter.read || fresh.has(letter.id),
      ...(shown.target.kind === "screen"
        ? { href: shown.target.href }
        : { action: () => openChat() }),
    };
  });
  const hasMore = older === null ? (box?.hasMore ?? false) : older.hasMore;

  const loadOlder = async () => {
    const last = letters.at(-1);
    if (last === undefined) return;
    const page = await api.fetchMail(last.id).catch(() => null);
    if (page === null) return;
    setOlder((current) => ({
      letters: [...(current?.letters ?? []), ...page.letters],
      hasMore: page.hasMore,
    }));
  };

  const slipping = box?.slipping ?? null;
  const empty = todo.length === 0 && news.length === 0 && slipping === null;

  return (
    <Dialog open={open} title="Courrier" onClose={onClose}>
      {empty ? (
        <p className={styles.empty}>{box === null ? "Un instant…" : MAIL_EMPTY}</p>
      ) : (
        <>
          {(todo.length > 0 || slipping !== null) && (
            <section aria-label={MAIL_TODO} className={styles.mailSection}>
              <h3 className={styles.mailHeading}>{MAIL_TODO}</h3>
              <ul className={styles.letters}>
                {todo.map((row) => (
                  <RowItem key={row.key} row={row} onClose={onClose} />
                ))}
                {slipping !== null && open && (
                  <SlippingRow
                    cardId={slipping.cardId}
                    others={slipping.others}
                    onClose={onClose}
                  />
                )}
              </ul>
            </section>
          )}
          {news.length > 0 && (
            <section aria-label={MAIL_NEWS} className={styles.mailSection}>
              <h3 className={styles.mailHeading}>{MAIL_NEWS}</h3>
              <ul className={styles.letters}>
                {news.map((row) => (
                  <RowItem key={row.key} row={row} onClose={onClose} />
                ))}
              </ul>
              {hasMore && (
                <button type="button" className={styles.mailOlder} onClick={() => void loadOlder()}>
                  {MAIL_OLDER}
                </button>
              )}
            </section>
          )}
        </>
      )}
    </Dialog>
  );
}

/** « Lucubrateur est en train de t'échapper. »: needs the catalogue, read only once shown. */
function SlippingRow({
  cardId,
  others,
  onClose,
}: {
  readonly cardId: string;
  readonly others: number;
  readonly onClose: () => void;
}) {
  const card = useCatalog()?.cardsById.get(cardId);
  if (card === undefined) return null;
  return (
    <RowItem
      row={{
        key: "slipping",
        icon: "defi",
        title: (
          <>
            <em>{capitalize(card.word)}</em>
            {SLIPPING_AWAY.after}
          </>
        ),
        detail: slippingDetail(others),
        href: `/defis?mot=${encodeURIComponent(cardId)}`,
      }}
      onClose={onClose}
    />
  );
}

function RowItem({ row, onClose }: { readonly row: Row; readonly onClose: () => void }) {
  const className = row.fresh === true ? `${styles.letter} ${styles.letterFresh}` : styles.letter;
  const content = (
    <>
      <span className={styles.letterIcon}>
        <Icon name={row.icon} size={20} />
      </span>
      <span className={styles.letterText}>
        <span className={styles.letterTitle}>{row.title}</span>
        <span className={styles.letterDetail}>{row.detail}</span>
      </span>
      {row.when !== undefined && <span className={styles.letterWhen}>{row.when}</span>}
      {row.fresh === true && <span className={styles.visuallyHidden}>Nouveau</span>}
    </>
  );
  return (
    <li>
      {row.href !== undefined ? (
        <Link href={row.href} className={className} onClick={onClose}>
          {content}
        </Link>
      ) : (
        <button
          type="button"
          className={className}
          onClick={() => {
            onClose();
            row.action?.();
          }}
        >
          {content}
        </button>
      )}
    </li>
  );
}
