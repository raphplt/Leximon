import type {
  AccountResponse,
  BoosterWalletResponse,
  LevelRewardsResponse,
  MailResponse,
  MyClanResponse,
  ProfileResponse,
  Progress,
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
