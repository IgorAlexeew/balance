import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  allowedDevOrigins: [
    "preview-chat-1654056a-757b-40b9-87ba-be22c12f0672.space-z.ai",
    "*.space-z.ai",
  ],
};

export default nextConfig;
