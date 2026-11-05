"use client";

import type { ClaimMissionsResponse } from "@leximon/contract";
import type { CarnetClaimResult, ChangeMissionResult } from "@leximon/contract/client";
import { api } from "@/lib/api";
import { publishProgress } from "@/progress/use-progress";
import { carnet, missions, wallet } from "./player";

/**
 * Claims every mission done. Each tap has its own key: a tap after a failure claims what is done
 * then, which gives nothing twice.
 */
export async function claimDoneMissions(): Promise<ClaimMissionsResponse> {
  const result = await api.claimMissions(crypto.randomUUID());
  wallet.publish(result.wallet);
  publishProgress(result.progress);
  missions.refresh();
  return result;
}

/** Changes one mission of the day. */
export async function changeMissionAt(slot: number): Promise<ChangeMissionResult> {
  const result = await api.changeMission(slot, crypto.randomUUID());
  if (result.kind === "changed") missions.publish(result.missions);
  return result;
}

/** Claims the next case of the carnet. */
export async function claimCarnetCase(
  period: number,
  caseNumber: number,
): Promise<CarnetClaimResult> {
  const result = await api.claimCarnetCase(period, caseNumber);
  if (result.kind === "claimed") {
    wallet.publish(result.wallet);
    carnet.refresh();
  }
  return result;
}

/** Écus won outside the wallet's own routes (a sans-faute): the count moves at once. */
export function publishEcusWon(ecus: number): void {
  const current = wallet.current();
  if (current === null) wallet.refresh();
  else wallet.publish({ ...current, ecus: current.ecus + ecus });
}
