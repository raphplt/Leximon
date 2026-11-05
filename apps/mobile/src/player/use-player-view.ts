import { carnetWaits, mailCount, waitingCoffrets, welcomeWaits } from "@leximon/view-model";
import { useShared } from "./shared";
import {
  account,
  carnet,
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
  const card = useShared(carnet);
  const carnetWaiting = carnetWaits(card);
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
    /** The carnet de pointage; `null` until read. */
    carnet: card,
    /** A case of the carnet waits to be claimed. */
    carnetWaits: carnetWaiting,
    /** What « Récompenses » counts: the coffrets, the welcome week's day and the carnet. */
    rewardsWaiting: coffrets.length + (waits ? 1 : 0) + (carnetWaiting ? 1 : 0),
    guest: who?.kind === "guest",
    profile: me,
    /** Weekly goal boosters waiting, even from a clan the player left. */
    claimable,
    mailbox: mail,
    offers: offers ?? 0,
    mail: mailCount({
      coffrets: coffrets.length,
      // The welcome week's day and the carnet's case are entries of the same kind.
      welcome: (waits ? 1 : 0) + (carnetWaiting ? 1 : 0),
      goalSachets: claimable.length,
      referralSachets: mail?.referralRewards.length ?? 0,
      unread: mail?.unread ?? 0,
    }),
  };
}
