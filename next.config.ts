import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // Cache Components is off on purpose: every screen shows live, per-person
  // data, and keeping the language out of the URL needs a cookie read in the
  // root layout. Pages still stream with skeletons via loading.tsx/Suspense.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  poweredByHeader: false,
  experimental: {
    optimizePackageImports: ["lucide-react", "motion"],
    // Keep pages in the browser briefly so switching tabs and coming back is
    // instant. Fully prefetched tabs stay fresh for 60 s, visited pages 30 s.
    // Anything that changes data (admit, payment, seat move, live updates)
    // clears this cache straight away.
    staleTimes: { dynamic: 30, static: 60 },
  },
};

export default withNextIntl(nextConfig);
