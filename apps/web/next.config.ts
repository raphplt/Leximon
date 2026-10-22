import type { NextConfig } from "next";

// `cacheComponents` (and `partialPrefetching`, which needs it) stay off until OpenNext runs them
// on Workers: with Next 16.4, server renders after the first one in an isolate hang.
const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
};

export default nextConfig;
