"use client";

declare global {
  interface Window {
    dataLayer?: unknown[];
    fbq?: (...args: unknown[]) => void;
  }
}

export function trackEvent(eventName: string, params: Record<string, unknown> = {}): void {
  if (typeof window === "undefined") return;
  try {
    if (window.dataLayer) window.dataLayer.push({ event: eventName, ...params });
    if (window.fbq) window.fbq("track", eventName, params);
  } catch {
    // rastreamento nunca pode interromper o fluxo de compra
  }
}
