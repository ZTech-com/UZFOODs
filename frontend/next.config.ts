import type { NextConfig } from "next";

// EXPORT=true bo'lsa — GitHub Pages uchun statik eksport (client-side rendering)
// Default: Docker'da yengil deploy uchun standalone build
const output: NextConfig["output"] =
  process.env.EXPORT === "true" ? "export" : "standalone";

const nextConfig: NextConfig = {
  output,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
