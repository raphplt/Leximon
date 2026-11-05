import { mailCount, waitingCoffrets, welcomeWaits } from "@leximon/view-model";
import { useShared } from "./shared";
import {
  account,
  incomingOffers,
  levelRewards,
  mailbox,
  myClan,
  profile,
  progress,
  wallet,
  welcomeWeek,
} from "./state";

/** Everything the shell shows about the player, read from the shared state. */
export function usePlayerView() {
  const level = useShared(progress);
  const currentWallet = useShared(wallet);
  const rewards = useShared(levelRewards);
  const who = useShared(account);
  const offers = useShared(incomingOffers);
  const me = useShared(profile);
  const clan = useShared(myClan);
  const mail = useShared(mailbox);
  const welcome = useShared(welcomeWeek);
  const waits = welcomeWaits(welcome);
  const coffrets =
    level === null || rewards === null ? [] : waitingCoffrets(level.level, rewards.claimed);
  const claimable = clan?.claimable ?? [];
  return {
    progress: level,
    wallet: currentWallet,
    coffrets,
    /** The welcome week; `null` until read. */
    welcome,
    /** A day of the welcome week waits to be claimed today. */
    welcomeWaits: waits,
    /** What « Récompenses » counts: the coffrets and today's day of the welcome week. */
    rewardsWaiting: coffrets.length + (waits ? 1 : 0),
    guest: who?.kind === "guest",
    profile: me,
    /** Weekly goal boosters waiting, even from a clan the player left. */
    claimable,
    mailbox: mail,
    offers: offers ?? 0,
    mail: mailCount({
      coffrets: coffrets.length,
      welcome: waits ? 1 : 0,
      goalSachets: claimable.length,
      referralSachets: mail?.referralRewards.length ?? 0,
      unread: mail?.unread ?? 0,
    }),
  };
}
