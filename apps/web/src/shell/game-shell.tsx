"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { ChatPanel } from "@/clan/chat-panel";
import { MissingWordDialog } from "@/ecus/missing-word-dialog";
import { TradeDoneDialog } from "@/trades/trade-done-dialog";
import { ToastProvider } from "@/ui/toast";
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
import { useWelcomeOnArrival, WelcomeDialog } from "./welcome-dialog";

type Overlay = "menu" | "settings" | "mail" | "chat" | null;

/**
 * The frame of every game screen: the top bar on the web, the phone band and tabs under 760 px,
 * and what opens over any screen (menu, settings, mail, coffret, card sheet).
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
  const [welcome, setWelcome] = useState(false);
  const [missingWord, setMissingWord] = useState<{ readonly collectionId: string | null } | null>(
    null,
  );
  const [card, setCard] = useState<{
    readonly id: string;
    readonly among: readonly string[];
  } | null>(null);
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
  const openWelcome = useCallback(() => {
    setOverlay(null);
    setWelcome(true);
  }, []);
  const welcomeWaits = view.welcomeWaits;
  const openRewards = useCallback(() => {
    if (welcomeWaits) openWelcome();
    else openCoffret();
  }, [welcomeWaits, openWelcome, openCoffret]);
  useWelcomeOnArrival(welcomeWaits, view.now, openWelcome);
  const shell = useMemo<Shell>(
    () => ({
      openCoffret,
      openWelcome,
      openRewards,
      openMissingWord: (collectionId) => {
        setOverlay(null);
        setMissingWord({ collectionId: collectionId ?? null });
      },
      openSettings: () => setOverlay("settings"),
      openMail: () => setOverlay("mail"),
      openChat: () => setOverlay("chat"),
      openCard: (cardId, among = []) => {
        setOverlay(null);
        setCard({ id: cardId, among });
      },
    }),
    [openCoffret, openWelcome, openRewards],
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
      <LibraryTopBar menuOpen={overlay === "menu"} onMenu={toggleMenu} />
      <LibraryTopBand onMenu={toggleMenu} />
      <div className={styles.content}>{children}</div>
      <LibraryTabs />
      <PlayerMenu open={overlay === "menu"} onClose={close} />
      <SettingsPanel open={overlay === "settings"} onClose={close} />
      <MailPanel open={overlay === "mail"} onClose={close} />
      <ChatPanel open={overlay === "chat"} onClose={close} />
      <SanctionDialog now={view.now} />
      <NewsDialog level={view.progress?.level ?? null} />
      <CoffretDialog level={coffret} now={view.now} onClose={() => setCoffret(null)} />
      <WelcomeDialog open={welcome} onClose={() => setWelcome(false)} />
      <MissingWordDialog
        open={missingWord !== null}
        collectionId={missingWord?.collectionId ?? null}
        onClose={() => setMissingWord(null)}
      />
      <TradeDoneDialog />
      <CardSheet
        cardId={card?.id ?? null}
        among={card?.among ?? []}
        onTurn={(id) => setCard((open) => (open === null ? null : { ...open, id }))}
        onClose={() => setCard(null)}
      />
    </ShellContext.Provider>
  );
}
