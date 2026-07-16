"use client";

import React, { useEffect, useState } from "react";
import { Loader2, ShieldAlert, CheckCircle2, Plus, Trash2, Send } from "lucide-react";
import { maskCpfCnpjInput } from "@/lib/utils";

interface IntermediaryFillViewerProps {
  token: string;
}

interface Row {
  intermediary_name: string;
  intermediary_document: string;
  percentage: string;
}

export function IntermediaryFillViewer({ token }: IntermediaryFillViewerProps) {
  const [context, setContext] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [rows, setRows] = useState<Row[]>([{ intermediary_name: "", intermediary_document: "", percentage: "" }]);

  useEffect(() => {
    fetch(`/api/cm/deal-intermediaries/fill/${token}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Erro ao carregar");
        setContext(json);
        if (json.status === "preenchido") setSubmitted(true);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [token]);

  const soma = rows.reduce((s, r) => s + (Number(r.percentage) || 0), 0);

  const updateRow = (i: number, field: keyof Row, value: string) => {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)));
  };

  const addRow = () => setRows((prev) => [...prev, { intermediary_name: "", intermediary_document: "", percentage: "" }]);
  const removeRow = (i: number) => setRows((prev) => prev.filter((_, idx) => idx !== i));

  const handleSubmit = async () => {
    setError("");
    if (Math.abs(soma - 100) > 0.01) {
      setError(`Os percentuais somam ${soma}%, precisam somar exatamente 100%`);
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/cm/deal-intermediaries/fill/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erro ao enviar");
      setSubmitted(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#09081A] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#C9A84C] animate-spin" />
      </div>
    );
  }

  if (error && !context) {
    return (
      <div className="min-h-screen bg-[#09081A] flex flex-col items-center justify-center text-center px-6">
        <ShieldAlert className="w-10 h-10 text-red-400 mb-4" />
        <p className="text-sm text-[#9BAFC5]">{error}</p>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-[#09081A] flex flex-col items-center justify-center text-center px-6">
        <CheckCircle2 className="w-10 h-10 text-emerald-400 mb-4" />
        <h1 className="text-lg font-bold text-[#F5F1E8] mb-2">Distribuição enviada</h1>
        <p className="text-sm text-[#9BAFC5] max-w-md">
          A cadeia de intermediários do ativo <strong className="text-[#C9A84C]">{context?.anonymous_id}</strong> foi registrada. A Mesa V3 Partners vai gerar o Anexo FPA/NCND com esses dados.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#09081A] py-10 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <img src="https://app.v3partners.com.br/v3-logo-flat-gold-alpha.png" alt="V3 Partners" className="h-10" />
          <div>
            <div className="text-sm font-bold text-[#F5F1E8]">Cadeia de Intermediários</div>
            <div className="text-xs text-[#9BAFC5]">Bolsa de Ativos · V3 Partners</div>
          </div>
        </div>

        <div className="bg-[#12112A] border border-[#C9A84C]/20 rounded-xl p-6">
          <p className="text-sm text-[#F5F1E8] mb-1">
            Ativo <strong className="text-[#C9A84C]">{context?.anonymous_id}</strong>, lado <strong className="text-[#C9A84C]">{context?.side === "compra" ? "Compra" : "Venda"}</strong>
          </p>
          <p className="text-xs text-[#9BAFC5] mb-6">
            Como Mandatário desta operação, informe abaixo como o comissionamento deste lado será distribuído entre os intermediários da cadeia de originação. Os percentuais precisam somar exatamente 100%.
          </p>

          <div className="space-y-3 mb-4">
            {rows.map((row, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_100px_auto] gap-2 items-center">
                <input
                  value={row.intermediary_name}
                  onChange={(e) => updateRow(i, "intermediary_name", e.target.value)}
                  placeholder="Nome do intermediário *"
                  className="bg-[#162744] border border-[#9BAFC5]/15 rounded-md px-3 py-2 text-xs text-[#F5F1E8]"
                />
                <input
                  value={row.intermediary_document}
                  onChange={(e) => updateRow(i, "intermediary_document", maskCpfCnpjInput(e.target.value))}
                  placeholder="CPF/CNPJ (opcional)"
                  className="bg-[#162744] border border-[#9BAFC5]/15 rounded-md px-3 py-2 text-xs text-[#F5F1E8]"
                />
                <input
                  type="number"
                  value={row.percentage}
                  onChange={(e) => updateRow(i, "percentage", e.target.value)}
                  placeholder="% *"
                  className="bg-[#162744] border border-[#9BAFC5]/15 rounded-md px-3 py-2 text-xs text-[#F5F1E8]"
                />
                <button onClick={() => removeRow(i)} disabled={rows.length === 1} className="disabled:opacity-30">
                  <Trash2 size={14} className="text-red-400/70 hover:text-red-400" />
                </button>
              </div>
            ))}
          </div>

          <button onClick={addRow} className="flex items-center gap-1.5 text-xs text-[#C9A84C] font-bold hover:text-[#E8C97A] transition mb-6">
            <Plus size={14} /> Adicionar intermediário
          </button>

          <div className={`flex items-center justify-between px-4 py-2.5 rounded-lg mb-4 text-xs font-bold ${Math.abs(soma - 100) < 0.01 ? "bg-emerald-500/10 text-emerald-400" : "bg-[#C9A84C]/10 text-[#C9A84C]"}`}>
            <span>Soma dos percentuais</span>
            <span>{soma}% {Math.abs(soma - 100) < 0.01 ? "✓" : "(precisa somar 100%)"}</span>
          </div>

          {error && <p className="text-red-400 text-xs mb-4">{error}</p>}

          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full flex items-center justify-center gap-2 py-3 bg-[#C9A84C] text-[#09081A] rounded-lg text-sm font-bold hover:bg-[#D4B96A] transition disabled:opacity-50"
          >
            {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            {submitting ? "Enviando..." : "Confirmar Distribuição"}
          </button>
        </div>
      </div>
    </div>
  );
}
