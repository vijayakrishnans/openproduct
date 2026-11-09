import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // OpenNext packages the standalone output into the Worker.
  output: "standalone",
  outputFileTracingRoot: __dirname,
  // People became Builders; old links keep working.
  async redirects() {
    return [
      { source: "/people", destination: "/builders", permanent: true },
      { source: "/people/:handle", destination: "/builders/:handle", permanent: true },
    ];
  },
};

export default config;
