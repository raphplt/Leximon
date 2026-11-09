"use client";

import type { JoustsResponse } from "@leximon/contract";
import { sharedResource } from "@leximon/view-model";
import { api } from "@/lib/api";

/** The jousts' state: the half of Défis that leads to them, and the red count of the tab. */
export const joustsOverview = sharedResource<JoustsResponse>(api.fetchJousts);
