import type { Metadata, Viewport } from "next";
import "./globals.css";
import { PWARegister } from "@/components/pwa-register";
import { ChunkErrorReload } from "@/components/chunk-error-reload";
import { Toaster } from "@/components/shared/toaster";

export const metadata: Metadata = {
  title: "V3 PARTNERS — Plataforma Financeira",
  description: "Plataforma de gestão para parceiros e operações financeiras V3 Partners",
  keywords: ["crédito", "finanças", "M&A", "parceiros"],
  manifest: "/manifest.json",
  // Favicon em public/ (não app/favicon.ico): a convenção de arquivo do Next injeta o ícone da raiz
  // antes dos ícones dos layouts filhos, e o Enterprise com tema sairia com dois ícones.
  icons: { icon: "/favicon.ico", apple: "/icon-192.png" },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "V3 Partners",
  },
};

// Cor padrão da barra (V3). As páginas no domínio de um Enterprise sobrescrevem com generateViewport
// (BRIEF docs/briefs/2026-11-26_app-instalado-marca-enterprise.md).
export const viewport: Viewport = { themeColor: "#C9A84C" };

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className="h-full antialiased dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className="min-h-full bg-[#09081A]">
        <PWARegister />
        <ChunkErrorReload />
        <Toaster />
        {children}
      </body>
    </html>
  );
}
