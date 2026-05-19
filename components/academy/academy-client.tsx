"use client";

import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { Play, Search, GraduationCap, Clock, ChevronRight, CheckCircle2, BookOpen, Flame, Star, Settings, Award, Lock, Trophy, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { VideoPlayer } from "./video-player";
import { AcademyAdmin, loadYtLinks } from "./academy-admin";
import { AcademyCertificate } from "./academy-certificate";
import { AcademyQuiz } from "./academy-quiz";
import { ACADEMY_CATEGORIES, getAllVideos, type Video, type VideoCategory } from "@/lib/academy-data";
import { getQuiz } from "@/lib/academy-quizzes";
import { BADGE_DEFS, RARITY_COLORS, SPECIALTY_BADGE_DEFS } from "@/lib/academy-badges";
import { LiveClasses } from "./live-classes";
import { OnboardingTrail } from "./onboarding-trail";
import { AcademyRanking } from "./academy-ranking";

interface VideoOverride {
  video_id: string;
  title?: string;
  description?: string;
  instructor?: string;
  instructor_role?: string;
  level?: string;
  duration?: string;
  duration_secs?: number;
  featured?: boolean;
  required?: boolean;
  tags?: string[];
}

function applyOverride(video: Video, override?: VideoOverride): Video {
  if (!override) return video;
  return {
    ...video,
    title: override.title ?? video.title,
    description: override.description ?? video.description,
    instructor: override.instructor ?? video.instructor,
    instructorRole: override.instructor_role ?? video.instructorRole,
    level: (override.level as Video["level"]) ?? video.level,
    duration: override.duration ?? video.duration,
    durationSecs: override.duration_secs ?? video.durationSecs,
    featured: override.featured ?? video.featured,
    required: override.required ?? video.required,
    tags: override.tags ?? video.tags,
  };
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

// ── Video Card ──────────────────────────────────────────────────────────────
function VideoCard({ video, onPlay, progress, index, ytId, locked }: {
  video: Video; onPlay: (v: Video) => void; progress?: number; index: number; ytId?: string; locked?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      className={`relative flex-shrink-0 group ${locked ? "cursor-not-allowed opacity-70" : "cursor-pointer"}`}
      style={{ width: 220, animationDelay: `${index * 0.05}s` }}
      onMouseEnter={() => !locked && setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => !locked && onPlay(video)}
      title={locked ? "Complete os pré-requisitos para desbloquear esta aula" : undefined}
    >
      <div className={`relative rounded-xl overflow-hidden transition-all duration-300 ${hovered ? "scale-105 shadow-2xl ring-2 ring-white/20" : ""}`}
        style={{ aspectRatio: "16/9" }}>
        <div className={`absolute inset-0 bg-gradient-to-br ${video.gradient}`} />
        {ytId && (
          <img
            src={`https://img.youtube.com/vi/${ytId}/mqdefault.jpg`}
            alt={video.title}
            className="absolute inset-0 w-full h-full object-cover"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        )}
        <div className="absolute inset-0 opacity-10" style={{
            backgroundImage: "linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)",
            backgroundSize: "40px 40px"
          }} />
        <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/70 text-[10px] text-white font-mono">
          {video.duration}
        </div>
        {progress && progress > 0 && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
            <div className="h-full bg-red-500 transition-all" style={{ width: `${progress}%` }} />
          </div>
        )}
        {progress === 100 && (
          <div className="absolute top-2 right-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 drop-shadow" />
          </div>
        )}
        {video.required && !locked && (
          <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-[#C9A84C]/80 text-[9px] text-[#09081A] font-black uppercase">
            Obrigatório
          </div>
        )}
        {locked && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 rounded-xl">
            <Lock className="w-6 h-6 text-white/70 mb-1" />
            <p className="text-[9px] text-white/70 font-semibold px-2 text-center">Conclua os pré-requisitos</p>
          </div>
        )}
        {hovered && !locked && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 transition-all">
            <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center mb-2 shadow-lg">
              <Play className="w-5 h-5 text-black ml-0.5" fill="black" />
            </div>
            <p className="text-white text-xs font-semibold">Assistir</p>
          </div>
        )}
      </div>
      <div className="mt-2 px-0.5">
        <p className="text-xs font-semibold text-white leading-tight line-clamp-2 group-hover:text-white/90">{video.title}</p>
        <div className="flex items-center gap-1.5 mt-1">
          <Badge className={`text-[10px] px-1.5 py-0 ${LEVEL_COLORS[video.level]}`}>{video.level}</Badge>
          <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
            <Clock className="w-2.5 h-2.5" />{video.duration}
          </span>
        </div>
        <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{video.instructor}</p>
      </div>
    </div>
  );
}

// ── Category Row ────────────────────────────────────────────────────────────
function extractYtId(url?: string): string | undefined {
  if (!url?.trim()) return undefined;
  const short = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
  if (short) return short[1];
  const watch = url.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
  if (watch) return watch[1];
  const embed = url.match(/embed\/([a-zA-Z0-9_-]{11})/);
  if (embed) return embed[1];
  if (/^[a-zA-Z0-9_-]{11}$/.test(url.trim())) return url.trim();
  return undefined;
}

function CategoryRow({ category, onPlay, progress, ytLinks }: {
  category: VideoCategory;
  onPlay: (v: Video) => void;
  progress: Record<string, number>;
  ytLinks: Record<string, string>;
}) {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  function scroll(dir: "left" | "right") {
    if (!scrollRef.current) return;
    scrollRef.current.scrollBy({ left: dir === "left" ? -460 : 460, behavior: "smooth" });
  }

  function onScroll() {
    if (!scrollRef.current) return;
    setCanScrollLeft(scrollRef.current.scrollLeft > 0);
    setCanScrollRight(scrollRef.current.scrollLeft < scrollRef.current.scrollWidth - scrollRef.current.clientWidth - 10);
  }

  const completedCount = category.videos.filter((v) => (progress[v.id] ?? 0) >= 90).length;

  return (
    <div className="relative">
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <span className="text-lg">{category.icon}</span>
          <div>
            <h3 className="text-base font-bold text-white" style={{ color: category.color }}>{category.label}</h3>
            <p className="text-xs text-muted-foreground">{category.description}</p>
          </div>
          {completedCount > 0 && (
            <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px] ml-2">
              {completedCount}/{category.videos.length} concluídos
            </Badge>
          )}
          {completedCount === category.videos.length && category.videos.length > 0 && (
            <Badge className="bg-[#C9A84C]/20 text-[#C9A84C] border-[#C9A84C]/30 text-[10px] flex items-center gap-1">
              <Award className="w-2.5 h-2.5" /> Certificado disponível
            </Badge>
          )}
        </div>
        <button className="text-xs text-muted-foreground hover:text-white flex items-center gap-1 transition-colors">
          Ver todos <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="relative">
        {canScrollLeft && (
          <button onClick={() => scroll("left")}
            className="absolute left-0 top-0 bottom-6 z-10 w-10 flex items-center justify-center bg-gradient-to-r from-[#060D1A] to-transparent hover:from-[#0F172A] transition-colors">
            <ChevronRight className="w-5 h-5 text-white rotate-180" />
          </button>
        )}
        {canScrollRight && (
          <button onClick={() => scroll("right")}
            className="absolute right-0 top-0 bottom-6 z-10 w-10 flex items-center justify-center bg-gradient-to-l from-[#060D1A] to-transparent hover:from-[#0F172A] transition-colors">
            <ChevronRight className="w-5 h-5 text-white" />
          </button>
        )}
        <div ref={scrollRef} onScroll={onScroll}
          className="flex gap-3 overflow-x-auto pb-2 scrollbar-none"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
          {category.videos.map((video, i) => {
            const locked = !!video.requires?.length && !video.requires.every(reqId => (progress[reqId] ?? 0) >= 90);
            return <VideoCard key={video.id} video={video} onPlay={onPlay} progress={progress[video.id]} index={i} ytId={extractYtId(ytLinks[video.id])} locked={locked} />;
          })}
        </div>
      </div>
    </div>
  );
}

// ── Hero Banner ─────────────────────────────────────────────────────────────
function HeroBanner({ video, onPlay }: { video: Video; onPlay: (v: Video) => void }) {
  return (
    <div className="relative rounded-2xl overflow-hidden mb-8" style={{ aspectRatio: "21/7" }}>
      <div className={`absolute inset-0 bg-gradient-to-br ${video.gradient}`} />
      <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#060D1A] via-transparent to-transparent" />
      <div className="absolute inset-0 overflow-hidden">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="absolute w-1 h-1 rounded-full bg-white/20 animate-pulse"
            style={{ left: `${10 + i * 12}%`, top: `${20 + (i % 3) * 25}%`, animationDelay: `${i * 0.3}s` }} />
        ))}
      </div>
      <div className="absolute inset-0 flex flex-col justify-end px-8 pb-8">
        <div className="max-w-xl">
          <div className="flex items-center gap-2 mb-3">
            <Badge className="bg-red-500/80 text-white border-red-500/50 text-xs">DESTAQUE</Badge>
            <Badge className={LEVEL_COLORS[video.level]}>{video.level}</Badge>
            <span className="text-xs text-white/60 flex items-center gap-1">
              <Clock className="w-3 h-3" />{video.duration}
            </span>
          </div>
          <h2 className="text-2xl md:text-3xl font-bold text-white leading-tight mb-2">{video.title}</h2>
          <p className="text-sm text-white/70 mb-4 line-clamp-2">{video.description}</p>
          <div className="flex items-center gap-3">
            <button
              onClick={() => onPlay(video)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-black font-semibold text-sm hover:bg-white/90 transition-colors shadow-lg"
            >
              <Play className="w-4 h-4" fill="black" /> Assistir Agora
            </button>
            <div className="text-xs text-white/60">
              {video.instructor} · {video.instructorRole}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Academy Client ──────────────────────────────────────────────────────
export function AcademyClient({ initialCategory, userRole, userName, userId, isNew }: { initialCategory?: string; userRole?: string; userName?: string; userId?: string; isNew?: boolean }) {
  const isAdmin = userRole === "ADMIN";
  const [activeTab, setActiveTab] = useState<"content" | "admin" | "ranking">("content");
  const [activeCategory, setActiveCategory] = useState<string>(initialCategory ?? "all");
  const [search, setSearch] = useState("");
  const [playingVideo, setPlayingVideo] = useState<Video | null>(null);
  const [videoProgress, setVideoProgress] = useState<Record<string, number>>({});
  const [ytLinks, setYtLinks] = useState<Record<string, string>>({});
  const [certificates, setCertificates] = useState<Set<string>>(new Set());
  const [certificate, setCertificate] = useState<{ categoryId: string; issuedAt: string } | null>(null);
  const [quizData, setQuizData] = useState<{ categoryId: string; quizPassed: boolean } | null>(null);
  const [quizResults, setQuizResults] = useState<Record<string, { score: number; passed: boolean }>>({});
  const [earnedBadges, setEarnedBadges] = useState<Set<string>>(new Set());
  const [newBadges, setNewBadges] = useState<string[]>([]);
  const [overrides, setOverrides] = useState<Record<string, VideoOverride>>({});
  const saveProgressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load progress, YT links, certificates, quiz results, badges, overrides
  useEffect(() => {
    Promise.all([
      fetch("/api/academy/progress").then((r) => r.json()),
      fetch("/api/academy/yt-links").then((r) => r.json()),
      fetch("/api/academy/certificates").then((r) => r.json()),
      fetch("/api/academy/quiz").then((r) => r.json()),
      fetch("/api/academy/badges").then((r) => r.json()),
      fetch("/api/academy/video-overrides").then((r) => r.json()).catch(() => ({ overrides: [] })),
    ]).then(([pData, lData, cData, qData, bData, oData]) => {
      if (pData.progress) setVideoProgress(pData.progress);
      if (lData.links) setYtLinks(lData.links);
      if (cData.certificates) {
        setCertificates(new Set((cData.certificates as { category_id: string }[]).map((c) => c.category_id)));
      }
      if (qData.results) {
        const map: Record<string, { score: number; passed: boolean }> = {};
        for (const r of qData.results as { category_id: string; score: number; passed: boolean }[]) {
          map[r.category_id] = { score: r.score, passed: r.passed };
        }
        setQuizResults(map);
      }
      if (bData.badges) {
        setEarnedBadges(new Set((bData.badges as { badge_id: string }[]).map((b) => b.badge_id)));
      }
      if (oData.overrides) {
        const map: Record<string, VideoOverride> = {};
        for (const o of oData.overrides as VideoOverride[]) { map[o.video_id] = o; }
        setOverrides(map);
      }
    }).catch(() => {});
  }, []);

  const allVideos = useMemo(() =>
    getAllVideos().map(v => applyOverride(v, overrides[v.id])),
  [overrides]);

  const mergedCategories = useMemo(() =>
    ACADEMY_CATEGORIES.map(cat => ({
      ...cat,
      videos: cat.videos.map(v => applyOverride(v, overrides[v.id])),
    })),
  [overrides]);

  const featuredVideo = allVideos.find((v) => v.featured) ?? allVideos[0];

  const filteredCategories = useMemo(() => {
    if (search) {
      const q = search.toLowerCase();
      return mergedCategories.map((cat) => ({
        ...cat,
        videos: cat.videos.filter((v) =>
          v.title.toLowerCase().includes(q) ||
          v.description.toLowerCase().includes(q) ||
          v.instructor.toLowerCase().includes(q) ||
          v.tags?.some((t) => t.toLowerCase().includes(q))
        ),
      })).filter((cat) => cat.videos.length > 0);
    }
    if (activeCategory === "all") return mergedCategories;
    return mergedCategories.filter((c) => c.id === activeCategory);
  }, [activeCategory, search, mergedCategories]);

  const continueWatching = allVideos.filter((v) => {
    const p = videoProgress[v.id] ?? 0;
    return p > 0 && p < 90;
  });

  const flatVideosInCategory = playingVideo
    ? (mergedCategories.find((c) => c.id === playingVideo.category)?.videos ?? [])
    : [];
  const currentIdx = flatVideosInCategory.findIndex((v) => v.id === playingVideo?.id);

  // Emite certificado após quiz aprovado
  const issueCertificate = useCallback(async (categoryId: string) => {
    const res = await fetch("/api/academy/certificates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category_id: categoryId }),
    });
    const d = await res.json();
    if (d.certificate) {
      setCertificates((prev) => new Set([...prev, categoryId]));
      if (!d.already_had) {
        setCertificate({ categoryId, issuedAt: d.certificate.issued_at });
      }
    }
    // Check and award badges
    const bRes = await fetch("/api/academy/badges", { method: "POST" }).then(r => r.json()).catch(() => ({ awarded: [] }));
    if (bRes.awarded?.length > 0) {
      setEarnedBadges(prev => new Set([...prev, ...bRes.awarded]));
      setNewBadges(bRes.awarded);
      setTimeout(() => setNewBadges([]), 5000);
    }
  }, []);

  // Verifica e emite certificado de categoria (com quiz)
  const checkCertificate = useCallback(async (videoId: string, pct: number) => {
    if (pct < 90) return;
    const video = allVideos.find((v) => v.id === videoId);
    if (!video) return;
    const category = ACADEMY_CATEGORIES.find((c) => c.id === video.category);
    if (!category || certificates.has(category.id)) return;

    // Verifica se todos os vídeos da categoria estão concluídos (incluindo o atual)
    const updatedProgress = { ...videoProgress, [videoId]: pct };
    const allDone = category.videos.every((v) => (updatedProgress[v.id] ?? 0) >= 90);
    if (!allDone) return;

    // Verifica se existe quiz para esta categoria
    const quiz = getQuiz(category.id);
    if (quiz && !quizResults[category.id]?.passed) {
      // Mostra quiz antes do certificado
      setQuizData({ categoryId: category.id, quizPassed: false });
      return;
    }

    // Emite certificado diretamente (sem quiz ou quiz já aprovado)
    await issueCertificate(category.id);
  }, [allVideos, certificates, videoProgress, quizResults, issueCertificate]);

  // Salva progresso com debounce
  function handleProgress(videoId: string, pct: number) {
    setVideoProgress((prev) => ({ ...prev, [videoId]: pct }));
    if (saveProgressTimer.current) clearTimeout(saveProgressTimer.current);
    saveProgressTimer.current = setTimeout(() => {
      fetch("/api/academy/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ video_id: videoId, progress_pct: pct }),
      }).catch(() => {});
      checkCertificate(videoId, pct);
    }, 3000);
  }

  const totalVideos = allVideos.length;
  const completedVideos = allVideos.filter((v) => (videoProgress[v.id] ?? 0) >= 90).length;
  const totalHours = Math.floor(allVideos.reduce((s, v) => s + v.durationSecs, 0) / 3600);

  // Trilha de onboarding — aulas obrigatórias em ordem
  const ONBOARDING_TRAIL = allVideos.filter(v => v.required);
  const trailCompleted = ONBOARDING_TRAIL.filter(v => (videoProgress[v.id] ?? 0) >= 90).length;
  const trailPct = ONBOARDING_TRAIL.length > 0 ? Math.round((trailCompleted / ONBOARDING_TRAIL.length) * 100) : 0;

  // Specialty badge unlock logic: count certs per category label
  const unlockedSpecialtyBadges = useMemo(() => {
    const unlocked = new Set<string>();
    // Count certificates per category label
    const certsByCategory: Record<string, number> = {};
    for (const catId of Array.from(certificates)) {
      const cat = ACADEMY_CATEGORIES.find(c => c.id === catId);
      if (cat) {
        certsByCategory[cat.label] = (certsByCategory[cat.label] ?? 0) + 1;
      }
    }
    // Check specialty badges
    for (const sb of SPECIALTY_BADGE_DEFS) {
      if (sb.category_requirement && sb.courses_required) {
        if ((certsByCategory[sb.category_requirement] ?? 0) >= sb.courses_required) {
          unlocked.add(sb.id);
        }
      } else if (sb.specializations_required) {
        const specializationsCount = SPECIALTY_BADGE_DEFS
          .filter(s => s.category_requirement && s.courses_required)
          .filter(s => unlocked.has(s.id))
          .length;
        if (specializationsCount >= sb.specializations_required) {
          unlocked.add(sb.id);
        }
      }
    }
    return unlocked;
  }, [certificates]);

  // Dados do certificado para exibir
  const certCategory = certificate
    ? ACADEMY_CATEGORIES.find((c) => c.id === certificate.categoryId)
    : null;

  // Category for quiz modal
  const quizCategory = quizData ? ACADEMY_CATEGORIES.find(c => c.id === quizData.categoryId) : null;

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-600 to-pink-600 flex items-center justify-center">
            <GraduationCap className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">V3 Academy</h1>
            <p className="text-xs text-muted-foreground">{totalVideos} videoaulas · {totalHours}h de conteúdo</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-white font-semibold">{totalVideos}</span> aulas
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-white font-semibold">{completedVideos}</span> concluídas
            </div>
            <div className="flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5 text-orange-400" />
              <span className="text-white font-semibold">{continueWatching.length}</span> em progresso
            </div>
            {certificates.size > 0 && (
              <div className="flex items-center gap-1.5">
                <Award className="w-3.5 h-3.5 text-[#C9A84C]" />
                <span className="text-white font-semibold">{certificates.size}</span> certificados
              </div>
            )}
          </div>
          <button
            onClick={() => setActiveTab(activeTab === "ranking" ? "content" : "ranking")}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
              activeTab === "ranking"
                ? "bg-[#C9A84C]/15 border-[#C9A84C]/40 text-[#C9A84C]"
                : "border-border text-muted-foreground hover:text-white hover:bg-secondary"
            }`}
          >
            <Trophy className="w-3.5 h-3.5" />
            Ranking
          </button>
          {isAdmin && (
            <button
              onClick={() => setActiveTab(activeTab === "admin" ? "content" : "admin")}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                activeTab === "admin"
                  ? "bg-amber-500/15 border-amber-500/40 text-amber-400"
                  : "border-border text-muted-foreground hover:text-white hover:bg-secondary"
              }`}
            >
              <Settings className="w-3.5 h-3.5" />
              Administração
            </button>
          )}
        </div>
      </div>

      {/* New badge notification */}
      {newBadges.length > 0 && (
        <div className="fixed bottom-6 right-6 z-[100] space-y-2">
          {newBadges.map(badgeId => {
            const def = BADGE_DEFS.find(b => b.id === badgeId);
            if (!def) return null;
            return (
              <div key={badgeId} className={`flex items-center gap-3 px-4 py-3 rounded-xl border bg-gradient-to-r ${RARITY_COLORS[def.rarity]} shadow-2xl animate-bounce`}>
                <span className="text-2xl">{def.icon}</span>
                <div>
                  <p className="text-xs font-bold">Badge desbloqueada!</p>
                  <p className="text-xs opacity-80">{def.label} — {def.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Admin Panel */}
      {isAdmin && activeTab === "admin" && (
        <AcademyAdmin ytLinks={ytLinks} onLinksChange={setYtLinks} />
      )}

      {/* Ranking Panel */}
      {activeTab === "ranking" && (
        <AcademyRanking />
      )}

      {/* Content */}
      {activeTab === "content" && <>
        {/* Live Classes */}
        {!search && <LiveClasses />}

        {/* Welcome Onboarding Trail */}
        {!search && <OnboardingTrail isNew={isNew ?? false} />}

        <div className="relative mb-5">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar videoaulas, instrutores, temas..."
            className="w-full h-10 pl-10 pr-4 text-sm bg-secondary border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
          />
        </div>

        {/* Onboarding Trail */}
        {!search && trailPct < 100 && ONBOARDING_TRAIL.length > 0 && (
          <div className="mb-5 p-4 rounded-xl border border-[#C9A84C]/30 bg-gradient-to-r from-[#C9A84C]/5 to-transparent">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-[#C9A84C]" />
                <span className="text-sm font-bold text-white">Trilha de Onboarding</span>
                <span className="text-xs text-muted-foreground">— {trailCompleted}/{ONBOARDING_TRAIL.length} aulas obrigatórias</span>
              </div>
              <span className="text-xs font-bold text-[#C9A84C]">{trailPct}%</span>
            </div>
            <div className="h-2 bg-[#243A66] rounded-full overflow-hidden mb-3">
              <div className="h-full bg-[#C9A84C] rounded-full transition-all" style={{ width: `${trailPct}%` }} />
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none" style={{ scrollbarWidth: "none" }}>
              {ONBOARDING_TRAIL.map((v, i) => {
                const done = (videoProgress[v.id] ?? 0) >= 90;
                const isCurrent = !done && ONBOARDING_TRAIL.slice(0, i).every(pv => (videoProgress[pv.id] ?? 0) >= 90);
                return (
                  <button
                    key={v.id}
                    onClick={() => setPlayingVideo(v)}
                    className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition-all ${
                      done ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" :
                      isCurrent ? "border-[#C9A84C]/50 bg-[#C9A84C]/10 text-[#C9A84C] font-semibold" :
                      "border-[#243A66] text-muted-foreground"
                    }`}
                  >
                    {done ? <CheckCircle2 className="w-3 h-3" /> : isCurrent ? <Play className="w-3 h-3" fill="currentColor" /> : <Clock className="w-3 h-3" />}
                    {v.title.length > 25 ? v.title.slice(0, 25) + "…" : v.title}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Badges earned */}
        {(earnedBadges.size > 0 || unlockedSpecialtyBadges.size > 0) && !search && (
          <div className="mb-5 p-4 rounded-xl border border-[#243A66] bg-[#0D1929]">
            <div className="flex items-center gap-2 mb-3">
              <Trophy className="w-4 h-4 text-[#C9A84C]" />
              <span className="text-sm font-bold text-white">Minhas Conquistas</span>
              <span className="text-xs text-muted-foreground">({earnedBadges.size + unlockedSpecialtyBadges.size} badges)</span>
            </div>
            <div className="flex gap-2 flex-wrap">
              {BADGE_DEFS.filter(b => earnedBadges.has(b.id) && !SPECIALTY_BADGE_DEFS.find(s => s.id === b.id)).map(b => (
                <div key={b.id} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border bg-gradient-to-r text-xs ${RARITY_COLORS[b.rarity]}`} title={b.description}>
                  <span>{b.icon}</span>
                  <span className="font-semibold">{b.label}</span>
                </div>
              ))}
              {SPECIALTY_BADGE_DEFS.map(sb => {
                const isUnlocked = unlockedSpecialtyBadges.has(sb.id);
                return (
                  <div
                    key={sb.id}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border bg-gradient-to-r text-xs transition-all ${
                      isUnlocked
                        ? `${RARITY_COLORS[sb.rarity]} shadow-[0_0_12px_rgba(201,168,76,0.3)]`
                        : "border-[#243A66] bg-[#111F35] text-[#7A8FA8] opacity-50"
                    }`}
                    title={sb.description}
                  >
                    <span>{sb.icon}</span>
                    <div className="flex flex-col leading-none gap-0.5">
                      {isUnlocked && (
                        <span className="text-[7px] font-black tracking-widest text-[#C9A84C] uppercase">
                          ESPECIALIZAÇÃO
                        </span>
                      )}
                      <span className="font-semibold">{sb.label}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {!search && (
          <div className="flex gap-1.5 overflow-x-auto pb-1 mb-6 scrollbar-none" style={{ scrollbarWidth: "none" }}>
            <button
              onClick={() => setActiveCategory("all")}
              className={`flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${activeCategory === "all" ? "bg-white text-black" : "bg-secondary text-muted-foreground hover:text-white border border-border"}`}
            >
              Todos
            </button>
            {ACADEMY_CATEGORIES.map((cat) => (
              <button key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`flex-shrink-0 flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold transition-all border ${
                  activeCategory === cat.id ? "text-white border-current" : "bg-secondary text-muted-foreground hover:text-white border-border"
                }`}
                style={activeCategory === cat.id ? { background: `${cat.color}25`, borderColor: `${cat.color}60`, color: cat.color } : {}}>
                <span>{cat.icon}</span>{cat.label}
                {certificates.has(cat.id) && <Award className="w-3 h-3 text-[#C9A84C]" />}
              </button>
            ))}
          </div>
        )}

        {activeCategory === "all" && !search && (
          <HeroBanner video={featuredVideo} onPlay={setPlayingVideo} />
        )}

        {continueWatching.length > 0 && !search && (
          <div className="mb-8">
            <CategoryRow
              category={{ id: "continue", label: "Continuar Assistindo", description: "Retome de onde parou", icon: "▶️", color: "#F97316", videos: continueWatching }}
              onPlay={setPlayingVideo}
              progress={videoProgress}
              ytLinks={ytLinks}
            />
          </div>
        )}

        <div className="space-y-8">
          {filteredCategories.map((category) => (
            <CategoryRow key={category.id} category={category} onPlay={setPlayingVideo} progress={videoProgress} ytLinks={ytLinks} />
          ))}
        </div>

        {filteredCategories.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Search className="w-10 h-10 text-muted-foreground" />
            <p className="text-muted-foreground text-sm">Nenhuma aula encontrada para &quot;{search}&quot;</p>
          </div>
        )}
      </>}

      {/* Video Player */}
      {playingVideo && (
        <VideoPlayer
          video={playingVideo}
          onClose={() => setPlayingVideo(null)}
          onNext={currentIdx < flatVideosInCategory.length - 1 ? () => setPlayingVideo(flatVideosInCategory[currentIdx + 1]) : undefined}
          onPrev={currentIdx > 0 ? () => setPlayingVideo(flatVideosInCategory[currentIdx - 1]) : undefined}
          hasNext={currentIdx < flatVideosInCategory.length - 1}
          hasPrev={currentIdx > 0}
          onProgress={handleProgress}
          savedProgress={playingVideo ? Math.round((videoProgress[playingVideo.id] ?? 0) / 100 * playingVideo.durationSecs) : 0}
          youtubeUrl={ytLinks[playingVideo.id]}
        />
      )}

      {/* Quiz modal */}
      {quizData && quizCategory && getQuiz(quizData.categoryId) && (
        <AcademyQuiz
          quiz={getQuiz(quizData.categoryId)!}
          categoryLabel={quizCategory.label}
          categoryIcon={quizCategory.icon}
          previousScore={quizResults[quizData.categoryId]?.score}
          onPass={async () => {
            setQuizResults(prev => ({ ...prev, [quizData.categoryId]: { score: 100, passed: true } }));
            setQuizData(null);
            await issueCertificate(quizData.categoryId);
          }}
          onClose={() => setQuizData(null)}
        />
      )}

      {/* Certificate modal */}
      {certificate && certCategory && (
        <AcademyCertificate
          partnerName={userName || "Partner"}
          categoryLabel={certCategory.label}
          categoryIcon={certCategory.icon}
          issuedAt={certificate.issuedAt}
          onClose={() => setCertificate(null)}
        />
      )}
    </div>
  );
}
