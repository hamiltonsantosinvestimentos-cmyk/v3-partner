"use client";
import { useState, useEffect } from "react";
import { X, Download } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Register service worker
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(console.error);
    }

    // Install prompt
    const handler = (e: Event) => {
      e.preventDefault();
      if (!sessionStorage.getItem("pwa-dismissed")) {
        setDeferredPrompt(e as BeforeInstallPromptEvent);
        setShow(true);
      }
    };

    window.addEventListener("beforeinstallprompt", handler as EventListener);
    return () => window.removeEventListener("beforeinstallprompt", handler as EventListener);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      sessionStorage.setItem("pwa-dismissed", "1");
    }
    setDeferredPrompt(null);
    setShow(false);
  };

  const handleDismiss = () => {
    sessionStorage.setItem("pwa-dismissed", "1");
    setShow(false);
  };

  if (!show) return null;

  return (
    <div
      className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-sm rounded-xl border border-[#243A66] bg-[#111F35] px-4 py-3 shadow-2xl"
      role="banner"
      aria-label="Instalar aplicativo V3 Partners"
    >
      <div className="flex items-center gap-3">
        {/* Icon */}
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-[#162744]">
          <Download className="h-5 w-5 text-[#C9A84C]" />
        </div>

        {/* Text */}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-600 text-[#F0ECE4]">Instale o app V3 Partners</p>
          <p className="text-xs text-[#7A8FA8]">Acesso rápido direto da sua tela inicial</p>
        </div>

        {/* Install button */}
        <button
          onClick={handleInstall}
          className="flex-shrink-0 rounded-lg bg-[#C9A84C] px-3 py-1.5 text-xs font-700 uppercase tracking-wider text-[#09081A] transition-opacity hover:opacity-90"
        >
          Instalar
        </button>

        {/* Dismiss */}
        <button
          onClick={handleDismiss}
          className="flex-shrink-0 rounded-md p-1 text-[#7A8FA8] transition-colors hover:text-[#F0ECE4]"
          aria-label="Dispensar"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
