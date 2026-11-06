import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // OpenNext packages the standalone output into the Worker.
  output: "standalone",
  outputFileTracingRoot: __dirname,
};

export default config;
