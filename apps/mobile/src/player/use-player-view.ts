import { mailCount, waitingCoffrets } from "@leximon/view-model";
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
  const coffrets =
    level === null || rewards === null ? [] : waitingCoffrets(level.level, rewards.claimed);
  const claimable = clan?.claimable ?? [];
  return {
    progress: level,
    wallet: currentWallet,
    coffrets,
    guest: who?.kind === "guest",
    profile: me,
    /** Weekly goal boosters waiting, even from a clan the player left. */
    claimable,
    mailbox: mail,
    offers: offers ?? 0,
    mail: mailCount({
      coffrets: coffrets.length,
      goalSachets: claimable.length,
      referralSachets: mail?.referralRewards.length ?? 0,
      unread: mail?.unread ?? 0,
    }),
  };
}
