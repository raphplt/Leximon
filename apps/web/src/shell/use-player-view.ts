"use client";

import type { Progress } from "@leximon/contract";
import { playerTitle, waitingCoffrets } from "@leximon/view-model";
import { useNow } from "@/lib/use-now";
import { incomingOffers } from "@/player/offers";
import { account, levelRewards, profile, wallet } from "@/player/player";
import { useShared } from "@/player/resource";
import { useProgress } from "@/progress/use-progress";

/** Everything the shell shows about the player, read from the shared state. */
export function usePlayerView() {
  const progress: Progress | null = useProgress();
  const currentWallet = useShared(wallet);
  const rewards = useShared(levelRewards);
  const who = useShared(account);
  const offers = useShared(incomingOffers);
  const me = useShared(profile);
  const now = useNow(15_000);
  const claimed = rewards?.claimed ?? [];
  const coffrets =
    progress === null || rewards === null ? [] : waitingCoffrets(progress.level, claimed);
  const cardChoices = rewards?.cardChoices ?? [];
  return {
    progress,
    /** Levels claimed; `null` until read. */
    claimed: rewards === null ? null : rewards.claimed,
    wallet: currentWallet,
    now,
    coffrets,
    cardChoices,
    /** The title worn: the one chosen in the atelier, else the latest won. */
    title: me !== null ? me.title : now === 0 ? null : playerTitle(claimed, now),
    guest: who?.kind === "guest",
    /** `null` until read. */
    profile: me,
    /** The pseudo, else « Invité » or « Toi » before one is chosen. */
    name: me?.pseudo ?? (who?.kind === "guest" ? "Invité" : "Toi"),
    offers: offers ?? 0,
    /** What waits in the mail: coffrets, cards to choose, offers received. */
    mail: coffrets.length + cardChoices.length + (offers ?? 0),
  };
}
