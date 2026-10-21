"use client";

import type {
  AccountResponse,
  BoosterWalletResponse,
  LevelRewardsResponse,
} from "@leximon/contract";
import { fetchAccount, fetchLevelRewards, fetchWallet } from "@/lib/api";
import { forgetProgress } from "@/progress/use-progress";
import { sharedResource } from "./resource";

/** The player's wallet: free stock and bonus reserve (J-07, C-01). */
export const wallet = sharedResource<BoosterWalletResponse>(fetchWallet);

/** Levels claimed and cards of the player's choice left (P58). */
export const levelRewards = sharedResource<LevelRewardsResponse>(fetchLevelRewards);

/** Guest or member (P37). */
export const account = sharedResource<AccountResponse>(fetchAccount);

/** A coffret was claimed: its level is done, and its card choice waits if it has one. */
export function publishClaimed(level: number, withCardChoice: boolean): void {
  const state = levelRewards.current() ?? { claimed: [], cardChoices: [] };
  const sorted = (list: readonly number[]) => [...new Set(list)].sort((a, b) => a - b);
  levelRewards.publish({
    claimed: sorted([...state.claimed, level]),
    cardChoices: withCardChoice ? sorted([...state.cardChoices, level]) : state.cardChoices,
  });
}

export function publishCardChosen(level: number): void {
  const state = levelRewards.current();
  if (state === null) return;
  levelRewards.publish({ ...state, cardChoices: state.cardChoices.filter((l) => l !== level) });
}

/** The player changed (sign-in, sign-out): every screen reads the account's state afresh. */
export function forgetPlayer(): void {
  forgetProgress();
  wallet.refresh();
  levelRewards.refresh();
  account.refresh();
}
