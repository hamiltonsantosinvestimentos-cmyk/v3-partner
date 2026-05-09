"use client";

import React, { useState } from "react";
import { X, Loader2, Check, Building2, DollarSign } from "lucide-react";

interface DealForm {
  empresa_nome: string;
  setor: string;
  valor_estimado: string;
  tipo_operacao: string;
  contato_nome: string;
  contato_telefone: string;
  contato_email: string;
  origem_lead: string;
  observacoes: string;
}

interface Props {
  onClose: () => void;
  onSuccess: () => void;
  prefill?: Partial<DealForm>;
}

const SETORES = [
  { value: "credito_recebiveis",    label: "Crédito e Recebíveis" },
  { value: "real_estate",           label: "Real Estate" },
  { value: "mineracao_commodities", label: "Mineração e Commodities" },
  { value: "ma_cross_border",       label: "M&A Cross-Border" },
];

const TIPOS = [
  { value: "venda",        label: "Venda" },
  { value: "fusao",        label: "Fusão" },
  { value: "captacao",     label: "Captação" },
  { value: "estruturacao", label: "Estruturação" },
];

const ORIGENS = [
  { value: "parceiro",       label: "Parceiro" },
  { value: "cold_outreach",  label: "Cold Outreach" },
  { value: "indicacao",      label: "Indicação" },
  { value: "evento",         label: "Evento" },
  { value: "inbound",        label: "Inbound" },
];

const EMPTY: DealForm = {
  empresa_nome: "", setor: "ma_cross_border", valor_estimado: "",
  tipo_operacao: "captacao", contato_nome: "", contato_telefone: "",
  contato_email: "", origem_lead: "indicacao", observacoes: "",
};

export function DealIntakeModal({ onClose, onSuccess, prefill = {} }: Props) {
  const [form, setForm] = useState<DealForm>({ ...EMPTY, ...prefill });
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [tese, setTese] = useState("");
  const [error, setError] = useState("");

  function set(key: keyof DealForm, val: string) {
    setForm(f => ({ ...f, [key]: val }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setError("");

    const valor = parseFloat(form.valor_estimado.replace(/\./g, "").replace(",", "."));
    if (!valor || valor < 500000) {
      setError("Valor mínimo: R$ 500.000");
      setStatus("idle");
      return;
    }

    try {
      const res = await fetch("/api/hub/new-deal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, valor_estimado: valor }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao salvar");
      setTese(data.sugestao_tese ?? "");
      setStatus("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro desconhecido");
      setStatus("idle");
    }
  }

  function fieldClass(extra = "") {
    return `w-full bg-[#09081A] border border-[#243A66] focus:border-[#C9A84C] rounded-lg px-3 py-2.5 text-sm text-[#F0ECE4] placeholder:text-[#7A8FA8] outline-none transition-colors ${extra}`;
  }

  function labelClass() { return "block text-[#7A8FA8] text-[10px] font-semibold uppercase tracking-[1px] mb-1.5"; }

  if (status === "done") {
    return (
      <ModalShell onClose={() => { onSuccess(); onClose(); }} title="Deal registrado">
        <div className="p-6 flex flex-col items-center text-center gap-4">
          <div className="w-14 h-14 rounded-full bg-emerald-900/40 flex items-center justify-center">
            <Check className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <p className="text-[#F0ECE4] font-semibold mb-1">Deal inserido com sucesso</p>
            <p className="text-[#7A8FA8] text-sm">{form.empresa_nome} adicionado ao Hub de Deals.</p>
          </div>
          {tese && (
            <div className="w-full bg-[#09081A] border-l-3 border-[#C9A84C] border-l-4 rounded-r-lg p-4 text-left">
              <p className="text-[#C9A84C] text-[9px] font-bold tracking-[2px] uppercase mb-2">Tese gerada</p>
              <p className="text-[#F0ECE4] text-sm leading-relaxed">{tese}</p>
            </div>
          )}
          <button
            onClick={() => { onSuccess(); onClose(); }}
            className="bg-[#C9A84C] hover:bg-[#E8C97A] text-[#09081A] font-bold text-sm px-6 py-2.5 rounded-lg transition-colors mt-2"
          >
            Ver no Hub
          </button>
        </div>
      </ModalShell>
    );
  }

  return (
    <ModalShell onClose={onClose} title="Novo Deal">
      <form onSubmit={submit} className="p-6 space-y-4 overflow-y-auto max-h-[70vh]">

        {/* Empresa + Setor */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass()}>Empresa *</label>
            <input required value={form.empresa_nome} onChange={e => set("empresa_nome", e.target.value)}
              placeholder="Razão social ou nome do ativo" className={fieldClass()} />
          </div>
          <div>
            <label className={labelClass()}>Setor *</label>
            <select required value={form.setor} onChange={e => set("setor", e.target.value)} className={fieldClass()}>
              {SETORES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
        </div>

        {/* Valor + Tipo */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass()}>Valor Estimado (R$) *</label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-2.5 w-4 h-4 text-[#7A8FA8]" />
              <input required value={form.valor_estimado}
                onChange={e => set("valor_estimado", e.target.value)}
                placeholder="500.000" className={fieldClass("pl-9")} />
            </div>
            <p className="text-[#7A8FA8] text-[10px] mt-1">Mínimo: R$ 500.000</p>
          </div>
          <div>
            <label className={labelClass()}>Tipo de Operação *</label>
            <select required value={form.tipo_operacao} onChange={e => set("tipo_operacao", e.target.value)} className={fieldClass()}>
              {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
        </div>

        {/* Contato */}
        <div>
          <label className={labelClass()}>Nome do Contato *</label>
          <div className="relative">
            <Building2 className="absolute left-3 top-2.5 w-4 h-4 text-[#7A8FA8]" />
            <input required value={form.contato_nome} onChange={e => set("contato_nome", e.target.value)}
              placeholder="Nome do decisor" className={fieldClass("pl-9")} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass()}>Telefone</label>
            <input value={form.contato_telefone} onChange={e => set("contato_telefone", e.target.value)}
              placeholder="+55 11 9xxxx-xxxx" className={fieldClass()} />
          </div>
          <div>
            <label className={labelClass()}>E-mail</label>
            <input type="email" value={form.contato_email} onChange={e => set("contato_email", e.target.value)}
              placeholder="contato@empresa.com" className={fieldClass()} />
          </div>
        </div>

        {/* Origem */}
        <div>
          <label className={labelClass()}>Origem do Lead *</label>
          <select required value={form.origem_lead} onChange={e => set("origem_lead", e.target.value)} className={fieldClass()}>
            {ORIGENS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        {/* Observações */}
        <div>
          <label className={labelClass()}>Observações</label>
          <textarea value={form.observacoes} onChange={e => set("observacoes", e.target.value)}
            placeholder="Contexto adicional, histórico, urgência, dados relevantes..."
            rows={3} className={`${fieldClass()} resize-none leading-relaxed`} />
        </div>

        {error && <p className="text-red-400 text-xs bg-red-900/20 px-3 py-2 rounded-lg">{error}</p>}

        <div className="pt-2 flex gap-3">
          <button type="submit" disabled={status === "loading"}
            className="flex-1 flex items-center justify-center gap-2 bg-[#C9A84C] hover:bg-[#E8C97A] disabled:opacity-50 text-[#09081A] font-bold text-sm py-2.5 rounded-lg transition-colors">
            {status === "loading"
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Gerando tese e salvando...</>
              : "Inserir Deal + Gerar Tese"
            }
          </button>
          <button type="button" onClick={onClose}
            className="px-4 text-[#7A8FA8] hover:text-[#F0ECE4] transition-colors text-sm">
            Cancelar
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

function ModalShell({ onClose, title, children }: { onClose: () => void; title: string; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-[#111F35] border border-[#243A66] rounded-2xl w-full max-w-xl shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#243A66]">
          <h2 className="text-[#F0ECE4] font-bold">{title}</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-[#162744] hover:bg-[#243A66] text-[#7A8FA8] hover:text-[#F0ECE4] transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
