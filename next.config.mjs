const nextConfig = {
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
