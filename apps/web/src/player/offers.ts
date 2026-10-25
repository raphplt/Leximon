"use client";

import { api } from "@/lib/api";
import { sharedResource } from "./resource";

/** Offers received and still pending: the red count of Échanges and of the mail. */
export const incomingOffers = sharedResource<number>(async () => {
  const page = await api.fetchTrades("incoming");
  return page.trades.filter((trade) => trade.status === "pending").length;
});
