import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Permanently prevent local dev LMDB disk compaction errors on Windows
  // ("Compaction failed: Another write batch or compaction is already active")
  // by forcing dev-server cache to stay in-memory instead of locking disk files.
  webpack: (config, { dev }) => {
    if (dev) {
      config.cache = {
        type: 'memory',
      };
    }
    return config;
  },
  experimental: {
    turbopackMemoryLimit: 1024 * 1024 * 512,
  },
};

export default nextConfig;
