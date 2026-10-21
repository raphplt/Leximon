"use client";

import { levelBadge, levelsOfFeatures } from "@leximon/view-model";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { useNarrow } from "@/lib/use-narrow";
import { Dialog } from "@/ui/dialog";
import { Icon, type IconName } from "@/ui/icon";
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

/**
 * The player's menu (C-02): under the avatar on the web, a sheet on phones. The profile and the
 * workshop join it with lot 3.
 */
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

  const joustLevel = view.now === 0 ? null : levelsOfFeatures(view.now).jousts;
  const items: Item[] = [
    { label: "Chemin des niveaux", icon: "star", href: "/niveaux" },
    {
      label: "Joutes",
      icon: "joutes",
      href: "/joutes",
      lock:
        joustLevel !== null && view.progress !== null && view.progress.level < joustLevel
          ? levelBadge(joustLevel)
          : null,
    },
    { label: "Réglages", icon: "reglages", action: openSettings },
    { label: view.guest ? "Créer mon compte" : "Mon compte", icon: "profil", href: "/compte" },
  ];

  // Web: Escape and a click beside it close the menu; the first entry takes the focus.
  useEffect(() => {
    if (!open || narrow) return;
    list.current?.querySelector<HTMLElement>("a, button")?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
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

  if (narrow) {
    return (
      <Dialog open={open} title="Menu" onClose={onClose}>
        {view.progress !== null && (
          <div className={styles.who}>
            <span className={styles.bigAvatar}>
              <Icon name="profil" size={30} />
            </span>
            <div>
              <div className={`${ui.display} ${styles.whoName}`}>
                {view.guest ? "Invité" : "Toi"}
              </div>
              <div className={styles.whoLevel}>
                {view.title === null ? "" : `${view.title} · `}niveau {view.progress.level}
              </div>
            </div>
          </div>
        )}
        {entries}
      </Dialog>
    );
  }
  if (!open) return null;
  return (
    <>
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
