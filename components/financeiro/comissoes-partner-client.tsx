"use client";

import React, { useState, useMemo, useEffect } from "react";
import { Wallet, TrendingUp, Clock, CheckCircle2, Plus, X, Loader2, ShoppingBag, Send, Trophy, AlertCircle, Target, BarChart3, ChevronRight, Calendar, CreditCard, Banknote } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatMoeda } from "@/lib/demo-data-financeiro";
import { ExportButton } from "@/components/financeiro/export-button";
import { NpsModal } from "@/components/nps/nps-modal";

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
  partnerPixKey?: string | null;
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

// ── FEATURE A helpers ─────────────────────────────────────────────────────────

const TIPOS = ["CREDITO", "MA", "CONSORCIO", "SPLIT_FISCAL", "MARKETPLACE"] as const;
type TipoOp = typeof TIPOS[number];

const tipoLabels: Record<TipoOp, string> = { CREDITO: "Crédito", MA: "M&A", CONSORCIO: "Consórcio", SPLIT_FISCAL: "Split Fiscal", MARKETPLACE: "Marketplace" };
const tipoColors: Record<TipoOp, string> = { CREDITO: "#3B82F6", MA: "#8B5CF6", CONSORCIO: "#F59E0B", SPLIT_FISCAL: "#10B981", MARKETPLACE: "#C9A84C" };
const tipoIcons: Record<TipoOp, string> = { CREDITO: "💳", MA: "🤝", CONSORCIO: "🏆", SPLIT_FISCAL: "📊", MARKETPLACE: "🛒" };

const MONTH_NAMES_SHORT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function buildMonthKey(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function ComissoesPartnerClient({ partnerId, partnerName, role, commissions: initialCommissions, partners = [], marketplaceLeads = [], partnerPixKey }: Props) {
  const [commissions, setCommissions] = useState<CommissionRow[]>(initialCommissions);
  const [activeTab, setActiveTab] = useState<"comissoes" | "projecao" | "doze-meses">("comissoes");
  const [filtroTipo, setFiltroTipo] = useState<"TODOS" | TipoOp>("TODOS");
  const [filtroStatus, setFiltroStatus] = useState<"TODOS" | "A_PAGAR" | "PAGA">("TODOS");
  const [mktPage, setMktPage] = useState(0);
  const MKT_PAGE_SIZE = 5;

  const isAdmin = ["ADMIN", "GESTAO", "FINANCEIRO"].includes(role);
  const isPartner = ["PARTNER", "PARTNER_PRO"].includes(role);

  // ── Nova comissão ──
  const [modalAberto, setModalAberto] = useState(false);
  const [criando, setCriando] = useState(false);
  const [erroModal, setErroModal] = useState("");
  const [form, setForm] = useState({
    partner_id: "",
    operation_type: "CREDITO" as TipoOp,
    operation_description: "",
    operation_code: "",
    operation_value: "",
    commission_percent: "30",
    operation_closed_at: new Date().toISOString().slice(0, 10),
    notes: "",
  });

  // ── NPS automático pós-deal ──
  const [npsCommission, setNpsCommission] = useState<{ id: string; product_name: string } | null>(null);

  useEffect(() => {
    if (!isPartner) return;
    const paid = commissions.filter(c => c.status === "PAGA");
    if (paid.length === 0) return;
    // Sort by payment_date desc, pick most recent
    const sorted = [...paid].sort((a, b) => {
      const da = a.payment_date ?? a.created_at;
      const db = b.payment_date ?? b.created_at;
      return new Date(db).getTime() - new Date(da).getTime();
    });
    const candidate = sorted.find(c => {
      if (typeof window === "undefined") return false;
      return !localStorage.getItem(`nps-responded-${c.id}`) && !localStorage.getItem(`nps-dismissed-${c.id}`);
    });
    if (!candidate) return;
    const timer = setTimeout(() => {
      setNpsCommission({ id: candidate.id, product_name: candidate.operation_description });
    }, 2000);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Feature C: co-originação ──
  const [coOriginada, setCoOriginada] = useState(false);
  const [coPartnerId, setCoPartnerId] = useState("");
  const [splitPercent, setSplitPercent] = useState(50); // % para partner 1

  // ── Feature B: pagamento ──
  const [pagamentoModalAberto, setPagamentoModalAberto] = useState(false);
  const [pagamentoMethod, setPagamentoMethod] = useState<"PIX" | "BOLETO">("PIX");
  const [pagamentoPixKey, setPagamentoPixKey] = useState(partnerPixKey ?? "");
  const [pagamentoNote, setPagamentoNote] = useState("");
  const [pagamentoEnviando, setPagamentoEnviando] = useState(false);
  const [pagamentoMsg, setPagamentoMsg] = useState("");
  const [pagamentoErro, setPagamentoErro] = useState("");

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
    if (coOriginada && !coPartnerId) { setErroModal("Selecione o segundo partner para operação co-originada."); return; }
    if (coOriginada && coPartnerId === form.partner_id) { setErroModal("Selecione parceiros diferentes para co-originação."); return; }

    setCriando(true);
    try {
      const opValue = Number(form.operation_value.replace(",", "."));
      const basePercent = Number(form.commission_percent);

      if (coOriginada) {
        // Split: POST twice with adjusted commission_percent
        const p1Percent = parseFloat((basePercent * splitPercent / 100).toFixed(2));
        const p2Percent = parseFloat((basePercent * (100 - splitPercent) / 100).toFixed(2));

        const [res1, res2] = await Promise.all([
          fetch("/api/commissions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              partner_id: form.partner_id,
              operation_type: form.operation_type,
              operation_description: `${form.operation_description} (Co-orig. ${splitPercent}%)`,
              operation_code: form.operation_code || null,
              operation_value: opValue,
              commission_percent: p1Percent,
              operation_closed_at: form.operation_closed_at || null,
              notes: form.notes ? `Co-originada · ${form.notes}` : "Operação co-originada",
            }),
          }),
          fetch("/api/commissions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              partner_id: coPartnerId,
              operation_type: form.operation_type,
              operation_description: `${form.operation_description} (Co-orig. ${100 - splitPercent}%)`,
              operation_code: form.operation_code || null,
              operation_value: opValue,
              commission_percent: p2Percent,
              operation_closed_at: form.operation_closed_at || null,
              notes: form.notes ? `Co-originada · ${form.notes}` : "Operação co-originada",
            }),
          }),
        ]);

        const data1 = await res1.json();
        const data2 = await res2.json();

        if (!res1.ok) { setErroModal(data1.error || "Erro ao criar comissão do partner 1."); return; }
        if (!res2.ok) { setErroModal(data2.error || "Erro ao criar comissão do partner 2."); return; }

        setCommissions(prev => [data2.commission, data1.commission, ...prev]);
      } else {
        const res = await fetch("/api/commissions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            partner_id: form.partner_id,
            operation_type: form.operation_type,
            operation_description: form.operation_description,
            operation_code: form.operation_code || null,
            operation_value: opValue,
            commission_percent: basePercent,
            operation_closed_at: form.operation_closed_at || null,
            notes: form.notes || null,
          }),
        });
        const data = await res.json();
        if (!res.ok) { setErroModal(data.error || "Erro ao criar comissão."); return; }
        setCommissions(prev => [data.commission, ...prev]);
      }

      setModalAberto(false);
      setForm({ partner_id: "", operation_type: "CREDITO", operation_description: "", operation_code: "", operation_value: "", commission_percent: "30", operation_closed_at: new Date().toISOString().slice(0, 10), notes: "" });
      setCoOriginada(false);
      setCoPartnerId("");
      setSplitPercent(50);
    } catch {
      setErroModal("Erro de rede. Tente novamente.");
    } finally {
      setCriando(false);
    }
  }

  async function handleSolicitarPagamento(e: React.FormEvent) {
    e.preventDefault();
    setPagamentoErro("");
    setPagamentoMsg("");
    if (pagamentoMethod === "PIX" && !pagamentoPixKey.trim()) {
      setPagamentoErro("Informe a chave Pix.");
      return;
    }
    setPagamentoEnviando(true);
    try {
      const res = await fetch("/api/commissions/request-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          total: aReceber,
          method: pagamentoMethod,
          pix_key: pagamentoMethod === "PIX" ? pagamentoPixKey : null,
          note: pagamentoNote || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPagamentoErro(data.error || "Erro ao enviar solicitação.");
        return;
      }
      setPagamentoMsg(data.message ?? "Solicitação enviada com sucesso!");
    } catch {
      setPagamentoErro("Erro de rede. Tente novamente.");
    } finally {
      setPagamentoEnviando(false);
    }
  }

  const filtradas = commissions.filter(c =>
    (filtroTipo === "TODOS" || c.operation_type === filtroTipo) &&
    (filtroStatus === "TODOS" || c.status === filtroStatus)
  );

  const aReceber = commissions.filter(c => c.status === "A_PAGAR").reduce((s, c) => s + (c.commission_value ?? 0), 0);
  const recebido = commissions.filter(c => c.status === "PAGA").reduce((s, c) => s + (c.commission_value ?? 0), 0);
  const totalGeral = aReceber + recebido;

  const porTipo = TIPOS.map(tipo => ({
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

  // ── Projeção helpers ──
  const pendentes = commissions.filter(c => c.status === "A_PAGAR");
  const pagas = commissions.filter(c => c.status === "PAGA");

  const now = new Date();
  const thisMonthPendentes = pendentes.filter(c => {
    if (!c.payment_date) return false;
    const d = new Date(c.payment_date);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  });
  const thisMonthTotal = thisMonthPendentes.reduce((s, c) => s + (c.commission_value ?? 0), 0);

  // avg monthly from paid history
  const paidMonths: Record<string, number> = {};
  pagas.forEach(c => {
    if (!c.payment_date) return;
    const d = new Date(c.payment_date);
    const key = buildMonthKey(d.getFullYear(), d.getMonth() + 1);
    paidMonths[key] = (paidMonths[key] ?? 0) + (c.commission_value ?? 0);
  });
  const paidMonthVals = Object.values(paidMonths);
  const avgMonthly = paidMonthVals.length > 0
    ? paidMonthVals.reduce((a, b) => a + b, 0) / paidMonthVals.length
    : pendentes.reduce((s, c) => s + (c.commission_value ?? 0), 0) / 3;

  const yearTotal = pendentes.reduce((s, c) => s + (c.commission_value ?? 0), 0);

  const tipoGroups = TIPOS.map(tipo => {
    const tipoPend = pendentes.filter(c => c.operation_type === tipo);
    const tipoPaid = pagas.filter(c => c.operation_type === tipo);
    const totalPend = tipoPend.reduce((s, c) => s + (c.commission_value ?? 0), 0);
    const totalPaid = tipoPaid.reduce((s, c) => s + (c.commission_value ?? 0), 0);
    const totalAll = totalPend + totalPaid;
    const dates = tipoPend
      .map(c => c.payment_date)
      .filter(Boolean)
      .map(d => new Date(d!).getTime());
    const minDate = dates.length ? new Date(Math.min(...dates)) : null;
    const maxDate = dates.length ? new Date(Math.max(...dates)) : null;
    return { tipo, tipoPend, totalPend, totalPaid, totalAll, minDate, maxDate };
  });

  // Monthly pipeline bar data (next 6 months)
  const monthlyBars: { label: string; value: number; month: number; year: number }[] = [];
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const label = d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
    const val = pendentes.filter(c => {
      if (!c.payment_date) return false;
      const pd = new Date(c.payment_date);
      return pd.getFullYear() === d.getFullYear() && pd.getMonth() === d.getMonth();
    }).reduce((s, c) => s + (c.commission_value ?? 0), 0);
    monthlyBars.push({ label, value: val, month: d.getMonth(), year: d.getFullYear() });
  }
  const semData = pendentes
    .filter(c => !c.payment_date)
    .reduce((s, c) => s + (c.commission_value ?? 0), 0);
  if (semData > 0) monthlyBars.push({ label: "S/ Data", value: semData, month: -1, year: -1 });

  const maxBarVal = Math.max(...monthlyBars.map(b => b.value), 1);

  // Goal milestones
  const milestones = [5000, 10000, 25000, 50000, 100000];
  const totalAReceber = pendentes.reduce((s, c) => s + (c.commission_value ?? 0), 0);
  const nextMilestone = milestones.find(m => m > totalAReceber) ?? milestones[milestones.length - 1];
  const prevMilestone = milestones.slice().reverse().find(m => m <= totalAReceber) ?? 0;
  const goalProgress = nextMilestone > prevMilestone
    ? Math.min(100, ((totalAReceber - prevMilestone) / (nextMilestone - prevMilestone)) * 100)
    : 100;

  // ── FEATURE A: 12-month chart data ──
  const dozeData = useMemo(() => {
    const result: {
      key: string;
      label: string;
      year: number;
      month: number;
      paga: number;
      aPagar: number;
      isCurrent: boolean;
      isFuture: boolean;
    }[] = [];

    for (let i = -6; i <= 5; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const yr = d.getFullYear();
      const mo = d.getMonth(); // 0-indexed
      const key = buildMonthKey(yr, mo + 1);
      const isCurrent = yr === now.getFullYear() && mo === now.getMonth();
      const isFuture = d > now && !isCurrent;

      const pagaVal = commissions
        .filter(c => c.status === "PAGA" && c.payment_date)
        .filter(c => {
          const pd = new Date(c.payment_date!);
          return pd.getFullYear() === yr && pd.getMonth() === mo;
        })
        .reduce((s, c) => s + (c.commission_value ?? 0), 0);

      const aPagarVal = commissions
        .filter(c => c.status === "A_PAGAR" && c.payment_date)
        .filter(c => {
          const pd = new Date(c.payment_date!);
          return pd.getFullYear() === yr && pd.getMonth() === mo;
        })
        .reduce((s, c) => s + (c.commission_value ?? 0), 0);

      result.push({
        key,
        label: MONTH_NAMES_SHORT[mo],
        year: yr,
        month: mo,
        paga: pagaVal,
        aPagar: aPagarVal,
        isCurrent,
        isFuture,
      });
    }
    return result;
  }, [commissions, now.getFullYear(), now.getMonth()]);

  // avg of last 3 paid months (non-zero)
  const last3PaidAvg = useMemo(() => {
    const pastMonthsWithPaga = dozeData
      .filter(m => !m.isFuture && !m.isCurrent && m.paga > 0)
      .slice(-3);
    if (pastMonthsWithPaga.length === 0) return 0;
    return pastMonthsWithPaga.reduce((s, m) => s + m.paga, 0) / pastMonthsWithPaga.length;
  }, [dozeData]);

  const dozeChartData = useMemo(() => {
    return dozeData.map(m => {
      let barValue = m.isFuture ? last3PaidAvg : m.isCurrent ? (m.paga + m.aPagar) : m.paga;
      return { ...m, barValue };
    });
  }, [dozeData, last3PaidAvg]);

  const dozeMaxVal = Math.max(...dozeChartData.map(m => m.barValue), 1);
  const dozeHalfVal = dozeMaxVal / 2;

  // KPI cards for 12m tab
  const melhorMes = useMemo(() => {
    let best = { label: "—", value: 0 };
    dozeData.forEach(m => {
      if (m.paga > best.value) {
        best = { label: `${m.label}/${String(m.year).slice(2)}`, value: m.paga };
      }
    });
    return best;
  }, [dozeData]);

  const mediaMonsal = useMemo(() => {
    const months = dozeData.filter(m => m.paga > 0);
    if (!months.length) return 0;
    return months.reduce((s, m) => s + m.paga, 0) / months.length;
  }, [dozeData]);

  const projecao6Meses = last3PaidAvg * 6;
  const META_ANUAL = 50000;
  const totalPagoAnual = commissions
    .filter(c => c.status === "PAGA" && c.payment_date)
    .filter(c => new Date(c.payment_date!).getFullYear() === now.getFullYear())
    .reduce((s, c) => s + (c.commission_value ?? 0), 0);
  const metaProgress = Math.min(100, (totalPagoAnual / META_ANUAL) * 100);

  // Breakdown por tipo for 12m tab
  const breakdownTipo = useMemo(() => {
    const totalAll = commissions.reduce((s, c) => s + (c.commission_value ?? 0), 0);
    return TIPOS.map(tipo => {
      const val = commissions.filter(c => c.operation_type === tipo).reduce((s, c) => s + (c.commission_value ?? 0), 0);
      const pct = totalAll > 0 ? (val / totalAll) * 100 : 0;
      return { tipo, val, pct };
    }).filter(b => b.val > 0);
  }, [commissions]);

  // Tooltip state for chart
  const [hoveredBar, setHoveredBar] = useState<string | null>(null);

  // ── Feature C: commission value preview ──
  const opValue = Number(form.operation_value.replace(",", "."));
  const basePercent = Number(form.commission_percent);
  const commValueTotal = !isNaN(opValue) && opValue > 0 ? opValue * basePercent / 100 : 0;
  const p1Value = coOriginada ? commValueTotal * splitPercent / 100 : commValueTotal;
  const p2Value = coOriginada ? commValueTotal * (100 - splitPercent) / 100 : 0;

  const p1Partner = partners.find(p => p.id === form.partner_id);
  const p2Partner = partners.find(p => p.id === coPartnerId);

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
        <div className="flex items-center gap-3">
          {/* Feature B: Solicitar Pagamento */}
          {isPartner && aReceber > 0 && (
            <button
              onClick={() => { setPagamentoModalAberto(true); setPagamentoMsg(""); setPagamentoErro(""); }}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[#C9A84C]/50 hover:border-[#C9A84C] text-[#C9A84C] hover:text-[#E8C97A] text-sm font-bold transition-colors"
            >
              <Banknote className="w-4 h-4" />
              Solicitar Pagamento
            </button>
          )}
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
      </div>

      {/* Tab switcher */}
      <div className="flex bg-[#111F35] border border-[#243A66] rounded-xl p-1 w-fit gap-1">
        <button
          onClick={() => setActiveTab("comissoes")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === "comissoes" ? "bg-[#C9A84C] text-[#09081A]" : "text-[#7A8FA8] hover:text-[#F0ECE4]"}`}
        >
          <Wallet className="w-4 h-4" />
          Extrato
        </button>
        <button
          onClick={() => setActiveTab("projecao")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === "projecao" ? "bg-[#C9A84C] text-[#09081A]" : "text-[#7A8FA8] hover:text-[#F0ECE4]"}`}
        >
          <BarChart3 className="w-4 h-4" />
          Projeção
        </button>
        <button
          onClick={() => setActiveTab("doze-meses")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === "doze-meses" ? "bg-[#C9A84C] text-[#09081A]" : "text-[#7A8FA8] hover:text-[#F0ECE4]"}`}
        >
          <Calendar className="w-4 h-4" />
          12 Meses
        </button>
      </div>

      {/* ══════════════ 12 MESES TAB ══════════════ */}
      {activeTab === "doze-meses" && (
        <div className="space-y-6">

          {/* KPI row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Melhor mês */}
            <div className="bg-gradient-to-br from-[#162744] to-[#111F35] border border-[#C9A84C]/30 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-[#C9A84C]/20 flex items-center justify-center">
                  <Trophy className="w-4 h-4 text-[#C9A84C]" />
                </div>
                <span className="text-xs font-bold text-[#7A8FA8] uppercase tracking-wide">Melhor Mês</span>
              </div>
              <p className="text-2xl font-bold text-[#E8C97A]">{formatMoeda(melhorMes.value)}</p>
              <p className="text-xs text-[#7A8FA8] mt-1">{melhorMes.label}</p>
            </div>

            {/* Média mensal */}
            <div className="bg-gradient-to-br from-[#162744] to-[#111F35] border border-[#243A66] rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-[#7A8FA8]/20 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-[#7A8FA8]" />
                </div>
                <span className="text-xs font-bold text-[#7A8FA8] uppercase tracking-wide">Média Mensal</span>
              </div>
              <p className="text-2xl font-bold text-[#F0ECE4]">{formatMoeda(mediaMonsal)}</p>
              <p className="text-xs text-[#7A8FA8] mt-1">meses com comissão</p>
            </div>

            {/* Projeção próximos 6 meses */}
            <div className="bg-gradient-to-br from-[#162744] to-[#111F35] border border-[#243A66] rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                  <BarChart3 className="w-4 h-4 text-blue-400" />
                </div>
                <span className="text-xs font-bold text-[#7A8FA8] uppercase tracking-wide">Próx. 6 Meses</span>
              </div>
              <p className="text-2xl font-bold text-blue-400">{formatMoeda(projecao6Meses)}</p>
              <p className="text-xs text-[#7A8FA8] mt-1">projeção estimada</p>
            </div>

            {/* Meta anual */}
            <div className="bg-gradient-to-br from-[#162744] to-[#111F35] border border-[#243A66] rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                  <Target className="w-4 h-4 text-emerald-400" />
                </div>
                <span className="text-xs font-bold text-[#7A8FA8] uppercase tracking-wide">Meta Anual</span>
              </div>
              <p className="text-2xl font-bold text-emerald-400">{metaProgress.toFixed(0)}%</p>
              <p className="text-xs text-[#7A8FA8] mt-2 mb-1.5">
                {formatMoeda(totalPagoAnual)} de {formatMoeda(META_ANUAL)}
              </p>
              <div className="bg-[#111F35] rounded-full h-2 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${metaProgress}%`, background: "linear-gradient(90deg, #10B981, #34D399)" }}
                />
              </div>
            </div>
          </div>

          {/* Bar chart 12 meses */}
          <div className="bg-[#0D1B2E] border border-[#243A66] rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-1">
              <BarChart3 className="w-4 h-4 text-[#C9A84C]" />
              <span className="text-sm font-bold text-[#F0ECE4]">Receita 12 Meses</span>
              <span className="ml-auto text-xs text-[#7A8FA8]">últimos 6 + próximos 6</span>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-5 mb-5 mt-2">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm" style={{ background: "linear-gradient(90deg, #C9A84C, #E8C97A)" }} />
                <span className="text-xs text-[#7A8FA8]">Pago</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm bg-amber-400" />
                <span className="text-xs text-[#7A8FA8]">Mês atual (Pago + A receber)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm border-2 border-dashed border-[#3A5070] bg-transparent" />
                <span className="text-xs text-[#7A8FA8]">Projeção (média 3 meses)</span>
              </div>
            </div>

            {/* Y-axis labels + bars */}
            <div className="flex gap-4">
              {/* Y-axis */}
              <div className="flex flex-col justify-between text-right w-16 flex-shrink-0 pb-8">
                <span className="text-[10px] text-[#3A5070]">{formatMoeda(dozeMaxVal)}</span>
                <span className="text-[10px] text-[#3A5070]">{formatMoeda(dozeHalfVal)}</span>
                <span className="text-[10px] text-[#3A5070]">R$ 0</span>
              </div>

              {/* Bars area */}
              <div className="flex-1 min-w-0">
                <div className="flex items-end gap-1.5 h-36">
                  {dozeChartData.map(bar => {
                    const heightPct = dozeMaxVal > 0 ? (bar.barValue / dozeMaxVal) * 100 : 0;
                    const isHovered = hoveredBar === bar.key;
                    return (
                      <div
                        key={bar.key}
                        className="flex-1 flex flex-col items-center justify-end gap-1 cursor-pointer group"
                        onMouseEnter={() => setHoveredBar(bar.key)}
                        onMouseLeave={() => setHoveredBar(null)}
                      >
                        {/* Tooltip */}
                        {isHovered && bar.barValue > 0 && (
                          <div className="absolute -translate-y-8 bg-[#162744] border border-[#243A66] rounded-lg px-2 py-1 text-[10px] text-[#F0ECE4] whitespace-nowrap z-10 pointer-events-none shadow-xl">
                            {bar.label}/{String(bar.year).slice(2)} · {formatMoeda(bar.barValue)}
                          </div>
                        )}
                        <div
                          className="w-full rounded-t-md transition-all duration-300 relative"
                          style={{
                            height: `${Math.max(heightPct, bar.barValue > 0 ? 4 : 0)}%`,
                            background: bar.isFuture
                              ? "transparent"
                              : bar.isCurrent
                              ? "#F59E0B"
                              : "linear-gradient(180deg, #E8C97A, #C9A84C)",
                            border: bar.isFuture ? "2px dashed #3A5070" : "none",
                            opacity: isHovered ? 1 : 0.85,
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
                {/* X-axis labels */}
                <div className="flex gap-1.5 mt-2">
                  {dozeChartData.map(bar => (
                    <div key={bar.key} className="flex-1 text-center">
                      <span
                        className={`text-[9px] font-semibold ${bar.isCurrent ? "text-amber-400" : bar.isFuture ? "text-[#3A5070]" : "text-[#7A8FA8]"}`}
                      >
                        {bar.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Hover tooltip below chart (fallback for mobile) */}
            {hoveredBar && (() => {
              const bar = dozeChartData.find(b => b.key === hoveredBar);
              if (!bar || bar.barValue === 0) return null;
              return (
                <div className="mt-3 flex items-center gap-3 bg-[#162744] border border-[#243A66] rounded-xl px-4 py-2 text-sm">
                  <span className="font-bold text-[#F0ECE4]">{bar.label} {bar.year}</span>
                  <span className="text-[#7A8FA8]">·</span>
                  {bar.isFuture ? (
                    <span className="text-[#3A5070]">Projeção: <strong className="text-[#F0ECE4]">{formatMoeda(bar.barValue)}</strong></span>
                  ) : bar.isCurrent ? (
                    <span className="text-amber-400">Atual: Pago {formatMoeda(bar.paga)} + A Receber {formatMoeda(bar.aPagar)}</span>
                  ) : (
                    <span className="text-[#E8C97A]">Pago: <strong>{formatMoeda(bar.paga)}</strong></span>
                  )}
                </div>
              );
            })()}
          </div>

          {/* Breakdown por tipo */}
          <div className="bg-[#0D1B2E] border border-[#243A66] rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-5">
              <CreditCard className="w-4 h-4 text-[#C9A84C]" />
              <span className="text-sm font-bold text-[#F0ECE4]">Breakdown por Tipo de Operação</span>
            </div>

            {breakdownTipo.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 text-[#7A8FA8]">
                <BarChart3 className="w-8 h-8 mb-2 opacity-20" />
                <p className="text-sm">Nenhuma comissão registrada</p>
              </div>
            ) : (
              <>
                {/* Horizontal bar chart */}
                <div className="h-8 rounded-xl overflow-hidden flex mb-4">
                  {breakdownTipo.map((b, i) => (
                    <div
                      key={b.tipo}
                      className="h-full transition-all duration-700 relative group"
                      style={{
                        width: `${b.pct}%`,
                        backgroundColor: tipoColors[b.tipo as TipoOp],
                        opacity: 0.85,
                      }}
                      title={`${tipoLabels[b.tipo as TipoOp]}: ${b.pct.toFixed(1)}%`}
                    />
                  ))}
                </div>

                {/* Legend */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                  {breakdownTipo.map(b => (
                    <div key={b.tipo} className="flex items-start gap-2">
                      <div
                        className="w-3 h-3 rounded-sm flex-shrink-0 mt-0.5"
                        style={{ backgroundColor: tipoColors[b.tipo as TipoOp] }}
                      />
                      <div>
                        <p className="text-xs font-semibold text-[#F0ECE4]">{tipoLabels[b.tipo as TipoOp]}</p>
                        <p className="text-[10px] text-[#7A8FA8]">{b.pct.toFixed(1)}%</p>
                        <p className="text-[10px] text-[#C9A84C] font-semibold">{formatMoeda(b.val)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

        </div>
      )}

      {/* ══════════════ PROJEÇÃO TAB ══════════════ */}
      {activeTab === "projecao" && (
        <div className="space-y-6">
          {/* Big projection header */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-gradient-to-br from-[#162744] to-[#111F35] border border-[#C9A84C]/30 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-[#C9A84C]/20 flex items-center justify-center">
                  <Clock className="w-4 h-4 text-[#C9A84C]" />
                </div>
                <span className="text-xs font-bold text-[#7A8FA8] uppercase tracking-wide">Este Mês</span>
              </div>
              <p className="text-2xl font-bold text-[#E8C97A]">{formatMoeda(thisMonthTotal)}</p>
              <p className="text-xs text-[#7A8FA8] mt-1">{thisMonthPendentes.length} operaç{thisMonthPendentes.length !== 1 ? "ões" : "ão"} com previsão</p>
            </div>
            <div className="bg-gradient-to-br from-[#162744] to-[#111F35] border border-[#243A66] rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-[#7A8FA8]/20 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-[#7A8FA8]" />
                </div>
                <span className="text-xs font-bold text-[#7A8FA8] uppercase tracking-wide">Próx. Mês (est.)</span>
              </div>
              <p className="text-2xl font-bold text-[#F0ECE4]">{formatMoeda(avgMonthly)}</p>
              <p className="text-xs text-[#7A8FA8] mt-1">baseado na média histórica</p>
            </div>
            <div className="bg-gradient-to-br from-[#162744] to-[#111F35] border border-[#243A66] rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
                  <Trophy className="w-4 h-4 text-amber-400" />
                </div>
                <span className="text-xs font-bold text-[#7A8FA8] uppercase tracking-wide">Total a Receber</span>
              </div>
              <p className="text-2xl font-bold text-amber-400">{formatMoeda(yearTotal)}</p>
              <p className="text-xs text-[#7A8FA8] mt-1">{pendentes.length} pendentes no pipeline</p>
            </div>
          </div>

          {/* Bar chart */}
          <div className="bg-[#0D1B2E] border border-[#243A66] rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-5">
              <BarChart3 className="w-4 h-4 text-[#C9A84C]" />
              <span className="text-sm font-bold text-[#F0ECE4]">Pipeline de Recebimento — Próximos Meses</span>
            </div>
            {monthlyBars.every(b => b.value === 0) ? (
              <div className="flex flex-col items-center justify-center py-8 text-[#7A8FA8]">
                <BarChart3 className="w-10 h-10 mb-3 opacity-20" />
                <p className="text-sm">Nenhuma comissão com data de previsão definida</p>
                <p className="text-xs mt-1 opacity-70">Solicite ao financeiro para incluir previsão de pagamento</p>
              </div>
            ) : (
              <div className="space-y-3">
                {monthlyBars.map((bar, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-xs font-semibold text-[#7A8FA8] w-14 flex-shrink-0 capitalize">{bar.label}</span>
                    <div className="flex-1 bg-[#111F35] rounded-full h-7 overflow-hidden relative">
                      <div
                        className="h-full rounded-full transition-all duration-700 flex items-center justify-end pr-3"
                        style={{
                          width: `${(bar.value / maxBarVal) * 100}%`,
                          background: bar.month === now.getMonth() && bar.year === now.getFullYear()
                            ? "linear-gradient(90deg, #C9A84C, #E8C97A)"
                            : "linear-gradient(90deg, #243A66, #3A5070)",
                          minWidth: bar.value > 0 ? "2rem" : "0",
                        }}
                      >
                        {bar.value > 0 && (
                          <span className="text-[10px] font-bold text-[#09081A] whitespace-nowrap">
                            {formatMoeda(bar.value)}
                          </span>
                        )}
                      </div>
                      {bar.value === 0 && (
                        <span className="absolute inset-0 flex items-center pl-3 text-[10px] text-[#3A5070]">—</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pipeline cards by type */}
          <div>
            <p className="text-xs font-bold text-[#7A8FA8] uppercase tracking-wide mb-3">Pipeline por Tipo de Operação</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {tipoGroups.filter(g => g.tipoPend.length > 0 || g.totalPaid > 0).map(g => {
                const pct = g.totalAll > 0 ? Math.round((g.totalPaid / g.totalAll) * 100) : 0;
                return (
                  <div key={g.tipo} className="bg-[#0D1B2E] border border-[#243A66] rounded-xl p-4 hover:border-[#C9A84C]/30 transition-colors">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{tipoIcons[g.tipo as TipoOp]}</span>
                        <span className="text-sm font-bold text-[#F0ECE4]">{tipoLabels[g.tipo as TipoOp]}</span>
                      </div>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                        {g.tipoPend.length} pend.
                      </span>
                    </div>
                    <p className="text-xl font-bold mb-1" style={{ color: tipoColors[g.tipo as TipoOp] }}>
                      {formatMoeda(g.totalPend)}
                    </p>
                    <p className="text-xs text-[#7A8FA8] mb-3">a receber · {formatMoeda(g.totalPaid)} já pago</p>
                    <div className="bg-[#111F35] rounded-full h-2 mb-1 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${pct}%`, backgroundColor: tipoColors[g.tipo as TipoOp] }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] text-[#7A8FA8] mb-2">
                      <span>{pct}% recebido</span>
                      <span>{formatMoeda(g.totalAll)} total</span>
                    </div>
                    {(g.minDate || g.maxDate) && (
                      <div className="flex items-center gap-1 text-[10px] text-[#7A8FA8]">
                        <ChevronRight className="w-3 h-3 text-[#C9A84C]" />
                        <span>
                          Previsão:{" "}
                          {g.minDate?.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                          {g.maxDate && g.minDate?.getTime() !== g.maxDate.getTime()
                            ? ` — ${g.maxDate.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}`
                            : ""}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
              {tipoGroups.every(g => g.tipoPend.length === 0 && g.totalPaid === 0) && (
                <div className="col-span-full flex flex-col items-center justify-center py-10 text-[#7A8FA8]">
                  <Target className="w-10 h-10 mb-3 opacity-20" />
                  <p className="text-sm">Nenhuma comissão no pipeline ainda</p>
                </div>
              )}
            </div>
          </div>

          {/* Goal / milestone section */}
          <div className="bg-gradient-to-br from-[#0D1B2E] to-[#162744] border border-[#C9A84C]/20 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-[#C9A84C]/20 flex items-center justify-center">
                <Target className="w-4 h-4 text-[#C9A84C]" />
              </div>
              <div>
                <p className="text-sm font-bold text-[#F0ECE4]">Meta de Ganhos</p>
                <p className="text-xs text-[#7A8FA8]">Progresso rumo à próxima marca</p>
              </div>
            </div>
            <div className="mb-2">
              <div className="flex justify-between items-end mb-2">
                <div>
                  <p className="text-xs text-[#7A8FA8]">Total a receber</p>
                  <p className="text-3xl font-bold text-[#E8C97A]">{formatMoeda(totalAReceber)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-[#7A8FA8]">Próxima meta</p>
                  <p className="text-xl font-bold text-[#C9A84C]">{formatMoeda(nextMilestone)}</p>
                </div>
              </div>
              <div className="bg-[#111F35] rounded-full h-4 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700 relative"
                  style={{
                    width: `${goalProgress}%`,
                    background: "linear-gradient(90deg, #C9A84C, #E8C97A)",
                  }}
                >
                  {goalProgress > 15 && (
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-[#09081A]">
                      {goalProgress.toFixed(0)}%
                    </span>
                  )}
                </div>
              </div>
              <p className="text-xs text-[#7A8FA8] mt-2">
                {totalAReceber >= nextMilestone
                  ? `Parabéns! Você atingiu ${formatMoeda(nextMilestone)}.`
                  : `Falta ${formatMoeda(nextMilestone - totalAReceber)} para atingir ${formatMoeda(nextMilestone)}`}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 mt-4">
              {milestones.map(m => {
                const reached = totalAReceber >= m;
                return (
                  <div
                    key={m}
                    className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
                      reached
                        ? "bg-[#C9A84C]/20 border-[#C9A84C]/40 text-[#E8C97A]"
                        : "bg-[#111F35] border-[#243A66] text-[#3A5070]"
                    }`}
                  >
                    {reached ? "✓" : "○"} {formatMoeda(m)}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════ EXTRATO TAB ══════════════ */}
      {activeTab === "comissoes" && <>

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

      </> /* end extrato tab */}

      {/* ══════════════ MODAL NOVA COMISSÃO (Feature C) ══════════════ */}
      {modalAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setModalAberto(false)} />
          <div className="relative w-full max-w-lg bg-[#111F35] border border-[#243A66] rounded-2xl shadow-2xl p-6 z-10 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold text-[#F0ECE4]">Nova Comissão</h2>
              <button onClick={() => setModalAberto(false)} className="text-[#7A8FA8] hover:text-[#F0ECE4]">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCriarComissao} className="space-y-4">
              <div>
                <label className={labelCls}>Partner 1 *</label>
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

              {/* Feature C: Co-originação toggle */}
              <div className="flex items-center gap-3 bg-[#0A1628] border border-[#243A66] rounded-lg px-3 py-2.5">
                <input
                  type="checkbox"
                  id="coOriginada"
                  checked={coOriginada}
                  onChange={e => {
                    setCoOriginada(e.target.checked);
                    if (!e.target.checked) { setCoPartnerId(""); setSplitPercent(50); }
                  }}
                  className="w-4 h-4 accent-[#C9A84C] cursor-pointer"
                />
                <label htmlFor="coOriginada" className="text-xs font-semibold text-[#F0ECE4] cursor-pointer select-none">
                  Operação co-originada
                </label>
                <span className="text-[10px] text-[#7A8FA8] ml-auto">Dividir comissão entre 2 partners</span>
              </div>

              {/* Co-originação fields */}
              {coOriginada && (
                <div className="bg-[#0A1628] border border-[#C9A84C]/20 rounded-xl p-4 space-y-4">
                  <div>
                    <label className={labelCls}>Partner 2 *</label>
                    <select
                      value={coPartnerId}
                      onChange={e => {
                        setCoPartnerId(e.target.value);
                        if (!e.target.value) return;
                        const p2 = partners.find(x => x.id === e.target.value);
                        setForm(f => ({ ...f, commission_percent: p2?.role === "PARTNER_PRO" ? "50" : "30" }));
                      }}
                      className={inputCls}
                      required={coOriginada}
                    >
                      <option value="">Selecione o segundo partner...</option>
                      {partners.filter(p => p.id !== form.partner_id).map(p => (
                        <option key={p.id} value={p.id}>
                          {p.full_name || p.email} ({p.role === "PARTNER_PRO" ? "PRO · 50%" : "30%"})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Split slider */}
                  <div>
                    <label className={labelCls}>Divisão da Comissão</label>
                    <div className="flex items-center justify-between text-xs mb-2">
                      <span className="text-[#F0ECE4] font-bold">
                        {p1Partner?.full_name ?? "Partner 1"}: <span className="text-[#C9A84C]">{splitPercent}%</span>
                      </span>
                      <span className="text-[#F0ECE4] font-bold">
                        {p2Partner?.full_name ?? "Partner 2"}: <span className="text-[#C9A84C]">{100 - splitPercent}%</span>
                      </span>
                    </div>
                    <input
                      type="range"
                      min={5}
                      max={95}
                      step={5}
                      value={splitPercent}
                      onChange={e => setSplitPercent(Number(e.target.value))}
                      className="w-full h-2 rounded-full accent-[#C9A84C] cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-[#3A5070] mt-1">
                      <span>5%</span>
                      <span>50/50</span>
                      <span>95%</span>
                    </div>
                  </div>

                  {/* Preview split values */}
                  {commValueTotal > 0 && coPartnerId && (
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-[#111F35] rounded-lg px-3 py-2 text-xs">
                        <p className="text-[#7A8FA8] mb-0.5">{p1Partner?.full_name ?? "Partner 1"}</p>
                        <p className="text-[#C9A84C] font-bold">{formatMoeda(p1Value)}</p>
                        <p className="text-[10px] text-[#3A5070]">{splitPercent}% de {formatMoeda(commValueTotal)}</p>
                      </div>
                      <div className="bg-[#111F35] rounded-lg px-3 py-2 text-xs">
                        <p className="text-[#7A8FA8] mb-0.5">{p2Partner?.full_name ?? "Partner 2"}</p>
                        <p className="text-[#C9A84C] font-bold">{formatMoeda(p2Value)}</p>
                        <p className="text-[10px] text-[#3A5070]">{100 - splitPercent}% de {formatMoeda(commValueTotal)}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Tipo de Operação *</label>
                  <select
                    value={form.operation_type}
                    onChange={e => setForm(f => ({ ...f, operation_type: e.target.value as TipoOp }))}
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
                  <label className={labelCls}>% Comissão Total</label>
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
              {/* Preview comissão (não co-originada) */}
              {!coOriginada && commValueTotal > 0 && (
                <div className="bg-[#C9A84C]/10 border border-[#C9A84C]/30 rounded-lg px-3 py-2 text-xs text-[#C9A84C]">
                  Comissão estimada:{" "}
                  <strong>{formatMoeda(commValueTotal)}</strong>
                </div>
              )}
              <button
                type="submit"
                disabled={criando}
                className="w-full h-10 rounded-lg bg-[#C9A84C] hover:bg-[#E8C97A] text-[#09081A] text-sm font-bold transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {criando && <Loader2 className="w-4 h-4 animate-spin" />}
                {criando ? "Criando..." : coOriginada ? "Criar 2 Comissões (Split)" : "Criar Comissão"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════ MODAL SOLICITAR PAGAMENTO (Feature B) ══════════════ */}
      {pagamentoModalAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { if (!pagamentoEnviando) setPagamentoModalAberto(false); }} />
          <div className="relative w-full max-w-md bg-[#111F35] border border-[#243A66] rounded-2xl shadow-2xl p-6 z-10">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold text-[#F0ECE4]">Solicitar pagamento de comissões</h2>
              <button
                onClick={() => setPagamentoModalAberto(false)}
                disabled={pagamentoEnviando}
                className="text-[#7A8FA8] hover:text-[#F0ECE4] disabled:opacity-40"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {pagamentoMsg ? (
              <div className="space-y-4">
                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-4 py-5 text-center">
                  <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
                  <p className="text-sm font-semibold text-emerald-400">{pagamentoMsg}</p>
                </div>
                <button
                  onClick={() => setPagamentoModalAberto(false)}
                  className="w-full h-10 rounded-lg bg-[#243A66] hover:bg-[#162744] text-[#F0ECE4] text-sm font-semibold transition-colors"
                >
                  Fechar
                </button>
              </div>
            ) : (
              <form onSubmit={handleSolicitarPagamento} className="space-y-4">
                {/* Total a pagar */}
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-4 text-center">
                  <p className="text-xs text-[#7A8FA8] mb-1">Total A Receber</p>
                  <p className="text-3xl font-bold text-amber-400">{formatMoeda(aReceber)}</p>
                  <p className="text-xs text-[#7A8FA8] mt-1">{commissions.filter(c => c.status === "A_PAGAR").length} comissões pendentes</p>
                </div>

                {/* Forma de pagamento */}
                <div>
                  <label className={labelCls}>Forma de pagamento</label>
                  <div className="flex gap-3">
                    <label className={`flex-1 flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-all ${pagamentoMethod === "PIX" ? "border-[#C9A84C] bg-[#C9A84C]/10" : "border-[#243A66] bg-[#0A1628] hover:border-[#3A5070]"}`}>
                      <input
                        type="radio"
                        name="method"
                        value="PIX"
                        checked={pagamentoMethod === "PIX"}
                        onChange={() => setPagamentoMethod("PIX")}
                        className="accent-[#C9A84C]"
                      />
                      <div>
                        <p className="text-sm font-bold text-[#F0ECE4]">Pix</p>
                        <p className="text-[10px] text-[#7A8FA8]">Instantâneo</p>
                      </div>
                    </label>
                    <label className={`flex-1 flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-all ${pagamentoMethod === "BOLETO" ? "border-[#C9A84C] bg-[#C9A84C]/10" : "border-[#243A66] bg-[#0A1628] hover:border-[#3A5070]"}`}>
                      <input
                        type="radio"
                        name="method"
                        value="BOLETO"
                        checked={pagamentoMethod === "BOLETO"}
                        onChange={() => setPagamentoMethod("BOLETO")}
                        className="accent-[#C9A84C]"
                      />
                      <div>
                        <p className="text-sm font-bold text-[#F0ECE4]">Boleto</p>
                        <p className="text-[10px] text-[#7A8FA8]">1-2 dias úteis</p>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Chave Pix */}
                {pagamentoMethod === "PIX" && (
                  <div>
                    <label className={labelCls}>Chave Pix *</label>
                    <input
                      value={pagamentoPixKey}
                      onChange={e => setPagamentoPixKey(e.target.value)}
                      placeholder="CPF, CNPJ, e-mail ou celular"
                      className={inputCls}
                      required={pagamentoMethod === "PIX"}
                    />
                  </div>
                )}

                {/* Nota */}
                <div>
                  <label className={labelCls}>Referência / Observação</label>
                  <input
                    value={pagamentoNote}
                    onChange={e => setPagamentoNote(e.target.value)}
                    placeholder="Ex: Comissões de maio/2026"
                    className={inputCls}
                  />
                </div>

                {pagamentoErro && (
                  <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{pagamentoErro}</p>
                )}

                <button
                  type="submit"
                  disabled={pagamentoEnviando}
                  className="w-full h-10 rounded-lg bg-[#C9A84C] hover:bg-[#E8C97A] text-[#09081A] text-sm font-bold transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {pagamentoEnviando && <Loader2 className="w-4 h-4 animate-spin" />}
                  {pagamentoEnviando ? "Enviando..." : "Solicitar pagamento"}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* NPS automático pós-deal */}
      {npsCommission && (
        <NpsModal
          commissionId={npsCommission.id}
          productName={npsCommission.product_name}
          onClose={() => setNpsCommission(null)}
          onSubmitted={() => setNpsCommission(null)}
        />
      )}
    </div>
  );
}
