import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Sin GLOSSARY_REPO, la API del chat usa el glosario de ejemplo: incluirlo en la función de Vercel.
  outputFileTracingIncludes: { "/api/chat": ["./glossary.example.md"] },
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
