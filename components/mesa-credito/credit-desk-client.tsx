"use client";

import React, { useState, useCallback, useEffect } from "react";
import { Plus, Search, TrendingUp, Zap } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/utils";
import { STATUS_LABELS, STATUS_COLORS, type OperationStatus } from "@/lib/constants";
import { NovaPropostaModal } from "./nova-proposta-modal";
import { PropostaDetailModal, type ProposalFull } from "./proposta-detail-modal";

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
  comissao_mandato_perc?: number;
  comissao_instituicao_perc?: number;
}

interface CreditDeskClientProps {
  proposals: Proposal[];
  level: "NIVEL_2" | "NIVEL_3";
  currentUser?: { id: string; full_name: string; role: string };
}

const CONFIG = {
  NIVEL_2: {
    title: "Nível 2 — Crédito Estruturado",
    subtitle: "HomeCash · V3Giro e V3AutoGiro · CGI",
    gradient: "from-amber-500 to-orange-600",
    color: "text-amber-400",
    badgeVariant: "warning" as const,
  },
  NIVEL_3: {
    title: "Nível 3 — High Ticket",
    subtitle: "CRI · CRA · CPR · Fundos Internacionais · Fundos de Construção",
    gradient: "from-purple-500 to-indigo-600",
    color: "text-purple-400",
    badgeVariant: "default" as const,
  },
};

const LS_KEY = "v3_demo_proposals";
function loadFromStorage(): Proposal[] {
  try { return JSON.parse(localStorage.getItem(LS_KEY) ?? "[]"); } catch { return []; }
}
function saveToStorage(all: Proposal[]) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(all)); } catch {}
}

export function CreditDeskClient({ proposals: initial, level, currentUser }: CreditDeskClientProps) {
  const [proposals, setProposals] = useState<Proposal[]>(initial);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [newOpen, setNewOpen] = useState(false);
  const [detailProposal, setDetailProposal] = useState<Proposal | null>(null);

  useEffect(() => {
    const stored = loadFromStorage().filter((s) => s.current_level === level);
    if (stored.length === 0) return;
    setProposals((prev) => {
      const ids = new Set(prev.map((p) => p.id));
      const newOnes = stored.filter((s) => !ids.has(s.id));
      return newOnes.length > 0 ? [...newOnes, ...prev] : prev;
    });
  }, [level]);

  const cfg = CONFIG[level];
  const partnerName = currentUser?.full_name ?? "João Partner Silva";
  const partnerId = currentUser?.id ?? "demo-partner-001";
  const canChangeStage = currentUser?.role === "MESA_OPERACIONAL" || currentUser?.role === "ADMIN" || currentUser?.role === "GESTAO";

  const filtered = proposals.filter((p) => {
    const matchSearch = !search ||
      p.client_name.toLowerCase().includes(search.toLowerCase()) ||
      p.code.toLowerCase().includes(search.toLowerCase());
    const matchStatus = !filterStatus || p.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const totalValue = filtered.reduce((s, p) => s + p.requested_value, 0);

  const handleNewProposal = useCallback((proposal: Record<string, unknown>) => {
    const p = proposal as unknown as Proposal;
    setProposals((prev) => {
      const stored = loadFromStorage().filter((s) => s.id !== p.id);
      saveToStorage([p, ...stored]);
      return [p, ...prev];
    });
  }, []);

  const handleStageChange = useCallback((proposalId: string, newStage: string) => {
    setProposals((prev) => prev.map((p) => p.id === proposalId ? { ...p, stage: newStage } : p));
    if (detailProposal?.id === proposalId) {
      setDetailProposal((prev) => prev ? { ...prev, stage: newStage } : prev);
    }
  }, [detailProposal]);

  const handleProposalUpdate = useCallback((proposalId: string, updates: Partial<Proposal>) => {
    setProposals((prev) => prev.map((p) => p.id === proposalId ? { ...p, ...updates } : p));
    if (detailProposal?.id === proposalId) {
      setDetailProposal((prev) => prev ? { ...prev, ...updates } : prev);
    }
  }, [detailProposal]);

  const Icon = level === "NIVEL_3" ? Zap : TrendingUp;

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${cfg.gradient} flex items-center justify-center`}>
            <Icon className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">{cfg.title}</h1>
            <p className="text-xs text-muted-foreground">{cfg.subtitle}</p>
          </div>
        </div>
        <Button size="sm" onClick={() => setNewOpen(true)}>
          <Plus className="w-4 h-4 mr-1.5" /> Nova Operação
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total", value: filtered.length, color: cfg.color },
          { label: "Volume", value: formatCurrency(totalValue), color: "text-white" },
          { label: "Aprovadas", value: filtered.filter((p) => p.status === "APPROVED").length, color: "text-emerald-400" },
          { label: "Em Análise", value: filtered.filter((p) => p.status === "IN_REVIEW").length, color: "text-blue-400" },
        ].map((kpi) => (
          <Card key={kpi.label}><CardContent className="p-4">
            <p className="text-xs text-muted-foreground">{kpi.label}</p>
            <p className={`text-xl font-bold mt-1 ${kpi.color}`}>{kpi.value}</p>
          </CardContent></Card>
        ))}
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por cliente, código..."
            className="w-full h-9 pl-9 pr-4 text-sm bg-secondary border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50" />
        </div>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
          className="h-9 px-3 text-sm bg-secondary border border-border rounded-lg text-foreground focus:outline-none">
          <option value="">Todos os status</option>
          <option value="PENDING">Pendente</option>
          <option value="IN_REVIEW">Em Análise</option>
          <option value="APPROVED">Aprovado</option>
          <option value="REJECTED">Reprovado</option>
        </select>
      </div>

      <Card>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Icon className={`w-10 h-10 ${cfg.color}/50`} />
              <p className="text-muted-foreground text-sm">Nenhuma operação encontrada</p>
              <Button size="sm" variant="outline" onClick={() => setNewOpen(true)}>
                <Plus className="w-4 h-4 mr-1.5" /> Nova Operação
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50">
                    {["Código", "Cliente", "Tipo", "Instrumento", "Valor Solicitado", "Valor Aprovado", "Etapa", "Status", "Data"].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => (
                    <tr key={p.id} className="data-table-row cursor-pointer" onClick={() => setDetailProposal(p)}>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{p.code}</td>
                      <td className="px-4 py-3 font-medium text-foreground max-w-36 truncate">{p.client_name}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{p.client_type ?? "PJ"}</td>
                      <td className="px-4 py-3"><Badge variant={cfg.badgeVariant}>{p.credit_line}</Badge></td>
                      <td className="px-4 py-3 text-right font-semibold text-white">{formatCurrency(p.requested_value)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-emerald-400">{p.approved_value ? formatCurrency(p.approved_value) : "—"}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{p.stage ?? "RECEBIDO"}</td>
                      <td className="px-4 py-3">
                        <Badge className={STATUS_COLORS[p.status as OperationStatus]}>{STATUS_LABELS[p.status as OperationStatus]}</Badge>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{formatDate(p.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <NovaPropostaModal
        open={newOpen}
        onClose={() => setNewOpen(false)}
        level={level}
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
      />
    </div>
  );
}
