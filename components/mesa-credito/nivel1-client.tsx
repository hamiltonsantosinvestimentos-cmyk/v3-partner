"use client";

import React, { useState, useCallback, useEffect } from "react";
import { Home as HomeIcon, LayoutGrid, List, Plus, Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/utils";
import { STATUS_LABELS, STATUS_COLORS, type OperationStatus } from "@/lib/constants";
import { NovaPropostaModal } from "./nova-proposta-modal";
import { PropostaDetailModal, type ProposalFull } from "./proposta-detail-modal";

interface Proposal {
  id: string;
  code: string;
  title: string;
  client_name: string;
  client_type?: string;
  cpf_cnpj?: string;
  email?: string;
  telefone?: string;
  credit_line: string;
  requested_value: number;
  approved_value: number | null;
  prazo?: string;
  finalidade?: string;
  current_level: string;
  status: string;
  stage?: string;
  partner_id?: string;
  partner_name?: string;
  docs_uploaded?: number;
  docs_required?: number;
  created_at: string;
  valor_credito_atual?: number;
  comissao_mandato_perc?: number;
  comissao_instituicao_perc?: number;
  imovel_endereco?: string;
  imovel_valor_medio?: number;
  imovel_cidade?: string;
  imovel_estado?: string;
  metadata?: Record<string, unknown>;
}

interface CreditDeskLevel1ClientProps {
  proposals: Proposal[];
  currentUser?: { id: string; full_name: string; role: string };
}

const CREDIT_LINES = ["HOME EQUITY", "HOME EQUITY ESTRESSADO", "AVAL", "FUNDO CONSTRUÇÃO RESIDENCIAL"];


export function CreditDeskLevel1Client({ proposals: initial, currentUser }: CreditDeskLevel1ClientProps) {
  const [proposals, setProposals] = useState<Proposal[]>(initial);
  const [search, setSearch] = useState("");
  const [filterLine, setFilterLine] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [newOpen, setNewOpen] = useState(false);
  const [detailProposal, setDetailProposal] = useState<Proposal | null>(null);
  const [view, setView] = useState<"table" | "kanban">("table");

  // Busca dados frescos da API ao montar (reflete atualizações da Mesa Operacional)
  useEffect(() => {
    fetch("/api/credit-proposals?level=NIVEL_1")
      .then(r => r.json())
      .then(({ proposals: fresh }) => {
        if (!Array.isArray(fresh)) return;
        setProposals(fresh.map((p: Record<string, unknown>) => {
          const meta = p.metadata as Record<string, unknown> | null;
          return {
            id: p.id as string,
            code: p.code as string,
            title: p.title as string,
            client_name: p.client_name as string,
            cpf_cnpj: p.client_cpf_cnpj as string | undefined,
            client_type: (meta?.client_type as string | undefined) ?? p.client_type as string | undefined,
            email: meta?.email as string | undefined,
            telefone: meta?.telefone as string | undefined,
            prazo: meta?.prazo as string | undefined,
            finalidade: meta?.finalidade as string | undefined,
            credit_line: p.credit_line as string,
            requested_value: p.requested_value as number,
            approved_value: (p.approved_value as number | null) ?? null,
            current_level: p.current_level as string,
            status: p.status as string,
            stage: p.stage as string | undefined,
            partner_id: (p.partner as { id?: string } | null)?.id,
            partner_name: (p.partner as { full_name?: string } | null)?.full_name,
            created_at: p.created_at as string,
            valor_credito_atual: p.valor_credito_atual as number | undefined,
            comissao_mandato_perc: p.comissao_mandato_perc as number | undefined,
            comissao_instituicao_perc: p.comissao_instituicao_perc as number | undefined,
            metadata: meta ?? undefined,
          };
        }));
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const partnerName = currentUser?.full_name ?? "João Partner Silva";
  const partnerId = currentUser?.id ?? "demo-partner-001";
  const canChangeStage = currentUser?.role === "MESA_OPERACIONAL" || currentUser?.role === "ADMIN" || currentUser?.role === "GESTAO";
  const canEditValorSolicitado = canChangeStage || currentUser?.role === "PARTNER" || currentUser?.role === "PARTNER_PRO";

  const filtered = proposals.filter((p) => {
    const matchSearch =
      !search ||
      p.client_name.toLowerCase().includes(search.toLowerCase()) ||
      p.code.toLowerCase().includes(search.toLowerCase()) ||
      p.title.toLowerCase().includes(search.toLowerCase());
    const matchLine = !filterLine || p.credit_line === filterLine;
    const matchStatus = !filterStatus || p.status === filterStatus;
    return matchSearch && matchLine && matchStatus;
  });

  const totalValue = filtered.reduce((sum, p) => sum + p.requested_value, 0);

  const handleNewProposal = useCallback(async (proposal: Record<string, unknown>) => {
    const p = proposal as unknown as Proposal;
    try {
      const raw = proposal as Record<string, unknown>;
      // Usa metadata se já vier montado pelo nova-proposta-modal, senão constrói
      const metadata = (raw.metadata as Record<string, unknown>) ?? {
        client_type:       raw.client_type,
        email:             raw.email,
        telefone:          raw.telefone,
        prazo:             raw.prazo,
        finalidade:        raw.finalidade,
        restricao_cliente: raw.restricao_cliente,
        imoveis:           raw.imoveis,
      };
      const res = await fetch("/api/credit-proposals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code:            p.code,
          title:           p.title,
          client_name:     p.client_name,
          client_cpf_cnpj: p.cpf_cnpj ?? null,
          credit_line:     p.credit_line,
          requested_value: p.requested_value,
          current_level:   "NIVEL_1",
          metadata,
        }),
      });
      const json = await res.json();
      if (json.ok && json.proposal) {
        setProposals(prev => [{
          ...p,
          id: json.proposal.id,
          partner_id: json.proposal.partner_id ?? p.partner_id,
          metadata: json.proposal.metadata ?? metadata,
        }, ...prev]);
        return;
      }
      const errMsg = typeof json.error === "string"
        ? json.error
        : JSON.stringify(json.error ?? "Erro desconhecido");
      throw new Error(errMsg);
    } catch (err) {
      throw err instanceof Error ? err : new Error("Erro ao salvar proposta. Verifique sua conexão e tente novamente.");
    }
  }, []);

  const handleStageChange = useCallback((proposalId: string, newStage: string) => {
    setProposals((prev) =>
      prev.map((p) => p.id === proposalId ? { ...p, stage: newStage } : p)
    );
    if (detailProposal?.id === proposalId) {
      setDetailProposal((prev) => prev ? { ...prev, stage: newStage } : prev);
    }
  }, [detailProposal]);

  const handleProposalUpdate = useCallback((proposalId: string, updates: Partial<Proposal>) => {
    setProposals((prev) =>
      prev.map((p) => p.id === proposalId ? { ...p, ...updates } : p)
    );
    if (detailProposal?.id === proposalId) {
      setDetailProposal((prev) => prev ? { ...prev, ...updates } : prev);
    }
  }, [detailProposal]);

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
            <HomeIcon className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Nível 1 — Crédito Varejo</h1>
            <p className="text-xs text-muted-foreground">Home Equity · Aval · Fundo Construção Residencial</p>
          </div>
        </div>
        <Button size="sm" onClick={() => setNewOpen(true)}>
          <Plus className="w-4 h-4 mr-1.5" /> Nova Proposta
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total de Propostas", value: filtered.length, color: "text-blue-400" },
          { label: "Volume Total", value: formatCurrency(totalValue), color: "text-white" },
          { label: "Aprovadas", value: filtered.filter((p) => p.status === "APPROVED").length, color: "text-emerald-400" },
          { label: "Em Análise", value: filtered.filter((p) => p.status === "IN_REVIEW").length, color: "text-amber-400" },
        ].map((kpi) => (
          <Card key={kpi.label}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{kpi.label}</p>
              <p className={`text-xl font-bold mt-1 ${kpi.color}`}>{kpi.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por cliente, código..."
            className="w-full h-9 pl-9 pr-4 text-sm bg-secondary border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
          />
        </div>
        <select value={filterLine} onChange={(e) => setFilterLine(e.target.value)}
          className="h-9 px-3 text-sm bg-secondary border border-border rounded-lg text-foreground focus:outline-none">
          <option value="">Todas as linhas</option>
          {CREDIT_LINES.map((line) => <option key={line} value={line}>{line}</option>)}
        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
          className="h-9 px-3 text-sm bg-secondary border border-border rounded-lg text-foreground focus:outline-none">
          <option value="">Todos os status</option>
          <option value="PENDING">Pendente</option>
          <option value="IN_REVIEW">Em Análise</option>
          <option value="APPROVED">Aprovado</option>
          <option value="REJECTED">Reprovado</option>
        </select>
        <div className="flex gap-1 p-1 bg-secondary rounded-lg ml-auto">
          <button
            title="Tabela"
            onClick={() => setView("table")}
            className={`p-1.5 rounded transition-colors ${view === "table" ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-white"}`}
          >
            <List className="w-4 h-4" />
          </button>
          <button
            title="Kanban"
            onClick={() => setView("kanban")}
            className={`p-1.5 rounded transition-colors ${view === "kanban" ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-white"}`}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
        </div>
      </div>

      {(() => {
        const KANBAN_STAGES = [
          { key: "RECEBIDO",   label: "Recebido",          borderColor: "border-slate-500/40",   headerColor: "text-slate-400",   bg: "bg-slate-500/5"  },
          { key: "TRIAGEM",    label: "Triagem",            borderColor: "border-blue-500/40",    headerColor: "text-blue-400",    bg: "bg-blue-500/5"   },
          { key: "ANALISE",    label: "Análise de Crédito", borderColor: "border-amber-500/40",   headerColor: "text-amber-400",   bg: "bg-amber-500/5"  },
          { key: "PENDENCIA",  label: "Pendência de Docs",  borderColor: "border-orange-500/40",  headerColor: "text-orange-400",  bg: "bg-orange-500/5" },
          { key: "APROVACAO",  label: "Em Aprovação",       borderColor: "border-purple-500/40",  headerColor: "text-purple-400",  bg: "bg-purple-500/5" },
          { key: "FINALIZADO", label: "Finalizado",         borderColor: "border-emerald-500/40", headerColor: "text-emerald-400", bg: "bg-emerald-500/5"},
        ];
        if (view === "kanban") return (
          <div className="overflow-x-auto pb-2">
            <div className="flex gap-3 min-w-max">
              {KANBAN_STAGES.map((stage) => {
                const stageCards = filtered.filter((p) => (p.stage ?? "RECEBIDO") === stage.key);
                return (
                  <div key={stage.key} className={`w-56 flex-shrink-0 rounded-xl border ${stage.borderColor} ${stage.bg} p-3 flex flex-col gap-2`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-[11px] font-bold uppercase tracking-wide ${stage.headerColor}`}>{stage.label}</span>
                      <span className="text-[10px] text-muted-foreground bg-secondary/80 rounded px-1.5 py-0.5 font-semibold">{stageCards.length}</span>
                    </div>
                    {stageCards.length === 0 ? (
                      <div className="flex items-center justify-center py-8 text-[11px] text-muted-foreground/40">Vazio</div>
                    ) : (
                      stageCards.map((p) => (
                        <div
                          key={p.id}
                          onClick={() => setDetailProposal(p)}
                          className="bg-card border border-border/60 rounded-lg p-3 cursor-pointer hover:border-primary/40 hover:bg-card/80 transition-all space-y-2 group"
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-mono text-[9px] text-muted-foreground truncate">{p.code}</span>
                            <Badge className={`${STATUS_COLORS[p.status as OperationStatus]} text-[9px] px-1.5 py-0 leading-4`}>
                              {STATUS_LABELS[p.status as OperationStatus]}
                            </Badge>
                          </div>
                          <p className="text-[11px] font-semibold text-white leading-tight line-clamp-2 group-hover:text-primary transition-colors">{p.client_name}</p>
                          <div className="flex items-center justify-between gap-1">
                            <Badge variant="info" className="text-[9px] truncate max-w-[100px]">{p.credit_line}</Badge>
                            <span className="text-[10px] font-bold text-emerald-400 flex-shrink-0">{formatCurrency(p.requested_value)}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
        return null;
      })()}

      {/* Table */}
      <Card className={view === "kanban" ? "hidden" : ""}>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <HomeIcon className="w-6 h-6 text-blue-400" />
              </div>
              <p className="text-muted-foreground text-sm">Nenhuma proposta encontrada</p>
              <Button size="sm" variant="outline" onClick={() => setNewOpen(true)}>
                <Plus className="w-4 h-4 mr-1.5" /> Criar primeira proposta
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50">
                    {["Código", "Cliente", "Tipo", "Linha", "Valor Solicitado", "Valor Aprovado", "Etapa", "Status", "Data"].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((proposal) => (
                    <tr key={proposal.id} className="data-table-row cursor-pointer" onClick={() => setDetailProposal(proposal)}>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{proposal.code}</td>
                      <td className="px-4 py-3 font-medium text-foreground max-w-36 truncate">{proposal.client_name}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{proposal.client_type ?? "PF"}</td>
                      <td className="px-4 py-3"><Badge variant="info">{proposal.credit_line}</Badge></td>
                      <td className="px-4 py-3 text-right font-semibold text-white">{formatCurrency(proposal.requested_value)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-emerald-400">
                        {proposal.approved_value ? formatCurrency(proposal.approved_value) : "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{proposal.stage ?? "RECEBIDO"}</td>
                      <td className="px-4 py-3">
                        <Badge className={STATUS_COLORS[proposal.status as OperationStatus]}>
                          {STATUS_LABELS[proposal.status as OperationStatus]}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{formatDate(proposal.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modais */}
      <NovaPropostaModal
        open={newOpen}
        onClose={() => setNewOpen(false)}
        level="NIVEL_1"
        partnerName={partnerName}
        partnerId={partnerId}
        onSubmit={handleNewProposal}
      />

      <PropostaDetailModal
        open={!!detailProposal}
        onClose={() => setDetailProposal(null)}
        proposal={detailProposal as ProposalFull | null}
        onStageChange={handleStageChange}
        onProposalUpdate={handleProposalUpdate}
        canChangeStage={canChangeStage}
        canEditValorSolicitado={canEditValorSolicitado}
      />
    </div>
  );
}
