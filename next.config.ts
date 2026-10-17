import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The app is fully dynamic (live restaurant data). Disable cache components
  // so server components reading cookies/DB behave in the classic dynamic way.
  cacheComponents: false,
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
