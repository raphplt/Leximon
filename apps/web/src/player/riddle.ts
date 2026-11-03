"use client";

import type { RiddleResponse } from "@leximon/contract";
import { sharedResource } from "@leximon/view-model";
import { api } from "@/lib/api";

/** Today's riddle as the player may read it, for the desk of the Jouer screen; `null` on a day without one. */
export const todayRiddle = sharedResource<RiddleResponse | null>(api.fetchRiddle);
