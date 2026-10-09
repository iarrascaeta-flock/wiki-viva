import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // La API del chat lee glossary.md en runtime: incluirlo en la función de Vercel.
  outputFileTracingIncludes: { "/api/chat": ["./glossary.md"] },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
