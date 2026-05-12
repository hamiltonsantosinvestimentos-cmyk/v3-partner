"use client";

import React, { useState } from "react";
import { Wallet, TrendingUp, Clock, CheckCircle2, Plus, X, Loader2, ShoppingBag, Send, Trophy, AlertCircle } from "lucide-react";
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

export interface MarketplaceLead {
  id: string;
  status: string;
  created_at: string;
  product_id: string;
  client_name: string | null;
  marketplace_products: { name: string; partner_commission_percent: number | null } | null;
}

interface Partner {
  id: string;
  full_name: string | null;
  email: string;
  role: string;
}

interface Props {
  partnerId: string;
  partnerName: string;
  role: string;
  commissions: CommissionRow[];
  partners?: Partner[];
  marketplaceLeads?: MarketplaceLead[];
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
    SPLIT_FISCAL: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    MARKETPLACE: "bg-[#C9A84C]/20 text-[#C9A84C] border-[#C9A84C]/30",
  };
  const labels: Record<string, string> = { CREDITO: "Crédito", MA: "M&A", CONSORCIO: "Consórcio", SPLIT_FISCAL: "Split", MARKETPLACE: "Marketplace" };
  return (
    <span className={`text-[10px] font-semibold border px-2 py-0.5 rounded-full ${map[tipo] ?? "bg-gray-500/20 text-gray-400 border-gray-500/30"}`}>
      {labels[tipo] ?? tipo}
    </span>
  );
}

function MktStatusBadge({ status }: { status: string }) {
  const map: Record<string, { cls: string; label: string }> = {
    NEW:          { cls: "bg-blue-500/20 text-blue-400 border-blue-500/30",    label: "Novo" },
    IN_PROGRESS:  { cls: "bg-amber-500/20 text-amber-400 border-amber-500/30", label: "Em Andamento" },
    CLOSED_WON:   { cls: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30", label: "Ganho" },
    CLOSED_LOST:  { cls: "bg-gray-500/20 text-gray-400 border-gray-500/30",   label: "Perdido" },
  };
  const { cls, label } = map[status] ?? { cls: "bg-gray-500/20 text-gray-400 border-gray-500/30", label: status };
  return <span className={`text-[10px] font-semibold border px-2 py-0.5 rounded-full ${cls}`}>{label}</span>;
}

const inputCls = "w-full h-9 px-3 text-sm rounded-lg border bg-[#0A1628] border-[#243A66] text-[#F0ECE4] placeholder:text-[#3A5070] focus:outline-none focus:ring-1 focus:ring-[#C9A84C]/50";
const labelCls = "block text-xs font-semibold text-[#7A8FA8] mb-1";

export function ComissoesPartnerClient({ partnerId, partnerName, role, commissions: initialCommissions, partners = [], marketplaceLeads = [] }: Props) {
  const [commissions, setCommissions] = useState<CommissionRow[]>(initialCommissions);
  const [filtroTipo, setFiltroTipo] = useState<"TODOS" | "CREDITO" | "MA" | "CONSORCIO" | "SPLIT_FISCAL" | "MARKETPLACE">("TODOS");
  const [filtroStatus, setFiltroStatus] = useState<"TODOS" | "A_PAGAR" | "PAGA">("TODOS");
  const [mktPage, setMktPage] = useState(0);
  const MKT_PAGE_SIZE = 5;

  const isAdmin = ["ADMIN", "GESTAO", "FINANCEIRO"].includes(role);

  // ── Nova comissão ──
  const [modalAberto, setModalAberto] = useState(false);
  const [criando, setCriando] = useState(false);
  const [erroModal, setErroModal] = useState("");
  const [form, setForm] = useState({
    partner_id: "",
    operation_type: "CREDITO" as "CREDITO" | "MA" | "CONSORCIO" | "SPLIT_FISCAL" | "MARKETPLACE",
    operation_description: "",
    operation_code: "",
    operation_value: "",
    commission_percent: "30",
    operation_closed_at: new Date().toISOString().slice(0, 10),
    notes: "",
  });

  // Auto-preenche % comissão ao selecionar partner
  function handleSelectPartner(id: string) {
    const p = partners.find(x => x.id === id);
    setForm(f => ({
      ...f,
      partner_id: id,
      commission_percent: p?.role === "PARTNER_PRO" ? "50" : "30",
    }));
  }

  async function handleCriarComissao(e: React.FormEvent) {
    e.preventDefault();
    setErroModal("");
    if (!form.partner_id) { setErroModal("Selecione um partner."); return; }
    if (!form.operation_description) { setErroModal("Informe a descrição da operação."); return; }
    if (!form.operation_value || isNaN(Number(form.operation_value.replace(",", ".")))) {
      setErroModal("Informe o valor da operação."); return;
    }
    setCriando(true);
    try {
      const res = await fetch("/api/commissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          partner_id: form.partner_id,
          operation_type: form.operation_type,
          operation_description: form.operation_description,
          operation_code: form.operation_code || null,
          operation_value: Number(form.operation_value.replace(",", ".")),
          commission_percent: Number(form.commission_percent),
          operation_closed_at: form.operation_closed_at || null,
          notes: form.notes || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setErroModal(data.error || "Erro ao criar comissão."); return; }
      setCommissions(prev => [data.commission, ...prev]);
      setModalAberto(false);
      setForm({ partner_id: "", operation_type: "CREDITO" as const, operation_description: "", operation_code: "", operation_value: "", commission_percent: "30", operation_closed_at: new Date().toISOString().slice(0, 10), notes: "" });
    } catch {
      setErroModal("Erro de rede. Tente novamente.");
    } finally {
      setCriando(false);
    }
  }

  const filtradas = commissions.filter(c =>
    (filtroTipo === "TODOS" || c.operation_type === filtroTipo) &&
    (filtroStatus === "TODOS" || c.status === filtroStatus)
  );

  const aReceber = commissions.filter(c => c.status === "A_PAGAR").reduce((s, c) => s + (c.commission_value ?? 0), 0);
  const recebido = commissions.filter(c => c.status === "PAGA").reduce((s, c) => s + (c.commission_value ?? 0), 0);
  const totalGeral = aReceber + recebido;

  const porTipo = (["CREDITO", "MA", "CONSORCIO", "SPLIT_FISCAL", "MARKETPLACE"] as const).map(tipo => ({
    tipo,
    total: commissions.filter(c => c.operation_type === tipo).reduce((s, c) => s + (c.commission_value ?? 0), 0),
    qtd: commissions.filter(c => c.operation_type === tipo).length,
  }));

  // Marketplace stats
  const mktTotal   = marketplaceLeads.length;
  const mktNovos   = marketplaceLeads.filter(l => l.status === "NEW").length;
  const mktAndamento = marketplaceLeads.filter(l => l.status === "IN_PROGRESS").length;
  const mktGanhos  = marketplaceLeads.filter(l => l.status === "CLOSED_WON").length;
  const mktPerdidos = marketplaceLeads.filter(l => l.status === "CLOSED_LOST").length;
  const mktPaginados = marketplaceLeads.slice(mktPage * MKT_PAGE_SIZE, (mktPage + 1) * MKT_PAGE_SIZE);
  const mktTotalPages = Math.ceil(marketplaceLeads.length / MKT_PAGE_SIZE);

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">
            Comissões — <span className="gradient-text">A Receber</span>
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {isAdmin ? "Todas as comissões da plataforma" : `Operações finalizadas vinculadas a ${partnerName}`}
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setModalAberto(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#C9A84C] hover:bg-[#E8C97A] text-[#09081A] text-sm font-bold transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nova Comissão
          </button>
        )}
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
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {porTipo.map(({ tipo, total, qtd }) => {
          const labels: Record<string, string> = { CREDITO: "Crédito", MA: "M&A", CONSORCIO: "Consórcio", SPLIT_FISCAL: "Split Fiscal", MARKETPLACE: "Marketplace" };
          const colors: Record<string, string> = { CREDITO: "#3B82F6", MA: "#8B5CF6", CONSORCIO: "#F59E0B", SPLIT_FISCAL: "#10B981", MARKETPLACE: "#C9A84C" };
          const icons: Record<string, string> = { CREDITO: "💳", MA: "🤝", CONSORCIO: "🏆", SPLIT_FISCAL: "📊", MARKETPLACE: "🛒" };
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

      {/* Dashboard Marketplace */}
      <div className="rounded-xl border border-[#C9A84C]/20 bg-[#0D1B2E] p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-[#C9A84C]/20 flex items-center justify-center">
            <ShoppingBag className="w-4 h-4 text-[#C9A84C]" />
          </div>
          <div>
            <p className="text-sm font-bold text-white">Marketplace — Leads Enviados</p>
            <p className="text-xs text-muted-foreground">Produtos indicados a clientes via marketplace</p>
          </div>
        </div>

        {mktTotal === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-center text-muted-foreground">
            <ShoppingBag className="w-8 h-8 mb-2 opacity-30" />
            <p className="text-sm">Nenhum lead de marketplace ainda</p>
            <p className="text-xs mt-1">Acesse o Marketplace e indique produtos a clientes para gerar comissões.</p>
          </div>
        ) : (
          <>
            {/* KPI mini cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
              <div className="bg-[#091221] border border-[#122036] rounded-lg p-3 text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Send className="w-3 h-3 text-blue-400" />
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Enviados</span>
                </div>
                <p className="text-xl font-bold text-blue-400">{mktTotal}</p>
              </div>
              <div className="bg-[#091221] border border-[#122036] rounded-lg p-3 text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <AlertCircle className="w-3 h-3 text-amber-400" />
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Em Andamento</span>
                </div>
                <p className="text-xl font-bold text-amber-400">{mktAndamento + mktNovos}</p>
              </div>
              <div className="bg-[#091221] border border-[#122036] rounded-lg p-3 text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <Trophy className="w-3 h-3 text-emerald-400" />
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Ganhos</span>
                </div>
                <p className="text-xl font-bold text-emerald-400">{mktGanhos}</p>
              </div>
              <div className="bg-[#091221] border border-[#122036] rounded-lg p-3 text-center">
                <div className="flex items-center justify-center gap-1 mb-1">
                  <TrendingUp className="w-3 h-3 text-[#C9A84C]" />
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Taxa Conversão</span>
                </div>
                <p className="text-xl font-bold text-[#C9A84C]">
                  {mktTotal > 0 ? `${Math.round((mktGanhos / mktTotal) * 100)}%` : "0%"}
                </p>
              </div>
            </div>

            {/* Tabela de leads marketplace */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/40">
                    {["Produto", "Cliente", "Status", "Data"].map(h => (
                      <th key={h} className="text-left px-3 py-2 text-muted-foreground font-semibold uppercase tracking-wide text-[10px]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {mktPaginados.map((lead, i) => (
                    <tr key={lead.id} className={`border-b border-border/20 hover:bg-secondary/30 transition-colors ${i % 2 === 0 ? "" : "bg-[#091221]/40"}`}>
                      <td className="px-3 py-2 text-white max-w-[180px]">
                        <div className="truncate" title={lead.marketplace_products?.name ?? "—"}>
                          {lead.marketplace_products?.name ?? "—"}
                        </div>
                        {lead.marketplace_products?.partner_commission_percent != null && (
                          <div className="text-[10px] text-[#C9A84C]">{lead.marketplace_products.partner_commission_percent}% comissão</div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{lead.client_name ?? "—"}</td>
                      <td className="px-3 py-2"><MktStatusBadge status={lead.status} /></td>
                      <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                        {new Date(lead.created_at).toLocaleDateString("pt-BR")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Paginação */}
            {mktTotalPages > 1 && (
              <div className="flex items-center justify-between mt-3">
                <span className="text-xs text-muted-foreground">{mktTotal} leads no total</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setMktPage(p => Math.max(0, p - 1))}
                    disabled={mktPage === 0}
                    className="px-3 py-1 text-xs rounded-lg border border-[#243A66] text-[#7A8FA8] disabled:opacity-40 hover:text-white transition-colors"
                  >
                    ‹ Anterior
                  </button>
                  <span className="text-xs text-muted-foreground">{mktPage + 1} / {mktTotalPages}</span>
                  <button
                    onClick={() => setMktPage(p => Math.min(mktTotalPages - 1, p + 1))}
                    disabled={mktPage === mktTotalPages - 1}
                    className="px-3 py-1 text-xs rounded-lg border border-[#243A66] text-[#7A8FA8] disabled:opacity-40 hover:text-white transition-colors"
                  >
                    Próximo ›
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex bg-secondary rounded-lg p-0.5 flex-wrap gap-0.5">
          {(["TODOS", "CREDITO", "MA", "CONSORCIO", "SPLIT_FISCAL", "MARKETPLACE"] as const).map(t => {
            const labels = { TODOS: "Todos", CREDITO: "Crédito", MA: "M&A", CONSORCIO: "Consórcio", SPLIT_FISCAL: "Split", MARKETPLACE: "Marketplace" };
            return (
              <button key={t} onClick={() => setFiltroTipo(t)} className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${filtroTipo === t ? "bg-[#C9A84C] text-[#09081A]" : "text-muted-foreground hover:text-foreground"}`}>
                {labels[t]}
              </button>
            );
          })}
        </div>
        <div className="flex bg-secondary rounded-lg p-0.5">
          {(["TODOS", "A_PAGAR", "PAGA"] as const).map(t => {
            const labels = { TODOS: "Todos", A_PAGAR: "A Receber", PAGA: "Recebido" };
            return (
              <button key={t} onClick={() => setFiltroStatus(t)} className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${filtroStatus === t ? "bg-[#C9A84C] text-[#09081A]" : "text-muted-foreground hover:text-foreground"}`}>
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
                    <td className="px-4 py-3"><TipoBadge tipo={c.operation_type} /></td>
                    <td className="px-4 py-3 text-white">{formatMoeda(c.operation_value)}</td>
                    <td className="px-4 py-3 text-[#C9A84C] font-semibold">{c.commission_percent}%</td>
                    <td className="px-4 py-3 font-bold text-white">{formatMoeda(c.commission_value)}</td>
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
                      {formatMoeda(filtradas.reduce((s, c) => s + (c.commission_value ?? 0), 0))}
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
              <span className="text-[#C9A84C] font-mono">{c.code}:</span>
              <span className="text-muted-foreground">{c.notes}</span>
            </div>
          ))}
        </div>
      )}

      {/* Modal Nova Comissão */}
      {modalAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setModalAberto(false)} />
          <div className="relative w-full max-w-lg bg-[#111F35] border border-[#243A66] rounded-2xl shadow-2xl p-6 z-10">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold text-[#F0ECE4]">Nova Comissão</h2>
              <button onClick={() => setModalAberto(false)} className="text-[#7A8FA8] hover:text-[#F0ECE4]">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCriarComissao} className="space-y-4">
              <div>
                <label className={labelCls}>Partner *</label>
                <select
                  value={form.partner_id}
                  onChange={e => handleSelectPartner(e.target.value)}
                  className={inputCls}
                  required
                >
                  <option value="">Selecione um partner...</option>
                  {partners.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.full_name || p.email} ({p.role === "PARTNER_PRO" ? "PRO · 50%" : "30%"})
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Tipo de Operação *</label>
                  <select
                    value={form.operation_type}
                    onChange={e => setForm(f => ({ ...f, operation_type: e.target.value as typeof f.operation_type }))}
                    className={inputCls}
                  >
                    <option value="CREDITO">Crédito</option>
                    <option value="MA">M&A</option>
                    <option value="CONSORCIO">Consórcio</option>
                    <option value="SPLIT_FISCAL">Split Fiscal</option>
                    <option value="MARKETPLACE">Marketplace</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Código da Op. (opcional)</label>
                  <input
                    value={form.operation_code}
                    onChange={e => setForm(f => ({ ...f, operation_code: e.target.value }))}
                    placeholder="Ex: CRED-2026-001"
                    className={inputCls}
                  />
                </div>
              </div>
              <div>
                <label className={labelCls}>Descrição da Operação *</label>
                <input
                  value={form.operation_description}
                  onChange={e => setForm(f => ({ ...f, operation_description: e.target.value }))}
                  placeholder="Ex: Home Equity - Cliente João Silva"
                  className={inputCls}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Valor da Operação (R$) *</label>
                  <input
                    value={form.operation_value}
                    onChange={e => setForm(f => ({ ...f, operation_value: e.target.value }))}
                    placeholder="Ex: 150000"
                    className={inputCls}
                    required
                  />
                </div>
                <div>
                  <label className={labelCls}>% Comissão</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={form.commission_percent}
                    onChange={e => setForm(f => ({ ...f, commission_percent: e.target.value }))}
                    className={inputCls}
                  />
                </div>
              </div>
              <div>
                <label className={labelCls}>Data de Fechamento</label>
                <input
                  type="date"
                  value={form.operation_closed_at}
                  onChange={e => setForm(f => ({ ...f, operation_closed_at: e.target.value }))}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Observações (opcional)</label>
                <input
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Informações adicionais..."
                  className={inputCls}
                />
              </div>
              {erroModal && (
                <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{erroModal}</p>
              )}
              {form.operation_value && !isNaN(Number(form.operation_value.replace(",", "."))) && Number(form.operation_value.replace(",", ".")) > 0 && (
                <div className="bg-[#C9A84C]/10 border border-[#C9A84C]/30 rounded-lg px-3 py-2 text-xs text-[#C9A84C]">
                  Comissão estimada:{" "}
                  <strong>{formatMoeda(Number(form.operation_value.replace(",", ".")) * Number(form.commission_percent) / 100)}</strong>
                </div>
              )}
              <button
                type="submit"
                disabled={criando}
                className="w-full h-10 rounded-lg bg-[#C9A84C] hover:bg-[#E8C97A] text-[#09081A] text-sm font-bold transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {criando && <Loader2 className="w-4 h-4 animate-spin" />}
                {criando ? "Criando..." : "Criar Comissão"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
