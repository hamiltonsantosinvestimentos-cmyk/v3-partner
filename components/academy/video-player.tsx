"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  X, Play, Pause, Volume2, VolumeX, Maximize2, Minimize2,
  SkipForward, SkipBack, ChevronRight, BookOpen, Star,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Video } from "@/lib/academy-data";

function extractYoutubeId(url: string): string | null {
  if (!url?.trim()) return null;
  const short = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
  if (short) return short[1];
  const watch = url.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
  if (watch) return watch[1];
  const embed = url.match(/embed\/([a-zA-Z0-9_-]{11})/);
  if (embed) return embed[1];
  if (/^[a-zA-Z0-9_-]{11}$/.test(url.trim())) return url.trim();
  return null;
}

interface VideoPlayerProps {
  video: Video | null;
  onClose: () => void;
  onNext?: () => void;
  onPrev?: () => void;
  hasNext?: boolean;
  hasPrev?: boolean;
  onProgress?: (videoId: string, progress: number) => void;
  savedProgress?: number;
  youtubeUrl?: string;
}

const LEVEL_COLORS: Record<string, string> = {
  "Iniciante": "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  "Intermediário": "bg-amber-500/20 text-amber-400 border-amber-500/30",
  "Avançado": "bg-red-500/20 text-red-400 border-red-500/30",
};

function formatTime(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function VideoPlayer({ video, onClose, onNext, onPrev, hasNext, hasPrev, onProgress, savedProgress, youtubeUrl }: VideoPlayerProps) {
  const ytId = extractYoutubeId(youtubeUrl ?? "");
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(savedProgress ?? 0);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(80);
  const [fullscreen, setFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [buffered, setBuffered] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const controlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const duration = video?.durationSecs ?? 1;
  const progress = (currentTime / duration) * 100;

  // Simulate buffering ahead of playhead
  useEffect(() => {
    setBuffered(Math.min(100, progress + 15 + Math.random() * 10));
  }, [progress]);

  // Auto-hide controls
  const resetControlsTimer = useCallback(() => {
    setShowControls(true);
    if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    controlsTimerRef.current = setTimeout(() => {
      if (playing) setShowControls(false);
    }, 3000);
  }, [playing]);

  // Playback simulation
  useEffect(() => {
    if (playing) {
      intervalRef.current = setInterval(() => {
        setCurrentTime((t) => {
          const next = t + 1;
          if (next >= duration) {
            setPlaying(false);
            return duration;
          }
          onProgress?.(video!.id, Math.round((next / duration) * 100));
          return next;
        });
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [playing, duration, video, onProgress]);

  // Reset on video change
  useEffect(() => {
    setPlaying(false);
    setCurrentTime(savedProgress ?? 0);
    setShowControls(true);
  }, [video?.id, savedProgress]);

  function togglePlay() {
    setPlaying((p) => !p);
    resetControlsTimer();
  }

  function seek(pct: number) {
    const t = Math.round((pct / 100) * duration);
    setCurrentTime(t);
    onProgress?.(video!.id, pct);
    resetControlsTimer();
  }

  function skip(secs: number) {
    setCurrentTime((t) => Math.max(0, Math.min(duration, t + secs)));
    resetControlsTimer();
  }

  if (!video) return null;

  const thumbnailGradient = video.gradient.replace("from-", "").replace("via-", "").replace("to-", "").split(" ")[0];

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center" onClick={togglePlay}>
      <div
        ref={containerRef}
        className={`relative bg-black flex flex-col ${fullscreen ? "w-screen h-screen" : "w-full max-w-5xl max-h-[90vh] rounded-2xl overflow-hidden shadow-2xl"}`}
        onClick={(e) => e.stopPropagation()}
        onMouseMove={resetControlsTimer}
      >
        {/* ── Video Area ── */}
        <div
          className="relative flex-1 flex items-center justify-center select-none overflow-hidden bg-black"
          style={{ minHeight: fullscreen ? "100vh" : "56vmin", maxHeight: fullscreen ? "100vh" : "60vh" }}
          onClick={ytId ? undefined : togglePlay}
        >
          {ytId ? (
            /* ── YouTube Player ── */
            <iframe
              key={ytId}
              src={`https://www.youtube.com/embed/${ytId}?autoplay=1&rel=0&modestbranding=1&color=white&controls=1`}
              className="absolute inset-0 w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
              allowFullScreen
              title={video.title}
            />
          ) : (
            <>
              {/* Simulated player — gradient background + content */}
              <div className={`absolute inset-0 bg-gradient-to-br ${video.gradient} opacity-90`} />
              <div className="absolute inset-0 opacity-10" style={{
                backgroundImage: "linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)",
                backgroundSize: "40px 40px"
              }} />

              {/* Chapter title card */}
              <div className="relative z-10 text-center px-8 max-w-2xl">
                <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center mx-auto mb-4">
                  <BookOpen className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-2 drop-shadow-lg">{video.title}</h3>
                <p className="text-sm text-white/70">{video.instructor} — {video.instructorRole}</p>
              </div>

              {/* Center play/pause overlay */}
              {!playing && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-20 h-20 rounded-full bg-black/40 backdrop-blur-sm border border-white/20 flex items-center justify-center cursor-pointer hover:scale-110 transition-transform">
                    <Play className="w-8 h-8 text-white ml-1" fill="white" />
                  </div>
                </div>
              )}

              {/* Playing indicator */}
              {playing && (
                <div className="absolute top-4 right-4 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-500/80 backdrop-blur-sm">
                  <div className="flex gap-0.5 items-end h-3">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="w-0.5 bg-white rounded-full animate-pulse"
                        style={{ height: `${[8, 12, 6, 10][i - 1]}px`, animationDelay: `${i * 0.1}s` }} />
                    ))}
                  </div>
                  <span className="text-xs text-white font-semibold">REPRODUZINDO</span>
                </div>
              )}
            </>
          )}

          {/* Close button — always visible */}
          <button
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            className="absolute top-4 left-4 w-9 h-9 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/70 transition-colors z-20"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Controls Bar — only for simulated player ── */}
        {!ytId && <div className={`bg-gradient-to-t from-black via-black/95 to-transparent px-5 pb-4 pt-3 transition-opacity duration-300 ${showControls || !playing ? "opacity-100" : "opacity-0"}`}>
          {/* Progress bar */}
          <div className="relative h-1.5 bg-white/20 rounded-full mb-4 cursor-pointer group"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              seek(((e.clientX - rect.left) / rect.width) * 100);
            }}>
            {/* Buffered */}
            <div className="absolute h-full bg-white/30 rounded-full transition-all" style={{ width: `${buffered}%` }} />
            {/* Played */}
            <div className="absolute h-full rounded-full transition-all"
              style={{ width: `${progress}%`, background: video.accentColor }} />
            {/* Thumb */}
            <div className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-white shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ left: `calc(${progress}% - 7px)` }} />
          </div>

          {/* Controls row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* Skip back */}
              <button onClick={() => skip(-15)} className="text-white/70 hover:text-white transition-colors" title="15s atrás">
                <SkipBack className="w-5 h-5" />
              </button>
              {/* Play/Pause */}
              <button onClick={togglePlay}
                className="w-10 h-10 rounded-full flex items-center justify-center text-white hover:scale-110 transition-transform"
                style={{ background: video.accentColor }}>
                {playing ? <Pause className="w-5 h-5" fill="white" /> : <Play className="w-5 h-5 ml-0.5" fill="white" />}
              </button>
              {/* Skip forward */}
              <button onClick={() => skip(15)} className="text-white/70 hover:text-white transition-colors" title="15s à frente">
                <SkipForward className="w-5 h-5" />
              </button>

              {/* Volume */}
              <div className="flex items-center gap-2 group/vol">
                <button onClick={() => setMuted((m) => !m)} className="text-white/70 hover:text-white transition-colors">
                  {muted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </button>
                <input type="range" min={0} max={100} value={muted ? 0 : volume}
                  onChange={(e) => { setVolume(Number(e.target.value)); setMuted(false); }}
                  className="w-20 accent-white cursor-pointer" />
              </div>

              {/* Time */}
              <span className="text-white/60 text-xs font-mono tabular-nums">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {/* Prev/Next */}
              {hasPrev && (
                <button onClick={onPrev} className="text-white/70 hover:text-white transition-colors text-xs flex items-center gap-1">
                  <ChevronRight className="w-4 h-4 rotate-180" /> Anterior
                </button>
              )}
              {hasNext && (
                <button onClick={onNext} className="text-white/70 hover:text-white transition-colors text-xs flex items-center gap-1">
                  Próximo <ChevronRight className="w-4 h-4" />
                </button>
              )}
              {/* Fullscreen */}
              <button onClick={() => setFullscreen((f) => !f)} className="text-white/70 hover:text-white transition-colors">
                {fullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>}

        {/* ── YouTube nav controls (prev/next only) ── */}
        {ytId && (hasNext || hasPrev) && (
          <div className="bg-black/90 px-5 py-2 flex items-center justify-end gap-3 border-t border-white/10">
            {hasPrev && (
              <button onClick={onPrev} className="text-white/70 hover:text-white transition-colors text-xs flex items-center gap-1">
                <ChevronRight className="w-4 h-4 rotate-180" /> Anterior
              </button>
            )}
            {hasNext && (
              <button onClick={onNext} className="text-white/70 hover:text-white transition-colors text-xs flex items-center gap-1">
                Próximo <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        {/* ── Info Panel ── */}
        {!fullscreen && (
          <div className="bg-zinc-950 border-t border-white/10 px-5 py-4 flex items-start gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <Badge className={LEVEL_COLORS[video.level]}>{video.level}</Badge>
                {video.tags?.map((t) => (
                  <span key={t} className="text-xs text-muted-foreground border border-border/50 rounded px-1.5 py-0.5">{t}</span>
                ))}
              </div>
              <h3 className="text-sm font-semibold text-white mb-1">{video.title}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">{video.description}</p>
            </div>
            <div className="flex-shrink-0 text-right">
              <div className="flex items-center gap-1.5 text-xs text-amber-400 mb-1">
                <Star className="w-3 h-3 fill-amber-400" />
                <Star className="w-3 h-3 fill-amber-400" />
                <Star className="w-3 h-3 fill-amber-400" />
                <Star className="w-3 h-3 fill-amber-400" />
                <Star className="w-3 h-3 fill-amber-400/40" />
              </div>
              <p className="text-xs font-semibold text-white">{video.instructor}</p>
              <p className="text-xs text-muted-foreground">{video.instructorRole}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
