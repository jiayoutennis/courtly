import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    // Don't prevent builds when there are ESLint errors
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
