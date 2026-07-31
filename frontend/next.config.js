/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: { bodySizeLimit: "2mb" },
  },
  transpilePackages: ["@openlend/sdk"],
  async headers() {
    return [
      {
        // SEP-0001: wallets and explorers fetch /.well-known/stellar.toml
        // cross-origin (e.g. from stellar.expert, Lobstr, Freighter). It must
        // be readable from any origin and cacheable but not stale forever.
        source: "/.well-known/stellar.toml",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Cache-Control", value: "public, max-age=3600, stale-while-revalidate=86400" },
        ],
      },
    ];
  },
  webpack: (config) => {
    config.resolve.fallback = { ...config.resolve.fallback, fs: false };
    return config;
  },
};

module.exports = nextConfig;
