"use client";

import type { MailResponse } from "@leximon/contract";
import { sharedResource } from "@leximon/view-model";
import { api } from "@/lib/api";

/** The mail's first page: letters written by the queue, unread count, words slipping away. */
export const mailbox = sharedResource<MailResponse>(() => api.fetchMail());
