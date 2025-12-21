import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Increase body size limit for API routes to handle larger images
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
