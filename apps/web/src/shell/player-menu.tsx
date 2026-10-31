"use client";

import { COMMUNITY_PATH, COMMUNITY_TITLE, levelBadge, levelsOfFeatures } from "@leximon/view-model";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { FeedbackDialog } from "@/beta/feedback-dialog";
import { Avatar } from "@/components/avatar";
import { useNarrow } from "@/lib/use-narrow";
import { SignOutDialog } from "@/profile/sign-out-dialog";
import { Dialog } from "@/ui/dialog";
import { Icon, type IconName } from "@/ui/icon";
import { LevelMedal } from "@/ui/level-bits";
import ui from "@/ui/ui.module.css";
import styles from "./player-menu.module.css";
import { useShell } from "./shell-context";
import { usePlayerView } from "./use-player-view";

interface Item {
  readonly label: string;
  readonly icon: IconName;
  readonly href?: string;
  readonly action?: () => void;
  readonly lock?: string | null;
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

  const admin: Item[] = view.admin ? [{ label: "Admin", icon: "cle", href: "/admin" }] : [];
  // Until the account is read, the account page: it knows what to offer either way.
  const account: Item = view.member
    ? { label: "Déconnexion", icon: "logout", action: () => setSignOutOpen(true) }
    : { label: "Créer mon compte", icon: "cle", href: "/compte" };
  const joustLevel = view.now === 0 ? null : levelsOfFeatures(view.now).jousts;
  const items: Item[] = [
    { label: "Mon profil", icon: "profil", href: "/profil" },
    { label: "Amis", icon: "amis", href: "/amis" },
    { label: COMMUNITY_TITLE, icon: "clan", href: COMMUNITY_PATH },
    {
      label: "Joutes",
      icon: "joutes",
      href: "/joutes",
      lock:
        joustLevel !== null && view.progress !== null && view.progress.level < joustLevel
          ? levelBadge(joustLevel)
          : null,
    },
    { label: "Apparence", icon: "palette", href: "/atelier" },
    { label: "Niveaux", icon: "star", href: "/niveaux" },
    { label: "Nouveautés", icon: "bolt", href: "/nouveautes" },
    { label: "Réglages", icon: "reglages", action: openSettings },
    { label: "Devenir mécène", icon: "crown", href: "/mecene" },
    { label: "Écrire à l'équipe", icon: "chat", action: () => setFeedbackOpen(true) },
    ...admin,
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
      {items.map((item) => {
        const content = (
          <>
            <span className={narrow ? styles.sheetIcon : styles.icon}>
              <Icon name={item.icon} size={narrow ? 20 : 19} />
            </span>
            <span className={styles.label}>{item.label}</span>
            {item.lock != null && <span className={styles.lock}>{item.lock}</span>}
            {narrow && <Icon name="chev" size={16} />}
          </>
        );
        return (
          <li key={item.label}>
            {item.href !== undefined ? (
              <Link href={item.href} className={styles.row} onClick={onClose}>
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
          {view.progress !== null && (
            <div className={styles.who}>
              <Avatar
                avatar={view.profile?.avatar ?? null}
                frame={view.profile?.frame ?? null}
                size={56}
              />
              <div>
                <div className={`${ui.display} ${styles.whoName}`}>{view.name}</div>
                <div className={styles.whoLevel}>
                  <LevelMedal level={view.progress.level} size={26} labelled />
                  {view.title}
                </div>
              </div>
            </div>
          )}
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
