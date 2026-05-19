"use client";

import { useState, useEffect } from "react";
import { Video, X, ExternalLink } from "lucide-react";

const DISMISSED_KEY = "onboarding-call-dismissed";
const CALENDLY_URL =
  process.env.NEXT_PUBLIC_ONBOARDING_CALENDLY_URL ||
  "https://calendly.com/v3partners/onboarding";

interface OnboardingCallWidgetProps {
  userCreatedAt?: string | null;
}

export function OnboardingCallWidget({ userCreatedAt }: OnboardingCallWidgetProps) {
  const [dismissed, setDismissed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const isDismissed = localStorage.getItem(DISMISSED_KEY) === "1";
    setDismissed(isDismissed);
  }, []);

  function handleDismiss() {
    localStorage.setItem(DISMISSED_KEY, "1");
    setDismissed(true);
  }

  // Only show for partners within first 30 days
  const isNew = (() => {
    if (!userCreatedAt) return true; // show by default if no date
    const elapsed = Math.floor(
      (Date.now() - new Date(userCreatedAt).getTime()) / 86400000
    );
    return elapsed < 30;
  })();

  if (!mounted || dismissed || !isNew) return null;

  return (
    <div
      className="relative rounded-xl border border-[#C9A84C]/40 bg-[#111F35] p-4"
      style={{ fontFamily: "DM Sans, sans-serif" }}
    >
      {/* Gold left accent */}
      <div className="absolute left-0 top-4 bottom-4 w-1 rounded-r-full bg-gradient-to-b from-[#C9A84C] to-[#E8C97A]" />

      {/* Dismiss */}
      <button
        onClick={handleDismiss}
        className="absolute top-3 right-3 w-7 h-7 rounded-lg bg-[#162744] hover:bg-[#243A66] flex items-center justify-center text-[#7A8FA8] hover:text-[#F0ECE4] transition-colors"
        aria-label="Dispensar widget de call"
      >
        <X className="w-3.5 h-3.5" />
      </button>

      <div className="flex items-start gap-4 pl-3">
        {/* Icon */}
        <div className="w-10 h-10 rounded-xl bg-[#C9A84C]/15 border border-[#C9A84C]/30 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Video className="w-5 h-5 text-[#C9A84C]" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 pr-8">
          <div className="flex items-center gap-2 mb-1">
            <p className="text-sm font-bold text-[#F0ECE4] leading-tight">
              Agende sua call de onboarding gratuita
            </p>
            <span className="flex-shrink-0 px-2 py-0.5 rounded-full bg-[#C9A84C] text-[#09081A] text-[9px] font-black uppercase tracking-wider">
              GRATUITO
            </span>
          </div>
          <p className="text-xs text-[#7A8FA8] leading-relaxed mb-3">
            15 min com nosso time para acelerar seus primeiros deals
          </p>

          <a
            href={CALENDLY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-xs text-[#09081A] hover:opacity-90 active:scale-[0.97] transition-all"
            style={{
              background: "linear-gradient(135deg, #C9A84C, #E8C97A)",
            }}
          >
            Agendar agora
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
}
