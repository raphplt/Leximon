"use client";

import type {
  AccountResponse,
  BoosterWalletResponse,
  LevelRewardsResponse,
  ProfileResponse,
} from "@leximon/contract";
import { fetchAccount, fetchLevelRewards, fetchProfile, fetchWallet } from "@/lib/api";
import { forgetProgress } from "@/progress/use-progress";
import { myClan, sanctions } from "./clan";
import { dailyChallenge, ownedCards, refreshIfRead, wordMemory } from "./collection";
import { mailbox } from "./mail";
import { sharedResource } from "./resource";

/** The player's wallet: free stock and bonus reserve. */
export const wallet = sharedResource<BoosterWalletResponse>(fetchWallet);

/** Levels claimed and cards of the player's choice left. */
export const levelRewards = sharedResource<LevelRewardsResponse>(fetchLevelRewards);

/** Guest or member. */
export const account = sharedResource<AccountResponse>(fetchAccount);

/** Pseudo, avatar, cosmetics, pinned cards, figures. */
export const profile = sharedResource<ProfileResponse>(fetchProfile);

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
  account.refresh();
  refreshIfRead(profile);
  refreshIfRead(ownedCards);
  refreshIfRead(wordMemory);
  refreshIfRead(dailyChallenge);
  refreshIfRead(myClan);
  refreshIfRead(sanctions);
  refreshIfRead(mailbox);
}
