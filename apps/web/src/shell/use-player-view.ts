"use client";

import type { Progress } from "@leximon/contract";
import { playerTitle, waitingCoffrets } from "@leximon/view-model";
import { useNow } from "@/lib/use-now";
import { myClan } from "@/player/clan";
import { mailbox } from "@/player/mail";
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
  const clan = useShared(myClan);
  const mail = useShared(mailbox);
  const now = useNow(15_000);
  const claimed = rewards?.claimed ?? [];
  const coffrets =
    progress === null || rewards === null ? [] : waitingCoffrets(progress.level, claimed);
  const claimable = clan?.claimable ?? [];
  return {
    progress,
    /** Levels claimed; `null` until read. */
    claimed: rewards === null ? null : rewards.claimed,
    wallet: currentWallet,
    now,
    coffrets,
    /** The title worn: the one chosen in the atelier, else the latest won. */
    title: me !== null ? me.title : now === 0 ? null : playerTitle(claimed, now),
    guest: who?.kind === "guest",
    /** Signed in to an account; `false` until read. */
    member: who?.kind === "member",
    /** Shows the link to the back office; the server checks the role on every admin route. */
    admin: who?.kind === "member" && who.isAdmin,
    /** `null` until read. */
    profile: me,
    /** The pseudo, else « Invité » or « Toi » before one is chosen. */
    name: me?.pseudo ?? (who?.kind === "guest" ? "Invité" : "Toi"),
    offers: offers ?? 0,
    /** Weekly goal boosters to take. */
    claimable,
    /** The mail's first page; `null` until read. */
    mailbox: mail,
    /**
     * The mail's count: what waits to be done (coffrets, goal boosters) and the
     * letters not read. Words slipping away are left out: they come back every day, and a count
     * that never empties only nags.
     */
    mail: coffrets.length + claimable.length + (mail?.unread ?? 0),
  };
}
