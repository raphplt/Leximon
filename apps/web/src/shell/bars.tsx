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
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Avatar } from "@/components/avatar";
import { profile } from "@/player/player";
import { useSharedFailed } from "@/player/resource";
import { Icon } from "@/ui/icon";
import { LevelMedal, ringStyle, XpBar } from "@/ui/level-bits";
import { Logo } from "@/ui/logo";
import ui from "@/ui/ui.module.css";
import styles from "./bars.module.css";
import { isCurrent, PHONE_ORDER, TABS, type TabId } from "./nav";
import { ReserveDialog } from "./reserve-dialog";
import { useShell } from "./shell-context";
import { usePlayerView } from "./use-player-view";

type PlayerView = ReturnType<typeof usePlayerView>;

/** Which tabs a level still closes: shown with a padlock, never hidden. */
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
  const [reserveOpen, setReserveOpen] = useState(false);
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
        <>
          <button
            type="button"
            className={`${ui.chip} ${ui.chipGold} ${styles.chipButton} ${compact ? styles.chipCompact : ""}`}
            onClick={() => setReserveOpen(true)}
            aria-label={`Réserve, ${stock.bonus} sur ${view.wallet.bonusCap} sachets bonus`}
          >
            {compact ? `+${stock.bonus}` : `+${stock.bonus} bonus`}
          </button>
          <ReserveDialog
            wallet={view.wallet}
            open={reserveOpen}
            onClose={() => setReserveOpen(false)}
          />
        </>
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

interface Pill {
  readonly x: number;
  readonly width: number;
  /** Hidden on a screen that is no tab (profile, levels): it waits there, out of sight. */
  readonly shown: boolean;
  /** From one tab to another it slides; appearing, it is set down in place. */
  readonly slide: boolean;
}

/**
 * The pill behind the current tab. It leaves for the tab clicked at once, without waiting for
 * the page, and follows the address otherwise (a link elsewhere, the browser's back button).
 */
function useNavPill(pathname: string) {
  const navRef = useRef<HTMLElement>(null);
  const [target, setTarget] = useState<string | null>(null);
  const [pill, setPill] = useState<Pill | null>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new address ends the move
  useEffect(() => setTarget(null), [pathname]);
  const active = target ?? TABS.find((tab) => isCurrent(pathname, tab.href))?.href ?? null;

  useLayoutEffect(() => {
    const nav = navRef.current;
    if (nav === null) return;
    const place = () => {
      const link = active === null ? null : nav.querySelector<HTMLElement>(`a[href="${active}"]`);
      setPill((previous) =>
        link === null
          ? previous && { ...previous, shown: false, slide: false }
          : {
              x: link.offsetLeft,
              width: link.offsetWidth,
              shown: true,
              slide: previous?.shown === true,
            },
      );
    };
    place();
    // The tabs change width with the window (labels hidden) and once the font has loaded.
    const observer = new ResizeObserver(place);
    observer.observe(nav);
    return () => observer.disconnect();
  }, [active]);

  return { navRef, active, pill, follow: setTarget };
}

/** The web top bar, from 760 px. */
export function TopBar({
  menuOpen,
  onMenu,
}: {
  readonly menuOpen: boolean;
  readonly onMenu: () => void;
}) {
  const pathname = usePathname();
  const view = usePlayerView();
  const profileFailed = useSharedFailed(profile);
  const closed = closedTabs(view);
  // The group on the right waits for the profile, then comes whole: the name beside the avatar
  // widens its button, which would push the mail and the level aside under the eye.
  const me = view.profile;
  const sideShown = me !== null || profileFailed;
  const name = me === null ? null : (me.pseudo ?? (me.member ? null : "Invité"));
  const { navRef, active, pill, follow } = useNavPill(pathname);
  return (
    <header className={styles.top}>
      <Link href="/jouer" className={styles.logoLink} aria-label="Leximon, retour au jeu">
        <Logo size="md" />
      </Link>
      <nav
        ref={navRef}
        aria-label="Navigation principale"
        className={styles.nav}
        data-pill={pill !== null}
      >
        {pill !== null && (
          <span
            className={styles.navPill}
            data-shown={pill.shown}
            data-slide={pill.slide}
            style={{ translate: `${pill.x}px 0`, width: pill.width }}
            aria-hidden="true"
          />
        )}
        {TABS.map((tab) => {
          const current = isCurrent(pathname, tab.href);
          const badge = badgeOf(tab.id, view);
          return (
            <Link
              key={tab.id}
              href={tab.href}
              className={styles.navLink}
              aria-current={current ? "page" : undefined}
              data-active={tab.href === active}
              onNavigate={() => follow(tab.href)}
            >
              <Icon name={tab.icon} size={19} />
              <span className={styles.navLabel}>{tab.label}</span>
              {closed.has(tab.id) && <Icon name="lock" size={14} className={styles.navLock} />}
              {badge > 0 && !current && <span className={styles.navBadge}>{badge}</span>}
            </Link>
          );
        })}
      </nav>
      <div className={`${styles.side} ${sideShown ? styles.sideShown : ""}`}>
        {sideShown && <TopBarSide view={view} name={name} menuOpen={menuOpen} onMenu={onMenu} />}
      </div>
    </header>
  );
}

/** Stock, mail, level and the player's menu, on the right of the top bar. */
function TopBarSide({
  view,
  name,
  menuOpen,
  onMenu,
}: {
  readonly view: PlayerView;
  readonly name: string | null;
  readonly menuOpen: boolean;
  readonly onMenu: () => void;
}) {
  return (
    <>
      <StockChips view={view} compact={false} />
      <MailButton view={view} compact={false} />
      {view.progress === null ? (
        <span className={styles.ring} aria-hidden="true" />
      ) : (
        <Link
          href="/niveaux"
          className={styles.ring}
          style={ringStyle(levelRatio(view.progress))}
          aria-label={`Chemin des niveaux, ${levelDescription(view.progress)}`}
          title={levelDescription(view.progress)}
        >
          <LevelMedal level={view.progress.level} size={38} small />
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
        {name !== null && <span className={styles.avatarName}>{name}</span>}
        <Icon name="chevd" size={16} />
      </button>
    </>
  );
}

/** The phone top band, under 760 px. */
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
          <span className={styles.phoneLevel}>
            <LevelMedal level={progress.level} size={24} small />
          </span>
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

/** The phone tabs, under 760 px. */
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
