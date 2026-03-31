import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "V3 PARTNERS — Plataforma Financeira",
  description: "Plataforma de gestão para parceiros e operações financeiras V3 Partners",
  keywords: ["crédito", "finanças", "M&A", "split fiscal", "parceiros"],
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "V3 Partners",
  },
};

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
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Outfit:wght@400;500;600;700;800;900&display=swap" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#C4922E" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="V3 Partners" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body className="min-h-full bg-[#050C18]">{children}</body>
    </html>
  );
}
