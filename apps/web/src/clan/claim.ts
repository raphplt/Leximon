"use client";

import type { ClaimableGoal } from "@leximon/contract";
import { goalClaimedToast } from "@leximon/view-model";
import { useCallback } from "react";
import { myClan } from "@/player/clan";
import { wallet } from "@/player/player";
import { useToast } from "@/ui/toast";
import { claimGoal } from "./api";
import { refusalText } from "./chat";

/**
 * Takes the boosters of a weekly goal, from the clan page or the mail: the wallet and the
 * mail follow at once. `true` when the boosters are in the reserve.
 */
export function useClaim(): (claim: ClaimableGoal) => Promise<boolean> {
  const toast = useToast();
  return useCallback(
    async (claim) => {
      try {
        const result = await claimGoal(claim.week, claim.tier);
        const mine = myClan.current();
        // Taken or refused, the claim leaves the mail; a full reserve keeps it for later.
        const keep = result.kind === "refused" && result.reason === "reserve_full";
        if (mine !== null && !keep) {
          myClan.publish({
            ...mine,
            claimable: mine.claimable.filter(
              (c) => !(c.week === claim.week && c.tier === claim.tier),
            ),
          });
        }
        if (result.kind === "ok") {
          wallet.publish(result.value.wallet);
          toast(goalClaimedToast(claim));
          return true;
        }
        toast(refusalText(result.reason));
        return false;
      } catch {
        toast("Ça n'a pas marché. Réessaie.");
        return false;
      }
    },
    [toast],
  );
}
