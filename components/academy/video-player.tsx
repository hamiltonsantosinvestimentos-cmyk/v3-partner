"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  X, Play, Pause, Volume2, VolumeX, Maximize2, Minimize2,
  SkipForward, SkipBack, ChevronRight, BookOpen, Star,
  StickyNote, Plus, Trash2, Loader2,
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

interface Note {
  id: string;
  timestamp_secs: number;
  note: string;
  created_at: string;
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
  const [showNotes, setShowNotes] = useState(false);
  const [notes, setNotes] = useState<Note[]>([]);
  const [noteInput, setNoteInput] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const controlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const duration = video?.durationSecs ?? 1;
  const progress = (currentTime / duration) * 100;

  // Simulate buffering ahead of playhead
  useEffect(() => {
    setBuffered(Math.min(100, progress + 15 + Math.random() * 10));
  }, [progress]);

  // Load notes when video changes
  useEffect(() => {
    if (!video) return;
    setNotes([]);
    fetch(`/api/academy/notes?video_id=${video.id}`)
      .then((r) => r.json())
      .then((d) => setNotes(d.notes ?? []))
      .catch(() => {});
  }, [video?.id]);

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
    setNoteInput("");
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

  async function handleAddNote() {
    if (!video || !noteInput.trim()) return;
    setSavingNote(true);
    try {
      const res = await fetch("/api/academy/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ video_id: video.id, timestamp_secs: currentTime, note: noteInput.trim() }),
      });
      const d = await res.json();
      if (d.note) {
        setNotes((prev) => [...prev, d.note].sort((a, b) => a.timestamp_secs - b.timestamp_secs));
        setNoteInput("");
      }
    } finally {
      setSavingNote(false);
    }
  }

  async function handleDeleteNote(id: string) {
    await fetch("/api/academy/notes", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setNotes((prev) => prev.filter((n) => n.id !== id));
  }

  if (!video) return null;

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
              <div className={`absolute inset-0 bg-gradient-to-br ${video.gradient} opacity-90`} />
              <div className="absolute inset-0 opacity-10" style={{
                backgroundImage: "linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)",
                backgroundSize: "40px 40px"
              }} />
              <div className="relative z-10 text-center px-8 max-w-2xl">
                <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center mx-auto mb-4">
                  <BookOpen className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-2 drop-shadow-lg">{video.title}</h3>
                <p className="text-sm text-white/70">{video.instructor} — {video.instructorRole}</p>
              </div>
              {!playing && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-20 h-20 rounded-full bg-black/40 backdrop-blur-sm border border-white/20 flex items-center justify-center cursor-pointer hover:scale-110 transition-transform">
                    <Play className="w-8 h-8 text-white ml-1" fill="white" />
                  </div>
                </div>
              )}
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
          <button
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            className="absolute top-4 left-4 w-9 h-9 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/70 transition-colors z-20"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Controls Bar — only for simulated player ── */}
        {!ytId && <div className={`bg-gradient-to-t from-black via-black/95 to-transparent px-5 pb-4 pt-3 transition-opacity duration-300 ${showControls || !playing ? "opacity-100" : "opacity-0"}`}>
          <div className="relative h-1.5 bg-white/20 rounded-full mb-4 cursor-pointer group"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              seek(((e.clientX - rect.left) / rect.width) * 100);
            }}>
            <div className="absolute h-full bg-white/30 rounded-full transition-all" style={{ width: `${buffered}%` }} />
            <div className="absolute h-full rounded-full transition-all" style={{ width: `${progress}%`, background: video.accentColor }} />
            <div className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-white shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ left: `calc(${progress}% - 7px)` }} />
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => skip(-15)} className="text-white/70 hover:text-white transition-colors" title="15s atrás">
                <SkipBack className="w-5 h-5" />
              </button>
              <button onClick={togglePlay}
                className="w-10 h-10 rounded-full flex items-center justify-center text-white hover:scale-110 transition-transform"
                style={{ background: video.accentColor }}>
                {playing ? <Pause className="w-5 h-5" fill="white" /> : <Play className="w-5 h-5 ml-0.5" fill="white" />}
              </button>
              <button onClick={() => skip(15)} className="text-white/70 hover:text-white transition-colors" title="15s à frente">
                <SkipForward className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-2">
                <button onClick={() => setMuted((m) => !m)} className="text-white/70 hover:text-white transition-colors">
                  {muted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </button>
                <input type="range" min={0} max={100} value={muted ? 0 : volume}
                  onChange={(e) => { setVolume(Number(e.target.value)); setMuted(false); }}
                  className="w-20 accent-white cursor-pointer" />
              </div>
              <span className="text-white/60 text-xs font-mono tabular-nums">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>
            <div className="flex items-center gap-2">
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
              <button onClick={() => setFullscreen((f) => !f)} className="text-white/70 hover:text-white transition-colors">
                {fullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>}

        {/* ── YouTube nav controls ── */}
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

        {/* ── Info + Notes Panel ── */}
        {!fullscreen && (
          <div className="bg-zinc-950 border-t border-white/10">
            {/* Tabs */}
            <div className="flex border-b border-white/10">
              <button
                onClick={() => setShowNotes(false)}
                className={`px-5 py-3 text-xs font-semibold transition-colors border-b-2 ${!showNotes ? "border-white text-white" : "border-transparent text-white/50 hover:text-white/70"}`}
              >
                Sobre a Aula
              </button>
              <button
                onClick={() => setShowNotes(true)}
                className={`flex items-center gap-1.5 px-5 py-3 text-xs font-semibold transition-colors border-b-2 ${showNotes ? "border-[#C9A84C] text-[#C9A84C]" : "border-transparent text-white/50 hover:text-white/70"}`}
              >
                <StickyNote className="w-3.5 h-3.5" />
                Minhas Anotações
                {notes.length > 0 && (
                  <span className="bg-[#C9A84C] text-[#09081A] text-[10px] font-black px-1.5 rounded-full">{notes.length}</span>
                )}
              </button>
            </div>

            {!showNotes ? (
              /* Info */
              <div className="px-5 py-4 flex items-start gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <Badge className={LEVEL_COLORS[video.level]}>{video.level}</Badge>
                    {video.required && <Badge className="bg-[#C9A84C]/20 text-[#C9A84C] border-[#C9A84C]/30 text-[10px]">Obrigatório</Badge>}
                    {video.tags?.map((t) => (
                      <span key={t} className="text-xs text-muted-foreground border border-border/50 rounded px-1.5 py-0.5">{t}</span>
                    ))}
                  </div>
                  <h3 className="text-sm font-semibold text-white mb-1">{video.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{video.description}</p>
                </div>
                <div className="flex-shrink-0 text-right">
                  <div className="flex items-center gap-1.5 text-xs text-amber-400 mb-1">
                    {[1,2,3,4].map((i) => <Star key={i} className="w-3 h-3 fill-amber-400" />)}
                    <Star className="w-3 h-3 fill-amber-400/40" />
                  </div>
                  <p className="text-xs font-semibold text-white">{video.instructor}</p>
                  <p className="text-xs text-muted-foreground">{video.instructorRole}</p>
                </div>
              </div>
            ) : (
              /* Notes */
              <div className="px-5 py-4 space-y-3 max-h-48 overflow-y-auto">
                {/* Add note */}
                <div className="flex gap-2">
                  <div className="flex-shrink-0 px-2 py-1 rounded bg-white/10 text-[10px] text-white/60 font-mono self-center">
                    {formatTime(currentTime)}
                  </div>
                  <input
                    value={noteInput}
                    onChange={(e) => setNoteInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleAddNote(); } }}
                    placeholder="Adicionar anotação neste momento... (Enter para salvar)"
                    className="flex-1 h-8 px-3 text-xs bg-white/5 border border-white/10 rounded-lg text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-[#C9A84C]/50"
                  />
                  <button
                    onClick={handleAddNote}
                    disabled={!noteInput.trim() || savingNote}
                    className="flex-shrink-0 w-8 h-8 rounded-lg bg-[#C9A84C]/20 border border-[#C9A84C]/30 flex items-center justify-center text-[#C9A84C] hover:bg-[#C9A84C]/30 disabled:opacity-40 transition-colors"
                  >
                    {savingNote ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  </button>
                </div>

                {/* Notes list */}
                {notes.length === 0 ? (
                  <p className="text-xs text-white/30 text-center py-2">Nenhuma anotação ainda. Pause o vídeo e registre seus insights!</p>
                ) : (
                  notes.map((n) => (
                    <div key={n.id} className="flex items-start gap-2 group">
                      <button
                        onClick={() => { seek((n.timestamp_secs / duration) * 100); }}
                        className="flex-shrink-0 px-2 py-0.5 rounded bg-[#C9A84C]/10 text-[10px] text-[#C9A84C] font-mono hover:bg-[#C9A84C]/20 transition-colors mt-0.5"
                        title="Ir para este momento"
                      >
                        {formatTime(n.timestamp_secs)}
                      </button>
                      <p className="flex-1 text-xs text-white/80 leading-relaxed">{n.note}</p>
                      <button
                        onClick={() => handleDeleteNote(n.id)}
                        className="flex-shrink-0 opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 transition-all"
                        title="Remover anotação"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
