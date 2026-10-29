"use client";

import { useEffect, useState } from "react";
import {
  Clock, Upload, Zap, ArrowLeftRight,
  MessageSquare, Bell, Loader2,
} from "lucide-react";
import { isoToBr } from "@/lib/ma/pipeline";

type TimelineEvent = {
  id: string;
  type: "stage_change" | "forja" | "upload" | "comment" | "notification";
  title: string;
  description: string;
  actor?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
};

const EVENT_CONFIG: Record<TimelineEvent["type"], {
  icon: React.ElementType;
  color: string;
  bg: string;
  border: string;
  label: string;
  labelColor: string;
}> = {
  stage_change: {
    icon:       ArrowLeftRight,
    color:      "#10B981",
    bg:         "rgba(16,185,129,.10)",
    border:     "rgba(16,185,129,.20)",
    label:      "Etapa",
    labelColor: "#10B981",
  },
  forja: {
    icon:       Zap,
    color:      "#C9A84C",
    bg:         "rgba(201,168,76,.10)",
    border:     "rgba(201,168,76,.20)",
    label:      "FORJA",
    labelColor: "#E8C97A",
  },
  upload: {
    icon:       Upload,
    color:      "#9BAFC5",
    bg:         "rgba(155,175,197,.10)",
    border:     "rgba(155,175,197,.20)",
    label:      "Upload",
    labelColor: "#9BAFC5",
  },
  comment: {
    icon:       MessageSquare,
    color:      "#9BAFC5",
    bg:         "rgba(155,175,197,.10)",
    border:     "rgba(155,175,197,.20)",
    label:      "Comentário",
    labelColor: "#9BAFC5",
  },
  notification: {
    icon:       Bell,
    color:      "#9BAFC5",
    bg:         "rgba(155,175,197,.10)",
    border:     "rgba(155,175,197,.20)",
    label:      "Sistema",
    labelColor: "#9BAFC5",
  },
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  const hours   = Math.floor(minutes / 60);
  const days    = Math.floor(hours / 24);
  if (days > 0)    return `há ${days} dia${days > 1 ? "s" : ""}`;
  if (hours > 0)   return `há ${hours}h`;
  if (minutes > 0) return `há ${minutes}min`;
  return "agora";
}

type Closure = {
  stage: string;
  stage_label: string;
  closed_date: string;
  closed_reason_category: string | null;
  closed_reason_category_label: string | null;
  closed_reason: string | null;
};

export function DealTimeline({ dealId }: { dealId: string }) {
  const [events, setEvents]   = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [closure, setClosure] = useState<Closure | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/ma/timeline?deal_id=${dealId}`)
      .then(r => r.json())
      .then(({ events: data, closure: cl, error: err }: { events?: TimelineEvent[]; closure?: Closure | null; error?: string }) => {
        if (err) { setError(err); return; }
        setEvents(Array.isArray(data) ? data : []);
        setClosure(cl ?? null);
      })
      .catch(() => setError("Não foi possível carregar a timeline."))
      .finally(() => setLoading(false));
  }, [dealId]);

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 mb-4">
        <Clock size={14} className="text-[#C9A84C]" />
        <p className="text-xs font-bold tracking-widest uppercase text-[#C9A84C]">
          Timeline de Movimentações
        </p>
        {!loading && !error && events.length > 0 && (
          <span className="ml-auto text-[10px] text-[#243A66]">{events.length} eventos</span>
        )}
      </div>

      {/* Encerramento atual (BRIEF 28/10/2026, bloco B): fase, data, categoria e motivo. */}
      {!loading && !error && closure && (
        <div className="mb-3 rounded-xl border border-[#C9A84C]/30 bg-[#0F1E35] p-3">
          <p className="text-[10px] font-bold tracking-widest uppercase text-[#E8C97A] mb-1">Encerramento: {closure.stage_label}</p>
          <p className="text-[11px] text-[#9BAFC5]">Data de fechamento: {isoToBr(closure.closed_date)}</p>
          {closure.closed_reason_category_label && (
            <p className="text-[11px] text-[#9BAFC5]">Categoria: {closure.closed_reason_category_label}</p>
          )}
          {closure.closed_reason && (
            <p className="text-[11px] text-[#9BAFC5] whitespace-pre-line">Motivo: {closure.closed_reason}</p>
          )}
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-10">
          <Loader2 size={18} className="text-[#9BAFC5] animate-spin" />
        </div>
      )}

      {!loading && error && (
        <p className="text-xs text-red-400 py-4 text-center">{error}</p>
      )}

      {!loading && !error && events.length === 0 && (
        <div className="text-center py-10">
          <Clock size={24} className="text-[#243A66] mx-auto mb-3" />
          <p className="text-xs text-[#9BAFC5]">Nenhuma movimentação registrada ainda.</p>
          <p className="text-[10px] text-[#243A66] mt-1">
            Movimentações de etapa, uploads e validações FORJA aparecerão aqui.
          </p>
        </div>
      )}

      {!loading && !error && events.length > 0 && (
        <div className="relative">
          <div className="absolute left-[17px] top-2 bottom-2 w-px bg-[#162744]" />
          <div className="space-y-2">
            {events.map((ev) => {
              const cfg  = EVENT_CONFIG[ev.type] ?? EVENT_CONFIG.notification;
              const Icon = cfg.icon;
              return (
                <div key={ev.id} className="relative flex gap-3 group">
                  <div
                    className="relative z-10 flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center"
                    style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}
                  >
                    <Icon size={13} style={{ color: cfg.color }} />
                  </div>

                  <div className="flex-1 min-w-0 rounded-xl border border-[#122036] bg-[#0F1E35] p-3 group-hover:border-[#243A66] transition-colors">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className="text-[9px] font-bold tracking-widest uppercase px-1.5 py-0.5 rounded"
                          style={{ color: cfg.labelColor, background: cfg.bg }}
                        >
                          {cfg.label}
                        </span>
                        <p className="text-xs font-semibold text-[#E8EDF5]">{ev.title}</p>
                      </div>
                      <span
                        className="text-[10px] text-[#243A66] flex-shrink-0 whitespace-nowrap"
                        title={new Date(ev.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                      >
                        {relativeTime(ev.created_at)}
                      </span>
                    </div>

                    {ev.description && (
                      <p className="text-[11px] text-[#9BAFC5] leading-relaxed">{ev.description}</p>
                    )}
                    {ev.type === "stage_change" && typeof ev.metadata?.notes === "string" && ev.metadata.notes && (
                      <p className="text-[11px] text-[#9BAFC5] leading-relaxed whitespace-pre-line mt-1">{ev.metadata.notes}</p>
                    )}
                    {ev.actor && (
                      <p className="text-[10px] text-[#243A66] mt-1">{ev.actor}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
