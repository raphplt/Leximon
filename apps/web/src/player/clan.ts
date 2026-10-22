"use client";

import type { MyClanResponse, Sanction } from "@leximon/contract";
import { fetchMyClan, fetchSanctions } from "@/clan/api";
import { sharedResource } from "./resource";

/** The player's clan, requests and weekly goal boosters waiting. */
export const myClan = sharedResource<MyClanResponse>(fetchMyClan);

/** Sanctions received, newest first: the unseen ones open a window over any screen. */
export const sanctions = sharedResource<readonly Sanction[]>(fetchSanctions);
