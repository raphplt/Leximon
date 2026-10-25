import type { UpdateProfileRequest } from "@leximon/contract";
import { ApiError, type ProfileResult } from "@leximon/contract/client";
import { profileRefusalMessage } from "@leximon/view-model";
import { useState } from "react";
import { api } from "@/api/client";
import { useShared } from "@/player/shared";
import { profile } from "@/player/state";
import { toast } from "@/ui/toast";

function failureMessage(error: unknown): string {
  return error instanceof ApiError && error.status === null
    ? "Pas de connexion. Réessaie."
    : "Ça n'a pas marché. Réessaie.";
}

interface Options {
  /** Said in a toast once it worked. */
  readonly success: string | null;
  /** The caller shows what went wrong itself (a form), instead of a toast. */
  readonly quiet?: boolean;
}

/**
 * Changes to the player's own profile: each sends one request, publishes the profile the server
 * answers, and says the outcome. One change at a time. Resolves to `null` once done, else to what
 * went wrong.
 */
export function useProfileActions() {
  const me = useShared(profile);
  const [busy, setBusy] = useState(false);

  const run = async (
    request: () => Promise<ProfileResult>,
    { success, quiet = false }: Options,
  ): Promise<string | null> => {
    if (busy) return null;
    setBusy(true);
    let problem: string | null = null;
    try {
      const result = await request();
      if (result.kind === "refused") problem = profileRefusalMessage(result.reason);
      else {
        profile.publish(result.profile);
        if (success !== null) toast(success);
      }
    } catch (error) {
      problem = failureMessage(error);
    } finally {
      setBusy(false);
    }
    if (problem !== null && !quiet) toast(problem);
    return problem;
  };

  return {
    profile: me,
    busy,
    isPinned: (cardId: string) => me?.pinned.includes(cardId) ?? false,
    /** Sends the pinned cards, all of them, in their new order. */
    setPins: (cardIds: readonly string[], success: string | null): Promise<string | null> =>
      run(() => api.setPinnedCards(cardIds), { success }),
    update: (changes: UpdateProfileRequest, options: Options): Promise<string | null> =>
      run(() => api.updateProfile(changes), options),
  };
}
