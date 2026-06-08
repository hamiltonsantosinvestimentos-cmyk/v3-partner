"use client";
import { useEffect } from "react";

const RELOAD_FLAG = "v3_chunk_reload_at";
const RELOAD_COOLDOWN_MS = 10_000;

function isChunkLoadError(value: unknown): boolean {
  const message =
    value instanceof Error
      ? `${value.name} ${value.message}`
      : typeof value === "string"
        ? value
        : "";
  return /ChunkLoadError|Failed to load chunk|Loading chunk [\w-]+ failed/i.test(message);
}

function recoverFromStaleChunk() {
  const lastReload = Number(sessionStorage.getItem(RELOAD_FLAG) || 0);
  if (Date.now() - lastReload < RELOAD_COOLDOWN_MS) return;
  sessionStorage.setItem(RELOAD_FLAG, String(Date.now()));
  window.location.reload();
}

export function ChunkErrorReload() {
  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      if (isChunkLoadError(event.error) || isChunkLoadError(event.message)) {
        recoverFromStaleChunk();
      }
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      if (isChunkLoadError(event.reason)) {
        recoverFromStaleChunk();
      }
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
  return null;
}
