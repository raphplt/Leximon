"use client";

import {
  levelDescription,
  levelRatio,
  levelsOfFeatures,
  stockView,
  xpProgressLabel,
} from "@leximon/view-model";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Avatar } from "@/components/avatar";
import { Icon } from "@/ui/icon";
import { ringStyle, XpBar } from "@/ui/level-bits";
import { Logo } from "@/ui/logo";
import ui from "@/ui/ui.module.css";
import styles from "./bars.module.css";
import { isCurrent, PHONE_ORDER, TABS, type TabId } from "./nav";
import { useShell } from "./shell-context";
import { usePlayerView } from "./use-player-view";

type PlayerView = ReturnType<typeof usePlayerView>;

/** Which tabs a level still closes (P59): shown with a padlock, never hidden. */
function closedTabs(view: PlayerView): ReadonlySet<TabId> {
  if (view.progress === null || view.now === 0) return new Set();
  const levels = levelsOfFeatures(view.now);
  const closed = new Set<TabId>();
  if (view.progress.level < levels.trade) closed.add("echanges");
  if (view.progress.level < levels.join_clan) closed.add("clan");
  return closed;
}

function badgeOf(id: TabId, view: PlayerView): number {
  if (id === "echanges") return view.offers;
  if (id === "jouer") return view.coffrets.length;
  return 0;
}

/** Stock and bonus chips, shared by both bars. */
function StockChips({ view, compact }: { readonly view: PlayerView; readonly compact: boolean }) {
  if (view.wallet === null || view.now === 0) return null;
  const stock = stockView(view.wallet, view.now);
  return (
    <>
      <Link
        href="/jouer"
        className={`${ui.chip} ${compact ? styles.chipCompact : ""}`}
        aria-label={stock.description}
      >
        <Icon name="sachet" size={compact ? 16 : 18} />
        <span className={styles.num}>
          {stock.stored}/{stock.capacity}
        </span>
        {!compact && <span className={styles.chipMuted}>{stock.refillShort}</span>}
      </Link>
      {stock.bonus > 0 && (
        <span
          className={`${ui.chip} ${ui.chipGold} ${compact ? styles.chipCompact : ""}`}
          title={`${stock.bonus} / ${view.wallet.bonusCap} sachets bonus en réserve`}
        >
          {compact ? `+${stock.bonus}` : `+${stock.bonus} bonus`}
        </span>
      )}
    </>
  );
}

function MailButton({ view, compact }: { readonly view: PlayerView; readonly compact: boolean }) {
  const { openMail } = useShell();
  return (
    <button
      type="button"
      className={`${ui.round} ${compact ? styles.roundCompact : ""}`}
      onClick={openMail}
      aria-label={view.mail > 0 ? `Courrier, ${view.mail} en attente` : "Courrier"}
    >
      <Icon name="courrier" size={compact ? 19 : 21} />
      {view.mail > 0 && <span className={`${ui.badge} ${styles.badgeBar}`}>{view.mail}</span>}
    </button>
  );
}

/** The web top bar, from 760 px (C-01). */
export function TopBar({
  menuOpen,
  onMenu,
}: {
  readonly menuOpen: boolean;
  readonly onMenu: () => void;
}) {
  const pathname = usePathname();
  const view = usePlayerView();
  const closed = closedTabs(view);
  return (
    <header className={styles.top}>
      <Link href="/jouer" className={styles.logoLink} aria-label="Leximon, retour au jeu">
        <Logo size="md" />
      </Link>
      <nav aria-label="Navigation principale" className={styles.nav}>
        {TABS.map((tab) => {
          const current = isCurrent(pathname, tab.href);
          const badge = badgeOf(tab.id, view);
          return (
            <Link
              key={tab.id}
              href={tab.href}
              className={styles.navLink}
              aria-current={current ? "page" : undefined}
            >
              <Icon name={tab.icon} size={19} />
              <span className={styles.navLabel}>{tab.label}</span>
              {closed.has(tab.id) && <Icon name="lock" size={14} className={styles.navLock} />}
              {badge > 0 && !current && <span className={styles.navBadge}>{badge}</span>}
            </Link>
          );
        })}
      </nav>
      <div className={styles.side}>
        <StockChips view={view} compact={false} />
        <MailButton view={view} compact={false} />
        {view.progress !== null && (
          <Link
            href="/niveaux"
            className={styles.ring}
            style={ringStyle(levelRatio(view.progress))}
            aria-label={`Chemin des niveaux, ${levelDescription(view.progress)}`}
            title={levelDescription(view.progress)}
          >
            <span className={`${ui.display} ${styles.ringLevel}`}>{view.progress.level}</span>
          </Link>
        )}
        <button
          type="button"
          className={styles.avatarButton}
          onClick={onMenu}
          aria-label="Menu du joueur"
          aria-expanded={menuOpen}
        >
          <Avatar
            avatar={view.profile?.avatar ?? null}
            frame={view.profile?.frame ?? null}
            size={40}
          />
          {(view.guest || view.profile?.pseudo != null) && (
            <span className={styles.avatarName}>{view.name}</span>
          )}
          <Icon name="chevd" size={16} />
        </button>
      </div>
    </header>
  );
}

/** The phone top band, under 760 px (C-04, C-08). */
export function PhoneTopBar({ onMenu }: { readonly onMenu: () => void }) {
  const view = usePlayerView();
  const { progress } = view;
  return (
    <header className={styles.phoneTop}>
      <button
        type="button"
        className={styles.phoneAvatar}
        style={progress === null ? undefined : ringStyle(levelRatio(progress))}
        onClick={onMenu}
        aria-label="Menu du joueur"
        aria-haspopup="dialog"
      >
        <Avatar avatar={view.profile?.avatar ?? null} frame={null} size={38} />
        {progress !== null && (
          <span className={`${ui.display} ${styles.phoneLevel}`}>{progress.level}</span>
        )}
      </button>
      {progress !== null && (
        <Link
          href="/niveaux"
          className={styles.phoneXp}
          aria-label={`Chemin des niveaux, ${levelDescription(progress)}`}
        >
          <span className={styles.phoneXpText}>{xpProgressLabel(progress)}</span>
          <XpBar ratio={levelRatio(progress)} thin />
        </Link>
      )}
      <span className={styles.spacer} />
      <StockChips view={view} compact />
      <MailButton view={view} compact />
    </header>
  );
}

/** The phone tabs, under 760 px (C-03, C-08). */
export function PhoneTabs() {
  const pathname = usePathname();
  const view = usePlayerView();
  const closed = closedTabs(view);
  return (
    <nav aria-label="Navigation principale" className={styles.tabs}>
      {PHONE_ORDER.map((id) => {
        const tab = TABS.find((t) => t.id === id);
        if (tab === undefined) return null;
        const current = isCurrent(pathname, tab.href);
        const badge = badgeOf(id, view);
        if (id === "jouer") {
          return (
            <Link
              key={id}
              href={tab.href}
              className={styles.tabPlay}
              aria-current={current ? "page" : undefined}
            >
              <span className={styles.tabPlayCircle}>
                <Icon name="sachet" size={30} />
                {badge > 0 && <span className={`${ui.badge} ${styles.tabBadge}`}>{badge}</span>}
              </span>
              <span className={styles.tabLabel}>{tab.label}</span>
            </Link>
          );
        }
        return (
          <Link
            key={id}
            href={tab.href}
            className={styles.tab}
            aria-current={current ? "page" : undefined}
          >
            <span className={styles.tabPill}>
              <Icon name={tab.icon} size={22} />
              {closed.has(id) ? (
                <span className={styles.tabLock}>
                  <Icon name="lock" size={10} />
                </span>
              ) : (
                badge > 0 && <span className={`${ui.badge} ${styles.tabBadge}`}>{badge}</span>
              )}
            </span>
            <span className={styles.tabLabel}>{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
