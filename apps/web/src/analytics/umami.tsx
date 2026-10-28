"use client";

import Script from "next/script";
import { cleanPayload } from "./clean-url";

/** Our own Umami, on the home server (`infra/umami`); its host is allowed by the CSP in `next.config.ts`. */
const UMAMI_SCRIPT = "https://stats.leximon.fr/script.js";

// Dot access only: Next.js inlines NEXT_PUBLIC_ variables at build time, not bracket access.
const WEBSITE_ID = process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID ?? "";
const BEFORE_SEND = "leximonBeforeSend";

// Umami looks the hook up on `window` by name at each event, so it must be there before the first
// page view, which the script sends as soon as it loads.
if (WEBSITE_ID !== "" && typeof window !== "undefined") {
  Object.assign(window, {
    [BEFORE_SEND]: (_type: string, payload: Record<string, unknown>) =>
      cleanPayload(payload, window.location.origin),
  });
}

/**
 * Page views counted by Umami, without cookies. Off without a site id (local development) and on any
 * host but leximon.fr (a preview build), so only real visits are counted.
 */
export function Umami() {
  if (WEBSITE_ID === "") return null;
  return (
    <Script
      src={UMAMI_SCRIPT}
      data-website-id={WEBSITE_ID}
      data-domains="leximon.fr"
      data-before-send={BEFORE_SEND}
      data-do-not-track="true"
      data-exclude-hash="true"
    />
  );
}
