const springApiBaseUrl = process.env.SPRING_API_BASE_URL || "http://127.0.0.1:8080";

const migratedApiPaths = (process.env.SPRING_API_PATHS || "")
  .split(",")
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
