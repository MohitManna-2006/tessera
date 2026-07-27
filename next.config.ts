import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/api/export": ["./templates/standalone-portfolio/**/*"],
  },
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
