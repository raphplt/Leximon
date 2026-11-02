"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { ChatPanel } from "@/clan/chat-panel";
import { TradeDoneDialog } from "@/trades/trade-done-dialog";
import { ToastProvider } from "@/ui/toast";
import { PhoneTabs, PhoneTopBar, TopBar } from "./bars";
import { CardSheet } from "./card-sheet";
import { CoffretDialog } from "./coffret-dialog";
import styles from "./game-shell.module.css";
import { LibraryTabs, LibraryTopBand, LibraryTopBar } from "./library-bars";
import { MailPanel } from "./mail-panel";
import { NewsDialog } from "./news-dialog";
import { PlayerMenu } from "./player-menu";
import { SanctionDialog } from "./sanction-dialog";
import { SettingsPanel } from "./settings-panel";
import { type Shell, ShellContext } from "./shell-context";
import { usePlayerView } from "./use-player-view";

type Overlay = "menu" | "settings" | "mail" | "chat" | null;

/**
 * The frame of every game screen: the top bar on the web, the phone band and tabs under 760 px
 *, and what opens over any screen (menu, settings, mail, coffret, card sheet).
 */
export function GameShell({ children }: { readonly children: ReactNode }) {
  return (
    <ToastProvider>
      <Frame>{children}</Frame>
    </ToastProvider>
  );
}

function Frame({ children }: { readonly children: ReactNode }) {
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [coffret, setCoffret] = useState<number | null>(null);
  const [card, setCard] = useState<string | null>(null);
  const view = usePlayerView();
  const router = useRouter();
  const lowest = view.coffrets[0];

  const openCoffret = useCallback(
    (level?: number) => {
      setOverlay(null);
      const target = level ?? lowest;
      if (target === undefined) router.push("/niveaux");
      else setCoffret(target);
    },
    [lowest, router],
  );
  const shell = useMemo<Shell>(
    () => ({
      openCoffret,
      openSettings: () => setOverlay("settings"),
      openMail: () => setOverlay("mail"),
      openChat: () => setOverlay("chat"),
      openCard: (cardId) => {
        setOverlay(null);
        setCard(cardId);
      },
    }),
    [openCoffret],
  );
  // `?courrier` in an e-mail's link opens the mail over the screen, once.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("courrier")) return;
    setOverlay("mail");
    url.searchParams.delete("courrier");
    window.history.replaceState(window.history.state, "", url);
  }, []);
  const close = useCallback(() => setOverlay(null), []);
  const toggleMenu = useCallback(() => setOverlay((o) => (o === "menu" ? null : "menu")), []);

  return (
    <ShellContext.Provider value={shell}>
      <TopBar menuOpen={overlay === "menu"} onMenu={toggleMenu} />
      <PhoneTopBar onMenu={toggleMenu} />
      <LibraryTopBar menuOpen={overlay === "menu"} onMenu={toggleMenu} />
      <LibraryTopBand onMenu={toggleMenu} />
      <div className={styles.content}>{children}</div>
      <PhoneTabs />
      <LibraryTabs />
      <PlayerMenu open={overlay === "menu"} onClose={close} />
      <SettingsPanel open={overlay === "settings"} onClose={close} />
      <MailPanel open={overlay === "mail"} onClose={close} />
      <ChatPanel open={overlay === "chat"} onClose={close} />
      <SanctionDialog now={view.now} />
      <NewsDialog level={view.progress?.level ?? null} />
      <CoffretDialog level={coffret} now={view.now} onClose={() => setCoffret(null)} />
      <TradeDoneDialog />
      <CardSheet cardId={card} onClose={() => setCard(null)} />
    </ShellContext.Provider>
  );
}
