import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: ["localhost", "10.5.51.78"],
  turbopack: {
    root: path.resolve(process.cwd(), "..")
  }
};

export default nextConfig;
