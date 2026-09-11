import path from "path";
import type { NextConfig } from "next";

// /v1/* and /health are handled by app route proxies (web/app/v1, web/app/health)
// so Vercel can forward the visitor IP to the OCI API.

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;
