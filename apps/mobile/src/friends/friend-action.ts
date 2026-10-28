import type { FriendResult } from "@leximon/contract/client";
import { friendRefusalText } from "@leximon/view-model";
import { friends, mailbox } from "@/player/state";
import { toast } from "@/ui/toast";

/** Runs a friend action and says how it went; `true` when it went through. */
export async function friendAction<T>(
  action: () => Promise<FriendResult<T>>,
  done: (value: T) => string | null,
): Promise<boolean> {
  try {
    const result = await action();
    if (result.kind === "refused") {
      toast(friendRefusalText(result.reason));
      friends.refresh();
      return false;
    }
    const message = done(result.value);
    if (message !== null) toast(message);
    friends.refresh();
    mailbox.refresh();
    return true;
  } catch {
    toast("Le serveur ne répond pas. Réessaie.");
    return false;
  }
}
