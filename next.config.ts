import type { NextConfig } from "next";

/**
 * Private routes get `X-Robots-Tag` from the edge as well as `<meta robots>` from
 * the page itself. The header is the belt to the metadata's braces: it applies
 * even to a response that never renders the metadata, and it covers the invite
 * links people paste around.
 *
 * Note what is *not* here: a `Disallow` in `robots.txt`. Blocking a crawler from
 * fetching these pages would also stop it from seeing their `noindex`, which is
 * the directive that actually removes them from results.
 */
const noIndexHeaders = [
  { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
];

const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(),
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn.sanity.io",
        pathname: "/images/**",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/:locale/lab/daily-questions/room/:path*",
        headers: noIndexHeaders,
      },
      {
        source: "/:locale/lab/daily-questions/room",
        headers: noIndexHeaders,
      },
      {
        source: "/:locale/lab/daily-questions/join/:path*",
        headers: noIndexHeaders,
      },
    ];
  },
};

export default nextConfig;
