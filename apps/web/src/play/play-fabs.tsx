"use client";

import {
  dailyView,
  type FabId,
  type Fab as FabModel,
  lockedToast,
  playFabs,
} from "@leximon/view-model";
import { useRouter } from "next/navigation";
import type { CSSProperties } from "react";
import { Emblem } from "@/clan/emblem";
import { myClan } from "@/player/clan";
import { dailyChallenge } from "@/player/collection";
import { useShared } from "@/player/resource";
import { useShell } from "@/shell/shell-context";
import { usePlayerView } from "@/shell/use-player-view";
import { Fab } from "@/ui/fab";
import type { IconName } from "@/ui/icon";
import { useToast } from "@/ui/toast";
import styles from "./play.module.css";

const ICONS: Readonly<Record<FabId, IconName>> = {
  clan: "clan",
  chat: "chat",
  jousts: "joutes",
  daily: "defi",
  coffrets: "coffret",
  mail: "courrier",
  settings: "reglages",
};

/** The buttons of the Jouer screen, and what each one does. */
function useFabs() {
  const view = usePlayerView();
  const shell = useShell();
  const router = useRouter();
  const toast = useToast();
  const daily = useShared(dailyChallenge);
  const emblem = useShared(myClan)?.emblem ?? null;
  if (view.now === 0) return null;
  const dailyRatio = daily === null ? 0 : dailyView(daily).ratio;
  const fabs = playFabs(
    {
      level: view.progress?.level ?? 1,
      coffrets: view.coffrets.length,
      mail: view.mail,
    },
    view.now,
  );

  const act = (fab: FabModel) => {
    switch (fab.id) {
      case "clan":
      case "jousts":
        router.push(fab.id === "clan" ? "/clan" : "/joutes");
        return;
      case "chat":
        if (fab.lock !== null) toast(lockedToast("join_clan", view.now));
        else shell.openChat();
        return;
      case "daily":
        router.push("/defis");
        return;
      case "coffrets":
        shell.openCoffret();
        return;
      case "mail":
        shell.openMail();
        return;
      case "settings":
        shell.openSettings();
        return;
    }
  };

  const render = (fab: FabModel) => (
    <Fab
      key={fab.id}
      icon={ICONS[fab.id]}
      label={fab.label}
      badge={fab.badge}
      lock={fab.lock}
      glow={fab.glow}
      onClick={() => act(fab)}
      visual={
        fab.id === "clan" && emblem !== null ? <Emblem emblem={emblem} size={30} /> : undefined
      }
      ring={
        fab.id === "daily" ? (
          <span
            className={styles.dailyRing}
            style={{ "--done": `${Math.round(dailyRatio * 360)}deg` } as CSSProperties}
            aria-hidden="true"
          />
        ) : undefined
      }
    />
  );
  return { ...fabs, render };
}

/** On a phone, the floating buttons on both sides of the sachet. */
export function PlayFabs() {
  const fabs = useFabs();
  if (fabs === null) return null;
  return (
    <>
      <div className={styles.fabsLeft}>{fabs.left.map(fabs.render)}</div>
      <div className={styles.fabsRight}>{fabs.right.map(fabs.render)}</div>
    </>
  );
}

/** On a wider screen, the places to go from Jouer; the daily challenge, coffrets and mail have their own cards. */
export function Shortcuts() {
  const fabs = useFabs();
  if (fabs === null) return null;
  const settings = fabs.right.filter((fab) => fab.id === "settings");
  return (
    <nav className={styles.shortcuts} aria-label="Raccourcis">
      {[...fabs.left, ...settings].map(fabs.render)}
    </nav>
  );
}
