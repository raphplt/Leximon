"use client";

import type { MailResponse } from "@leximon/contract";
import { fetchMail } from "@/lib/api";
import { sharedResource } from "./resource";

/** The mail's first page: letters written by the queue, unread count, words slipping away. */
export const mailbox = sharedResource<MailResponse>(() => fetchMail());
