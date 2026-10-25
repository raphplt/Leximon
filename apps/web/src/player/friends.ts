"use client";

import type { FriendsResponse } from "@leximon/contract";
import { api } from "@/lib/api";
import { sharedResource } from "./resource";

/** The player's friends, requests and friend link: the menu counts the requests waiting. */
export const friends = sharedResource<FriendsResponse>(api.fetchFriends);
