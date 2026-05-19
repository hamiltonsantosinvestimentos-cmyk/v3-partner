"use client";

import { useState, useEffect } from "react";
import { X, TrendingUp, LayoutGrid, Headphones } from "lucide-react";

const VIDEO_SEEN_KEY = "founder-video-seen";
const DEFAULT_EMBED = "https://www.youtube.com/embed/dQw4w9WgXcQ";

const HIGHLIGHTS = [
  { icon: <TrendingUp className="w-4 h-4" />, label: "Ate 60% de comissao" },
  { icon: <LayoutGrid className="w-4 h-4" />, label: "20+ linhas de credito" },
  { icon: <Headphones className="w-4 h-4" />, label: "Suporte dedicado" },
];

interface FounderVideoModalProps {
  partnerName?: string;
}

export function FounderVideoModal({ partnerName }: FounderVideoModalProps) {
  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [embedUrl, setEmbedUrl] = useState(DEFAULT_EMBED);

  useEffect(() => {
    setMounted(true);
    const seen = localStorage.getItem(VIDEO_SEEN_KEY);
    if (!seen) {
      setVisible(true);
    }
    fetch("/api/settings/platform")
      .then(r => r.json())
      .then(d => { if (d.founder_video_url) setEmbedUrl(d.founder_video_url); })
      .catch(() => {});
  }, []);

  function handleClose() {
    localStorage.setItem(VIDEO_SEEN_KEY, "1");
    setVisible(false);
  }

  if (!mounted || !visible) return null;

  const displayName = partnerName?.split(" ")[0] || "Partner";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ fontFamily: "DM Sans, sans-serif" }}
    >
      {/* Dark overlay */}
      <div
        className="absolute inset-0 bg-black/75 backdrop-blur-sm"
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Modal card */}
      <div className="relative w-full max-w-2xl rounded-2xl border border-[#243A66] bg-[#111F35] shadow-2xl overflow-hidden animate-fade-in">
        {/* Gold accent line at top */}
        <div className="h-1 bg-gradient-to-r from-[#C9A84C] to-[#E8C97A] w-full" />

        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 z-10 w-8 h-8 rounded-lg bg-[#162744] hover:bg-[#243A66] flex items-center justify-center text-[#7A8FA8] hover:text-[#F0ECE4] transition-colors"
          aria-label="Fechar video"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="p-6 pb-0">
          {/* Header */}
          <div className="mb-5">
            <p className="text-[10px] font-bold text-[#C9A84C] uppercase tracking-widest mb-1">
              Mensagem dos Fundadores
            </p>
            <h2 className="text-xl font-bold text-[#F0ECE4] leading-tight">
              Bem-vindo a{" "}
              <span
                style={{
                  background: "linear-gradient(90deg, #C9A84C, #E8C97A)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                V3 Partners
              </span>
              {", "}
              {displayName}!
            </h2>
            <p className="text-sm text-[#7A8FA8] mt-1">
              Assista a mensagem especial dos nossos fundadores para voce.
            </p>
          </div>
        </div>

        {/* YouTube embed */}
        <div className="mx-6 rounded-xl overflow-hidden border border-[#243A66] bg-[#09081A]">
          <div className="relative" style={{ paddingBottom: "56.25%" }}>
            <iframe
              className="absolute inset-0 w-full h-full"
              src={`${embedUrl}?autoplay=1&rel=0&modestbranding=1`}
              title="Mensagem dos Fundadores V3 Partners"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </div>

        {/* Highlight chips */}
        <div className="flex flex-wrap items-center justify-center gap-3 px-6 pt-5">
          {HIGHLIGHTS.map((h) => (
            <div
              key={h.label}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#C9A84C]/30 bg-[#C9A84C]/10 text-[#C9A84C] text-xs font-semibold"
            >
              {h.icon}
              {h.label}
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="flex flex-col items-center gap-2 p-6">
          <button
            onClick={handleClose}
            className="w-full max-w-xs py-3 px-6 rounded-xl font-bold text-sm text-[#09081A] transition-all hover:opacity-90 active:scale-[0.98]"
            style={{
              background: "linear-gradient(135deg, #C9A84C, #E8C97A)",
            }}
          >
            Comecar agora
          </button>
          <button
            onClick={handleClose}
            className="text-xs text-[#7A8FA8] hover:text-[#F0ECE4] transition-colors py-1"
          >
            Pular
          </button>
        </div>
      </div>
    </div>
  );
}
