"use client";

import type { FriendsResponse } from "@leximon/contract";
import { sharedResource } from "@leximon/view-model";
import { api } from "@/lib/api";

/** The player's friends, requests and friend link: the menu counts the requests waiting. */
export const friends = sharedResource<FriendsResponse>(api.fetchFriends);
