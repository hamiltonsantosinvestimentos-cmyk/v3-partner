"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  ChevronLeft, ChevronRight, Loader2, AlertCircle, User, Clock, RefreshCw, Search,
} from "lucide-react";

type Etapa = "prospect" | "contatado" | "interessado" | "trial" | "convertido" | "perdido";

const ETAPAS: { id: Etapa; label: string; text: string; bg: string; border: string }[] = [
  { id: "prospect",    label: "Prospect",    text: "text-[#7A8FA8]", bg: "bg-[#7A8FA8]/10", border: "border-[#7A8FA8]/30" },
  { id: "contatado",   label: "Contatado",   text: "text-blue-400",   bg: "bg-blue-400/10",   border: "border-blue-400/30" },
  { id: "interessado", label: "Interessado", text: "text-amber-400",  bg: "bg-amber-400/10",  border: "border-amber-400/30" },
  { id: "trial",       label: "Em Trial",    text: "text-violet-400", bg: "bg-violet-400/10", border: "border-violet-400/30" },
  { id: "convertido",  label: "Convertido",  text: "text-emerald-400", bg: "bg-emerald-400/10", border: "border-emerald-400/30" },
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
    <div className="bg-[#111F35] border border-[#243A66] rounded-2xl p-3 space-y-2 hover:border-[#3A5070] transition-colors">
      <p className="text-sm font-semibold text-[#F0ECE4] leading-tight">
        {lead.nome ?? lead.phone}
      </p>
      {lead.last_message_preview && (
        <p className="text-[11px] leading-snug line-clamp-2 text-[#7A8FA8]">
          {lead.last_message_preview}
        </p>
      )}
      <div className="flex items-center justify-between">
        {lead.last_message_at && (
          <span className="text-[10px] flex items-center gap-1 text-[#7A8FA8]">
            <Clock className="w-2.5 h-2.5" /> {formatTime(lead.last_message_at)}
          </span>
        )}
        {showResponsavel && lead.responsavel_nome && (
          <span className="text-[10px] flex items-center gap-1 text-[#7A8FA8]">
            <User className="w-2.5 h-2.5" /> {lead.responsavel_nome.split(" ")[0]}
          </span>
        )}
      </div>

      {podeMover && (
        <div className="flex items-center justify-between pt-1 border-t border-[#243A66]">
          <button
            onClick={() => etapaAtual > 0 && onMove(lead.phone, ETAPAS[etapaAtual - 1].id)}
            disabled={etapaAtual === 0}
            className="p-1 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-20"
          >
            <ChevronLeft className="w-3 h-3 text-[#7A8FA8]" />
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
            <ChevronRight className="w-3 h-3 text-[#7A8FA8]" />
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
          <h2 className="text-base font-bold text-[#F0ECE4]">Kanban WhatsApp</h2>
          <p className="text-xs mt-0.5 text-[#7A8FA8]">
            {isAdmin ? "Todos os responsáveis" : "Seus leads"} — etapas iguais à Prospecção de Partners
          </p>
        </div>
        <button onClick={load} className="p-1.5 rounded-xl border border-[#243A66] hover:border-[#3A5070] transition-colors">
          <RefreshCw className="w-4 h-4 text-[#7A8FA8]" />
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#7A8FA8]" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar…"
            className="pl-8 pr-3 py-1.5 text-sm rounded-xl bg-[#0A1628] border border-[#243A66] text-[#F0ECE4] placeholder:text-[#3A5070] focus:outline-none focus:ring-1 focus:ring-[#C9A84C]/50"
          />
        </div>
        {isAdmin && (
          <select
            value={filtroResp}
            onChange={e => setFiltroResp(e.target.value)}
            className="px-3 py-1.5 text-sm rounded-xl bg-[#0A1628] border border-[#243A66] text-[#F0ECE4] focus:outline-none focus:ring-1 focus:ring-[#C9A84C]/50"
          >
            <option value="">Todos responsáveis</option>
            {equipe.map(e => <option key={e.id} value={e.id}>{e.full_name}</option>)}
          </select>
        )}
      </div>

      {loading && (
        <div className="flex items-center justify-center h-48 gap-2 text-[#7A8FA8]">
          <Loader2 className="w-4 h-4 animate-spin text-[#C9A84C]" />
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
                <div className={`flex items-center justify-between px-3 py-2 rounded-xl ${etapa.bg}`}>
                  <span className={`text-xs font-bold uppercase tracking-widest ${etapa.text}`}>
                    {etapa.label}
                  </span>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${etapa.bg} ${etapa.text} ${etapa.border}`}>
                    {cards.length}
                  </span>
                </div>
                <div className="space-y-2 min-h-[120px]">
                  {cards.map(l => (
                    <LeadCard key={l.phone} lead={l} onMove={handleMove} showResponsavel={isAdmin} />
                  ))}
                  {cards.length === 0 && (
                    <div className="h-16 rounded-xl border-2 border-dashed border-[#243A66] flex items-center justify-center">
                      <span className="text-[11px] text-[#7A8FA8]">Vazio</span>
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
                <div key={l.phone} className="bg-[#111F35] border border-[#243A66] rounded-2xl p-3">
                  <p className="text-xs font-semibold text-[#F0ECE4] leading-tight">{l.nome ?? l.phone}</p>
                  <button
                    onClick={() => handleMove(l.phone, "prospect")}
                    className="mt-1.5 text-[10px] px-2 py-0.5 rounded-full border border-[#243A66] hover:border-[#3A5070] transition-colors text-[#7A8FA8]"
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
