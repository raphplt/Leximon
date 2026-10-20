"use client";

import { type AnalyticsEvent, type AnalyticsPage, MAX_EVENTS_PER_BATCH } from "@leximon/contract";
import { useEffect } from "react";
import { sendEvents } from "./api";

/**
 * Client side of the A/B event log (D-030). Events wait in memory and leave in batches, at the
 * latest when the page is hidden. Measurement must never disturb the game: a batch that fails
 * is dropped, and nothing is sent once the player has opted out.
 */

type Untimed<T> = T extends unknown ? Omit<T, "at"> : never;

const OPT_OUT_KEY = "leximon.analytics";
const FLUSH_DELAY_MS = 5_000;

let pending: AnalyticsEvent[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let listening = false;

/** On unless the player objected (CNIL: audience measurement is exempt from consent, not from objection). */
export function analyticsEnabled(): boolean {
  try {
    return window.localStorage.getItem(OPT_OUT_KEY) !== "off";
  } catch {
    return true;
  }
}

export function setAnalyticsEnabled(enabled: boolean): void {
  try {
    window.localStorage.setItem(OPT_OUT_KEY, enabled ? "on" : "off");
  } catch {
    // Not remembered for the next visit; the choice still applies to this one.
  }
  if (!enabled) pending = [];
}

export function track(event: Untimed<AnalyticsEvent>): void {
  if (typeof window === "undefined" || !analyticsEnabled()) return;
  pending.push({ ...event, at: new Date().toISOString() } as AnalyticsEvent);
  listen();
  if (pending.length >= MAX_EVENTS_PER_BATCH) flush(false);
  else timer ??= setTimeout(() => flush(false), FLUSH_DELAY_MS);
}

function flush(closing: boolean): void {
  if (timer !== null) {
    clearTimeout(timer);
    timer = null;
  }
  while (pending.length > 0) {
    const events = pending.slice(0, MAX_EVENTS_PER_BATCH);
    pending = pending.slice(MAX_EVENTS_PER_BATCH);
    sendEvents({ events }, closing).catch(() => {
      // Dropped on purpose: a lost measurement is better than a retry loop in the game.
    });
  }
}

function listen(): void {
  if (listening) return;
  listening = true;
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush(true);
  });
  window.addEventListener("pagehide", () => flush(true));
}

/** Counts a visit of a screen, once per mount: the base of the J1 and J7 return rates. */
export function usePageView(page: AnalyticsPage): void {
  useEffect(() => {
    track({ name: "page_viewed", page });
  }, [page]);
}
