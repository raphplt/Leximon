"use client";

import { APPEARANCE_NEW_KEY, patronMenuLabel, SIGN_IN_QUERY } from "@leximon/view-model";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { FeedbackDialog } from "@/beta/feedback-dialog";
import { Avatar } from "@/components/avatar";
import { useSeenFlag } from "@/lib/seen-flag";
import { useNarrow } from "@/lib/use-narrow";
import { SignOutDialog } from "@/profile/sign-out-dialog";
import { Dialog } from "@/ui/dialog";
import { Icon, type IconName } from "@/ui/icon";
import { LevelMedal } from "@/ui/level-bits";
import { NewTag } from "@/ui/new-tag";
import ui from "@/ui/ui.module.css";
import styles from "./player-menu.module.css";
import { useShell } from "./shell-context";
import { usePlayerView } from "./use-player-view";

interface Item {
  readonly label: string;
  readonly icon: IconName;
  readonly href?: string;
  readonly action?: () => void;
  /** Marked « Nouveau » until followed once. */
  readonly fresh?: boolean;
  readonly onFollow?: () => void;
}

/** The player's menu: under the avatar on the web, a sheet on phones. */
export function PlayerMenu({
  open,
  onClose,
}: {
  readonly open: boolean;
  readonly onClose: () => void;
}) {
  const narrow = useNarrow();
  const view = usePlayerView();
  const { openSettings } = useShell();
  const list = useRef<HTMLUListElement>(null);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [signOutOpen, setSignOutOpen] = useState(false);
  const [appearanceFresh, appearanceSeen] = useSeenFlag(APPEARANCE_NEW_KEY);

  const admin: Item[] = view.admin ? [{ label: "Admin", icon: "cle", href: "/admin" }] : [];
  // Until the account is read, the account page: it knows what to offer either way.
  const account: readonly Item[] = view.member
    ? [{ label: "Déconnexion", icon: "logout", action: () => setSignOutOpen(true) }]
    : [
        { label: "Se connecter", icon: "porte", href: `/compte?${SIGN_IN_QUERY}` },
        { label: "Créer mon compte", icon: "cle", href: "/compte" },
      ];
  const groups: readonly (readonly Item[])[] = [
    [
      {
        label: "Apparence",
        icon: "palette",
        href: "/atelier",
        fresh: appearanceFresh,
        onFollow: appearanceSeen,
      },
      { label: "Réglages", icon: "reglages", action: openSettings },
    ],
    [
      { label: "Nouveautés", icon: "bolt", href: "/nouveautes" },
      { label: patronMenuLabel(view.patron), icon: "crown", href: "/mecene" },
      { label: "Écrire à l'équipe", icon: "chat", action: () => setFeedbackOpen(true) },
      ...admin,
    ],
    account,
  ];

  // Web: Escape and a click beside it close the menu; the first entry takes the focus, and the
  // avatar gets it back once the menu closes.
  useEffect(() => {
    if (!open || narrow) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    list.current?.querySelector<HTMLElement>("a, button")?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      opener?.focus();
    };
  }, [open, narrow, onClose]);

  const entries = (
    <ul ref={list} className={narrow ? styles.sheetList : styles.list}>
      <li>
        <Link href="/profil" className={styles.who} onClick={onClose}>
          <Avatar
            avatar={view.profile?.avatar ?? null}
            frame={view.profile?.frame ?? null}
            size={narrow ? 56 : 44}
          />
          <span className={styles.whoText}>
            <span className={`${ui.display} ${styles.whoName}`}>{view.name}</span>
            {view.progress !== null && (
              <span className={styles.whoLevel}>
                <LevelMedal level={view.progress.level} size={26} labelled />
                {view.title}
              </span>
            )}
          </span>
          <Icon name="chev" size={16} />
        </Link>
      </li>
      {groups.map((group) => (
        <li key={group[0]?.label} className={styles.group}>
          <ul className={styles.groupList}>
            {group.map((item) => {
              const content = (
                <>
                  <span className={narrow ? styles.sheetIcon : styles.icon}>
                    <Icon name={item.icon} size={narrow ? 20 : 19} />
                  </span>
                  <span className={styles.label}>
                    {item.label}
                    {item.fresh === true && (
                      <>
                        {" "}
                        <NewTag inline />
                      </>
                    )}
                  </span>
                  {narrow && <Icon name="chev" size={16} />}
                </>
              );
              return (
                <li key={item.label}>
                  {item.href !== undefined ? (
                    <Link
                      href={item.href}
                      className={styles.row}
                      onClick={() => {
                        item.onFollow?.();
                        onClose();
                      }}
                    >
                      {content}
                    </Link>
                  ) : (
                    <button
                      type="button"
                      className={styles.row}
                      onClick={() => {
                        onClose();
                        item.action?.();
                      }}
                    >
                      {content}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </li>
      ))}
    </ul>
  );

  // These windows outlive the menu, which closes as they open.
  const windows = (
    <>
      <FeedbackDialog open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
      <SignOutDialog open={signOutOpen} onClose={() => setSignOutOpen(false)} />
    </>
  );

  if (narrow) {
    return (
      <>
        <Dialog open={open} title="Menu" onClose={onClose}>
          {entries}
        </Dialog>
        {windows}
      </>
    );
  }
  if (!open) return windows;
  return (
    <>
      {windows}
      <button
        type="button"
        className={styles.scrim}
        aria-label="Fermer le menu"
        onClick={onClose}
        tabIndex={-1}
      />
      <nav className={`${styles.menu} ${ui.enter}`} aria-label="Menu du joueur">
        {entries}
      </nav>
    </>
  );
}
