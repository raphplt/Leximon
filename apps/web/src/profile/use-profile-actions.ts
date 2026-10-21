"use client";

import type { UpdateProfileRequest } from "@leximon/contract";
import { pinsFullMessage, pinToast, profileRefusalMessage, togglePin } from "@leximon/view-model";
import { useState } from "react";
import { ApiError, type ProfileResult, setPinnedCards, updateProfile } from "@/lib/api";
import { profile } from "@/player/player";
import { useShared } from "@/player/resource";
import { useToast } from "@/ui/toast";

export function failureMessage(error: unknown): string {
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
  const toast = useToast();
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
    /** Pins or unpins a card (A-08), at the end of the profile's row. */
    togglePin: (cardId: string): Promise<string | null> => {
      if (me === null) return Promise.resolve(null);
      const change = togglePin(me.pinned, cardId, me.pinnedSlots);
      if (!change.ok) {
        const problem = pinsFullMessage(me.pinnedSlots);
        toast(problem);
        return Promise.resolve(problem);
      }
      return run(() => setPinnedCards(change.cardIds), { success: pinToast(change) });
    },
    update: (changes: UpdateProfileRequest, options: Options): Promise<string | null> =>
      run(() => updateProfile(changes), options),
  };
}
