"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useNow } from "@/lib/use-now";
import { myClan } from "@/player/clan";
import { profile } from "@/player/player";
import { useShared, useSharedFailed } from "@/player/resource";
import { retryProgress, useProgress, useProgressFailed } from "@/progress/use-progress";
import { LoadFailed } from "@/ui/load-failed";
import { WaitingScreen } from "@/ui/skeleton";
import styles from "./clan.module.css";
import { ClanPage } from "./clan-page";
import { FindClan } from "./find-clan";

/** Clan: the player's clan, or how to find one. */
export function ClanScreen() {
  const mine = useShared(myClan);
  const progress = useProgress();
  const clanFailed = useSharedFailed(myClan);
  const progressFailed = useProgressFailed();
  const now = useNow(30_000);
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  // An invitation link, `/clan?code=…`: kept for the code field, then out of the address.
  const [code] = useState(() => params.get("code"));

  useEffect(() => {
    if (params.get("code") !== null) router.replace(pathname, { scroll: false });
  }, [params, router, pathname]);

  // The clan just joined shows at once, while `/me/clan` is read again.
  const [joined, setJoined] = useState<string | null>(null);
  const onJoined = useCallback((clanId: string) => {
    setJoined(clanId);
    myClan.refresh();
    profile.refresh();
  }, []);
  const onLeft = useCallback(() => {
    setJoined(null);
    const current = myClan.current();
    if (current !== null) myClan.publish({ ...current, clanId: null, emblem: null });
    myClan.refresh();
    profile.refresh();
  }, []);

  if ((mine === null && clanFailed) || (progress === null && progressFailed)) {
    return (
      <main className={styles.screen}>
        <LoadFailed
          onRetry={() => {
            myClan.ensure();
            retryProgress();
          }}
        />
      </main>
    );
  }
  // Either the clan's page or the search for one: no shape fits both.
  if (mine === null || progress === null || now === 0) {
    return <WaitingScreen className={styles.screen} />;
  }
  const clanId = mine.clanId ?? joined;
  if (clanId === null) {
    return (
      <FindClan
        mine={mine}
        level={progress.level}
        now={now}
        presetCode={code}
        onJoined={onJoined}
      />
    );
  }
  return <ClanPage key={clanId} clanId={clanId} now={now} onLeft={onLeft} />;
}
