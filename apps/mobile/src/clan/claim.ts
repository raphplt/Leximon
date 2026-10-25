import type { ClaimableGoal } from "@leximon/contract";
import { goalClaimedToast } from "@leximon/view-model";
import { api } from "@/api/client";
import { myClan, wallet } from "@/player/state";
import { toast } from "@/ui/toast";
import { refusalText } from "./act";

/**
 * Takes the boosters of a weekly goal: the wallet and the clan's list of claims follow at once.
 * `true` when the boosters are in the reserve.
 */
export async function claimGoal(claim: ClaimableGoal): Promise<boolean> {
  try {
    const result = await api.claimGoal(claim.week, claim.tier);
    const mine = myClan.current();
    // Taken or refused, the claim leaves the list; a full reserve keeps it for later.
    const keep = result.kind === "refused" && result.reason === "reserve_full";
    if (mine !== null && !keep) {
      myClan.publish({
        ...mine,
        claimable: mine.claimable.filter((c) => !(c.week === claim.week && c.tier === claim.tier)),
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
}
