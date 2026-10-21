"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, useCallback, useMemo, useState } from "react";
import { ToastProvider } from "@/ui/toast";
import { PhoneTabs, PhoneTopBar, TopBar } from "./bars";
import { CardSheet } from "./card-sheet";
import { CoffretDialog } from "./coffret-dialog";
import styles from "./game-shell.module.css";
import { MailPanel } from "./mail-panel";
import { PlayerMenu } from "./player-menu";
import { SettingsPanel } from "./settings-panel";
import { type Shell, ShellContext } from "./shell-context";
import { usePlayerView } from "./use-player-view";

type Overlay = "menu" | "settings" | "mail" | null;

/**
 * The frame of every game screen: the top bar on the web, the phone band and tabs under 760 px
 * (C-08), and what opens over any screen (menu, settings, mail, coffret, card sheet).
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
      openCard: (cardId) => {
        setOverlay(null);
        setCard(cardId);
      },
    }),
    [openCoffret],
  );
  const close = useCallback(() => setOverlay(null), []);
  const toggleMenu = useCallback(() => setOverlay((o) => (o === "menu" ? null : "menu")), []);

  return (
    <ShellContext.Provider value={shell}>
      <TopBar menuOpen={overlay === "menu"} onMenu={toggleMenu} />
      <PhoneTopBar onMenu={toggleMenu} />
      <div className={styles.content}>{children}</div>
      <PhoneTabs />
      <PlayerMenu open={overlay === "menu"} onClose={close} />
      <SettingsPanel open={overlay === "settings"} onClose={close} />
      <MailPanel open={overlay === "mail"} onClose={close} />
      <CoffretDialog level={coffret} now={view.now} onClose={() => setCoffret(null)} />
      <CardSheet cardId={card} onClose={() => setCard(null)} />
    </ShellContext.Provider>
  );
}
