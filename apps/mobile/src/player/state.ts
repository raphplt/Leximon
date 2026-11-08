import type {
  AccountResponse,
  BoosterWalletResponse,
  CarnetResponse,
  EditionsResponse,
  FriendsResponse,
  LevelRewardsResponse,
  MailResponse,
  MissionsResponse,
  MyClanResponse,
  ProfileResponse,
  Progress,
  Sanction,
  WelcomeWeekResponse,
} from "@leximon/contract";
import { sharedResource } from "@leximon/view-model";
import { api } from "@/api/client";

/**
 * The player's state shared by every screen: read once from the API, then replaced by what
 * actions return. The server stays the authority.
 */

export const wallet = sharedResource<BoosterWalletResponse>(api.fetchWallet);
export const levelRewards = sharedResource<LevelRewardsResponse>(api.fetchLevelRewards);
/** The welcome week: what each day gives, and whether today's waits. */
export const welcomeWeek = sharedResource<WelcomeWeekResponse>(api.fetchWelcomeWeek);
/** The missions of the day, with what earlier days still give. */
export const missions = sharedResource<MissionsResponse>(api.fetchMissions);
/** The carnet de pointage, after the welcome week. */
export const carnet = sharedResource<CarnetResponse>(api.fetchCarnet);
export const account = sharedResource<AccountResponse>(api.fetchAccount);
export const profile = sharedResource<ProfileResponse>(api.fetchProfile);
/** The library editions the player owns and how their cards print: read where cards are shown. */
export const editions = sharedResource<EditionsResponse>(api.fetchEditions);
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

/** A coffret just opened: the level joins the claimed ones, the profile may have new pieces. */
export function publishClaimed(level: number): void {
  if (profile.current() !== null) profile.refresh();
  const claimed = levelRewards.current()?.claimed ?? [];
  levelRewards.publish({ claimed: [...new Set([...claimed, level])].sort((a, b) => a - b) });
}

/** A day of the welcome week was claimed: the next one opens tomorrow. */
export function publishWelcomeClaimed(day: number): void {
  if (profile.current() !== null) profile.refresh();
  const week = welcomeWeek.current();
  if (week === null || week.claimed >= day) return;
  welcomeWeek.publish({ ...week, claimed: day, open: false });
  // The last day starts the carnet.
  if (carnet.current() !== null) carnet.refresh();
}

/** Forgets the state of the player who left: the next read is the new player's. */
export function resetPlayerState(): void {
  for (const resource of [
    wallet,
    levelRewards,
    welcomeWeek,
    missions,
    carnet,
    account,
    profile,
    editions,
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
