"use client";

import React, { useState } from "react";
import { Wallet, TrendingUp, Clock, CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatMoeda } from "@/lib/demo-data-financeiro";
import { ExportButton } from "@/components/financeiro/export-button";

export interface CommissionRow {
  id: string;
  code: string;
  partner_id: string;
  operation_type: string;
  operation_code: string | null;
  operation_description: string;
  operation_value: number;
  commission_percent: number;
  commission_value: number;
  status: string;
  operation_closed_at: string | null;
  payment_date: string | null;
  notes: string | null;
  created_at: string;
}

interface Props {
  partnerId: string;
  partnerName: string;
  role: string;
  commissions: CommissionRow[];
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    A_PAGAR: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    PAGA: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    CANCELADA: "bg-gray-500/20 text-gray-400 border-gray-500/30",
  };
  const labels: Record<string, string> = { A_PAGAR: "A Receber", PAGA: "Recebida", CANCELADA: "Cancelada" };
  return (
    <span className={`text-[10px] font-semibold border px-2 py-0.5 rounded-full ${map[status] ?? ""}`}>
      {labels[status] ?? status}
    </span>
  );
}

function TipoBadge({ tipo }: { tipo: string }) {
  const map: Record<string, string> = {
    CREDITO: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    MA: "bg-purple-500/20 text-purple-400 border-purple-500/30",
    CONSORCIO: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  };
  const labels: Record<string, string> = { CREDITO: "Crédito", MA: "M&A", CONSORCIO: "Consórcio" };
  return (
    <span className={`text-[10px] font-semibold border px-2 py-0.5 rounded-full ${map[tipo] ?? ""}`}>
      {labels[tipo] ?? tipo}
    </span>
  );
}

export function ComissoesPartnerClient({ partnerId, partnerName, role, commissions }: Props) {
  const [filtroTipo, setFiltroTipo] = useState<"TODOS" | "CREDITO" | "MA" | "CONSORCIO" | "SPLIT_FISCAL">("TODOS");
  const [filtroStatus, setFiltroStatus] = useState<"TODOS" | "A_PAGAR" | "PAGA">("TODOS");

  const filtradas = commissions.filter(c =>
    (filtroTipo === "TODOS" || c.operation_type === filtroTipo) &&
    (filtroStatus === "TODOS" || c.status === filtroStatus)
  );

  const aReceber = commissions.filter(c => c.status === "A_PAGAR").reduce((s, c) => s + (c.commission_value ?? 0), 0);
  const recebido = commissions.filter(c => c.status === "PAGA").reduce((s, c) => s + (c.commission_value ?? 0), 0);
  const totalGeral = aReceber + recebido;

  const porTipo = (["CREDITO", "MA", "CONSORCIO", "SPLIT_FISCAL"] as const).map(tipo => ({
    tipo,
    total: commissions.filter(c => c.operation_type === tipo).reduce((s, c) => s + (c.commission_value ?? 0), 0),
    qtd: commissions.filter(c => c.operation_type === tipo).length,
  }));

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">
          Comissões — <span className="gradient-text">A Receber</span>
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          {role === "ADMIN" ? "Todas as comissões da plataforma" : `Operações finalizadas vinculadas a ${partnerName}`}
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="kpi-card">
          <div className="w-9 h-9 rounded-xl bg-amber-500/20 flex items-center justify-center mb-3">
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-xl font-bold text-amber-400">{formatMoeda(aReceber)}</p>
          <p className="text-sm font-medium text-foreground mt-0.5">A Receber</p>
          <p className="text-xs text-muted-foreground">{commissions.filter(c => c.status === "A_PAGAR").length} pendentes</p>
        </div>
        <div className="kpi-card">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/20 flex items-center justify-center mb-3">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-xl font-bold text-emerald-400">{formatMoeda(recebido)}</p>
          <p className="text-sm font-medium text-foreground mt-0.5">Já Recebido</p>
          <p className="text-xs text-muted-foreground">{commissions.filter(c => c.status === "PAGA").length} liquidadas</p>
        </div>
        <div className="kpi-card">
          <div className="w-9 h-9 rounded-xl bg-[#C9A84C]/20 flex items-center justify-center mb-3">
            <Wallet className="w-4 h-4 text-[#C9A84C]" />
          </div>
          <p className="text-xl font-bold text-[#C9A84C]">{formatMoeda(totalGeral)}</p>
          <p className="text-sm font-medium text-foreground mt-0.5">Total Gerado</p>
          <p className="text-xs text-muted-foreground">{commissions.length} operações</p>
        </div>
        <div className="kpi-card">
          <div className="w-9 h-9 rounded-xl bg-blue-500/20 flex items-center justify-center mb-3">
            <TrendingUp className="w-4 h-4 text-blue-400" />
          </div>
          <p className="text-xl font-bold text-white">
            {totalGeral > 0 ? `${((recebido / totalGeral) * 100).toFixed(0)}%` : "0%"}
          </p>
          <p className="text-sm font-medium text-foreground mt-0.5">Taxa de Recebimento</p>
          <p className="text-xs text-muted-foreground">recebido / total gerado</p>
        </div>
      </div>

      {/* Por tipo */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {porTipo.map(({ tipo, total, qtd }) => {
          const labels: Record<string, string> = { CREDITO: "Crédito", MA: "M&A", CONSORCIO: "Consórcio", SPLIT_FISCAL: "Split Fiscal" };
          const colors: Record<string, string> = { CREDITO: "#3B82F6", MA: "#8B5CF6", CONSORCIO: "#F59E0B", SPLIT_FISCAL: "#10B981" };
          const icons: Record<string, string> = { CREDITO: "💳", MA: "🤝", CONSORCIO: "🏆", SPLIT_FISCAL: "📊" };
          return (
            <div key={tipo} className="bg-[#091221] border border-[#122036] rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xl">{icons[tipo]}</span>
                <span className="text-sm font-semibold text-white">{labels[tipo]}</span>
              </div>
              <p className="text-lg font-bold" style={{ color: colors[tipo] }}>{formatMoeda(total)}</p>
              <p className="text-xs text-muted-foreground mt-1">{qtd} operaç{qtd === 1 ? "ão" : "ões"} finalizada{qtd !== 1 ? "s" : ""}</p>
            </div>
          );
        })}
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex bg-secondary rounded-lg p-0.5">
          {(["TODOS", "CREDITO", "MA", "CONSORCIO", "SPLIT_FISCAL"] as const).map(t => {
            const labels = { TODOS: "Todos", CREDITO: "Crédito", MA: "M&A", CONSORCIO: "Consórcio", SPLIT_FISCAL: "Split" };
            return (
              <button key={t} onClick={() => setFiltroTipo(t)} className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${filtroTipo === t ? "bg-[#C9A84C] text-white" : "text-muted-foreground hover:text-foreground"}`}>
                {labels[t]}
              </button>
            );
          })}
        </div>
        <div className="flex bg-secondary rounded-lg p-0.5">
          {(["TODOS", "A_PAGAR", "PAGA"] as const).map(t => {
            const labels = { TODOS: "Todos", A_PAGAR: "A Receber", PAGA: "Recebido" };
            return (
              <button key={t} onClick={() => setFiltroStatus(t)} className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${filtroStatus === t ? "bg-[#C9A84C] text-white" : "text-muted-foreground hover:text-foreground"}`}>
                {labels[t]}
              </button>
            );
          })}
        </div>
        <span className="text-xs text-muted-foreground ml-auto">{filtradas.length} resultado{filtradas.length !== 1 ? "s" : ""}</span>
        <ExportButton opts={{
          titulo: "Comissões a Receber",
          subtitulo: partnerName,
          orientacao: "landscape",
          colunas: [
            { header: "Código", key: "code", width: 14 },
            { header: "Operação", key: "operation_description", width: 30 },
            { header: "Código Op.", key: "operation_code", width: 14 },
            { header: "Tipo", key: "operation_type", width: 12 },
            { header: "Vlr. Operação", key: "operation_value", format: "moeda", width: 18 },
            { header: "% Comissão", key: "commission_percent", format: "percent", width: 13 },
            { header: "Vlr. a Receber", key: "commission_value", format: "moeda", width: 18 },
            { header: "Finalizada em", key: "operation_closed_at", format: "date", width: 16 },
            { header: "Previsão Pgto.", key: "payment_date", format: "date", width: 16 },
            { header: "Status", key: "status", width: 12 },
          ],
          dados: filtradas,
          totais: { label: "TOTAL", valores: { code: "TOTAL", commission_value: filtradas.reduce((s, c) => s + (c.commission_value ?? 0), 0) } },
        }} />
      </div>

      {/* Tabela */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border/40">
                  {["Código", "Operação", "Tipo", "Vlr. Operação", "% Comissão", "Vlr. a Receber", "Finalizada em", "Previsão Pgto.", "Status"].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-muted-foreground font-semibold uppercase tracking-wide text-[10px]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtradas.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-muted-foreground">
                      <Wallet className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      Nenhuma comissão encontrada com esses filtros
                    </td>
                  </tr>
                ) : filtradas.map((c, i) => (
                  <tr key={c.id} className={`border-b border-border/20 hover:bg-secondary/30 transition-colors ${i % 2 === 0 ? "" : "bg-[#091221]/40"}`}>
                    <td className="px-4 py-3 font-mono text-muted-foreground">{c.code}</td>
                    <td className="px-4 py-3 text-white max-w-[200px]">
                      <div className="truncate" title={c.operation_description}>{c.operation_description}</div>
                      <div className="text-[10px] text-muted-foreground">{c.operation_code ?? "—"}</div>
                    </td>
                    <td className="px-4 py-3"><TipoBadge tipo={c.operacaoTipo} /></td>
                    <td className="px-4 py-3 text-white">{formatMoeda(c.valorOperacao)}</td>
                    <td className="px-4 py-3 text-[#C9A84C] font-semibold">{c.percentualComissao}%</td>
                    <td className="px-4 py-3 font-bold text-white">{formatMoeda(c.valorComissao)}</td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{new Date(c.dataOperacaoFinalizada).toLocaleDateString("pt-BR")}</td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {c.operation_closed_at ? new Date(c.operation_closed_at).toLocaleDateString("pt-BR") : "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {c.payment_date ? new Date(c.payment_date).toLocaleDateString("pt-BR") : "—"}
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                  </tr>
                ))}
              </tbody>
              {filtradas.length > 0 && (
                <tfoot>
                  <tr className="bg-[#0F1E35] border-t border-[#C9A84C]/30">
                    <td className="px-4 py-3 font-bold text-[#C9A84C]" colSpan={5}>TOTAL FILTRADO</td>
                    <td className="px-4 py-3 font-bold text-[#C9A84C]">
                      {formatMoeda(filtradas.reduce((s, c) => s + c.valorComissao, 0))}
                    </td>
                    <td colSpan={3} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </CardContent>
      </Card>

      {filtradas.some(c => c.notes) && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Observações</p>
          {filtradas.filter(c => c.notes).map(c => (
            <div key={c.id} className="flex gap-2 text-xs p-3 bg-[#091221] border border-[#122036] rounded-lg">
              <span className="text-[#C9A84C] font-mono">{c.codigo}:</span>
              <span className="text-muted-foreground">{c.observacoes}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
