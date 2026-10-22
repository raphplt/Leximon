"use client";

import {
  ATELIER_TABS,
  type AtelierItem,
  type AtelierTab,
  atelierItems,
  cosmeticLockedToast,
  cosmeticStateLabel,
  wornToast,
} from "@leximon/view-model";
import Link from "next/link";
import { useState } from "react";
import { Avatar } from "@/components/avatar";
import { useNow } from "@/lib/use-now";
import { Icon } from "@/ui/icon";
import { useToast } from "@/ui/toast";
import ui from "@/ui/ui.module.css";
import styles from "./profile.module.css";
import { useProfileActions } from "./use-profile-actions";

const STATE_CLASS = {
  worn: styles.worn,
  owned: styles.owned,
  in_coffret: styles.closed,
  locked: styles.closed,
} as const;

/** The atelier: what the coffrets gave, worn on the profile with one tap. */
export function AtelierScreen() {
  const actions = useProfileActions();
  const me = actions.profile;
  const now = useNow(60_000);
  const toast = useToast();
  const [tab, setTab] = useState<AtelierTab>("avatars");

  const choose = (item: AtelierItem) => {
    if (item.state === "worn") return;
    if (item.state !== "owned") {
      toast(cosmeticLockedToast(item));
      return;
    }
    const change =
      tab === "avatars"
        ? { avatar: item.id }
        : tab === "frames"
          ? { frame: item.id }
          : { title: item.id };
    void actions.update(change, { success: wornToast(tab) });
  };

  const items = me === null || now === 0 ? [] : atelierItems(tab, me, now);

  return (
    <main className={styles.page}>
      <Link href="/profil" className={styles.back}>
        <Icon name="back" size={18} />
        Retour au profil
      </Link>
      <div className={styles.atelierHead}>
        {me !== null && <Avatar avatar={me.avatar} frame={me.frame} size={72} />}
        <h1 className={`${ui.display} ${styles.title}`}>Atelier</h1>
      </div>
      <div className={styles.tabs} role="tablist" aria-label="Rayons de l'atelier">
        {ATELIER_TABS.map((entry) => (
          <button
            key={entry.tab}
            type="button"
            role="tab"
            id={`tab-${entry.tab}`}
            aria-selected={tab === entry.tab}
            aria-controls="atelier-items"
            className={ui.chip}
            onClick={() => setTab(entry.tab)}
          >
            {entry.label}
          </button>
        ))}
      </div>
      <ul
        id="atelier-items"
        className={styles.items}
        role="tabpanel"
        aria-labelledby={`tab-${tab}`}
      >
        {items.map((item) => {
          const closed = item.state === "locked" || item.state === "in_coffret";
          return (
            <li key={item.id}>
              <button
                type="button"
                className={`${styles.item} ${closed ? styles.itemLocked : ""}`}
                aria-pressed={item.state === "worn"}
                aria-disabled={item.state !== "owned" ? true : undefined}
                disabled={actions.busy}
                onClick={() => choose(item)}
              >
                <Preview tab={tab} item={item} wornAvatar={me?.avatar ?? null} />
                {tab !== "titles" && <span className={styles.itemName}>{item.name}</span>}
                <span className={`${styles.itemState} ${STATE_CLASS[item.state]}`}>
                  {item.state === "worn" && <Icon name="check" size={14} />}{" "}
                  {cosmeticStateLabel(item)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </main>
  );
}

function Preview({
  tab,
  item,
  wornAvatar,
}: {
  readonly tab: AtelierTab;
  readonly item: AtelierItem;
  readonly wornAvatar: string | null;
}) {
  if (tab === "titles") {
    return (
      <span className={styles.titlePreview}>
        <span className={styles.titlePill}>{item.name}</span>
      </span>
    );
  }
  // A frame is tried on the avatar worn; an avatar in the simple frame.
  return tab === "avatars" ? (
    <Avatar avatar={item.id} frame="simple" size={84} />
  ) : (
    <Avatar avatar={wornAvatar} frame={item.id} size={84} />
  );
}
