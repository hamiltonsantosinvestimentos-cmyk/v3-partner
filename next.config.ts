import type { NextConfig } from "next";
const withPWA = require("next-pwa")({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
});

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    domains: ["avatars.githubusercontent.com", "lh3.googleusercontent.com", "img.youtube.com"],
  },
};

export default withPWA(nextConfig);
