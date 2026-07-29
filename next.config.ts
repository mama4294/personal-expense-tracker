import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Expenses and Import folded into the spending page; keep old bookmarks working.
  async redirects() {
    return [
      { source: "/expenses", destination: "/", permanent: false },
      { source: "/import", destination: "/", permanent: false },
    ];
  },
};

export default nextConfig;
