"use client";

import React, { useState, useEffect } from "react";
import {
  Video, Save, CheckCircle2, AlertCircle, Search,
  ExternalLink, Trash2, Link2, Info, Trophy, Loader2, BarChart2, Upload, X, Edit3,
  Radio, Calendar, Users, Plus, Rocket,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ACADEMY_CATEGORIES, getAllVideos, type Video as VideoType, type VideoCategory } from "@/lib/academy-data";
import { AcademyRanking } from "./academy-ranking";
import { AcademyAnalytics } from "./academy-analytics";
import { AcademyVideoEdit } from "./academy-video-edit";

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
  onEdit?: () => void;
  hasOverride?: boolean;
}

function VideoRow({ video, savedUrl, onSave, onDelete, onEdit, hasOverride }: RowProps) {
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

          {onEdit && (
            <button
              onClick={onEdit}
              className={`flex-shrink-0 w-9 h-9 rounded-lg border flex items-center justify-center transition-colors ${
                hasOverride
                  ? "border-[#C9A84C]/50 text-[#C9A84C] bg-[#C9A84C]/10 hover:bg-[#C9A84C]/20"
                  : "border-[#243A66] text-[#7A8FA8] hover:text-[#F0ECE4] hover:border-[#3A5070]"
              }`}
              title="Editar metadados do vídeo"
            >
              <Edit3 className="w-4 h-4" />
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

interface CategoryRowProps {
  category: VideoCategory;
  override?: { label?: string; description?: string; icon?: string; color?: string; hidden?: boolean };
  onSave: (data: { label?: string; description?: string; icon?: string; color?: string; hidden?: boolean }) => Promise<void>;
  onReset: () => Promise<void>;
}

function CategoryRow({ category, override, onSave, onReset }: CategoryRowProps) {
  const effective = {
    label: override?.label ?? category.label,
    description: override?.description ?? category.description,
    icon: override?.icon ?? category.icon,
    color: override?.color ?? category.color,
  };
  const isHidden = !!override?.hidden;

  const [label, setLabel] = useState(effective.label);
  const [description, setDescription] = useState(effective.description);
  const [icon, setIcon] = useState(effective.icon);
  const [color, setColor] = useState(effective.color);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const isDirty = label !== effective.label || description !== effective.description || icon !== effective.icon || color !== effective.color;
  const hasOverride = !!override && (override.label !== undefined || override.description !== undefined || override.icon !== undefined || override.color !== undefined);

  async function handleSave() {
    setSaving(true);
    await onSave({ label, description, icon, color });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function handleToggleHidden() {
    setSaving(true);
    await onSave({ label, description, icon, color, hidden: !isHidden });
    setSaving(false);
  }

  return (
    <div className={`p-4 rounded-xl border ${isHidden ? "border-border/40 bg-secondary/10 opacity-60" : "border-border bg-secondary/20"}`}>
      <div className="flex items-start gap-3">
        <input
          value={icon}
          onChange={(e) => setIcon(e.target.value)}
          className="w-12 h-12 text-2xl text-center rounded-lg bg-secondary border border-border flex-shrink-0"
          maxLength={4}
        />
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-center gap-2">
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="flex-1 h-8 px-2.5 text-sm font-semibold bg-secondary border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-[#C9A84C]/50"
              placeholder="Nome do tema"
            />
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="w-8 h-8 rounded-lg border border-border bg-secondary cursor-pointer"
              title="Cor do tema"
            />
            {isHidden && <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-[10px]">Oculto</Badge>}
          </div>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="w-full px-2.5 py-1.5 text-xs bg-secondary border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[#C9A84C]/50 resize-none"
            placeholder="Descrição do tema"
          />
          <p className="text-[10px] text-muted-foreground">{category.videos.length} aula(s) neste tema</p>
        </div>
        <div className="flex flex-col gap-1.5 flex-shrink-0">
          <Button size="sm" onClick={handleSave} disabled={!isDirty || saving} className="gap-1.5 h-8">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : saved ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
            {saved ? "Salvo" : "Salvar"}
          </Button>
          <Button size="sm" variant="outline" onClick={handleToggleHidden} disabled={saving}
            className={isHidden ? "gap-1.5 h-8 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10" : "gap-1.5 h-8 border-red-500/40 text-red-400 hover:bg-red-500/10"}>
            {isHidden ? "Restaurar" : <><Trash2 className="w-3.5 h-3.5" /> Ocultar</>}
          </Button>
          {hasOverride && (
            <button onClick={onReset} className="text-[10px] text-muted-foreground hover:text-foreground transition-colors underline">
              Restaurar padrão
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

interface TrailStepRowProps {
  step: { id: number; title: string; duration: string; desc: string };
  override?: OnboardingOverride;
  saving: boolean;
  onSave: (data: Partial<OnboardingOverride>) => Promise<void>;
}

function TrailStepRow({ step, override, saving, onSave }: TrailStepRowProps) {
  const [title, setTitle] = useState(override?.title ?? step.title);
  const [description, setDescription] = useState(override?.description ?? step.desc);
  const [duration, setDuration] = useState(override?.duration ?? step.duration);
  const [videoUrl, setVideoUrl] = useState(override?.video_url ?? "");

  return (
    <div className="p-4 rounded-xl border border-border bg-secondary/30 space-y-3">
      <div className="flex items-center gap-2">
        <span className="w-6 h-6 rounded-full bg-[#C9A84C]/20 text-[#C9A84C] text-[10px] font-black flex items-center justify-center flex-shrink-0">
          {step.id + 1}
        </span>
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Passo {step.id + 1}</p>
        {videoUrl && (
          <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> Aula vinculada
          </span>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <input value={title} onChange={e => setTitle(e.target.value)}
          placeholder="Título"
          className="h-9 px-3 text-sm bg-secondary border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-[#C9A84C]/50" />
        <input value={duration} onChange={e => setDuration(e.target.value)}
          placeholder="Duração (ex: 5 min)"
          className="h-9 px-3 text-sm bg-secondary border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-[#C9A84C]/50" />
        <textarea value={description} onChange={e => setDescription(e.target.value)}
          placeholder="Descrição" rows={2}
          className="md:col-span-2 px-3 py-2 text-sm bg-secondary border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-[#C9A84C]/50 resize-none" />
        <input value={videoUrl} onChange={e => setVideoUrl(e.target.value)}
          placeholder="Link do YouTube desta aula"
          className="md:col-span-2 h-9 px-3 text-sm bg-secondary border border-[#C9A84C]/40 rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-[#C9A84C]/50" />
      </div>
      <Button
        size="sm"
        onClick={() => onSave({ title, description, duration, video_url: videoUrl })}
        disabled={saving}
        className="gap-1.5"
      >
        {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
        Salvar
      </Button>
    </div>
  );
}

interface AcademyAdminProps {
  ytLinks: Record<string, string>;
  onLinksChange: (links: Record<string, string>) => void;
}

interface CategoryOverride {
  category_id: string;
  label?: string;
  description?: string;
  icon?: string;
  color?: string;
  hidden?: boolean;
}

const TRAIL_STEPS_DEFAULT = [
  { id: 0, title: "Como funciona a V3 Partners", duration: "5 min", desc: "Visão geral da plataforma e seus módulos" },
  { id: 1, title: "Seu primeiro deal no Marketplace", duration: "8 min", desc: "Passo a passo para enviar seu primeiro lead" },
  { id: 2, title: "CRM para assessores financeiros", duration: "6 min", desc: "Organize sua carteira e acompanhe clientes" },
  { id: 3, title: "Crédito estruturado — fundamentos", duration: "10 min", desc: "Entenda as principais linhas de crédito" },
  { id: 4, title: "M&A para assessores independentes", duration: "12 min", desc: "Como originar e estruturar operações de M&A" },
];

interface OnboardingOverride {
  step_id: number;
  title?: string;
  description?: string;
  duration?: string;
  video_url?: string;
}

interface HomeBanner {
  title?: string;
  subtitle?: string;
  background_image_url?: string;
  cta_label?: string;
  cta_href?: string;
}

function BannerEditor() {
  const [banner, setBanner] = useState<HomeBanner>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/academy/home-banner")
      .then(r => r.json())
      .then(d => { if (d.banner) setBanner(d.banner); })
      .catch(() => {});
  }, []);

  async function handleSave() {
    setSaving(true);
    const res = await fetch("/api/academy/home-banner", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(banner),
    });
    setSaving(false);
    if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 2000); }
  }

  return (
    <div className="p-4 rounded-xl border border-[#C9A84C]/30 bg-[#C9A84C]/5 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-white">Banner Principal (topo da página inicial)</p>
        <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5 h-8">
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : saved ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
          {saved ? "Salvo" : "Salvar Banner"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground -mt-2">
        Deixe em branco pra usar o comportamento padrão (destaca automaticamente a aula marcada como "featured").
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] font-bold uppercase tracking-wide text-[#C9A84C]">Título</label>
          <input value={banner.title ?? ""} onChange={e => setBanner({ ...banner, title: e.target.value })}
            placeholder="Ex: Domine o Mercado de Crédito Estruturado"
            className="w-full mt-1 h-9 px-3 text-sm bg-secondary border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-[#C9A84C]/50" />
        </div>
        <div>
          <label className="text-[10px] font-bold uppercase tracking-wide text-[#C9A84C]">Imagem de fundo (URL)</label>
          <input value={banner.background_image_url ?? ""} onChange={e => setBanner({ ...banner, background_image_url: e.target.value })}
            placeholder="https://..."
            className="w-full mt-1 h-9 px-3 text-sm bg-secondary border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-[#C9A84C]/50" />
        </div>
        <div className="md:col-span-2">
          <label className="text-[10px] font-bold uppercase tracking-wide text-[#C9A84C]">Subtítulo</label>
          <textarea value={banner.subtitle ?? ""} onChange={e => setBanner({ ...banner, subtitle: e.target.value })}
            rows={2} placeholder="Texto de apoio abaixo do título"
            className="w-full mt-1 px-3 py-2 text-sm bg-secondary border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-[#C9A84C]/50 resize-none" />
        </div>
        <div>
          <label className="text-[10px] font-bold uppercase tracking-wide text-[#C9A84C]">Texto do botão</label>
          <input value={banner.cta_label ?? ""} onChange={e => setBanner({ ...banner, cta_label: e.target.value })}
            placeholder="Ex: Começar Agora"
            className="w-full mt-1 h-9 px-3 text-sm bg-secondary border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-[#C9A84C]/50" />
        </div>
        <div>
          <label className="text-[10px] font-bold uppercase tracking-wide text-[#C9A84C]">Link do botão</label>
          <input value={banner.cta_href ?? ""} onChange={e => setBanner({ ...banner, cta_href: e.target.value })}
            placeholder="/academy?cat=home-equity"
            className="w-full mt-1 h-9 px-3 text-sm bg-secondary border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-[#C9A84C]/50" />
        </div>
      </div>
    </div>
  );
}

interface LiveClass {
  id: string;
  title: string;
  description?: string | null;
  instructor?: string | null;
  category?: string | null;
  date: string;
  duration_min: number;
  level?: string | null;
  total_spots: number;
  zoom_link?: string | null;
  recording_url?: string | null;
  registered_count: number;
}

const NOVA_AULA_VAZIA = {
  title: "", description: "", instructor: "", category: "", date: "",
  duration_min: 60, level: "Intermediário", total_spots: 100, zoom_link: "",
};

function LiveClassRow({ liveClass, onSave, onDelete }: {
  liveClass: LiveClass;
  onSave: (id: string, data: Partial<LiveClass>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [form, setForm] = useState({
    title: liveClass.title,
    description: liveClass.description ?? "",
    instructor: liveClass.instructor ?? "",
    category: liveClass.category ?? "",
    date: liveClass.date ? liveClass.date.slice(0, 16) : "",
    duration_min: liveClass.duration_min,
    level: liveClass.level ?? "",
    total_spots: liveClass.total_spots,
    zoom_link: liveClass.zoom_link ?? "",
    recording_url: liveClass.recording_url ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isPast = new Date(liveClass.date) < new Date();

  async function handleSave() {
    setSaving(true);
    await onSave(liveClass.id, { ...form, date: new Date(form.date).toISOString() });
    setSaving(false);
  }

  async function handleDelete() {
    if (!confirm(`Excluir "${liveClass.title}"? Os inscritos não serão notificados.`)) return;
    setDeleting(true);
    await onDelete(liveClass.id);
    setDeleting(false);
  }

  return (
    <div className="rounded-xl border border-border bg-secondary/20 overflow-hidden">
      <button onClick={() => setExpanded(!expanded)} className="w-full flex items-center gap-3 px-4 py-3 text-left">
        {isPast ? <Badge className="bg-secondary text-muted-foreground border-border text-[10px]">Passada</Badge>
          : <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-[10px]">Agendada</Badge>}
        <span className="text-sm font-semibold text-foreground flex-1 truncate">{liveClass.title}</span>
        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
          <Calendar className="w-3 h-3" /> {new Date(liveClass.date).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
        </span>
        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
          <Users className="w-3 h-3" /> {liveClass.registered_count}/{liveClass.total_spots}
        </span>
        {liveClass.recording_url && <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px]">Gravação salva</Badge>}
      </button>
      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Título</label>
              <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
                className="w-full mt-1 h-9 px-3 text-sm bg-secondary border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-[#C9A84C]/50" />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Instrutor</label>
              <input value={form.instructor} onChange={e => setForm({ ...form, instructor: e.target.value })}
                className="w-full mt-1 h-9 px-3 text-sm bg-secondary border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-[#C9A84C]/50" />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Data e hora</label>
              <input type="datetime-local" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })}
                className="w-full mt-1 h-9 px-3 text-sm bg-secondary border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-[#C9A84C]/50" />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Duração (min)</label>
              <input type="number" value={form.duration_min} onChange={e => setForm({ ...form, duration_min: parseInt(e.target.value) || 0 })}
                className="w-full mt-1 h-9 px-3 text-sm bg-secondary border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-[#C9A84C]/50" />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Categoria</label>
              <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
                className="w-full mt-1 h-9 px-3 text-sm bg-secondary border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-[#C9A84C]/50">
                <option value="">—</option>
                {ACADEMY_CATEGORIES.map(c => <option key={c.id} value={c.label}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Nível</label>
              <select value={form.level} onChange={e => setForm({ ...form, level: e.target.value })}
                className="w-full mt-1 h-9 px-3 text-sm bg-secondary border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-[#C9A84C]/50">
                <option value="Iniciante">Iniciante</option>
                <option value="Intermediário">Intermediário</option>
                <option value="Avançado">Avançado</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Total de vagas</label>
              <input type="number" value={form.total_spots} onChange={e => setForm({ ...form, total_spots: parseInt(e.target.value) || 0 })}
                className="w-full mt-1 h-9 px-3 text-sm bg-secondary border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-[#C9A84C]/50" />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Link da sala (Zoom/Meet)</label>
              <input value={form.zoom_link} onChange={e => setForm({ ...form, zoom_link: e.target.value })}
                placeholder="https://zoom.us/j/..."
                className="w-full mt-1 h-9 px-3 text-sm bg-secondary border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-[#C9A84C]/50" />
            </div>
            <div className="md:col-span-2">
              <label className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Descrição</label>
              <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                rows={2}
                className="w-full mt-1 px-3 py-2 text-sm bg-secondary border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-[#C9A84C]/50 resize-none" />
            </div>
            <div className="md:col-span-2">
              <label className="text-[10px] font-bold uppercase tracking-wide text-emerald-400">
                Link da gravação (cole aqui quando a aula terminar — vídeo do YouTube)
              </label>
              <input value={form.recording_url} onChange={e => setForm({ ...form, recording_url: e.target.value })}
                placeholder="https://youtu.be/..."
                className="w-full mt-1 h-9 px-3 text-sm bg-secondary border border-emerald-500/30 rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-emerald-500/50" />
              <p className="text-[10px] text-muted-foreground mt-1">
                Ao salvar com um link aqui, a aula passa a aparecer pros partners no tema &quot;Aulas ao Vivo&quot;, disponível pra assistir quando quiser.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Salvar
            </Button>
            <Button size="sm" variant="outline" onClick={handleDelete} disabled={deleting}
              className="gap-1.5 border-red-500/40 text-red-400 hover:bg-red-500/10">
              {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              Excluir
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function AcademyAdmin({ ytLinks, onLinksChange }: AcademyAdminProps) {
  const [tab, setTab] = useState<"links" | "categorias" | "aovivo" | "trilha" | "ranking" | "analytics">("links");
  const [showCsvImport, setShowCsvImport] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [csvImporting, setCsvImporting] = useState(false);
  const [csvResult, setCsvResult] = useState<{ ok: number; errors: string[] } | null>(null);
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("all");
  const [overrides, setOverrides] = useState<Record<string, VideoOverride>>({});
  const [editingVideo, setEditingVideo] = useState<VideoType | null>(null);
  const [categoryOverrides, setCategoryOverrides] = useState<Record<string, CategoryOverride>>({});

  const allVideos = getAllVideos();

  useEffect(() => {
    fetch("/api/academy/video-overrides")
      .then(r => r.json())
      .then(d => {
        if (d.overrides) {
          const map: Record<string, VideoOverride> = {};
          for (const o of d.overrides as VideoOverride[]) { map[o.video_id] = o; }
          setOverrides(map);
        }
      }).catch(() => {});
    fetch("/api/academy/category-overrides")
      .then(r => r.json())
      .then(d => {
        if (d.overrides) {
          const map: Record<string, CategoryOverride> = {};
          for (const o of d.overrides as CategoryOverride[]) { map[o.category_id] = o; }
          setCategoryOverrides(map);
        }
      }).catch(() => {});
  }, []);

  async function handleSaveCategoryOverride(categoryId: string, data: Partial<CategoryOverride>) {
    const res = await fetch("/api/academy/category-overrides", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category_id: categoryId, ...data }),
    });
    if (res.ok) {
      setCategoryOverrides(prev => ({ ...prev, [categoryId]: { ...prev[categoryId], ...data, category_id: categoryId } }));
    }
  }

  async function handleResetCategoryOverride(categoryId: string) {
    await fetch("/api/academy/category-overrides", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category_id: categoryId }),
    });
    setCategoryOverrides(prev => {
      const next = { ...prev };
      delete next[categoryId];
      return next;
    });
  }

  // ── Trilha de Boas-Vindas ────────────────────────────────────────────────
  const [trailOverrides, setTrailOverrides] = useState<Record<number, OnboardingOverride>>({});
  const [savingTrailStep, setSavingTrailStep] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/academy/onboarding-overrides")
      .then(r => r.json())
      .then(d => {
        if (d.overrides) {
          const map: Record<number, OnboardingOverride> = {};
          for (const o of d.overrides as OnboardingOverride[]) { map[o.step_id] = o; }
          setTrailOverrides(map);
        }
      }).catch(() => {});
  }, []);

  async function handleSaveTrailStep(stepId: number, data: Partial<OnboardingOverride>) {
    setSavingTrailStep(stepId);
    try {
      const res = await fetch("/api/academy/onboarding-overrides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step_id: stepId, ...data }),
      });
      if (res.ok) {
        setTrailOverrides(prev => ({ ...prev, [stepId]: { ...prev[stepId], ...data, step_id: stepId } }));
      }
    } finally {
      setSavingTrailStep(null);
    }
  }

  // ── Aulas ao Vivo ────────────────────────────────────────────────────────
  const [liveClasses, setLiveClasses] = useState<LiveClass[]>([]);
  const [novaAula, setNovaAula] = useState(NOVA_AULA_VAZIA);
  const [savingNovaAula, setSavingNovaAula] = useState(false);

  function loadLiveClasses() {
    fetch("/api/academy/live-classes")
      .then(r => r.json())
      .then(d => { if (d.classes) setLiveClasses(d.classes); })
      .catch(() => {});
  }

  useEffect(() => { loadLiveClasses(); }, []);

  async function handleCreateLiveClass() {
    if (!novaAula.title.trim() || !novaAula.date) return;
    setSavingNovaAula(true);
    try {
      await fetch("/api/academy/live-classes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...novaAula, date: new Date(novaAula.date).toISOString() }),
      });
      setNovaAula(NOVA_AULA_VAZIA);
      loadLiveClasses();
    } finally {
      setSavingNovaAula(false);
    }
  }

  async function handleSaveLiveClass(id: string, data: Partial<LiveClass>) {
    await fetch("/api/academy/live-classes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...data }),
    });
    loadLiveClasses();
  }

  async function handleDeleteLiveClass(id: string) {
    await fetch(`/api/academy/live-classes?id=${id}`, { method: "DELETE" });
    setLiveClasses(prev => prev.filter(c => c.id !== id));
  }

  async function handleSaveOverride(videoId: string, data: Partial<VideoOverride>) {
    const res = await fetch("/api/academy/video-overrides", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ video_id: videoId, ...data }),
    });
    if (res.ok) {
      setOverrides(prev => ({ ...prev, [videoId]: { ...prev[videoId], ...data, video_id: videoId } }));
    }
  }

  async function handleResetOverride(videoId: string) {
    await fetch("/api/academy/video-overrides", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ video_id: videoId }),
    });
    setOverrides(prev => {
      const next = { ...prev };
      delete next[videoId];
      return next;
    });
    setEditingVideo(null);
  }
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
          { key: "categorias", label: "Temas", icon: <Edit3 className="w-3.5 h-3.5" /> },
          { key: "aovivo", label: "Ao Vivo", icon: <Radio className="w-3.5 h-3.5" /> },
          { key: "trilha", label: "Trilha de Boas-Vindas", icon: <Rocket className="w-3.5 h-3.5" /> },
          { key: "ranking", label: "Ranking Engajamento", icon: <Trophy className="w-3.5 h-3.5" /> },
          { key: "analytics", label: "Analytics", icon: <BarChart2 className="w-3.5 h-3.5" /> },
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
      {tab === "analytics" && <AcademyAnalytics />}

      {tab === "categorias" && (
        <div className="space-y-3">
          <BannerEditor />

          <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 flex items-start gap-3">
            <Info className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-amber-400 mb-1">Gerenciar Temas</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Edite nome, descrição, ícone e cor de cada tema. "Ocultar" remove o tema e suas aulas da visão
                dos partners sem apagar nada — dá pra restaurar a qualquer momento.
              </p>
            </div>
          </div>
          {ACADEMY_CATEGORIES.map((cat) => (
            <CategoryRow
              key={cat.id}
              category={cat}
              override={categoryOverrides[cat.id]}
              onSave={(data) => handleSaveCategoryOverride(cat.id, data)}
              onReset={() => handleResetCategoryOverride(cat.id)}
            />
          ))}
        </div>
      )}

      {tab === "aovivo" && (
        <div className="space-y-3">
          <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 flex items-start gap-3">
            <Info className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-amber-400 mb-1">Gerenciar Aulas ao Vivo</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Quem se inscrever recebe o link por e-mail e pelo chat interno na hora, e um lembrete por e-mail 1 dia antes.
                Depois da aula, cole o link da gravação (edição do card) pra ela ficar salva no tema &quot;Aulas ao Vivo&quot;.
              </p>
            </div>
          </div>

          {/* Nova aula */}
          <div className="p-4 rounded-xl border border-dashed border-border space-y-3">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Nova Aula ao Vivo</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input value={novaAula.title} onChange={e => setNovaAula({ ...novaAula, title: e.target.value })}
                placeholder="Título *"
                className="h-9 px-3 text-sm bg-secondary border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-[#C9A84C]/50" />
              <input value={novaAula.instructor} onChange={e => setNovaAula({ ...novaAula, instructor: e.target.value })}
                placeholder="Instrutor"
                className="h-9 px-3 text-sm bg-secondary border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-[#C9A84C]/50" />
              <input type="datetime-local" value={novaAula.date} onChange={e => setNovaAula({ ...novaAula, date: e.target.value })}
                className="h-9 px-3 text-sm bg-secondary border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-[#C9A84C]/50" />
              <input type="number" value={novaAula.duration_min} onChange={e => setNovaAula({ ...novaAula, duration_min: parseInt(e.target.value) || 0 })}
                placeholder="Duração (min)"
                className="h-9 px-3 text-sm bg-secondary border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-[#C9A84C]/50" />
              <select value={novaAula.category} onChange={e => setNovaAula({ ...novaAula, category: e.target.value })}
                className="h-9 px-3 text-sm bg-secondary border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-[#C9A84C]/50">
                <option value="">Tema —</option>
                {ACADEMY_CATEGORIES.map(c => <option key={c.id} value={c.label}>{c.label}</option>)}
              </select>
              <select value={novaAula.level} onChange={e => setNovaAula({ ...novaAula, level: e.target.value })}
                className="h-9 px-3 text-sm bg-secondary border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-[#C9A84C]/50">
                <option value="Iniciante">Iniciante</option>
                <option value="Intermediário">Intermediário</option>
                <option value="Avançado">Avançado</option>
              </select>
              <input type="number" value={novaAula.total_spots} onChange={e => setNovaAula({ ...novaAula, total_spots: parseInt(e.target.value) || 0 })}
                placeholder="Total de vagas"
                className="h-9 px-3 text-sm bg-secondary border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-[#C9A84C]/50" />
              <input value={novaAula.zoom_link} onChange={e => setNovaAula({ ...novaAula, zoom_link: e.target.value })}
                placeholder="Link da sala (Zoom/Meet)"
                className="h-9 px-3 text-sm bg-secondary border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-[#C9A84C]/50" />
              <textarea value={novaAula.description} onChange={e => setNovaAula({ ...novaAula, description: e.target.value })}
                placeholder="Descrição" rows={2}
                className="md:col-span-2 px-3 py-2 text-sm bg-secondary border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-[#C9A84C]/50 resize-none" />
            </div>
            <Button size="sm" onClick={handleCreateLiveClass} disabled={savingNovaAula || !novaAula.title.trim() || !novaAula.date} className="gap-1.5">
              {savingNovaAula ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              Criar Aula
            </Button>
          </div>

          {/* Lista */}
          <div className="space-y-2">
            {liveClasses.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">Nenhuma aula ao vivo cadastrada ainda.</p>
            )}
            {liveClasses.map(cls => (
              <LiveClassRow key={cls.id} liveClass={cls} onSave={handleSaveLiveClass} onDelete={handleDeleteLiveClass} />
            ))}
          </div>
        </div>
      )}

      {tab === "trilha" && (
        <div className="space-y-3">
          <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 flex items-start gap-3">
            <Info className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-amber-400 mb-1">Trilha de Boas-Vindas</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Cole o link do YouTube de cada passo pra que o partner novo consiga assistir a aula de verdade
                clicando em &quot;Assistir&quot;. Sem link, o passo continua funcionando só como checklist manual.
              </p>
            </div>
          </div>
          {TRAIL_STEPS_DEFAULT.map((step) => (
            <TrailStepRow
              key={step.id}
              step={step}
              override={trailOverrides[step.id]}
              saving={savingTrailStep === step.id}
              onSave={(data) => handleSaveTrailStep(step.id, data)}
            />
          ))}
        </div>
      )}

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

        {/* CSV Import */}
        <div>
          <button
            onClick={() => { setShowCsvImport(!showCsvImport); setCsvResult(null); }}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#243A66] text-xs text-[#7A8FA8] hover:text-[#F0ECE4] transition-colors"
          >
            <Upload className="w-3.5 h-3.5" /> Importar CSV em lote
          </button>
          {showCsvImport && (
            <div className="mt-3 p-4 rounded-xl border border-[#243A66] bg-[#0D1929] space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-white">Importação em Lote</p>
                <button onClick={() => setShowCsvImport(false)}><X className="w-4 h-4 text-muted-foreground" /></button>
              </div>
              <p className="text-xs text-muted-foreground">Cole o CSV no formato: <code className="text-[#C9A84C]">video_id,url</code> — uma por linha. Ex: <code className="text-[#C9A84C]">he-001,https://youtu.be/ABC123</code></p>
              <textarea
                value={csvText}
                onChange={e => setCsvText(e.target.value)}
                placeholder={"he-001,https://youtu.be/XYZ\nhe-002,https://youtu.be/ABC\n..."}
                rows={5}
                className="w-full px-3 py-2 text-xs bg-[#0A1628] border border-[#243A66] rounded-lg text-[#F0ECE4] placeholder:text-[#3A5070] focus:outline-none focus:ring-1 focus:ring-[#C9A84C]/50 font-mono resize-none"
              />
              <button
                onClick={async () => {
                  setCsvImporting(true); setCsvResult(null);
                  const lines = csvText.trim().split("\n").filter(Boolean);
                  const allVids = getAllVideos();
                  let ok = 0; const errors: string[] = [];
                  for (const line of lines) {
                    const [videoId, url] = line.split(",").map(s => s.trim());
                    if (!videoId || !url) { errors.push(`Linha inválida: "${line}"`); continue; }
                    const v = allVids.find(v => v.id === videoId);
                    if (!v) { errors.push(`ID não encontrado: "${videoId}"`); continue; }
                    const res = await fetch("/api/academy/yt-links", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ video_id: videoId, url, video_title: v.title, is_new: !ytLinks[videoId] }) });
                    if (res.ok) { ok++; onLinksChange({ ...ytLinks, [videoId]: url }); }
                    else { errors.push(`Erro ao salvar ${videoId}`); }
                  }
                  setCsvResult({ ok, errors }); setCsvImporting(false);
                }}
                disabled={!csvText.trim() || csvImporting}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#C9A84C] hover:bg-[#E8C97A] text-[#09081A] text-xs font-bold transition-colors disabled:opacity-50"
              >
                {csvImporting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {csvImporting ? "Importando..." : "Importar"}
              </button>
              {csvResult && (
                <div className={`text-xs p-3 rounded-lg ${csvResult.errors.length > 0 ? "bg-amber-500/10 border border-amber-500/20" : "bg-emerald-500/10 border border-emerald-500/20"}`}>
                  <p className="font-semibold text-white">{csvResult.ok} link(s) importado(s) com sucesso</p>
                  {csvResult.errors.map((e, i) => <p key={i} className="text-red-400 mt-1">{e}</p>)}
                </div>
              )}
            </div>
          )}
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
                      onEdit={() => setEditingVideo(video)}
                      hasOverride={!!overrides[video.id]}
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

      {editingVideo && (
        <AcademyVideoEdit
          video={editingVideo}
          override={overrides[editingVideo.id]}
          onSave={handleSaveOverride}
          onReset={handleResetOverride}
          onClose={() => setEditingVideo(null)}
        />
      )}
    </div>
  );
}
