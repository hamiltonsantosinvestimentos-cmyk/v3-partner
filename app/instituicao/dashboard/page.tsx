"use client";

import React, { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import {
  Building2, LogOut, RefreshCw, FileText, Clock, AlertTriangle,
  CheckCircle2, Search, ChevronRight, Loader2, TrendingUp
} from "lucide-react";
import { InstituicaoPropostaModal } from "@/components/instituicao/proposta-modal";

type Proposta = {
  id: string;
  code: string;
  client_name: string;
  credit_line: string;
  requested_value: number;
  approved_value: number | null;
  stage: string;
  status: string;
  created_at: string;
  updated_at: string;
  pending_reason: string | null;
};

const STAGE_LABELS: Record<string, string> = {
  ANALISE: "Em Análise",
  PENDENCIA: "Pendência",
};

const STAGE_COLORS: Record<string, string> = {
  ANALISE: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  PENDENCIA: "bg-amber-500/10 text-amber-400 border-amber-500/30",
};

function formatBRL(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(value);
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function InstituicaoDashboard() {
  const [nome, setNome] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [propostas, setPropostas] = useState<Proposta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  useEffect(() => {
    const inst_nome = sessionStorage.getItem("instituicao_nome");
    if (!inst_nome) {
      window.location.href = "/instituicao/login";
      return;
    }
    setNome(inst_nome);
  }, []);

  const fetchPropostas = useCallback(async () => {
    if (!nome) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/instituicao/propostas?nome=${encodeURIComponent(nome)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao buscar propostas.");
      setPropostas(data.propostas);
      setLastUpdate(new Date());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro desconhecido.");
    } finally {
      setLoading(false);
    }
  }, [nome]);

  useEffect(() => {
    if (nome) fetchPropostas();
  }, [nome, fetchPropostas]);

  function handleLogout() {
    sessionStorage.removeItem("instituicao_id");
    sessionStorage.removeItem("instituicao_nome");
    window.location.href = "/instituicao/login";
  }

  const filtered = propostas.filter(p =>
    p.client_name.toLowerCase().includes(search.toLowerCase()) ||
    p.code.toLowerCase().includes(search.toLowerCase()) ||
    p.credit_line.toLowerCase().includes(search.toLowerCase())
  );

  const emAnalise = propostas.filter(p => p.stage === "ANALISE").length;
  const emPendencia = propostas.filter(p => p.stage === "PENDENCIA").length;
  const totalValue = propostas.reduce((acc, p) => acc + p.requested_value, 0);

  return (
    <div className="min-h-screen bg-[#09081A]">
      {/* Header */}
      <header className="border-b border-[#243A66] bg-[#09081A]/95 sticky top-0 z-10 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image src="/logo.jpg" alt="V3 Partners" width={32} height={32} className="rounded-lg object-cover" />
            <div>
              <div className="text-[9px] font-bold tracking-widest text-[#C9A84C] uppercase">V3 Partners</div>
              <div className="text-xs font-semibold text-[#F0ECE4]">Portal Instituição</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 bg-[#C9A84C]/10 border border-[#C9A84C]/20 rounded-full px-3 py-1">
              <Building2 className="w-3 h-3 text-[#C9A84C]" />
              <span className="text-[11px] font-semibold text-[#C9A84C]">{nome}</span>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-xs text-[#7A8FA8] hover:text-[#F0ECE4] transition-colors px-2 py-1.5 rounded-lg hover:bg-[#243A66]/40"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sair</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">

        {/* Page title */}
        <div>
          <h1 className="text-xl font-bold text-[#F0ECE4]">Propostas Encaminhadas</h1>
          <p className="text-xs text-[#7A8FA8] mt-1">
            Propostas em análise e pendência direcionadas para <span className="text-[#C9A84C] font-semibold">{nome}</span>
          </p>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="bg-[#111F35] border border-[#243A66] rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-3.5 h-3.5 text-[#C9A84C]" />
              <span className="text-[9px] font-bold text-[#7A8FA8] uppercase tracking-widest">Em Análise</span>
            </div>
            <div className="text-2xl font-bold text-[#F0ECE4]">{emAnalise}</div>
            <div className="text-[10px] text-[#7A8FA8] mt-1">proposta{emAnalise !== 1 ? "s" : ""}</div>
          </div>
          <div className="bg-[#111F35] border border-[#243A66] rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-[9px] font-bold text-[#7A8FA8] uppercase tracking-widest">Pendência</span>
            </div>
            <div className="text-2xl font-bold text-[#F0ECE4]">{emPendencia}</div>
            <div className="text-[10px] text-[#7A8FA8] mt-1">aguardando</div>
          </div>
          <div className="col-span-2 sm:col-span-1 bg-[#111F35] border border-[#243A66] rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-3.5 h-3.5 text-[#C9A84C]" />
              <span className="text-[9px] font-bold text-[#7A8FA8] uppercase tracking-widest">Volume Total</span>
            </div>
            <div className="text-xl font-bold text-[#C9A84C]">{loading ? "—" : formatBRL(totalValue)}</div>
            <div className="text-[10px] text-[#7A8FA8] mt-1">{propostas.length} proposta{propostas.length !== 1 ? "s" : ""}</div>
          </div>
        </div>

        {/* Search + Refresh */}
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#7A8FA8]" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por cliente, código ou linha de crédito..."
              className="w-full bg-[#111F35] border border-[#243A66] rounded-xl pl-9 pr-4 py-2.5 text-sm text-[#F0ECE4] placeholder:text-[#7A8FA8]/40 focus:outline-none focus:border-[#C9A84C]/50 transition-colors"
            />
          </div>
          <button
            onClick={fetchPropostas}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#111F35] border border-[#243A66] hover:border-[#C9A84C]/40 rounded-xl text-[#7A8FA8] hover:text-[#F0ECE4] text-xs transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Atualizar</span>
          </button>
        </div>

        {lastUpdate && !loading && (
          <p className="text-[10px] text-[#243A66] -mt-2">
            Atualizado às {lastUpdate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
          </p>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
            <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <p className="text-red-400 text-xs">{error}</p>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 text-[#C9A84C] animate-spin" />
          </div>
        )}

        {/* Empty */}
        {!loading && !error && filtered.length === 0 && (
          <div className="text-center py-16 bg-[#111F35] border border-[#243A66] rounded-2xl">
            <CheckCircle2 className="w-10 h-10 text-[#243A66] mx-auto mb-3" />
            <p className="text-sm text-[#7A8FA8] font-medium">
              {search ? "Nenhuma proposta encontrada para esse filtro." : "Nenhuma proposta encaminhada no momento."}
            </p>
            <p className="text-xs text-[#243A66] mt-1">
              {search ? "Tente buscar por outro termo." : "Quando houver propostas em análise ou pendência, elas aparecerão aqui."}
            </p>
          </div>
        )}

        {/* Table */}
        {!loading && filtered.length > 0 && (
          <div className="bg-[#111F35] border border-[#243A66] rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#243A66]">
                  <th className="text-left px-4 py-3 text-[9px] font-bold text-[#C9A84C] uppercase tracking-widest">Código</th>
                  <th className="text-left px-4 py-3 text-[9px] font-bold text-[#C9A84C] uppercase tracking-widest">Cliente</th>
                  <th className="text-left px-4 py-3 text-[9px] font-bold text-[#C9A84C] uppercase tracking-widest hidden md:table-cell">Linha</th>
                  <th className="text-left px-4 py-3 text-[9px] font-bold text-[#C9A84C] uppercase tracking-widest hidden sm:table-cell">Valor</th>
                  <th className="text-left px-4 py-3 text-[9px] font-bold text-[#C9A84C] uppercase tracking-widest">Etapa</th>
                  <th className="text-left px-4 py-3 text-[9px] font-bold text-[#C9A84C] uppercase tracking-widest hidden lg:table-cell">Atualizado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#243A66]/40">
                {filtered.map(p => (
                  <tr key={p.id} onClick={() => setSelectedId(p.id)} className="hover:bg-[#162744]/40 transition-colors group cursor-pointer">
                    <td className="px-4 py-3.5">
                      <span className="text-[#C9A84C] font-mono text-xs font-bold">{p.code}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="text-[#F0ECE4] font-medium text-xs">{p.client_name}</div>
                      {p.pending_reason && (
                        <div className="text-[10px] text-amber-400 mt-0.5 flex items-center gap-1">
                          <AlertTriangle className="w-2.5 h-2.5" />
                          {p.pending_reason.length > 50 ? p.pending_reason.slice(0, 50) + "…" : p.pending_reason}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3.5 hidden md:table-cell">
                      <span className="text-[#7A8FA8] text-xs">{p.credit_line}</span>
                    </td>
                    <td className="px-4 py-3.5 hidden sm:table-cell">
                      <div className="text-[#F0ECE4] text-xs font-semibold">{formatBRL(p.requested_value)}</div>
                      {p.approved_value && (
                        <div className="text-[10px] text-emerald-400 mt-0.5">
                          Aprovado: {formatBRL(p.approved_value)}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${STAGE_COLORS[p.stage] ?? "bg-[#243A66]/30 text-[#7A8FA8] border-[#243A66]"}`}>
                        {p.stage === "ANALISE" ? <Clock className="w-2.5 h-2.5" /> : <AlertTriangle className="w-2.5 h-2.5" />}
                        {STAGE_LABELS[p.stage] ?? p.stage}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 hidden lg:table-cell">
                      <span className="text-[#7A8FA8] text-xs">{formatDate(p.updated_at)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer note */}
        <p className="text-center text-[10px] text-[#243A66] pb-4">
          Exibindo apenas propostas nas etapas Análise e Pendência direcionadas a {nome} · Dados atualizados a cada acesso
        </p>
      </main>

      {/* Modal de detalhe */}
      {selectedId && nome && (
        <InstituicaoPropostaModal
          proposalId={selectedId}
          instituicaoNome={nome}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  );
}
