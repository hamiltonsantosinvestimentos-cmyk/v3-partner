"use client";

import React, { useState, useMemo, useEffect } from "react";
import { Play, Search, GraduationCap, Clock, ChevronRight, CheckCircle2, BookOpen, Flame, Star, Settings } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { VideoPlayer } from "./video-player";
import { AcademyAdmin, loadYtLinks } from "./academy-admin";
import { ACADEMY_CATEGORIES, getAllVideos, type Video, type VideoCategory } from "@/lib/academy-data";

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
function VideoCard({ video, onPlay, progress, index, ytId }: {
  video: Video; onPlay: (v: Video) => void; progress?: number; index: number; ytId?: string;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      className="relative flex-shrink-0 cursor-pointer group"
      style={{ width: 220, animationDelay: `${index * 0.05}s` }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => onPlay(video)}
    >
      {/* Thumbnail */}
      <div className={`relative rounded-xl overflow-hidden transition-all duration-300 ${hovered ? "scale-105 shadow-2xl ring-2 ring-white/20" : ""}`}
        style={{ aspectRatio: "16/9" }}>
        <div className={`absolute inset-0 bg-gradient-to-br ${video.gradient}`} />
        {/* YouTube thumbnail overlay */}
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

        {/* Duration badge */}
        <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/70 text-[10px] text-white font-mono">
          {video.duration}
        </div>

        {/* Progress bar */}
        {progress && progress > 0 && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
            <div className="h-full bg-red-500 transition-all" style={{ width: `${progress}%` }} />
          </div>
        )}

        {/* Completed badge */}
        {progress === 100 && (
          <div className="absolute top-2 right-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 drop-shadow" />
          </div>
        )}

        {/* Hover overlay */}
        {hovered && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 transition-all">
            <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center mb-2 shadow-lg">
              <Play className="w-5 h-5 text-black ml-0.5" fill="black" />
            </div>
            <p className="text-white text-xs font-semibold">Assistir</p>
          </div>
        )}
      </div>

      {/* Info */}
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
    const amount = 460;
    scrollRef.current.scrollBy({ left: dir === "left" ? -amount : amount, behavior: "smooth" });
  }

  function onScroll() {
    if (!scrollRef.current) return;
    setCanScrollLeft(scrollRef.current.scrollLeft > 0);
    setCanScrollRight(scrollRef.current.scrollLeft < scrollRef.current.scrollWidth - scrollRef.current.clientWidth - 10);
  }

  const completedCount = category.videos.filter((v) => (progress[v.id] ?? 0) >= 90).length;

  return (
    <div className="relative">
      {/* Row header */}
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
        </div>
        <button className="text-xs text-muted-foreground hover:text-white flex items-center gap-1 transition-colors">
          Ver todos <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Scroll container */}
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
          {category.videos.map((video, i) => (
            <VideoCard key={video.id} video={video} onPlay={onPlay} progress={progress[video.id]} index={i} ytId={extractYtId(ytLinks[video.id])} />
          ))}
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

      {/* Animated particles */}
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
export function AcademyClient({ initialCategory, userRole }: { initialCategory?: string; userRole?: string }) {
  const isAdmin = userRole === "ADMIN";
  const [activeTab, setActiveTab] = useState<"content" | "admin">("content");
  const [activeCategory, setActiveCategory] = useState<string>(initialCategory ?? "all");
  const [search, setSearch] = useState("");
  const [playingVideo, setPlayingVideo] = useState<Video | null>(null);
  const [videoProgress, setVideoProgress] = useState<Record<string, number>>({});
  const [ytLinks, setYtLinks] = useState<Record<string, string>>({});

  useEffect(() => {
    setYtLinks(loadYtLinks());
  }, []);

  const allVideos = getAllVideos();
  const featuredVideo = allVideos.find((v) => v.featured) ?? allVideos[0];

  const filteredCategories = useMemo(() => {
    if (search) {
      const q = search.toLowerCase();
      return ACADEMY_CATEGORIES.map((cat) => ({
        ...cat,
        videos: cat.videos.filter((v) =>
          v.title.toLowerCase().includes(q) ||
          v.description.toLowerCase().includes(q) ||
          v.instructor.toLowerCase().includes(q) ||
          v.tags?.some((t) => t.toLowerCase().includes(q))
        ),
      })).filter((cat) => cat.videos.length > 0);
    }
    if (activeCategory === "all") return ACADEMY_CATEGORIES;
    return ACADEMY_CATEGORIES.filter((c) => c.id === activeCategory);
  }, [activeCategory, search]);

  const continueWatching = allVideos.filter((v) => {
    const p = videoProgress[v.id] ?? 0;
    return p > 0 && p < 90;
  });

  // Find adjacent videos for player nav
  const flatVideosInCategory = playingVideo
    ? (ACADEMY_CATEGORIES.find((c) => c.id === playingVideo.category)?.videos ?? [])
    : [];
  const currentIdx = flatVideosInCategory.findIndex((v) => v.id === playingVideo?.id);

  function handleProgress(videoId: string, pct: number) {
    setVideoProgress((prev) => ({ ...prev, [videoId]: pct }));
  }

  const totalVideos = allVideos.length;
  const completedVideos = allVideos.filter((v) => (videoProgress[v.id] ?? 0) >= 90).length;
  const totalHours = Math.floor(allVideos.reduce((s, v) => s + v.durationSecs, 0) / 3600);

  return (
    <div className="animate-fade-in">
      {/* Header */}
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
          {/* Stats */}
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
          </div>
          {/* Admin tab button */}
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

      {/* Admin Panel */}
      {isAdmin && activeTab === "admin" && (
        <AcademyAdmin ytLinks={ytLinks} onLinksChange={setYtLinks} />
      )}

      {/* Content — hidden when admin tab is active */}
      {activeTab === "content" && <>

      {/* Search */}
      <div className="relative mb-5">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar videoaulas, instrutores, temas..."
          className="w-full h-10 pl-10 pr-4 text-sm bg-secondary border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
        />
      </div>

      {/* Category Tabs */}
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
                activeCategory === cat.id
                  ? "text-white border-current"
                  : "bg-secondary text-muted-foreground hover:text-white border-border"
              }`}
              style={activeCategory === cat.id ? { background: `${cat.color}25`, borderColor: `${cat.color}60`, color: cat.color } : {}}>
              <span>{cat.icon}</span>{cat.label}
            </button>
          ))}
        </div>
      )}

      {/* Hero Banner — only on "all" without search */}
      {activeCategory === "all" && !search && (
        <HeroBanner video={featuredVideo} onPlay={setPlayingVideo} />
      )}

      {/* Continue Watching */}
      {continueWatching.length > 0 && !search && (
        <div className="mb-8">
          <CategoryRow
            category={{
              id: "continue",
              label: "Continuar Assistindo",
              description: "Retome de onde parou",
              icon: "▶️",
              color: "#F97316",
              videos: continueWatching,
            }}
            onPlay={setPlayingVideo}
            progress={videoProgress}
            ytLinks={ytLinks}
          />
        </div>
      )}

      {/* Category Rows */}
      <div className="space-y-8">
        {filteredCategories.map((category) => (
          <CategoryRow
            key={category.id}
            category={category}
            onPlay={setPlayingVideo}
            progress={videoProgress}
            ytLinks={ytLinks}
          />
        ))}
      </div>

      {/* No results */}
      {filteredCategories.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Search className="w-10 h-10 text-muted-foreground" />
          <p className="text-muted-foreground text-sm">Nenhuma aula encontrada para "{search}"</p>
        </div>
      )}

      </>}

      {/* Video Player — always rendered outside content fragment */}
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
    </div>
  );
}
