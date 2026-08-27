import path from "path";
import type { NextConfig } from "next";

const api = process.env.API_PROXY_TARGET || "http://127.0.0.1:8765";

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname),
  async rewrites() {
    return [
      { source: "/health", destination: `${api}/health` },
      { source: "/v1/:path*", destination: `${api}/v1/:path*` },
    ];
  },
};

export default nextConfig;
