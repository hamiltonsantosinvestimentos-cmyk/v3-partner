"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  ChevronLeft, ChevronRight, Loader2, AlertCircle, User, Clock, RefreshCw, Search,
} from "lucide-react";

const GOLD = "#C9A84C";
const NAVY_CARD = "#162744";
const MUTED = "#7A8FA8";
const CREAM = "#F0ECE4";

type Etapa = "prospect" | "contatado" | "interessado" | "trial" | "convertido" | "perdido";

const ETAPAS: { id: Etapa; label: string; color: string; bg: string }[] = [
  { id: "prospect",    label: "Prospect",    color: "#7A8FA8", bg: "#7A8FA820" },
  { id: "contatado",   label: "Contatado",   color: "#60A5FA", bg: "#60A5FA20" },
  { id: "interessado", label: "Interessado", color: "#F59E0B", bg: "#F59E0B20" },
  { id: "trial",       label: "Em Trial",    color: "#A78BFA", bg: "#A78BFA20" },
  { id: "convertido",  label: "Convertido",  color: "#34D399", bg: "#34D39920" },
];

type KanbanLead = {
  phone: string;
  nome: string | null;
  tags: string[];
  responsavel_id: string | null;
  responsavel_nome: string | null;
  status: string;
  last_message_at: string | null;
  last_message_preview: string | null;
  prospeccao_lead_id: string | null;
  etapa: Etapa;
};

type Equipe = { id: string; full_name: string; role: string };

function formatTime(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diffDays === 0) return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  if (diffDays === 1) return "Ontem";
  if (diffDays < 7) return d.toLocaleDateString("pt-BR", { weekday: "short" });
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function LeadCard({
  lead, onMove, showResponsavel,
}: {
  lead: KanbanLead;
  onMove: (phone: string, etapa: Etapa) => void;
  showResponsavel: boolean;
}) {
  const etapaAtual = ETAPAS.findIndex(e => e.id === lead.etapa);
  const podeMover = lead.etapa !== "perdido";

  return (
    <div className="rounded-xl border border-white/5 p-3 space-y-2" style={{ background: "#0F1E35" }}>
      <p className="text-sm font-semibold text-white leading-tight">
        {lead.nome ?? lead.phone}
      </p>
      {lead.last_message_preview && (
        <p className="text-[11px] leading-snug line-clamp-2" style={{ color: MUTED }}>
          {lead.last_message_preview}
        </p>
      )}
      <div className="flex items-center justify-between">
        {lead.last_message_at && (
          <span className="text-[10px] flex items-center gap-1" style={{ color: MUTED }}>
            <Clock className="w-2.5 h-2.5" /> {formatTime(lead.last_message_at)}
          </span>
        )}
        {showResponsavel && lead.responsavel_nome && (
          <span className="text-[10px] flex items-center gap-1" style={{ color: MUTED }}>
            <User className="w-2.5 h-2.5" /> {lead.responsavel_nome.split(" ")[0]}
          </span>
        )}
      </div>

      {podeMover && (
        <div className="flex items-center justify-between pt-1 border-t border-white/5">
          <button
            onClick={() => etapaAtual > 0 && onMove(lead.phone, ETAPAS[etapaAtual - 1].id)}
            disabled={etapaAtual === 0}
            className="p-1 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-20"
          >
            <ChevronLeft className="w-3 h-3" style={{ color: MUTED }} />
          </button>
          <button
            onClick={() => onMove(lead.phone, "perdido")}
            className="text-[9px] px-2 py-0.5 rounded-full border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors"
          >
            Perdido
          </button>
          <button
            onClick={() => etapaAtual < ETAPAS.length - 1 && onMove(lead.phone, ETAPAS[etapaAtual + 1].id)}
            disabled={etapaAtual === ETAPAS.length - 1}
            className="p-1 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-20"
          >
            <ChevronRight className="w-3 h-3" style={{ color: MUTED }} />
          </button>
        </div>
      )}
    </div>
  );
}

export function SdrKanbanClient() {
  const [leads, setLeads] = useState<KanbanLead[]>([]);
  const [equipe, setEquipe] = useState<Equipe[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filtroResp, setFiltroResp] = useState("");

  const load = useCallback(() => {
    setLoading(true); setErr(null);
    fetch("/api/sdr/kanban")
      .then(r => r.json())
      .then(j => {
        if (j.error) setErr(j.error);
        else {
          setLeads(j.leads ?? []);
          setEquipe(j.equipe ?? []);
          setIsAdmin(!!j.isAdmin);
        }
      })
      .catch(() => setErr("Erro ao carregar"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleMove = async (phone: string, etapa: Etapa) => {
    setLeads(ls => ls.map(l => l.phone === phone ? { ...l, etapa } : l));
    const r = await fetch("/api/sdr/kanban", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, etapa }),
    }).then(r => r.json());
    if (r.error) { setErr(r.error); load(); }
  };

  const filtered = useMemo(() => {
    return leads.filter(l => {
      const q = search.toLowerCase();
      const matchSearch = !q || (l.nome ?? "").toLowerCase().includes(q) || l.phone.includes(q);
      const matchResp = !filtroResp || l.responsavel_id === filtroResp;
      return matchSearch && matchResp;
    });
  }, [leads, search, filtroResp]);

  return (
    <div className="space-y-4 p-4 overflow-y-auto h-full">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-white">Kanban WhatsApp</h2>
          <p className="text-xs mt-0.5" style={{ color: MUTED }}>
            {isAdmin ? "Todos os responsáveis" : "Seus leads"} — etapas iguais à Prospecção de Partners
          </p>
        </div>
        <button onClick={load} className="p-1.5 rounded-xl border border-white/10 hover:border-white/20 transition-colors">
          <RefreshCw className="w-4 h-4" style={{ color: MUTED }} />
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: MUTED }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar…"
            className="pl-8 pr-3 py-1.5 text-sm rounded-xl border border-white/10 focus:outline-none focus:border-yellow-500/40"
            style={{ background: NAVY_CARD, color: "#fff" }}
          />
        </div>
        {isAdmin && (
          <select
            value={filtroResp}
            onChange={e => setFiltroResp(e.target.value)}
            className="px-3 py-1.5 text-sm rounded-xl border border-white/10 focus:outline-none"
            style={{ background: NAVY_CARD, color: "#fff" }}
          >
            <option value="">Todos responsáveis</option>
            {equipe.map(e => <option key={e.id} value={e.id}>{e.full_name}</option>)}
          </select>
        )}
      </div>

      {loading && (
        <div className="flex items-center justify-center h-48 gap-2" style={{ color: MUTED }}>
          <Loader2 className="w-4 h-4 animate-spin" style={{ color: GOLD }} />
          <span className="text-sm">Carregando…</span>
        </div>
      )}

      {err && !loading && (
        <div className="flex items-center gap-2 text-red-400 text-sm">
          <AlertCircle className="w-4 h-4" /> {err}
        </div>
      )}

      {!loading && !err && (
        <div className="flex gap-3 overflow-x-auto pb-4">
          {ETAPAS.map(etapa => {
            const cards = filtered.filter(l => l.etapa === etapa.id);
            return (
              <div key={etapa.id} className="shrink-0 w-64 space-y-3">
                <div className="flex items-center justify-between px-3 py-2 rounded-xl" style={{ background: etapa.bg }}>
                  <span className="text-xs font-bold uppercase tracking-widest" style={{ color: etapa.color }}>
                    {etapa.label}
                  </span>
                  <span
                    className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                    style={{ background: etapa.bg, color: etapa.color, border: `1px solid ${etapa.color}40` }}
                  >
                    {cards.length}
                  </span>
                </div>
                <div className="space-y-2 min-h-[120px]">
                  {cards.map(l => (
                    <LeadCard key={l.phone} lead={l} onMove={handleMove} showResponsavel={isAdmin} />
                  ))}
                  {cards.length === 0 && (
                    <div className="h-16 rounded-xl border-2 border-dashed border-white/5 flex items-center justify-center">
                      <span className="text-[11px]" style={{ color: MUTED }}>Vazio</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          <div className="shrink-0 w-56 space-y-3">
            <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-red-500/10">
              <span className="text-xs font-bold uppercase tracking-widest text-red-400">Perdidos</span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30">
                {filtered.filter(l => l.etapa === "perdido").length}
              </span>
            </div>
            <div className="space-y-2 min-h-[60px]">
              {filtered.filter(l => l.etapa === "perdido").map(l => (
                <div key={l.phone} className="rounded-xl border border-white/5 p-3" style={{ background: "#0F1E35" }}>
                  <p className="text-xs font-semibold text-white leading-tight">{l.nome ?? l.phone}</p>
                  <button
                    onClick={() => handleMove(l.phone, "prospect")}
                    className="mt-1.5 text-[10px] px-2 py-0.5 rounded-full border border-white/10 hover:border-white/20 transition-colors"
                    style={{ color: MUTED }}
                  >
                    Reativar
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
