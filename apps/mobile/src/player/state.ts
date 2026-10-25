import type {
  AccountResponse,
  BoosterWalletResponse,
  FriendsResponse,
  LevelRewardsResponse,
  MailResponse,
  MyClanResponse,
  ProfileResponse,
  Progress,
  Sanction,
} from "@leximon/contract";
import { sharedResource } from "@leximon/view-model";
import { api } from "@/api/client";

/**
 * The player's state shared by every screen: read once from the API, then replaced by what
 * actions return. The server stays the authority.
 */

export const wallet = sharedResource<BoosterWalletResponse>(api.fetchWallet);
export const levelRewards = sharedResource<LevelRewardsResponse>(api.fetchLevelRewards);
export const account = sharedResource<AccountResponse>(api.fetchAccount);
export const profile = sharedResource<ProfileResponse>(api.fetchProfile);
export const progress = sharedResource<Progress>(api.fetchProgress);
export const mailbox = sharedResource<MailResponse>(() => api.fetchMail());
export const myClan = sharedResource<MyClanResponse>(api.fetchMyClan);
/** Sanctions received, newest first: a writing ban closes the clan's discussion. */
export const sanctions = sharedResource<readonly Sanction[]>(api.fetchSanctions);
/** The player's friends, requests and friend link. */
export const friends = sharedResource<FriendsResponse>(api.fetchFriends);

/** Offers received and still pending: the red count of Échanges. */
export const incomingOffers = sharedResource<number>(async () => {
  const page = await api.fetchTrades("incoming");
  return page.trades.filter((trade) => trade.status === "pending").length;
});

/** The level returned by an action (open, answer), unless the copy in hand is more recent. */
export function publishProgress(next: Progress): void {
  const current = progress.current();
  if (current === null || current.xp <= next.xp) progress.publish(next);
}

/** Forgets the state of the player who left: the next read is the new player's. */
export function resetPlayerState(): void {
  for (const resource of [
    wallet,
    levelRewards,
    account,
    profile,
    progress,
    mailbox,
    myClan,
    friends,
    sanctions,
    incomingOffers,
  ]) {
    resource.reset();
  }
}
