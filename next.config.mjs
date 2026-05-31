const springApiBaseUrl = process.env.SPRING_API_BASE_URL || "http://127.0.0.1:8080";

const defaultMigratedApiPaths = [
  "/api/characters/:path*",
  "/api/market/snapshot",
  "/api/consult/sggu",
  "/api/efficiency/spec-up/:path*",
  "/api/efficiency/accessories/recovery"
];

const configuredApiPaths = process.env.SPRING_API_PATHS;
const migratedApiPaths = (configuredApiPaths ? configuredApiPaths.split(",") : defaultMigratedApiPaths)
  .map((path) => path.trim())
  .filter(Boolean);

const nextConfig = {
  async rewrites() {
    return {
      beforeFiles: migratedApiPaths.map((source) => ({
        source,
        destination: `${springApiBaseUrl}${source}`
      }))
    };
  },
  turbopack: {
    root: process.cwd()
  },
  images: {
    qualities: [75, 90, 95],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn-lostark.game.onstove.com"
      },
      {
        protocol: "https",
        hostname: "img.lostark.co.kr"
      },
      {
        protocol: "https",
        hostname: "lostarkcodex.com",
        pathname: "/icons/**"
      }
    ]
  }
};

export default nextConfig;
