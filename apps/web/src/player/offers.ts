"use client";

import { sharedResource } from "@leximon/view-model";
import { api } from "@/lib/api";

/** Offers received and still pending: the red count of Échanges and of the mail. */
export const incomingOffers = sharedResource<number>(async () => {
  const page = await api.fetchTrades("incoming");
  return page.trades.filter((trade) => trade.status === "pending").length;
});
