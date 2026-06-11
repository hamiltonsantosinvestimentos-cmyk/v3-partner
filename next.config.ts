import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://fonts.googleapis.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob: https://avatars.githubusercontent.com https://lh3.googleusercontent.com https://img.youtube.com https://i.ytimg.com https://sbmuashewklfhdyyuezr.supabase.co https://feosfhqlofkfuwdsyeaq.supabase.co",
      "frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com",
      "connect-src 'self' https://sbmuashewklfhdyyuezr.supabase.co wss://sbmuashewklfhdyyuezr.supabase.co https://feosfhqlofkfuwdsyeaq.supabase.co wss://feosfhqlofkfuwdsyeaq.supabase.co https://api.anthropic.com https://brasilapi.com.br https://receitaws.com.br https://publica.cnj.jus.br https://viacep.com.br https://n8n-514n.onrender.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  turbopack: {},
  typescript: {
    ignoreBuildErrors: false,
  },
  // Externaliza chromium/puppeteer do bundle webpack — necessário para Vercel serverless
  serverExternalPackages: ["@sparticuz/chromium-min", "puppeteer-core", "pdf-lib"],
  images: {
    imageSizes: [16, 32, 48, 64, 96, 100, 128, 256, 384],
    remotePatterns: [
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "img.youtube.com" },
      { protocol: "https", hostname: "feosfhqlofkfuwdsyeaq.supabase.co" },
      { protocol: "https", hostname: "sbmuashewklfhdyyuezr.supabase.co" },
    ],
  },
  async headers() {
    // Headers para rotas de conteúdo em iframe (prompts e relatórios)
    const iframeContentHeaders = securityHeaders
      .filter(h => h.key !== "X-Frame-Options")
      .map(h => {
        // Permitir framing same-origin no CSP
        if (h.key === "Content-Security-Policy") {
          return { ...h, value: h.value.replace("frame-ancestors 'none'", "frame-ancestors 'self'") };
        }
        return h;
      });

    return [
      // Rotas de conteúdo em iframe — sem X-Frame-Options DENY, frame-ancestors self
      {
        source: "/api/prompts/content",
        headers: iframeContentHeaders,
      },
      {
        source: "/api/relatorios/content",
        headers: iframeContentHeaders,
      },
      // Todas as outras rotas — segurança total
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
