import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['@tomtom-international/web-sdk-services'],
  turbopack: {},
};

export default nextConfig;
