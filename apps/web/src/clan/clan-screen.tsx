"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useNow } from "@/lib/use-now";
import { myClan } from "@/player/clan";
import { profile } from "@/player/player";
import { useShared } from "@/player/resource";
import { useProgress } from "@/progress/use-progress";
import styles from "./clan.module.css";
import { ClanPage } from "./clan-page";
import { FindClan } from "./find-clan";

/** Clan: the player's clan, or how to find one. */
export function ClanScreen() {
  const mine = useShared(myClan);
  const progress = useProgress();
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

  if (mine === null || progress === null || now === 0) {
    return (
      <main className={styles.screen}>
        <p className={styles.hint}>Un instant…</p>
      </main>
    );
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
