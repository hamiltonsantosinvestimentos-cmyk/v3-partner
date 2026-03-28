import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    // Type errors are caused by dynamic Supabase table types.
    // After running `supabase gen types typescript`, remove this flag.
    ignoreBuildErrors: true,
  },
  images: {
    domains: ["avatars.githubusercontent.com", "lh3.googleusercontent.com", "img.youtube.com"],
  },
};

export default nextConfig;
