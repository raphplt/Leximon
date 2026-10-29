"use client";

import { changelogDate, newsToShow } from "@leximon/view-model";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/ui/button";
import { Dialog } from "@/ui/dialog";
import styles from "./panels.module.css";

const STORAGE_KEY = "leximon.news-seen";

/** Storage can be missing or blocked: then the news shows at each visit, which is harmless. */
function readSeen(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeSeen(date: string): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, date);
  } catch {
    // Not remembered: the pop-up comes back next visit.
  }
}

/**
 * What changed since the player last looked, once per change and per device. A new player is
 * spared the news of the past.
 */
export function NewsDialog({ level }: { readonly level: number | null }) {
  const [seen, setSeen] = useState<string | null | undefined>(undefined);
  useEffect(() => setSeen(readSeen()), []);
  const news = useMemo(
    () => (seen === undefined || level === null ? null : newsToShow(seen, level)),
    [seen, level],
  );

  useEffect(() => {
    if (news !== null && news.entries.length === 0 && news.seen !== null && news.seen !== seen) {
      writeSeen(news.seen);
    }
  }, [news, seen]);

  const close = () => {
    if (news?.seen != null) {
      writeSeen(news.seen);
      setSeen(news.seen);
    }
  };

  return (
    <Dialog
      open={news !== null && news.entries.length > 0}
      title="Nouveautés"
      onClose={close}
      variant="center"
    >
      <div className={styles.news}>
        {news?.entries.map((entry) => (
          <section key={entry.date} className={styles.newsEntry}>
            <h3 className={styles.newsTitle}>{entry.title}</h3>
            <p className={styles.newsDate}>{changelogDate(entry.date)}</p>
            <ul className={styles.newsItems}>
              {entry.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        ))}
        <Button wide onClick={close}>
          Retour au jeu
        </Button>
        <Link href="/nouveautes" className={styles.newsAll} onClick={close}>
          Toutes les nouveautés
        </Link>
      </div>
    </Dialog>
  );
}
