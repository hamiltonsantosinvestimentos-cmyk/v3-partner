"use client";

import React, { useState } from "react";
import { X, Save, Loader2, RotateCcw, Edit3 } from "lucide-react";
import type { Video } from "@/lib/academy-data";

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

interface Props {
  video: Video;
  override?: VideoOverride;
  onSave: (videoId: string, data: Partial<VideoOverride>) => Promise<void>;
  onReset: (videoId: string) => Promise<void>;
  onClose: () => void;
}

const inputCls = "w-full h-9 px-3 text-sm rounded-lg border bg-[#0A1628] border-[#243A66] text-[#F0ECE4] placeholder:text-[#3A5070] focus:outline-none focus:ring-1 focus:ring-[#C9A84C]/50";
const labelCls = "block text-xs font-semibold text-[#7A8FA8] mb-1";

export function AcademyVideoEdit({ video, override, onSave, onReset, onClose }: Props) {
  const [form, setForm] = useState({
    title: override?.title ?? video.title,
    description: override?.description ?? video.description,
    instructor: override?.instructor ?? video.instructor,
    instructor_role: override?.instructor_role ?? video.instructorRole,
    level: override?.level ?? video.level,
    duration: override?.duration ?? video.duration,
    featured: override?.featured ?? video.featured ?? false,
    required: override?.required ?? video.required ?? false,
    tags: (override?.tags ?? video.tags ?? []).join(", "),
  });
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [saved, setSaved] = useState(false);

  const hasOverride = !!override;

  function set(key: string, value: string | boolean) {
    setForm(f => ({ ...f, [key]: value }));
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const tags = form.tags.split(",").map(t => t.trim()).filter(Boolean);
      await onSave(video.id, {
        title: form.title,
        description: form.description,
        instructor: form.instructor,
        instructor_role: form.instructor_role,
        level: form.level,
        duration: form.duration,
        featured: form.featured,
        required: form.required,
        tags,
      });
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  async function handleReset() {
    if (!confirm("Restaurar todos os campos para os valores originais?")) return;
    setResetting(true);
    try {
      await onReset(video.id);
      setForm({
        title: video.title,
        description: video.description,
        instructor: video.instructor,
        instructor_role: video.instructorRole,
        level: video.level,
        duration: video.duration,
        featured: video.featured ?? false,
        required: video.required ?? false,
        tags: (video.tags ?? []).join(", "),
      });
      setSaved(false);
    } finally {
      setResetting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-[#111F35] border border-[#243A66] rounded-2xl shadow-2xl z-10 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#243A66] bg-[#0D1929]">
          <div className="flex items-center gap-2">
            <Edit3 className="w-4 h-4 text-[#C9A84C]" />
            <div>
              <p className="text-sm font-bold text-[#F0ECE4]">Editar Vídeo</p>
              <p className="text-[10px] text-[#7A8FA8] font-mono">{video.id}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {hasOverride && (
              <button
                onClick={handleReset}
                disabled={resetting}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-500/30 text-red-400 text-xs hover:bg-red-500/10 transition-colors disabled:opacity-50"
              >
                {resetting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                Restaurar original
              </button>
            )}
            <button onClick={onClose} className="text-[#7A8FA8] hover:text-[#F0ECE4] transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Form */}
        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {hasOverride && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#C9A84C]/10 border border-[#C9A84C]/30">
              <div className="w-1.5 h-1.5 rounded-full bg-[#C9A84C]" />
              <p className="text-xs text-[#C9A84C]">Este vídeo tem edições ativas. Os campos originais estão preservados no código.</p>
            </div>
          )}

          <div>
            <label className={labelCls}>Título *</label>
            <input value={form.title} onChange={e => set("title", e.target.value)} className={inputCls} />
            {form.title !== video.title && <p className="text-[10px] text-[#C9A84C] mt-1">Original: {video.title}</p>}
          </div>

          <div>
            <label className={labelCls}>Descrição *</label>
            <textarea
              value={form.description}
              onChange={e => set("description", e.target.value)}
              rows={3}
              className="w-full px-3 py-2 text-sm rounded-lg border bg-[#0A1628] border-[#243A66] text-[#F0ECE4] placeholder:text-[#3A5070] focus:outline-none focus:ring-1 focus:ring-[#C9A84C]/50 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Instrutor</label>
              <input value={form.instructor} onChange={e => set("instructor", e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Cargo do Instrutor</label>
              <input value={form.instructor_role} onChange={e => set("instructor_role", e.target.value)} className={inputCls} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Nível</label>
              <select value={form.level} onChange={e => set("level", e.target.value)} className={inputCls}>
                <option value="Iniciante">Iniciante</option>
                <option value="Intermediário">Intermediário</option>
                <option value="Avançado">Avançado</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Duração (mm:ss)</label>
              <input
                value={form.duration}
                onChange={e => set("duration", e.target.value)}
                placeholder="Ex: 25:30"
                className={inputCls}
              />
            </div>
          </div>

          <div>
            <label className={labelCls}>Tags (separadas por vírgula)</label>
            <input
              value={form.tags}
              onChange={e => set("tags", e.target.value)}
              placeholder="Ex: LTV, CMN 4.676, Garantia"
              className={inputCls}
            />
          </div>

          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.featured}
                onChange={e => set("featured", e.target.checked)}
                className="w-4 h-4 accent-[#C9A84C]"
              />
              <span className="text-xs text-[#7A8FA8]">Destaque (banner principal)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.required}
                onChange={e => set("required", e.target.checked)}
                className="w-4 h-4 accent-[#C9A84C]"
              />
              <span className="text-xs text-[#7A8FA8]">Obrigatório (trilha de onboarding)</span>
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#243A66] bg-[#0D1929] flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {saved ? <span className="text-emerald-400">✓ Salvo com sucesso</span> : "Alterações não salvas"}
          </p>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-[#C9A84C] hover:bg-[#E8C97A] text-[#09081A] text-sm font-bold transition-colors disabled:opacity-60"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}
