"use client";

import React, { useState, useCallback, useEffect } from "react";
import { Home as HomeIcon, LayoutGrid, List, Plus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/utils";
import { STATUS_LABELS, STATUS_COLORS, type OperationStatus } from "@/lib/constants";
import { NovaPropostaModal } from "./nova-proposta-modal";
import { PropostaDetailModal, type ProposalFull } from "./proposta-detail-modal";
import {
  AdvancedFilters, applyFilters, getSLAInfo, SLABadge,
  EMPTY_FILTERS, type FilterState,
} from "./advanced-filters";

interface Proposal {
  id: string; code: string; title: string;
  client_name: string; client_type?: string;
  cpf_cnpj?: string; email?: string; telefone?: string;
  credit_line: string; requested_value: number;
  approved_value: number | null; prazo?: string; finalidade?: string;
  current_level: string; status: string; stage?: string;
  partner_id?: string; partner_name?: string;
  docs_uploaded?: number; docs_required?: number;
  created_at: string;
  valor_credito_atual?: number;
  comissao_mandato_perc?: number; comissao_instituicao_perc?: number;
  imovel_endereco?: string; imovel_valor_medio?: number;
  imovel_cidade?: string; imovel_estado?: string;
  metadata?: Record<string, unknown>;
  level1_notes?: string | null;
  level2_notes?: string | null;
  level3_notes?: string | null;
  level1_at?: string | null;
  level2_at?: string | null;
  level3_at?: string | null;
  pending_reason?: string | null;
  pending_responsible?: string | null;
  pending_at?: string | null;
  pending_resolved_at?: string | null;
  pending_resolved_by?: string | null;
}

interface CreditDeskLevel1ClientProps {
  proposals: Proposal[];
  currentUser?: { id: string; full_name: string; role: string };
}

const CREDIT_LINES_N1 = [
  "HOME EQUITY", "HOME EQUITY ESTRESSADO", "AVAL", "FUNDO CONSTRUÇÃO RESIDENCIAL",
];

const KANBAN_STAGES = [
  { key: "RECEBIDO",   label: "Recebido",          borderColor: "border-slate-500/40",   headerColor: "text-slate-400",   bg: "bg-slate-500/5"  },
  { key: "TRIAGEM",    label: "Triagem",            borderColor: "border-blue-500/40",    headerColor: "text-blue-400",    bg: "bg-blue-500/5"   },
  { key: "ANALISE",    label: "Análise de Crédito", borderColor: "border-amber-500/40",   headerColor: "text-amber-400",   bg: "bg-amber-500/5"  },
  { key: "PENDENCIA",  label: "Pendência de Docs",  borderColor: "border-orange-500/40",  headerColor: "text-orange-400",  bg: "bg-orange-500/5" },
  { key: "APROVACAO",  label: "Em Aprovação",       borderColor: "border-purple-500/40",  headerColor: "text-purple-400",  bg: "bg-purple-500/5" },
  { key: "FINALIZADO", label: "Finalizado",         borderColor: "border-emerald-500/40", headerColor: "text-emerald-400", bg: "bg-emerald-500/5"},
];

export function CreditDeskLevel1Client({ proposals: initial, currentUser }: CreditDeskLevel1ClientProps) {
  const [proposals, setProposals] = useState<Proposal[]>(initial);
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [newOpen, setNewOpen]   = useState(false);
  const [detailProposal, setDetailProposal] = useState<Proposal | null>(null);
  const [view, setView] = useState<"table" | "kanban">("table");

  useEffect(() => {
    fetch("/api/credit-proposals?level=NIVEL_1")
      .then(r => r.json())
      .then(({ proposals: fresh }) => {
        if (!Array.isArray(fresh)) return;
        setProposals(fresh.map((p: Record<string, unknown>) => {
          const meta = p.metadata as Record<string, unknown> | null;
          return {
            id: p.id as string, code: p.code as string, title: p.title as string,
            client_name: p.client_name as string,
            cpf_cnpj: p.client_cpf_cnpj as string | undefined,
            client_type: (meta?.client_type ?? p.client_type) as string | undefined,
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
            level1_notes: p.level1_notes as string | null | undefined,
            level2_notes: p.level2_notes as string | null | undefined,
            level3_notes: p.level3_notes as string | null | undefined,
            level1_at: p.level1_at as string | null | undefined,
            level2_at: p.level2_at as string | null | undefined,
            level3_at: p.level3_at as string | null | undefined,
            pending_reason: p.pending_reason as string | null | undefined,
            pending_responsible: p.pending_responsible as string | null | undefined,
            pending_at: p.pending_at as string | null | undefined,
            pending_resolved_at: p.pending_resolved_at as string | null | undefined,
            pending_resolved_by: p.pending_resolved_by as string | null | undefined,
          };
        }));
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isAdmin = ["MESA_OPERACIONAL", "ADMIN", "GESTAO"].includes(currentUser?.role ?? "");
  const canChangeStage = isAdmin;
  const canEditValorSolicitado = isAdmin || currentUser?.role === "PARTNER" || currentUser?.role === "PARTNER_PRO";
  const partnerName = currentUser?.full_name ?? "Partner";
  const partnerId   = currentUser?.id ?? "";

  const filtered = applyFilters(proposals, filters);
  const totalValue = filtered.reduce((s, p) => s + p.requested_value, 0);
  const slaCritical = filtered.filter(p => ["critical","expired"].includes(getSLAInfo(p).sla)).length;
  const slaWarning  = filtered.filter(p => getSLAInfo(p).sla === "warning").length;

  const handleNewProposal = useCallback(async (proposal: Record<string, unknown>): Promise<string> => {
    const p = proposal as unknown as Proposal;
    const raw = proposal as Record<string, unknown>;
    const metadata = (raw.metadata as Record<string, unknown>) ?? {
      client_type: raw.client_type, email: raw.email, telefone: raw.telefone,
      prazo: raw.prazo, finalidade: raw.finalidade,
      restricao_cliente: raw.restricao_cliente, imoveis: raw.imoveis,
    };
    const res = await fetch("/api/credit-proposals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: p.code, title: p.title, client_name: p.client_name,
        client_cpf_cnpj: p.cpf_cnpj ?? null,
        credit_line: p.credit_line, requested_value: p.requested_value,
        current_level: "NIVEL_1", metadata,
      }),
    });
    const json = await res.json();
    if (json.ok && json.proposal) {
      setProposals(prev => [{ ...p, id: json.proposal.id, partner_id: json.proposal.partner_id ?? p.partner_id, metadata: json.proposal.metadata ?? metadata }, ...prev]);
      return json.proposal.id as string;
    }
    if (typeof json.error === "string") {
      throw new Error(json.error);
    }
    if (json.error && typeof json.error === "object") {
      const msgs = Object.entries(json.error as Record<string, string[]>)
        .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`)
        .join(" | ");
      throw new Error(msgs || "Erro de validação ao salvar proposta.");
    }
    throw new Error("Erro ao salvar proposta. Tente novamente.");
  }, []);

  const handleStageChange = useCallback((proposalId: string, newStage: string) => {
    setProposals(prev => prev.map(p => p.id === proposalId ? { ...p, stage: newStage } : p));
    if (detailProposal?.id === proposalId) setDetailProposal(prev => prev ? { ...prev, stage: newStage } : prev);
    fetch("/api/credit-proposals", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: proposalId, stage: newStage }),
    }).catch(() => {});
  }, [detailProposal]);

  const handleProposalUpdate = useCallback((proposalId: string, updates: Partial<Proposal>) => {
    setProposals(prev => prev.map(p => p.id === proposalId ? { ...p, ...updates } : p));
    if (detailProposal?.id === proposalId) setDetailProposal(prev => prev ? { ...prev, ...updates } : prev);
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
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Total",      value: filtered.length,                                                          color: "text-blue-400" },
          { label: "Volume",     value: formatCurrency(totalValue),                                               color: "text-white" },
          { label: "Aprovadas",  value: filtered.filter(p => p.status === "APPROVED").length,                    color: "text-emerald-400" },
          { label: "Em Análise", value: filtered.filter(p => p.status === "IN_REVIEW").length,                   color: "text-amber-400" },
          { label: "SLA vencido",value: slaCritical > 0 ? `${slaCritical} crítico${slaCritical > 1 ? "s" : ""}` : slaWarning > 0 ? `${slaWarning} alerta${slaWarning > 1 ? "s" : ""}` : "OK",
            color: slaCritical > 0 ? "text-red-400" : slaWarning > 0 ? "text-amber-400" : "text-emerald-400" },
        ].map((kpi) => (
          <Card key={kpi.label}><CardContent className="p-4">
            <p className="text-xs text-muted-foreground">{kpi.label}</p>
            <p className={`text-lg font-bold mt-1 ${kpi.color}`}>{kpi.value}</p>
          </CardContent></Card>
        ))}
      </div>

      {/* Filtros avançados */}
      <AdvancedFilters
        filters={filters}
        onChange={setFilters}
        creditLines={CREDIT_LINES_N1}
        isAdmin={isAdmin}
      />

      {/* Toggle tabela/kanban */}
      <div className="flex justify-end">
        <div className="flex gap-1 p-1 bg-secondary rounded-lg">
          <button title="Tabela" onClick={() => setView("table")}
            className={`p-1.5 rounded transition-colors ${view === "table" ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-white"}`}>
            <List className="w-4 h-4" />
          </button>
          <button title="Kanban" onClick={() => setView("kanban")}
            className={`p-1.5 rounded transition-colors ${view === "kanban" ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-white"}`}>
            <LayoutGrid className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Kanban */}
      {view === "kanban" && (
        <div className="overflow-x-auto pb-2">
          <div className="flex gap-3 min-w-max">
            {KANBAN_STAGES.map((stage) => {
              const cards = filtered.filter(p => (p.stage ?? "RECEBIDO") === stage.key);
              return (
                <div key={stage.key} className={`w-56 flex-shrink-0 rounded-xl border ${stage.borderColor} ${stage.bg} p-3 flex flex-col gap-2`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-[11px] font-bold uppercase tracking-wide ${stage.headerColor}`}>{stage.label}</span>
                    <span className="text-[10px] text-muted-foreground bg-secondary/80 rounded px-1.5 py-0.5 font-semibold">{cards.length}</span>
                  </div>
                  {cards.length === 0 ? (
                    <div className="flex items-center justify-center py-8 text-[11px] text-muted-foreground/40">Vazio</div>
                  ) : (
                    cards.map((p) => {
                      const slaInfo = getSLAInfo(p);
                      const { sla, hoursLeft, hoursLimit, pct } = slaInfo;
                      return (
                        <div key={p.id} onClick={() => setDetailProposal(p)}
                          className={`bg-card border rounded-lg p-3 cursor-pointer hover:border-primary/40 hover:bg-card/80 transition-all space-y-2 group ${
                            sla === "expired" || sla === "critical" ? "border-red-500/40" : sla === "warning" ? "border-amber-500/40" : "border-border/60"
                          }`}>
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
                          {sla !== "ok" && (
                            <div className="space-y-1">
                              <div className="h-1 rounded-full bg-white/10 overflow-hidden">
                                <div className={`h-full rounded-full transition-all ${
                                  sla === "expired" || sla === "critical" ? "bg-red-500" : "bg-amber-400"
                                }`} style={{ width: `${pct}%` }} />
                              </div>
                              <SLABadge sla={sla} hoursLeft={hoursLeft} hoursLimit={hoursLimit} pct={pct} />
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tabela */}
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
                    {["Código", "Cliente", "Tipo", "Linha", "Valor Solicitado", "Valor Aprovado", "Etapa", "SLA", "Status", "Data"].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => {
                    const { sla, hoursLeft, hoursLimit, pct, hoursElapsed } = getSLAInfo(p);
                    const hoursLeftDisplay = hoursLeft === Infinity ? null : hoursLeft;
                    return (
                      <tr key={p.id}
                        className={`border-b border-border/30 cursor-pointer transition-colors ${
                          sla === "expired" || sla === "critical" ? "bg-red-500/5 hover:bg-red-500/10"
                          : sla === "warning" ? "bg-amber-500/5 hover:bg-amber-500/10"
                          : "hover:bg-secondary/50"
                        }`}
                        onClick={() => setDetailProposal(p)}>
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{p.code}</td>
                        <td className="px-4 py-3 font-medium text-foreground max-w-36 truncate">{p.client_name}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{p.client_type ?? "PF"}</td>
                        <td className="px-4 py-3"><Badge variant="info">{p.credit_line}</Badge></td>
                        <td className="px-4 py-3 text-right font-semibold text-white">{formatCurrency(p.requested_value)}</td>
                        <td className="px-4 py-3 text-right font-semibold text-emerald-400">{p.approved_value ? formatCurrency(p.approved_value) : "—"}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{p.stage ?? "RECEBIDO"}</td>
                        <td className="px-4 py-3 min-w-[100px]">
                          {sla === "ok" ? (
                            <span className="text-xs text-muted-foreground">
                              {hoursElapsed < 24 ? `${Math.round(hoursElapsed)}h` : `${Math.round(hoursElapsed / 24)}d`}
                            </span>
                          ) : (
                            <SLABadge sla={sla} hoursLeft={hoursLeftDisplay ?? 0} hoursLimit={hoursLimit} pct={pct} />
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <Badge className={STATUS_COLORS[p.status as OperationStatus]}>{STATUS_LABELS[p.status as OperationStatus]}</Badge>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{formatDate(p.created_at)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <NovaPropostaModal open={newOpen} onClose={() => setNewOpen(false)} level="NIVEL_1"
        partnerName={partnerName} partnerId={partnerId} onSubmit={handleNewProposal} />

      <PropostaDetailModal
        open={!!detailProposal} onClose={() => setDetailProposal(null)}
        proposal={detailProposal as ProposalFull | null}
        onStageChange={handleStageChange} onProposalUpdate={handleProposalUpdate}
        canChangeStage={canChangeStage} canEditValorSolicitado={canEditValorSolicitado} canEditInstituicao={isAdmin}
      />
    </div>
  );
}
