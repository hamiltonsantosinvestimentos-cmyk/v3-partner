"use client";

import React, { useState, useEffect } from "react";
import {
  Video, Save, CheckCircle2, AlertCircle, Search,
  ExternalLink, Trash2, Link2, Info, Trophy, Loader2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ACADEMY_CATEGORIES, getAllVideos, type Video as VideoType } from "@/lib/academy-data";
import { AcademyRanking } from "./academy-ranking";

// Mantida para compatibilidade — academy-client carrega links pela API agora
export function loadYtLinks(): Record<string, string> { return {}; }

function extractYoutubeId(url: string): string | null {
  if (!url.trim()) return null;
  const short = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
  if (short) return short[1];
  const watch = url.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
  if (watch) return watch[1];
  const embed = url.match(/embed\/([a-zA-Z0-9_-]{11})/);
  if (embed) return embed[1];
  if (/^[a-zA-Z0-9_-]{11}$/.test(url.trim())) return url.trim();
  return null;
}

interface RowProps {
  video: VideoType;
  savedUrl: string;
  onSave: (videoId: string, url: string, isNew: boolean) => Promise<void>;
  onDelete: (videoId: string) => Promise<void>;
}

function VideoRow({ video, savedUrl, onSave, onDelete }: RowProps) {
  const [url, setUrl] = useState(savedUrl);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => { setUrl(savedUrl); }, [savedUrl]);

  const ytId = extractYoutubeId(url);
  const isValid = !!ytId;
  const isDirty = url !== savedUrl;

  async function handleSave() {
    if (!isValid && url.trim()) return;
    setSaving(true);
    await onSave(video.id, url.trim(), !savedUrl && !!url.trim());
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function handleDelete() {
    setDeleting(true);
    setUrl("");
    await onDelete(video.id);
    setDeleting(false);
  }

  return (
    <div className="flex items-start gap-4 p-4 rounded-xl border border-border bg-secondary/20 hover:bg-secondary/40 transition-colors">
      {/* Thumbnail */}
      <div className={`w-24 h-14 rounded-lg bg-gradient-to-br ${video.gradient} flex-shrink-0 flex items-center justify-center overflow-hidden`}>
        {ytId ? (
          <img
            src={`https://img.youtube.com/vi/${ytId}/mqdefault.jpg`}
            alt={video.title}
            className="w-full h-full object-cover"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        ) : (
          <Video className="w-6 h-6 text-white/60" />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className="text-sm font-semibold text-white truncate">{video.title}</span>
          <Badge className={`text-[10px] px-1.5 py-0 ${
            video.level === "Iniciante" ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" :
            video.level === "Intermediário" ? "bg-amber-500/20 text-amber-400 border-amber-500/30" :
            "bg-red-500/20 text-red-400 border-red-500/30"
          }`}>{video.level}</Badge>
          {video.required && (
            <Badge className="text-[10px] px-1.5 py-0 bg-[#C9A84C]/20 text-[#C9A84C] border-[#C9A84C]/30">
              Obrigatório
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground mb-3">{video.instructor} · {video.duration}</p>

        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-red-500" />
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Cole aqui o link do YouTube (ex: https://youtu.be/...)"
              className={`w-full h-9 pl-9 pr-4 text-sm bg-card border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 transition-colors ${
                url && !isValid ? "border-red-500/50 focus:ring-red-500/30" :
                isValid ? "border-emerald-500/40 focus:ring-emerald-500/30" :
                "border-border focus:ring-primary/50"
              }`}
            />
          </div>

          {url.trim() && (
            <div className="flex-shrink-0">
              {isValid ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertCircle className="w-4 h-4 text-red-400" />}
            </div>
          )}

          {ytId && (
            <a
              href={`https://www.youtube.com/watch?v=${ytId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-shrink-0 w-9 h-9 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:text-white hover:border-white/30 transition-colors"
              title="Abrir no YouTube"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          )}

          {savedUrl && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex-shrink-0 w-9 h-9 rounded-lg border border-red-500/30 flex items-center justify-center text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
              title="Remover link"
            >
              {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            </button>
          )}

          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving || (!isDirty && !!savedUrl) || (!!url.trim() && !isValid)}
            className={`flex-shrink-0 ${saved ? "bg-emerald-600 hover:bg-emerald-600" : ""}`}
          >
            {saving ? (
              <><Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> Salvando...</>
            ) : saved ? (
              <><CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Salvo!</>
            ) : (
              <><Save className="w-3.5 h-3.5 mr-1" /> Salvar</>
            )}
          </Button>
        </div>

        {url.trim() && !isValid && (
          <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" /> Link inválido. Use um URL do YouTube válido.
          </p>
        )}
        {isValid && ytId && (
          <p className="text-xs text-emerald-400 mt-1 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> ID do vídeo: <span className="font-mono">{ytId}</span>
          </p>
        )}
      </div>
    </div>
  );
}

interface AcademyAdminProps {
  ytLinks: Record<string, string>;
  onLinksChange: (links: Record<string, string>) => void;
}

export function AcademyAdmin({ ytLinks, onLinksChange }: AcademyAdminProps) {
  const [tab, setTab] = useState<"links" | "ranking">("links");
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("all");

  const allVideos = getAllVideos();
  const linkedCount = Object.values(ytLinks).filter(Boolean).length;

  const filtered = allVideos.filter((v) => {
    const matchSearch = !search ||
      v.title.toLowerCase().includes(search.toLowerCase()) ||
      v.instructor.toLowerCase().includes(search.toLowerCase());
    const matchCat = filterCat === "all" || v.category === filterCat;
    return matchSearch && matchCat;
  });

  async function handleSave(videoId: string, url: string, isNew: boolean) {
    const video = allVideos.find((v) => v.id === videoId);
    await fetch("/api/academy/yt-links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ video_id: videoId, url, video_title: video?.title, is_new: isNew }),
    });
    const updated = { ...ytLinks };
    if (url) updated[videoId] = url;
    else delete updated[videoId];
    onLinksChange(updated);
  }

  async function handleDelete(videoId: string) {
    await fetch("/api/academy/yt-links", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ video_id: videoId }),
    });
    const updated = { ...ytLinks };
    delete updated[videoId];
    onLinksChange(updated);
  }

  return (
    <div className="space-y-5">
      {/* Sub-tabs */}
      <div className="flex items-center gap-1 bg-[#0D1929] border border-[#243A66] rounded-xl p-1 w-fit">
        {([
          { key: "links", label: "Links YouTube", icon: <Link2 className="w-3.5 h-3.5" /> },
          { key: "ranking", label: "Ranking Engajamento", icon: <Trophy className="w-3.5 h-3.5" /> },
        ] as const).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              tab === t.key ? "bg-[#C9A84C] text-[#09081A]" : "text-[#7A8FA8] hover:text-[#F0ECE4]"
            }`}
          >
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {tab === "ranking" && <AcademyRanking />}

      {tab === "links" && <>
        {/* Info banner */}
        <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 flex items-start gap-3">
          <Info className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-400 mb-1">Gerenciar Links YouTube</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Os links são salvos no banco de dados e ficam disponíveis para todos os partners imediatamente.
              Ao adicionar um novo link, uma notificação é enviada automaticamente para os partners.
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="p-3 rounded-xl bg-secondary/40 border border-border text-center">
            <p className="text-2xl font-bold text-white">{allVideos.length}</p>
            <p className="text-xs text-muted-foreground">Total de aulas</p>
          </div>
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center">
            <p className="text-2xl font-bold text-emerald-400">{linkedCount}</p>
            <p className="text-xs text-muted-foreground">Com link YouTube</p>
          </div>
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-center">
            <p className="text-2xl font-bold text-amber-400">{allVideos.length - linkedCount}</p>
            <p className="text-xs text-muted-foreground">Sem link</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-2 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por título ou instrutor..."
              className="w-full h-9 pl-9 pr-4 text-sm bg-secondary border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
            />
          </div>
          <select
            value={filterCat}
            onChange={(e) => setFilterCat(e.target.value)}
            className="h-9 px-3 text-sm bg-secondary border border-border rounded-lg text-foreground focus:outline-none"
          >
            <option value="all">Todas as categorias</option>
            {ACADEMY_CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>{c.icon} {c.label}</option>
            ))}
          </select>
        </div>

        {/* Video list grouped by category */}
        <div className="space-y-6">
          {ACADEMY_CATEGORIES.filter((cat) => filterCat === "all" || cat.id === filterCat).map((cat) => {
            const catVideos = filtered.filter((v) => v.category === cat.id);
            if (catVideos.length === 0) return null;
            const catLinked = catVideos.filter((v) => !!ytLinks[v.id]).length;
            return (
              <div key={cat.id}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-base">{cat.icon}</span>
                  <h3 className="text-sm font-bold text-white">{cat.label}</h3>
                  <Badge className={`text-[10px] ${catLinked === catVideos.length ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : "bg-secondary text-muted-foreground border-border"}`}>
                    {catLinked}/{catVideos.length}
                  </Badge>
                </div>
                <div className="space-y-2">
                  {catVideos.map((video) => (
                    <VideoRow
                      key={video.id}
                      video={video}
                      savedUrl={ytLinks[video.id] ?? ""}
                      onSave={handleSave}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-12 text-muted-foreground text-sm">Nenhuma aula encontrada.</div>
        )}
      </>}
    </div>
  );
}
