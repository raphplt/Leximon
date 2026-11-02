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
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { Avatar } from "@/components/avatar";
import {
  CountBadge,
  LevelGauge,
  MailButton,
  PortraitButton,
  StockButton,
  type Tab,
  TabBar,
} from "@/library/play-pieces";
import { Dialog } from "@/ui/dialog";
import { Lettering, ToyIcon } from "@/ui/toy";
import styles from "./library-bars.module.css";
import { isCurrent, TABS } from "./nav";
import { useShell } from "./shell-context";
import { StockDetail } from "./stock-detail";
import { usePlayerView } from "./use-player-view";

const ICONS: Readonly<Record<TabId, ToyIconName>> = {
  jouer: "sachet",
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
 * The wide band of « La Bibliothèque », from 760 px: a shelf across the top with the house's
 * seal, the five places of the game, then the level, the stock, the mail and the player's
 * portrait, which opens their menu. CSS shows it in place of the current top bar.
 */
export function LibraryTopBar({
  menuOpen,
  onMenu,
}: {
  readonly menuOpen: boolean;
  readonly onMenu: () => void;
}) {
  const pathname = usePathname();
  const view = usePlayerView();
  const closed = closedTabs(view.progress?.level ?? null, view.now);
  const counts = { offers: view.offers, coffrets: view.coffrets.length };
  const name =
    view.profile === null ? null : (view.profile.pseudo ?? (view.profile.member ? null : "Invité"));
  return (
    <header className={styles.top}>
      <Link href="/jouer" className={styles.brand} aria-label="Leximon, retour au jeu">
        <Image src="/logo-mark.svg" alt="" width={46} height={46} className={styles.seal} />
        <Lettering className={styles.brandName}>Leximon</Lettering>
      </Link>
      <nav aria-label="Navigation principale" className={styles.nav}>
        {TABS.map((tab) => {
          const current = isCurrent(pathname, tab.href);
          const badge = tabBadge(tab.id, counts);
          const locked = closed.has(tab.id);
          return (
            <span key={tab.id} className={styles.plank}>
              <Link
                href={tab.href}
                className={styles.navItem}
                aria-current={current ? "page" : undefined}
                aria-label={
                  locked
                    ? `${tab.label}, ${levelBadge(levelsOfFeatures(view.now).trade)}`
                    : undefined
                }
              >
                <span className={locked ? styles.navIconLocked : styles.navIcon}>
                  <ToyIcon name={ICONS[tab.id]} size={30} />
                  {locked && (
                    <span className={styles.navLock}>
                      <ToyIcon name="lock" size={16} />
                    </span>
                  )}
                  {badge > 0 && !current && (
                    <CountBadge count={String(badge)} className={styles.navBadge} />
                  )}
                </span>
                <Lettering className={styles.navLabel}>{tab.label}</Lettering>
              </Link>
            </span>
          );
        })}
      </nav>
      <div className={styles.side}>
        <PlayerTools />
        <button
          type="button"
          className={styles.player}
          onClick={onMenu}
          aria-label="Menu du joueur"
          aria-expanded={menuOpen}
        >
          <span className={styles.playerPortrait} aria-hidden="true">
            <Avatar avatar={view.profile?.avatar ?? null} frame={null} size={40} />
          </span>
          {name !== null && <Lettering className={styles.playerName}>{name}</Lettering>}
        </button>
      </div>
    </header>
  );
}

/** The level, the stock with its detail and the mail: the same toys on the band and the bar. */
function PlayerTools() {
  const view = usePlayerView();
  const { openMail } = useShell();
  const [stockOpen, setStockOpen] = useState(false);
  const closeStock = useCallback(() => setStockOpen(false), []);
  const { progress, wallet, now } = view;
  const stock = wallet === null || now === 0 ? null : stockView(wallet, now);
  return (
    <>
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
    </>
  );
}

/**
 * The phone band of « La Bibliothèque »: the portrait opens the player's menu, the medal the
 * levels, then the stock and the mail. CSS shows it in place of the current band when the look
 * is on.
 */
export function LibraryTopBand({ onMenu }: { readonly onMenu: () => void }) {
  const view = usePlayerView();
  return (
    <header className={styles.band}>
      <PortraitButton label="Menu du joueur" onClick={onMenu}>
        <Avatar avatar={view.profile?.avatar ?? null} frame={null} size={40} />
      </PortraitButton>
      <PlayerTools />
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
