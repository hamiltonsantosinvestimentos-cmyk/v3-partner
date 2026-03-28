"use client";

import React, { useState, useEffect } from "react";
import {
  Video, Save, CheckCircle2, AlertCircle, Search,
  ExternalLink, Trash2, Link2, Info,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ACADEMY_CATEGORIES, getAllVideos, type Video } from "@/lib/academy-data";

const LS_KEY = "v3_academy_yt_links";

function extractYoutubeId(url: string): string | null {
  if (!url.trim()) return null;
  // youtu.be/ID
  const short = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
  if (short) return short[1];
  // youtube.com/watch?v=ID
  const watch = url.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
  if (watch) return watch[1];
  // youtube.com/embed/ID
  const embed = url.match(/embed\/([a-zA-Z0-9_-]{11})/);
  if (embed) return embed[1];
  // just an ID (11 chars)
  if (/^[a-zA-Z0-9_-]{11}$/.test(url.trim())) return url.trim();
  return null;
}

export function loadYtLinks(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function saveYtLinks(links: Record<string, string>) {
  localStorage.setItem(LS_KEY, JSON.stringify(links));
}

interface RowProps {
  video: Video;
  savedUrl: string;
  onSave: (videoId: string, url: string) => void;
  onDelete: (videoId: string) => void;
}

function VideoRow({ video, savedUrl, onSave, onDelete }: RowProps) {
  const [url, setUrl] = useState(savedUrl);
  const [saved, setSaved] = useState(false);

  useEffect(() => { setUrl(savedUrl); }, [savedUrl]);

  const ytId = extractYoutubeId(url);
  const isValid = !!ytId;
  const isDirty = url !== savedUrl;

  function handleSave() {
    if (!isValid && url.trim()) return;
    onSave(video.id, url.trim());
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
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
        </div>
        <p className="text-xs text-muted-foreground mb-3">{video.instructor} · {video.duration}</p>

        {/* URL input */}
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

          {/* Validate indicator */}
          {url.trim() && (
            <div className="flex-shrink-0">
              {isValid
                ? <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                : <AlertCircle className="w-4 h-4 text-red-400" />
              }
            </div>
          )}

          {/* Open in YouTube */}
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

          {/* Delete */}
          {savedUrl && (
            <button
              onClick={() => { setUrl(""); onDelete(video.id); }}
              className="flex-shrink-0 w-9 h-9 rounded-lg border border-red-500/30 flex items-center justify-center text-red-400 hover:bg-red-500/10 transition-colors"
              title="Remover link"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}

          {/* Save */}
          <Button
            size="sm"
            onClick={handleSave}
            disabled={(!isDirty && !!savedUrl) || (!!url.trim() && !isValid)}
            className={`flex-shrink-0 ${saved ? "bg-emerald-600 hover:bg-emerald-600" : ""}`}
          >
            {saved ? (
              <><CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Salvo!</>
            ) : (
              <><Save className="w-3.5 h-3.5 mr-1" /> Salvar</>
            )}
          </Button>
        </div>

        {/* Validation feedback */}
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
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("all");
  const [saveAll, setSaveAll] = useState(false);

  const allVideos = getAllVideos();
  const linkedCount = Object.values(ytLinks).filter(Boolean).length;

  const filtered = allVideos.filter((v) => {
    const matchSearch = !search ||
      v.title.toLowerCase().includes(search.toLowerCase()) ||
      v.instructor.toLowerCase().includes(search.toLowerCase());
    const matchCat = filterCat === "all" || v.category === filterCat;
    return matchSearch && matchCat;
  });

  function handleSave(videoId: string, url: string) {
    const updated = { ...ytLinks };
    if (url) {
      updated[videoId] = url;
    } else {
      delete updated[videoId];
    }
    saveYtLinks(updated);
    onLinksChange(updated);
  }

  function handleDelete(videoId: string) {
    const updated = { ...ytLinks };
    delete updated[videoId];
    saveYtLinks(updated);
    onLinksChange(updated);
  }

  function handleSaveAll() {
    saveYtLinks(ytLinks);
    setSaveAll(true);
    setTimeout(() => setSaveAll(false), 2000);
  }

  return (
    <div className="space-y-5">
      {/* Admin header */}
      <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 flex items-start gap-3">
        <Info className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-sm font-semibold text-amber-400 mb-1">Painel de Administração — V3 Academy</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Cole os links do YouTube para cada videoaula. Os vídeos serão exibidos diretamente na plataforma para todos os usuários.
            Links salvos ficam armazenados localmente. Em produção, utilize o banco de dados Supabase.
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
        <div className="text-center py-12 text-muted-foreground text-sm">
          Nenhuma aula encontrada.
        </div>
      )}
    </div>
  );
}
