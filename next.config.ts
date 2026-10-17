import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "i.pravatar.cc" },
    ],
  },
  async redirects() {
    return [
      // Les variants /ar et /en déclarés en hreflang n'existent pas comme
      // routes (la langue est gérée côté client) : on évite les 404 SEO.
      { source: "/ar", destination: "/", permanent: false },
      { source: "/en", destination: "/", permanent: false },
    ];
  },
};

export default nextConfig;
