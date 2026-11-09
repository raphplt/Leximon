"use client";

import type {
  AccountResponse,
  AppStatusResponse,
  BoosterWalletResponse,
  CarnetResponse,
  EditionsResponse,
  LevelRewardsResponse,
  MissionsResponse,
  ProfileResponse,
  WelcomeWeekResponse,
} from "@leximon/contract";
import { sharedResource } from "@leximon/view-model";
import { api } from "@/lib/api";
import { forgetProgress } from "@/progress/use-progress";
import { myClan, sanctions } from "./clan";
import { dailyChallenge, ownedCards, refreshIfRead, wordMemory } from "./collection";
import { mailbox } from "./mail";

/** The library editions the player owns and how their cards print: read where cards are shown. */
export const editions = sharedResource<EditionsResponse>(api.fetchEditions);

/** The player's wallet: free stock and bonus reserve. */
export const wallet = sharedResource<BoosterWalletResponse>(api.fetchWallet);

/** Levels claimed and cards of the player's choice left. */
export const levelRewards = sharedResource<LevelRewardsResponse>(api.fetchLevelRewards);

/** Guest or member. */
export const account = sharedResource<AccountResponse>(api.fetchAccount);

/** What this API offers: Google sign-in, the patron subscription on sale. */
export const appStatus = sharedResource<AppStatusResponse>(api.fetchAppStatus);

/** Pseudo, avatar, cosmetics, pinned cards, figures. */
export const profile = sharedResource<ProfileResponse>(api.fetchProfile);

/** The welcome week: what each day gives, and whether today's waits. */
export const welcomeWeek = sharedResource<WelcomeWeekResponse>(api.fetchWelcomeWeek);

/** The missions of the day, with what earlier days still give. */
export const missions = sharedResource<MissionsResponse>(api.fetchMissions);

/** The carnet de pointage, after the welcome week. */
export const carnet = sharedResource<CarnetResponse>(api.fetchCarnet);

/** A day of the welcome week was claimed: the next one opens tomorrow. */
export function publishWelcomeClaimed(day: number): void {
  refreshIfRead(profile);
  const week = welcomeWeek.current();
  if (week === null || week.claimed >= day) return;
  welcomeWeek.publish({ ...week, claimed: day, open: false });
  // The last day starts the carnet.
  refreshIfRead(carnet);
}

/** A coffret was claimed: its level is done. */
export function publishClaimed(level: number): void {
  refreshIfRead(profile);
  const claimed = levelRewards.current()?.claimed ?? [];
  levelRewards.publish({
    claimed: [...new Set([...claimed, level])].sort((a, b) => a - b),
  });
}

/** The player changed (sign-in, sign-out): every screen reads the account's state afresh. */
export function forgetPlayer(): void {
  forgetProgress();
  wallet.refresh();
  levelRewards.refresh();
  welcomeWeek.refresh();
  refreshIfRead(missions);
  refreshIfRead(carnet);
  account.refresh();
  refreshIfRead(profile);
  refreshIfRead(ownedCards);
  refreshIfRead(editions);
  refreshIfRead(wordMemory);
  refreshIfRead(dailyChallenge);
  refreshIfRead(myClan);
  refreshIfRead(sanctions);
  refreshIfRead(mailbox);
}
