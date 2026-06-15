import type { NextConfig } from "next";
import path from "node:path";

function devOrigins() {
  const origins = new Set(["localhost", "127.0.0.1"]);
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (configured) {
    try {
      origins.add(new URL(configured).hostname);
    } catch {
      console.warn(`[next-config] Ignoring invalid NEXT_PUBLIC_APP_URL: ${configured}`);
    }
  }
  return [...origins];
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: devOrigins(),
  turbopack: {
    root: path.resolve(process.cwd(), "..")
  }
};

export default nextConfig;
