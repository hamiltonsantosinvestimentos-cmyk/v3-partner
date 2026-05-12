"use client";

import React, { useState, useEffect } from "react";
import { Building2, RefreshCw, Plus, X, Loader2, CheckCircle2, AlertCircle, ChevronRight, TrendingUp, TrendingDown, Minus, Receipt } from "lucide-react";
import { Badge } from "@/components/ui/badge";

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
  code: string;
  status: "PENDING" | "PAID" | "CANCELLED" | "OVERDUE";
  customer: { name: string };
  payment_terms: { due_date: string; amount: number };
  services?: { name: string }[];
}

function fmtBRL(centavos: number) {
  return (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function fmtDate(s: string) {
  return new Date(s).toLocaleDateString("pt-BR");
}

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  PENDING:   { label: "Pendente",   cls: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
  PAID:      { label: "Pago",       cls: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
  CANCELLED: { label: "Cancelado",  cls: "bg-red-500/20 text-red-400 border-red-500/30" },
  OVERDUE:   { label: "Vencido",    cls: "bg-red-500/20 text-red-400 border-red-500/30" },
};

export function CoraPanel() {
  const [tab, setTab] = useState<"extrato" | "cobrancas">("extrato");
  const [saldo, setSaldo] = useState<Saldo | null>(null);
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [cobrancas, setCobrancas] = useState<Cobranca[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ nome: "", documento: "", email: "", valor: "", vencimento: "", descricao: "" });
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<{ ok: boolean; msg: string } | null>(null);

  async function load() {
    setLoading(true); setError(null);
    try {
      const [sRes, eRes, cRes] = await Promise.all([
        fetch("/api/cora/saldo"),
        fetch("/api/cora/extrato"),
        fetch("/api/cora/cobranca"),
      ]);
      const [sData, eData, cData] = await Promise.all([sRes.json(), eRes.json(), cRes.json()]);
      if (sData.available !== undefined || sData.balance !== undefined) {
        setSaldo({ available: sData.available ?? sData.balance ?? 0, blocked: sData.blocked ?? 0 });
      }
      if (eData.items) setLancamentos(eData.items);
      else if (Array.isArray(eData)) setLancamentos(eData);
      if (cData.invoices) setCobrancas(cData.invoices);
      else if (cData.items) setCobrancas(cData.items);
      else if (Array.isArray(cData)) setCobrancas(cData);
    } catch (e) {
      setError(String(e));
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleCriarCobranca() {
    if (!form.nome || !form.documento || !form.valor || !form.vencimento || !form.descricao) return;
    setSubmitting(true); setSubmitResult(null);
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
      const data = await res.json();
      if (res.ok) {
        setSubmitResult({ ok: true, msg: "Cobrança criada com sucesso!" });
        setForm({ nome: "", documento: "", email: "", valor: "", vencimento: "", descricao: "" });
        setTimeout(() => { setShowForm(false); setSubmitResult(null); load(); }, 2000);
      } else {
        setSubmitResult({ ok: false, msg: data.error ?? "Erro ao criar cobrança" });
      }
    } catch (e) {
      setSubmitResult({ ok: false, msg: String(e) });
    }
    setSubmitting(false);
  }

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
            <p className="text-xs text-muted-foreground">{process.env.NEXT_PUBLIC_CORA_ENV === "stage" ? "Ambiente de Homologação" : "Conta Empresarial"}</p>
          </div>
        </div>
        <button onClick={load} disabled={loading} className="p-2 rounded-lg border border-[#243A66] text-[#7A8FA8] hover:text-white transition-colors">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {error && (
        <div className="p-3 rounded-xl border border-red-500/30 bg-red-500/10 text-xs text-red-400 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
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
          { key: "extrato", label: "Extrato" },
          { key: "cobrancas", label: "Cobranças" },
        ] as const).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors ${tab === t.key ? "bg-[#C9A84C] text-[#09081A]" : "text-[#7A8FA8] hover:text-[#F0ECE4]"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Extrato */}
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

      {/* Cobranças */}
      {tab === "cobrancas" && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button
              onClick={() => { setShowForm(!showForm); setSubmitResult(null); }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#C9A84C] hover:bg-[#E8C97A] text-[#09081A] text-xs font-bold transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Nova Cobrança
            </button>
          </div>

          {/* Formulário */}
          {showForm && (
            <div className="p-5 rounded-xl border border-[#243A66] bg-[#0D1929] space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-white flex items-center gap-2"><Receipt className="w-4 h-4 text-[#C9A84C]" /> Nova Cobrança</p>
                <button onClick={() => setShowForm(false)}><X className="w-4 h-4 text-muted-foreground hover:text-white" /></button>
              </div>
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
            </div>
          )}

          {/* Lista de cobranças */}
          {loading && <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>}
          {!loading && cobrancas.length === 0 && (
            <div className="text-center py-8 text-muted-foreground text-sm">Nenhuma cobrança encontrada.</div>
          )}
          {cobrancas.map(c => {
            const st = STATUS_LABEL[c.status] ?? { label: c.status, cls: "bg-secondary text-muted-foreground border-border" };
            return (
              <div key={c.id} className="flex items-center gap-3 p-4 rounded-xl border border-[#243A66] bg-[#0D1929]">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-white truncate">{c.customer?.name}</span>
                    <Badge className={`text-[10px] px-1.5 py-0 ${st.cls}`}>{st.label}</Badge>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    {c.services?.[0]?.name ?? "Cobrança"} · Vence {fmtDate(c.payment_terms.due_date)}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-bold text-[#C9A84C]">{fmtBRL(c.payment_terms.amount)}</p>
                  <p className="text-[10px] text-muted-foreground font-mono">{c.code}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
