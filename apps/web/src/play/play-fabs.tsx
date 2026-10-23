"use client";

import {
  dailyView,
  type FabId,
  type Fab as FabModel,
  goalRing,
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

function Ring({
  ratio,
  className,
}: {
  readonly ratio: number;
  readonly className: string | undefined;
}) {
  return (
    <span
      className={className}
      style={{ "--done": `${Math.round(ratio * 360)}deg` } as CSSProperties}
      aria-hidden="true"
    />
  );
}

/**
 * The round buttons on both sides of the sachet; the clan's carries the weekly goal in its ring.
 * The mail is left out: the top bar has it. On a wide screen, the level band has the coffrets.
 */
export function PlayFabs() {
  const view = usePlayerView();
  const shell = useShell();
  const router = useRouter();
  const toast = useToast();
  const daily = useShared(dailyChallenge);
  const clan = useShared(myClan);
  if (view.now === 0) return null;
  const dailyRatio = daily === null ? 0 : dailyView(daily).ratio;
  const goal = clan?.goal == null ? null : goalRing(clan.goal);
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

  const ringOf = (id: FabId) => {
    if (id === "daily") return <Ring ratio={dailyRatio} className={styles.dailyRing} />;
    if (id === "clan" && goal !== null)
      return <Ring ratio={goal.ratio} className={styles.goalRing} />;
    return undefined;
  };

  const column = (fabs: readonly FabModel[], side: string | undefined) => (
    <div className={side}>
      {fabs
        .filter((fab) => fab.id !== "mail")
        .map((fab) => (
          <div key={fab.id} className={fab.id === "coffrets" ? styles.fabCoffrets : undefined}>
            <Fab
              icon={ICONS[fab.id]}
              label={fab.label}
              badge={fab.badge}
              lock={fab.lock}
              glow={fab.glow}
              onClick={() => act(fab)}
              visual={
                fab.id === "clan" && clan?.emblem != null ? (
                  <Emblem emblem={clan.emblem} size={30} />
                ) : undefined
              }
              ring={ringOf(fab.id)}
            />
          </div>
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
