"use client";

import { friendRefusalText } from "@leximon/view-model";
import { friends } from "@/player/friends";
import { mailbox } from "@/player/mail";
import { useToast } from "@/ui/toast";
import type { FriendResult } from "./api";

/** Runs a friend action and says how it went; `true` when it went through. */
export function useFriendAction() {
  const toast = useToast();
  return async <T>(
    action: () => Promise<FriendResult<T>>,
    done: (value: T) => string | null,
  ): Promise<boolean> => {
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
      toast("Le serveur lambine. Réessaie.");
      return false;
    }
  };
}
