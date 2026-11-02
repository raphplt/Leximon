"use client";

import type { ToyIconName } from "@leximon/tokens";
import {
  closedTabs,
  levelBadge,
  levelDescription,
  levelRatio,
  levelsOfFeatures,
  mailLabel,
  PHONE_TAB_ORDER,
  stockView,
  TAB_LABELS,
  type TabId,
  tabBadge,
  xpProgressLabel,
} from "@leximon/view-model";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { Avatar } from "@/components/avatar";
import {
  LevelGauge,
  MailButton,
  PortraitButton,
  StockButton,
  type Tab,
  TabBar,
} from "@/library/play-pieces";
import { Dialog } from "@/ui/dialog";
import styles from "./library-bars.module.css";
import { isCurrent, TABS } from "./nav";
import { useShell } from "./shell-context";
import { StockDetail } from "./stock-detail";
import { usePlayerView } from "./use-player-view";

const ICONS: Readonly<Record<Exclude<TabId, "jouer">, ToyIconName>> = {
  album: "album",
  defis: "challenges",
  echanges: "trades",
  clan: "community",
};

const SIDE_TABS = PHONE_TAB_ORDER.filter(
  (id): id is Exclude<TabId, "jouer"> => id !== "jouer",
) as readonly Exclude<TabId, "jouer">[];

function hrefOf(id: TabId): string {
  return TABS.find((tab) => tab.id === id)?.href ?? "/jouer";
}

/**
 * The phone band of « La Bibliothèque »: the portrait opens the player's menu, the medal the
 * levels, then the stock and the mail. CSS shows it in place of the current band when the look
 * is on.
 */
export function LibraryTopBand({ onMenu }: { readonly onMenu: () => void }) {
  const view = usePlayerView();
  const { openMail } = useShell();
  const [stockOpen, setStockOpen] = useState(false);
  const closeStock = useCallback(() => setStockOpen(false), []);
  const { progress, wallet, now } = view;
  const stock = wallet === null || now === 0 ? null : stockView(wallet, now);
  return (
    <header className={styles.band}>
      <PortraitButton label="Menu du joueur" onClick={onMenu}>
        <Avatar avatar={view.profile?.avatar ?? null} frame={null} size={40} />
      </PortraitButton>
      {progress === null ? (
        <span className={styles.gauge} />
      ) : (
        <Link
          href="/niveaux"
          className={styles.gauge}
          aria-label={`Niveaux, ${levelDescription(progress)}`}
        >
          <LevelGauge
            level={progress.level}
            progress={levelRatio(progress)}
            label={xpProgressLabel(progress)}
          />
        </Link>
      )}
      {stock !== null && wallet !== null && (
        <>
          <StockButton
            label={stock.description}
            figure={`${stock.stored}/${stock.capacity}`}
            onClick={() => setStockOpen(true)}
          />
          <Dialog open={stockOpen} title="Tes sachets" onClose={closeStock} variant="center">
            <StockDetail wallet={wallet} now={now} onClose={closeStock} />
          </Dialog>
        </>
      )}
      <MailButton label={mailLabel(view.mail)} count={view.mail} onClick={openMail} />
    </header>
  );
}

/** The phone tabs of « La Bibliothèque », in place of the current ones when the look is on. */
export function LibraryTabs() {
  const pathname = usePathname();
  const router = useRouter();
  const view = usePlayerView();
  const closed = closedTabs(view.progress?.level ?? null, view.now);
  const counts = { offers: view.offers, coffrets: view.coffrets.length };
  const tabs = SIDE_TABS.map(
    (id): Tab => ({
      icon: ICONS[id],
      label: TAB_LABELS[id],
      badge: tabBadge(id, counts) > 0 ? String(tabBadge(id, counts)) : undefined,
      lockedAt: closed.has(id) ? levelBadge(levelsOfFeatures(view.now).trade) : undefined,
    }),
  );
  const [first, second, third, fourth] = tabs;
  if (first === undefined || second === undefined || third === undefined || fourth === undefined)
    return null;
  const currentIndex = SIDE_TABS.findIndex((id) => isCurrent(pathname, hrefOf(id)));
  const current = isCurrent(pathname, "/jouer")
    ? "play"
    : currentIndex === -1
      ? null
      : currentIndex;
  return (
    <TabBar
      className={styles.tabs}
      tabs={[first, second, third, fourth]}
      playLabel={TAB_LABELS.jouer}
      current={current}
      onTab={(index) => {
        const id = SIDE_TABS[index];
        if (id !== undefined) router.push(hrefOf(id));
      }}
      onPlay={() => router.push("/jouer")}
    />
  );
}
