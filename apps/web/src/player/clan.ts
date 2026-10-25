"use client";

import type { MyClanResponse, Sanction } from "@leximon/contract";
import { sharedResource } from "@leximon/view-model";
import { api } from "@/lib/api";

/** The player's clan, requests and weekly goal boosters waiting. */
export const myClan = sharedResource<MyClanResponse>(api.fetchMyClan);

/** Sanctions received, newest first: the unseen ones open a window over any screen. */
export const sanctions = sharedResource<readonly Sanction[]>(api.fetchSanctions);
