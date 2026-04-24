"use client";

import { useState } from "react";
import { CreditCard, Building2, Trophy, Clock, CheckCircle2, XCircle, AlertCircle, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface Proposta {
  id: string;
  code: string;
  title: string;
  client_name: string;
  credit_line: string;
  requested_value: number;
  approved_value: number | null;
  status: string;
  current_level: string;
  created_at: string;
  updated_at: string;
}

interface Deal {
  id: string;
  code: string;
  title: string;
  stage: string;
  deal_value: number | null;
  sector: string | null;
  created_at: string;
  updated_at: string;
}

interface Lead {
  id: string;
  code: string;
  client: string;
  type: string;
  value: number | null;
  stage: string;
  created_at: string;
}

interface Props {
  propostas: Proposta[];
  deals: Deal[];
  leads: Lead[];
  partnerName: string;
}

const moeda = (v: number | null) =>
  v ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v) : "—";

const dataFmt = (d: string) => new Date(d).toLocaleDateString("pt-BR");

function StatusCredito({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    PENDING:     { label: "Pendente",      cls: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
    IN_REVIEW:   { label: "Em Análise",    cls: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
    APPROVED:    { label: "Aprovado",      cls: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
    REJECTED:    { label: "Reprovado",     cls: "bg-red-500/20 text-red-400 border-red-500/30" },
    WAITING_DOCS:{ label: "Aguard. Docs",  cls: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
    CANCELLED:   { label: "Cancelado",     cls: "bg-gray-500/20 text-gray-400 border-gray-500/30" },
  };
  const cfg = map[status] ?? { label: status, cls: "bg-gray-500/20 text-gray-400 border-gray-500/30" };
  return <span className={`text-[10px] font-semibold border px-2 py-0.5 rounded-full ${cfg.cls}`}>{cfg.label}</span>;
}

function StatusMA({ stage }: { stage: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    PROSPECTING:   { label: "Prospecção",    cls: "bg-gray-500/20 text-gray-400 border-gray-500/30" },
    QUALIFICATION: { label: "Qualificação",  cls: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
    DUE_DILIGENCE: { label: "Due Diligence", cls: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
    NEGOTIATION:   { label: "Negociação",    cls: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
    CLOSING:       { label: "Fechamento",    cls: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
    CLOSED_WON:    { label: "Fechado ✓",     cls: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
    CLOSED_LOST:   { label: "Perdido",       cls: "bg-red-500/20 text-red-400 border-red-500/30" },
  };
  const cfg = map[stage] ?? { label: stage, cls: "bg-gray-500/20 text-gray-400 border-gray-500/30" };
  return <span className={`text-[10px] font-semibold border px-2 py-0.5 rounded-full ${cfg.cls}`}>{cfg.label}</span>;
}

type Tab = "credito" | "ma" | "consorcio";

export function MinhasOperacoesClient({ propostas, deals, leads, partnerName }: Props) {
  const [tab, setTab] = useState<Tab>("credito");

  const totalCredito = propostas.filter(p => p.status === "APPROVED").reduce((s, p) => s + (p.approved_value ?? p.requested_value ?? 0), 0);
  const totalMA = deals.filter(d => d.stage === "CLOSED_WON").reduce((s, d) => s + (d.deal_value ?? 0), 0);
  const totalConsorcio = leads.reduce((s, l) => s + (l.value ?? 0), 0);

  const tabs: { id: Tab; label: string; icon: React.ReactNode; count: number }[] = [
    { id: "credito",   label: "Crédito",  icon: <CreditCard className="w-4 h-4" />,  count: propostas.length },
    { id: "ma",        label: "M&A",      icon: <Building2 className="w-4 h-4" />,   count: deals.length },
    { id: "consorcio", label: "Consórcio",icon: <Trophy className="w-4 h-4" />,      count: leads.length },
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Minhas Operações</h1>
        <p className="text-sm text-muted-foreground mt-1">Acompanhe todas as suas operações enviadas — {partnerName}</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: "Crédito Aprovado", value: totalCredito, count: propostas.filter(p => p.status === "APPROVED").length, icon: <CreditCard className="w-4 h-4 text-blue-400" />, color: "text-blue-400", bg: "bg-blue-500/20" },
          { label: "M&A Fechados",     value: totalMA,       count: deals.filter(d => d.stage === "CLOSED_WON").length,    icon: <Building2 className="w-4 h-4 text-purple-400" />, color: "text-purple-400", bg: "bg-purple-500/20" },
          { label: "Consórcio (leads)",value: totalConsorcio,count: leads.length,                                           icon: <Trophy className="w-4 h-4 text-amber-400" />,    color: "text-amber-400",  bg: "bg-amber-500/20" },
        ].map(kpi => (
          <div key={kpi.label} className="kpi-card">
            <div className={`w-9 h-9 rounded-xl ${kpi.bg} flex items-center justify-center mb-3`}>{kpi.icon}</div>
            <p className={`text-xl font-bold ${kpi.color}`}>{moeda(kpi.value)}</p>
            <p className="text-sm font-medium text-foreground mt-0.5">{kpi.label}</p>
            <p className="text-xs text-muted-foreground">{kpi.count} operaç{kpi.count !== 1 ? "ões" : "ão"}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex bg-secondary rounded-lg p-0.5 w-fit">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-xs font-semibold transition-all ${tab === t.id ? "bg-[#C9A84C] text-[#09081A]" : "text-muted-foreground hover:text-foreground"}`}
          >
            {t.icon} {t.label}
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${tab === t.id ? "bg-[#09081A]/20" : "bg-secondary"}`}>{t.count}</span>
          </button>
        ))}
      </div>

      {/* Crédito */}
      {tab === "credito" && (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/40">
                    {["Código", "Operação", "Cliente", "Linha", "Vlr. Solicitado", "Vlr. Aprovado", "Nível", "Status", "Envio"].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-muted-foreground font-semibold uppercase tracking-wide text-[10px] whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {propostas.length === 0 ? (
                    <tr><td colSpan={9} className="px-4 py-12 text-center text-muted-foreground">
                      <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      Nenhuma proposta de crédito enviada
                    </td></tr>
                  ) : propostas.map((p, i) => (
                    <tr key={p.id} className={`border-b border-border/20 hover:bg-secondary/30 transition-colors ${i % 2 === 0 ? "" : "bg-[#091221]/40"}`}>
                      <td className="px-4 py-3 font-mono text-muted-foreground">{p.code}</td>
                      <td className="px-4 py-3 text-white max-w-[160px]"><div className="truncate" title={p.title}>{p.title}</div></td>
                      <td className="px-4 py-3 text-muted-foreground">{p.client_name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{p.credit_line}</td>
                      <td className="px-4 py-3 text-white">{moeda(p.requested_value)}</td>
                      <td className="px-4 py-3 text-emerald-400 font-semibold">{moeda(p.approved_value)}</td>
                      <td className="px-4 py-3 text-muted-foreground">{p.current_level?.replace("NIVEL_", "N") ?? "—"}</td>
                      <td className="px-4 py-3"><StatusCredito status={p.status} /></td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{dataFmt(p.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* M&A */}
      {tab === "ma" && (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/40">
                    {["Código", "Negócio", "Setor", "Valor", "Estágio", "Criado em"].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-muted-foreground font-semibold uppercase tracking-wide text-[10px] whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {deals.length === 0 ? (
                    <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                      <Building2 className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      Nenhum negócio M&A cadastrado
                    </td></tr>
                  ) : deals.map((d, i) => (
                    <tr key={d.id} className={`border-b border-border/20 hover:bg-secondary/30 transition-colors ${i % 2 === 0 ? "" : "bg-[#091221]/40"}`}>
                      <td className="px-4 py-3 font-mono text-muted-foreground">{d.code}</td>
                      <td className="px-4 py-3 text-white max-w-[200px]"><div className="truncate" title={d.title}>{d.title}</div></td>
                      <td className="px-4 py-3 text-muted-foreground">{d.sector ?? "—"}</td>
                      <td className="px-4 py-3 text-white">{moeda(d.deal_value)}</td>
                      <td className="px-4 py-3"><StatusMA stage={d.stage} /></td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{dataFmt(d.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Consórcio */}
      {tab === "consorcio" && (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/40">
                    {["Código", "Cliente", "Tipo", "Valor", "Estágio", "Criado em"].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-muted-foreground font-semibold uppercase tracking-wide text-[10px] whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {leads.length === 0 ? (
                    <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                      <Trophy className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      Nenhum lead de consórcio cadastrado
                    </td></tr>
                  ) : leads.map((l, i) => (
                    <tr key={l.id} className={`border-b border-border/20 hover:bg-secondary/30 transition-colors ${i % 2 === 0 ? "" : "bg-[#091221]/40"}`}>
                      <td className="px-4 py-3 font-mono text-muted-foreground">{l.code}</td>
                      <td className="px-4 py-3 text-white">{l.client}</td>
                      <td className="px-4 py-3 text-muted-foreground">{l.type}</td>
                      <td className="px-4 py-3 text-white">{moeda(l.value)}</td>
                      <td className="px-4 py-3">
                        <span className="text-[10px] font-semibold border px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border-blue-500/30 capitalize">{l.stage}</span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{dataFmt(l.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Resumo de performance */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total Crédito Enviado", value: propostas.length, icon: <Clock className="w-3.5 h-3.5 text-amber-400" />, sub: `${propostas.filter(p => p.status === "APPROVED").length} aprovados` },
          { label: "Taxa de Aprovação Crédito", value: propostas.length > 0 ? `${((propostas.filter(p => p.status === "APPROVED").length / propostas.length) * 100).toFixed(0)}%` : "—", icon: <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />, sub: "operações aprovadas" },
          { label: "M&A Fechados", value: deals.filter(d => d.stage === "CLOSED_WON").length, icon: <CheckCircle2 className="w-3.5 h-3.5 text-purple-400" />, sub: `de ${deals.length} negócios` },
        ].map(kpi => (
          <div key={kpi.label} className="bg-[#091221] border border-[#122036] rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">{kpi.icon}<span className="text-[10px] text-muted-foreground uppercase tracking-wide">{kpi.label}</span></div>
            <p className="text-xl font-bold text-white">{kpi.value}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{kpi.sub}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
