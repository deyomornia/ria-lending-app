import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  // Ensure the PDF fonts ship with the serverless function on Vercel
  outputFileTracingIncludes: {
    "/api/loans/[id]/agreement": ["./public/fonts/**"],
  },
};

export default nextConfig;
