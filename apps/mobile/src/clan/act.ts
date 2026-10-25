import type { ClanRefusal } from "@leximon/contract";
import type { ClanResult } from "@leximon/contract/client";
import { clanRefusalMessage } from "@leximon/view-model";
import { toast } from "@/ui/toast";

export function refusalText(reason: ClanRefusal | "account_locked"): string {
  return reason === "account_locked" ? "Ton compte est suspendu." : clanRefusalMessage(reason);
}

/** Runs a clan action and says how it went: the refusal, or `done`. `true` on success. */
export async function act(
  action: () => Promise<ClanResult<unknown>>,
  done: string,
): Promise<boolean> {
  try {
    const result = await action();
    if (result.kind === "ok") {
      toast(done);
      return true;
    }
    toast(refusalText(result.reason));
  } catch {
    toast("Ça n'a pas marché. Réessaie.");
  }
  return false;
}
