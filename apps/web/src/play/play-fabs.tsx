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

/** The floating buttons on both sides of the sachet (J-04). */
export function PlayFabs() {
  const view = usePlayerView();
  const shell = useShell();
  const router = useRouter();
  const toast = useToast();
  const daily = useShared(dailyChallenge);
  if (view.now === 0) return null;
  const dailyRatio = daily === null ? 0 : dailyView(daily).ratio;
  const { left, right } = playFabs(
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
        else router.push("/clan");
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

  const column = (fabs: readonly FabModel[], side: string | undefined) => (
    <div className={side}>
      {fabs.map((fab) => (
        <Fab
          key={fab.id}
          icon={ICONS[fab.id]}
          label={fab.label}
          badge={fab.badge}
          lock={fab.lock}
          glow={fab.glow}
          onClick={() => act(fab)}
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
      ))}
    </div>
  );
  return (
    <>
      {column(left, styles.fabsLeft)}
      {column(right, styles.fabsRight)}
    </>
  );
}
