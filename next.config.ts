import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/api/export": ["./templates/standalone-portfolio/**/*"],
  },
  serverExternalPackages: ["pdfjs-dist"],
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
