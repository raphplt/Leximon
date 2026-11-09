"use client";

import type { Progress } from "@leximon/contract";
import {
  carnetWaits,
  isFeatureOpen,
  joustsWaiting,
  mailCount,
  playerTitle,
  waitingCoffrets,
  welcomeWaits,
} from "@leximon/view-model";
import { useNow } from "@/lib/use-now";
import { myClan } from "@/player/clan";
import { joustsOverview } from "@/player/jousts";
import { mailbox } from "@/player/mail";
import { incomingOffers } from "@/player/offers";
import { account, carnet, levelRewards, profile, wallet, welcomeWeek } from "@/player/player";
import { useShared, useSharedWhen } from "@/player/resource";
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
  const welcome = useShared(welcomeWeek);
  const card = useShared(carnet);
  const now = useNow(15_000);
  const jousts = useSharedWhen(
    joustsOverview,
    progress !== null && now !== 0 && isFeatureOpen("jousts", progress.level, now),
  );
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
    /** The welcome week; `null` until read. */
    welcome,
    /** A day of the welcome week waits to be claimed today. */
    welcomeWaits: welcomeWaits(welcome),
    /** The carnet de pointage; `null` until read. */
    carnet: card,
    /** A case of the carnet waits to be claimed. */
    carnetWaits: carnetWaits(card),
    /** What « Récompenses » counts: the coffrets, the welcome week's day and the carnet. */
    rewardsWaiting: coffrets.length + (welcomeWaits(welcome) ? 1 : 0) + (carnetWaits(card) ? 1 : 0),
    /** The patron's mark, `null` for who has none or until read. */
    patron: me?.patron ?? null,
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
    /** Sealed results and jousts to answer: the red count of Défis. */
    jousts: jousts === null ? 0 : joustsWaiting(jousts.jousts),
    /** Weekly goal boosters to take. */
    claimable,
    /** The mail's first page; `null` until read. */
    mailbox: mail,
    mail: mailCount({
      coffrets: coffrets.length,
      // The welcome week's day and the carnet's case are entries of the same kind.
      welcome: (welcomeWaits(welcome) ? 1 : 0) + (carnetWaits(card) ? 1 : 0),
      goalSachets: claimable.length,
      referralSachets: mail?.referralRewards.length ?? 0,
      unread: mail?.unread ?? 0,
    }),
  };
}
