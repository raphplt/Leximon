"use client";

import type { ClanJoinResult, MyClanResponse } from "@leximon/contract";
import type { ClanResult } from "@leximon/contract/client";
import { useState } from "react";
import { api } from "@/lib/api";
import { myClan } from "@/player/clan";
import { useToast } from "@/ui/toast";
import { refusalText } from "./chat";

/** Joining a clan, asking to enter or taking the request back. `busy` is the clan at work. */
export function useJoinClan(mine: MyClanResponse, onJoined: (clanId: string) => void) {
  const [busy, setBusy] = useState<string | null>(null);
  const toast = useToast();

  const settle = async (key: string, action: () => Promise<ClanResult<ClanJoinResult>>) => {
    setBusy(key);
    try {
      const result = await action();
      if (result.kind === "refused") {
        toast(refusalText(result.reason));
        return;
      }
      if (result.value.outcome === "joined") {
        onJoined(result.value.clanId);
        return;
      }
      toast("Demande envoyée.");
      myClan.publish({ ...mine, requests: [...mine.requests, result.value.clanId] });
    } catch {
      toast("Ça n'a pas marché. Réessaie.");
    } finally {
      setBusy(null);
    }
  };

  const withdraw = async (clanId: string) => {
    setBusy(clanId);
    const result = await api.withdrawRequest(clanId).catch(() => null);
    setBusy(null);
    if (result?.kind !== "ok") {
      toast("Ça n'a pas marché. Réessaie.");
      return;
    }
    myClan.publish({ ...mine, requests: mine.requests.filter((id) => id !== clanId) });
  };

  return {
    busy,
    requests: mine.requests,
    join: (clanId: string) => settle(clanId, () => api.joinClan(clanId)),
    enterByCode: (code: string) => settle("code", () => api.joinByCode(code)),
    withdraw,
  };
}

export type ClanJoin = ReturnType<typeof useJoinClan>;
