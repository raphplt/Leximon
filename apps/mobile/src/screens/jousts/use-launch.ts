import type { LaunchJoustRequest } from "@leximon/contract";
import type { LaunchJoustResult } from "@leximon/contract/client";
import { launchRefusalText } from "@leximon/view-model";
import { randomUUID } from "expo-crypto";
import { router } from "expo-router";
import { useRef, useState } from "react";
import { api } from "@/api/client";

export const NO_ANSWER = "Le serveur ne répond pas. Réessaie.";

// The joust just launched from this screen: it opens on the search for its opponent.
let fresh: string | null = null;

/** Whether the joust was the last launched here, so that its screen plays the search. */
export function launchedHere(joustId: string): boolean {
  return fresh === joustId;
}

/** Launches a joust and opens it; a refusal comes back as its sentence. */
export function useLaunch(opensAtLevel: number) {
  const [busy, setBusy] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);
  // Kept until the server answers: a retry after a lost answer never launches twice.
  const pendingKey = useRef<string | null>(null);

  const launch = async (request: LaunchJoustRequest): Promise<boolean> => {
    const key = pendingKey.current ?? randomUUID();
    pendingKey.current = key;
    setBusy(true);
    setRefusal(null);
    let result: LaunchJoustResult;
    try {
      result = await api.launchJoust(request, key);
    } catch {
      setRefusal(NO_ANSWER);
      setBusy(false);
      return false;
    }
    pendingKey.current = null;
    setBusy(false);
    if (result.kind === "launched") {
      fresh = result.joustId;
      router.push({ pathname: "/joutes/[id]", params: { id: result.joustId } });
      return true;
    }
    setRefusal(launchRefusalText(result.reason, opensAtLevel));
    return false;
  };

  return { launch, busy, refusal };
}
