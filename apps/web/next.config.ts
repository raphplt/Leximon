import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";
const apiOrigin = new URL(process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787").origin;
// Umami Cloud serves its script from one host and may collect on another.
const umami = process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID
  ? {
      script: " https://cloud.umami.is",
      collect: " https://cloud.umami.is https://api-gateway.umami.dev",
    }
  : { script: "", collect: "" };

// Without nonces: they would force every page to render per request. Inline scripts stay allowed
// (Next's own bootstrap), everything else comes from the site or the API.
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}${umami.script}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "media-src 'self'",
  `connect-src 'self' ${apiOrigin}${umami.collect}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  // No page of the game may be framed: a hidden frame could get a click on "accept" or "delete".
  "frame-ancestors 'none'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

// `cacheComponents` (and `partialPrefetching`, which needs it) stay off until OpenNext runs them
// on Workers: with Next 16.4, server renders after the first one in an isolate hang.
const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
