"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Building2, RefreshCw, Plus, X, Loader2, CheckCircle2, AlertCircle,
  TrendingUp, TrendingDown, Receipt, Download, Ban, Copy, QrCode,
  ExternalLink, DollarSign, Clock, XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

interface Saldo { available: number; blocked: number; }
interface Lancamento {
  id: string;
  description: string;
  amount: number;
  type: "CREDIT" | "DEBIT";
  created_at: string;
  balance_after?: number;
  category?: string;
}
interface Cobranca {
  id: string;
  status: string;
  customer_name: string;
  customer_document?: string;
  due_date: string;
  total_amount: number;
  paid_at?: string | null;
  total_paid?: number | null;
  payment_form?: string;
  created_at?: string;
}
interface NovaCobrancaResult {
  cobranca?: {
    id?: string;
    pix?: { emv?: string; qr_code?: string };
    bank_slip?: { pdf?: { url?: string }; our_number?: string };
    payment_url?: string;
  };
}

function fmtBRL(centavos: number) {
  return (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function fmtDate(s: string) {
  return new Date(s + (s.length === 10 ? "T12:00:00" : "")).toLocaleDateString("pt-BR");
}

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  OPEN:      { label: "Pendente",   cls: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
  PENDING:   { label: "Pendente",   cls: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
  PAID:      { label: "Pago",       cls: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
  CANCELLED: { label: "Cancelado",  cls: "bg-red-500/20 text-red-400 border-red-500/30" },
  OVERDUE:   { label: "Vencido",    cls: "bg-red-500/20 text-red-400 border-red-500/30" },
  EXPIRED:   { label: "Vencido",    cls: "bg-red-500/20 text-red-400 border-red-500/30" },
};

const FILTERS = [
  { key: "", label: "Todas" },
  { key: "OPEN", label: "Pendentes" },
  { key: "PAID", label: "Pagas" },
  { key: "CANCELLED", label: "Canceladas" },
];

export function CoraPanel() {
  const [tab, setTab] = useState<"extrato" | "cobrancas" | "dashboard">("dashboard");
  const [saldo, setSaldo] = useState<Saldo | null>(null);
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [cobrancas, setCobrancas] = useState<Cobranca[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ nome: "", documento: "", email: "", valor: "", vencimento: "", descricao: "" });
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [novaCobrancaData, setNovaCobrancaData] = useState<NovaCobrancaResult["cobranca"] | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [pixCopiado, setPixCopiado] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const url = statusFilter
        ? `/api/cora/cobranca?status=${statusFilter}`
        : "/api/cora/cobranca";
      const [sRes, eRes, cRes] = await Promise.all([
        fetch("/api/cora/saldo"),
        fetch("/api/cora/extrato"),
        fetch(url),
      ]);
      const [sData, eData, cData] = await Promise.all([sRes.json(), eRes.json(), cRes.json()]);

      if (sData.available !== undefined || sData.balance !== undefined) {
        setSaldo({ available: sData.available ?? sData.balance ?? 0, blocked: sData.blocked ?? 0 });
      }
      if (eData.items) setLancamentos(eData.items);
      else if (Array.isArray(eData)) setLancamentos(eData);

      const rawList: Cobranca[] = cData.invoices ?? cData.items ?? (Array.isArray(cData) ? cData : []);
      setCobrancas(rawList.filter((c) => c && typeof c === "object" && c.id));
    } catch (e) {
      setError(String(e));
    }
    setLoading(false);
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  // ── Nova cobrança ──────────────────────────────────────────────────────────
  async function handleCriarCobranca() {
    if (!form.nome || !form.documento || !form.valor || !form.vencimento || !form.descricao) return;
    setSubmitting(true); setSubmitResult(null); setNovaCobrancaData(null);
    try {
      const res = await fetch("/api/cora/cobranca", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: form.nome,
          documento: form.documento.replace(/\D/g, ""),
          email: form.email || undefined,
          valor: Math.round(parseFloat(form.valor.replace(",", ".")) * 100),
          vencimento: form.vencimento,
          descricao: form.descricao,
          juros_ao_mes: 1,
          multa: 2,
        }),
      });
      const data: NovaCobrancaResult = await res.json();
      if (res.ok) {
        setSubmitResult({ ok: true, msg: "Cobrança criada com sucesso!" });
        if (data.cobranca) setNovaCobrancaData(data.cobranca);
        setForm({ nome: "", documento: "", email: "", valor: "", vencimento: "", descricao: "" });
        setTimeout(() => load(), 1500);
      } else {
        setSubmitResult({ ok: false, msg: (data as { error?: string }).error ?? "Erro ao criar cobrança" });
      }
    } catch (e) {
      setSubmitResult({ ok: false, msg: String(e) });
    }
    setSubmitting(false);
  }

  // ── Cancelar cobrança ──────────────────────────────────────────────────────
  async function handleCancelar(id: string) {
    if (!confirm("Cancelar esta cobrança?")) return;
    setCancellingId(id);
    try {
      const res = await fetch("/api/cora/cobranca", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        setCobrancas(prev => prev.map(c => c.id === id ? { ...c, status: "CANCELLED" } : c));
      }
    } catch { /* silencioso */ }
    setCancellingId(null);
  }

  // ── Export CSV ─────────────────────────────────────────────────────────────
  function exportCSV() {
    const header = ["ID", "Cliente", "Documento", "Status", "Valor (R$)", "Vencimento", "Pago em", "Forma"];
    const rows = cobrancas.map(c => [
      c.id,
      c.customer_name,
      c.customer_document ?? "",
      STATUS_LABEL[c.status]?.label ?? c.status,
      (c.total_amount / 100).toFixed(2),
      c.due_date,
      c.paid_at ? fmtDate(c.paid_at) : "",
      c.payment_form ?? "",
    ]);
    const csv = [header, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `cobracas-cora-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  }

  // ── Dados para gráfico ─────────────────────────────────────────────────────
  const chartData = (() => {
    const byMonth: Record<string, { mes: string; pendente: number; pago: number; cancelado: number }> = {};
    cobrancas.forEach(c => {
      const key = (c.created_at ?? c.due_date ?? "").slice(0, 7);
      if (!key) return;
      if (!byMonth[key]) byMonth[key] = { mes: key.slice(5) + "/" + key.slice(0, 4), pendente: 0, pago: 0, cancelado: 0 };
      const val = c.total_amount / 100;
      if (["OPEN", "PENDING"].includes(c.status)) byMonth[key].pendente += val;
      else if (c.status === "PAID") byMonth[key].pago += val;
      else if (["CANCELLED", "EXPIRED"].includes(c.status)) byMonth[key].cancelado += val;
    });
    return Object.values(byMonth).sort((a, b) => a.mes.localeCompare(b.mes)).slice(-6);
  })();

  const totalPago = cobrancas.filter(c => c.status === "PAID").reduce((s, c) => s + c.total_amount, 0);
  const totalPendente = cobrancas.filter(c => ["OPEN", "PENDING"].includes(c.status)).reduce((s, c) => s + c.total_amount, 0);
  const totalCancelado = cobrancas.filter(c => ["CANCELLED", "EXPIRED"].includes(c.status)).reduce((s, c) => s + c.total_amount, 0);

  const inputCls = "w-full h-9 px-3 text-sm rounded-lg border bg-[#0A1628] border-[#243A66] text-[#F0ECE4] placeholder:text-[#3A5070] focus:outline-none focus:ring-1 focus:ring-[#C9A84C]/50";

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#FF7A00]/10 border border-[#FF7A00]/30 flex items-center justify-center">
            <Building2 className="w-4 h-4 text-[#FF7A00]" />
          </div>
          <div>
            <p className="text-sm font-bold text-white">Cora Bank</p>
            <p className="text-xs text-muted-foreground">
              {process.env.NEXT_PUBLIC_CORA_ENV === "stage" ? "Ambiente de Homologação" : "Conta Empresarial"}
            </p>
          </div>
        </div>
        <button onClick={load} disabled={loading} className="p-2 rounded-lg border border-[#243A66] text-[#7A8FA8] hover:text-white transition-colors">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {error && (
        <div className="p-3 rounded-xl border border-red-500/30 bg-red-500/10 text-xs text-red-400 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
        </div>
      )}

      {/* Saldo */}
      {saldo && (
        <div className="grid grid-cols-2 gap-3">
          <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5">
            <p className="text-xs text-muted-foreground mb-1">Saldo Disponível</p>
            <p className="text-xl font-bold text-emerald-400">{fmtBRL(saldo.available)}</p>
          </div>
          <div className="p-4 rounded-xl border border-[#243A66] bg-[#0D1929]">
            <p className="text-xs text-muted-foreground mb-1">Saldo Bloqueado</p>
            <p className="text-xl font-bold text-[#7A8FA8]">{fmtBRL(saldo.blocked)}</p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-[#0D1929] border border-[#243A66] rounded-xl p-1 w-fit">
        {([
          { key: "dashboard", label: "Dashboard" },
          { key: "extrato", label: "Extrato" },
          { key: "cobrancas", label: "Cobranças" },
        ] as const).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors ${tab === t.key ? "bg-[#C9A84C] text-[#09081A]" : "text-[#7A8FA8] hover:text-[#F0ECE4]"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Dashboard ── */}
      {tab === "dashboard" && (
        <div className="space-y-4">
          {/* KPIs */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Total Recebido", value: totalPago, icon: <CheckCircle2 className="w-4 h-4 text-emerald-400" />, cls: "text-emerald-400", border: "border-emerald-500/20" },
              { label: "Aguardando", value: totalPendente, icon: <Clock className="w-4 h-4 text-amber-400" />, cls: "text-amber-400", border: "border-amber-500/20" },
              { label: "Cancelado", value: totalCancelado, icon: <XCircle className="w-4 h-4 text-red-400" />, cls: "text-red-400", border: "border-red-500/20" },
            ].map(k => (
              <div key={k.label} className={`p-4 rounded-xl border ${k.border} bg-[#0D1929]`}>
                <div className="flex items-center gap-2 mb-2">{k.icon}<p className="text-[10px] text-muted-foreground uppercase tracking-wide">{k.label}</p></div>
                <p className={`text-lg font-bold ${k.cls}`}>{fmtBRL(k.value)}</p>
              </div>
            ))}
          </div>

          {/* Gráfico de receita */}
          {chartData.length > 0 ? (
            <div className="p-4 rounded-xl border border-[#243A66] bg-[#0D1929]">
              <p className="text-xs font-bold text-[#C9A84C] uppercase tracking-wide mb-4">Cobranças por Mês</p>
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradPago" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradPendente" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#C9A84C" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#C9A84C" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#243A66" />
                  <XAxis dataKey="mes" tick={{ fill: "#7A8FA8", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "#7A8FA8", fontSize: 10 }} axisLine={false} tickLine={false}
                    tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
                  <Tooltip
                    contentStyle={{ background: "#0D1929", border: "1px solid #243A66", borderRadius: 8, fontSize: 11 }}
                    formatter={(v: number) => [fmtBRL(v * 100), ""]}
                  />
                  <Area type="monotone" dataKey="pago" name="Pago" stroke="#10b981" fill="url(#gradPago)" strokeWidth={2} />
                  <Area type="monotone" dataKey="pendente" name="Pendente" stroke="#C9A84C" fill="url(#gradPendente)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="p-8 text-center rounded-xl border border-[#243A66] bg-[#0D1929] text-sm text-muted-foreground">
              <DollarSign className="w-8 h-8 mx-auto mb-2 opacity-30" />
              Sem dados suficientes para o gráfico.
            </div>
          )}

          {/* Últimas cobranças */}
          <div className="space-y-2">
            <p className="text-xs font-bold text-[#7A8FA8] uppercase tracking-wide">Cobranças Recentes</p>
            {cobrancas.slice(0, 5).map(c => {
              const st = STATUS_LABEL[c.status] ?? { label: c.status, cls: "bg-secondary text-muted-foreground border-border" };
              return (
                <div key={c.id} className="flex items-center gap-3 p-3 rounded-xl border border-[#243A66] bg-[#0D1929]">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-white truncate">{c.customer_name}</span>
                      <Badge className={`text-[10px] px-1.5 py-0 ${st.cls}`}>{st.label}</Badge>
                    </div>
                    <p className="text-[10px] text-muted-foreground">Vence {fmtDate(c.due_date)}</p>
                  </div>
                  <p className="text-sm font-bold text-[#C9A84C] flex-shrink-0">{fmtBRL(c.total_amount)}</p>
                </div>
              );
            })}
            {cobrancas.length === 0 && !loading && (
              <p className="text-center py-4 text-xs text-muted-foreground">Nenhuma cobrança ainda.</p>
            )}
          </div>
        </div>
      )}

      {/* ── Extrato ── */}
      {tab === "extrato" && (
        <div className="space-y-2">
          {loading && <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>}
          {!loading && lancamentos.length === 0 && (
            <div className="text-center py-8 text-muted-foreground text-sm">Nenhum lançamento encontrado.</div>
          )}
          {lancamentos.map(l => (
            <div key={l.id} className="flex items-center gap-3 p-3 rounded-xl border border-[#243A66] bg-[#0D1929]">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${l.type === "CREDIT" ? "bg-emerald-500/10" : "bg-red-500/10"}`}>
                {l.type === "CREDIT" ? <TrendingUp className="w-4 h-4 text-emerald-400" /> : <TrendingDown className="w-4 h-4 text-red-400" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-white truncate">{l.description}</p>
                <p className="text-[10px] text-muted-foreground">{fmtDate(l.created_at)}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className={`text-sm font-bold ${l.type === "CREDIT" ? "text-emerald-400" : "text-red-400"}`}>
                  {l.type === "CREDIT" ? "+" : "-"}{fmtBRL(Math.abs(l.amount))}
                </p>
                {l.balance_after !== undefined && (
                  <p className="text-[10px] text-muted-foreground">{fmtBRL(l.balance_after)}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Cobranças ── */}
      {tab === "cobrancas" && (
        <div className="space-y-3">
          {/* Toolbar */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            {/* Filtros */}
            <div className="flex items-center gap-1 bg-[#0D1929] border border-[#243A66] rounded-lg p-1">
              {FILTERS.map(f => (
                <button key={f.key} onClick={() => setStatusFilter(f.key)}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${statusFilter === f.key ? "bg-[#243A66] text-[#F0ECE4]" : "text-[#7A8FA8] hover:text-[#F0ECE4]"}`}>
                  {f.label}
                </button>
              ))}
            </div>
            {/* Ações */}
            <div className="flex items-center gap-2">
              <button onClick={exportCSV} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#243A66] text-xs text-[#7A8FA8] hover:text-white transition-colors">
                <Download className="w-3.5 h-3.5" /> CSV
              </button>
              <button
                onClick={() => { setShowForm(!showForm); setSubmitResult(null); setNovaCobrancaData(null); }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#C9A84C] hover:bg-[#E8C97A] text-[#09081A] text-xs font-bold transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Nova Cobrança
              </button>
            </div>
          </div>

          {/* Formulário */}
          {showForm && (
            <div className="p-5 rounded-xl border border-[#243A66] bg-[#0D1929] space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-white flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-[#C9A84C]" /> Nova Cobrança
                </p>
                <button onClick={() => { setShowForm(false); setNovaCobrancaData(null); }}>
                  <X className="w-4 h-4 text-muted-foreground hover:text-white" />
                </button>
              </div>

              {!novaCobrancaData ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-[#7A8FA8] mb-1">Nome *</label>
                      <input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} className={inputCls} placeholder="Nome do devedor" />
                    </div>
                    <div>
                      <label className="block text-xs text-[#7A8FA8] mb-1">CPF/CNPJ *</label>
                      <input value={form.documento} onChange={e => setForm(f => ({ ...f, documento: e.target.value }))} className={inputCls} placeholder="000.000.000-00" />
                    </div>
                    <div>
                      <label className="block text-xs text-[#7A8FA8] mb-1">E-mail</label>
                      <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className={inputCls} placeholder="email@exemplo.com" type="email" />
                    </div>
                    <div>
                      <label className="block text-xs text-[#7A8FA8] mb-1">Valor (R$) *</label>
                      <input value={form.valor} onChange={e => setForm(f => ({ ...f, valor: e.target.value }))} className={inputCls} placeholder="197,00" />
                    </div>
                    <div>
                      <label className="block text-xs text-[#7A8FA8] mb-1">Vencimento *</label>
                      <input value={form.vencimento} onChange={e => setForm(f => ({ ...f, vencimento: e.target.value }))} className={inputCls} type="date" />
                    </div>
                    <div>
                      <label className="block text-xs text-[#7A8FA8] mb-1">Descrição *</label>
                      <input value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} className={inputCls} placeholder="V3 Partner — Mensalidade" />
                    </div>
                  </div>
                  {submitResult && (
                    <div className={`flex items-center gap-2 text-xs p-2 rounded-lg ${submitResult.ok ? "text-emerald-400 bg-emerald-500/10" : "text-red-400 bg-red-500/10"}`}>
                      {submitResult.ok ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                      {submitResult.msg}
                    </div>
                  )}
                  <button
                    onClick={handleCriarCobranca}
                    disabled={submitting || !form.nome || !form.documento || !form.valor || !form.vencimento || !form.descricao}
                    className="w-full py-2.5 rounded-xl bg-[#C9A84C] hover:bg-[#E8C97A] text-[#09081A] text-sm font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Criando...</> : "Criar Cobrança"}
                  </button>
                </>
              ) : (
                /* QR Code + Pix após criar */
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-emerald-400 text-sm font-bold">
                    <CheckCircle2 className="w-5 h-5" /> Cobrança criada com sucesso!
                  </div>
                  {novaCobrancaData.pix?.qr_code && (
                    <div className="flex justify-center">
                      <div className="bg-white p-3 rounded-xl">
                        <img src={novaCobrancaData.pix.qr_code} alt="QR Code Pix" className="w-44 h-44" />
                      </div>
                    </div>
                  )}
                  {novaCobrancaData.pix?.emv && (
                    <div>
                      <p className="text-xs text-[#7A8FA8] mb-2">Pix Copia e Cola</p>
                      <div className="flex gap-2">
                        <div className="flex-1 px-3 py-2 rounded-lg bg-[#0A1628] border border-[#243A66] text-xs font-mono text-[#7A8FA8] truncate">
                          {novaCobrancaData.pix.emv}
                        </div>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(novaCobrancaData!.pix!.emv!);
                            setPixCopiado(true);
                            setTimeout(() => setPixCopiado(false), 3000);
                          }}
                          className={`flex-shrink-0 flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-bold transition-colors ${pixCopiado ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-[#C9A84C] hover:bg-[#E8C97A] text-[#09081A]"}`}
                        >
                          <Copy className="w-3.5 h-3.5" />{pixCopiado ? "Copiado!" : "Copiar"}
                        </button>
                      </div>
                    </div>
                  )}
                  {novaCobrancaData.bank_slip?.our_number && (
                    <div>
                      <p className="text-xs text-[#7A8FA8] mb-2">Código de Barras</p>
                      <div className="flex gap-2">
                        <div className="flex-1 px-3 py-2 rounded-lg bg-[#0A1628] border border-[#243A66] text-xs font-mono text-[#7A8FA8] truncate">
                          {novaCobrancaData.bank_slip.our_number}
                        </div>
                        {novaCobrancaData.bank_slip.pdf?.url && (
                          <a href={novaCobrancaData.bank_slip.pdf.url} target="_blank" rel="noopener noreferrer"
                            className="flex-shrink-0 flex items-center gap-1 px-3 py-2 rounded-lg border border-[#243A66] text-xs text-[#7A8FA8] hover:text-white transition-colors">
                            <ExternalLink className="w-3.5 h-3.5" /> Boleto
                          </a>
                        )}
                      </div>
                    </div>
                  )}
                  {novaCobrancaData.payment_url && !novaCobrancaData.pix?.emv && (
                    <a href={novaCobrancaData.payment_url} target="_blank" rel="noopener noreferrer"
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-[#C9A84C]/40 text-[#C9A84C] text-sm font-bold hover:bg-[#C9A84C]/10 transition-colors">
                      <QrCode className="w-4 h-4" /> Ver Cobrança
                    </a>
                  )}
                  <button onClick={() => setNovaCobrancaData(null)}
                    className="w-full py-2 rounded-xl border border-[#243A66] text-xs text-[#7A8FA8] hover:text-white transition-colors">
                    Nova Cobrança
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Lista */}
          {loading && <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>}
          {!loading && cobrancas.length === 0 && (
            <div className="text-center py-8 text-muted-foreground text-sm">Nenhuma cobrança encontrada.</div>
          )}
          {cobrancas.map(c => {
            const st = STATUS_LABEL[c.status] ?? { label: c.status, cls: "bg-secondary text-muted-foreground border-border" };
            const canCancel = ["OPEN", "PENDING"].includes(c.status);
            return (
              <div key={c.id} className="flex items-center gap-3 p-4 rounded-xl border border-[#243A66] bg-[#0D1929]">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-white truncate">{c.customer_name}</span>
                    <Badge className={`text-[10px] px-1.5 py-0 ${st.cls}`}>{st.label}</Badge>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    {c.payment_form ?? "Cobrança"} · Vence {fmtDate(c.due_date)}
                    {c.paid_at ? ` · Pago em ${fmtDate(c.paid_at)}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <div className="text-right">
                    <p className="text-sm font-bold text-[#C9A84C]">{fmtBRL(c.total_amount)}</p>
                    <p className="text-[10px] text-muted-foreground font-mono">{c.id.slice(-8).toUpperCase()}</p>
                  </div>
                  {canCancel && (
                    <button
                      onClick={() => handleCancelar(c.id)}
                      disabled={cancellingId === c.id}
                      title="Cancelar cobrança"
                      className="p-1.5 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                    >
                      {cancellingId === c.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Ban className="w-3.5 h-3.5" />}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
