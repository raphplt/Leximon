"use client";

import type { LaunchJoustRequest } from "@leximon/contract";
import type { LaunchJoustResult } from "@leximon/contract/client";
import { launchRefusalText } from "@leximon/view-model";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { api } from "@/lib/api";

// The joust just launched from this page: it opens on the search for its opponent, once.
let fresh: string | null = null;

/** Whether the joust was the last launched here, so that its page plays the search. */
export function launchedHere(joustId: string): boolean {
  return fresh === joustId;
}

/** Launches a joust and opens it; a refusal comes back as its sentence. */
export function useLaunch(opensAtLevel: number) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);
  // Kept until the server answers: a retry after a lost answer never launches twice.
  const pendingKey = useRef<string | null>(null);

  const launch = async (request: LaunchJoustRequest): Promise<boolean> => {
    const key = pendingKey.current ?? crypto.randomUUID();
    pendingKey.current = key;
    setBusy(true);
    setRefusal(null);
    let result: LaunchJoustResult;
    try {
      result = await api.launchJoust(request, key);
    } catch {
      setRefusal("Le serveur ne répond pas. Réessaie.");
      setBusy(false);
      return false;
    }
    pendingKey.current = null;
    setBusy(false);
    if (result.kind === "launched") {
      fresh = result.joustId;
      router.push(`/joutes/${result.joustId}`);
      return true;
    }
    setRefusal(launchRefusalText(result.reason, opensAtLevel));
    return false;
  };

  return { launch, busy, refusal, clearRefusal: () => setRefusal(null) };
}
