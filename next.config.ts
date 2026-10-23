import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Sin GLOSSARY_REPO, la wiki usa el glosario de ejemplo: incluirlo en la función de Vercel.
  outputFileTracingIncludes: { "/": ["./glossary.example.md"] },
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
