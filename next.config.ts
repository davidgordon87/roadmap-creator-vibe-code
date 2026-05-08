import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Disable Turbopack for builds — use Webpack for broader environment compatibility
  experimental: {},
};

export default nextConfig;
