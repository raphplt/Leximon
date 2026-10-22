"use client";

import type { MyClanResponse, Sanction } from "@leximon/contract";
import { fetchMyClan, fetchSanctions } from "@/clan/api";
import { sharedResource } from "./resource";

/** The player's clan, requests and weekly goal boosters waiting (K-01, R-01). */
export const myClan = sharedResource<MyClanResponse>(fetchMyClan);

/** Sanctions received, newest first (R-08): the unseen ones open a window over any screen. */
export const sanctions = sharedResource<readonly Sanction[]>(fetchSanctions);
