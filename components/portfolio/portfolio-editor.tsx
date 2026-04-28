"use client";

import { useState, useEffect } from "react";
import {
  Plus, Pencil, Trash2, ChevronDown, ChevronUp,
  Save, X, Loader2, CheckCircle2, AlertCircle, Power,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { PortfolioLinha } from "./portfolio-viewer";

const CATEGORIAS = ["Imobiliário", "Auto", "Capital de Giro", "Consórcio", "Construção", "Agro", "Outros"];

const FIELDS: { key: keyof PortfolioLinha; label: string; long?: boolean }[] = [
  { key: "descricao",           label: "Descrição",              long: true },
  { key: "publico_alvo",        label: "Público-Alvo",           long: true },
  { key: "prazo_pagamento",     label: "Prazo de Pagamento" },
  { key: "taxas",               label: "Taxas" },
  { key: "outras_despesas",     label: "Outras Despesas" },
  { key: "limite_credito",      label: "Limite de Crédito" },
  { key: "comprometimento_renda", label: "Comprometimento de Renda" },
  { key: "aporte",              label: "Aporte" },
  { key: "amortizacao",         label: "Amortização" },
  { key: "perfil_garantia",     label: "Perfil da Garantia",     long: true },
  { key: "destinacao",          label: "Destinação" },
  { key: "tempo_estruturacao",  label: "Tempo de Estruturação" },
  { key: "custo_estruturacao",  label: "Custo de Estruturação" },
  { key: "diferenciais",        label: "Diferenciais",           long: true },
];

const EMPTY: Omit<PortfolioLinha, "id" | "ativo" | "ordem"> = {
  nome: "", descricao: null, categoria: "Imobiliário",
  publico_alvo: null, prazo_pagamento: null, taxas: null,
  outras_despesas: null, limite_credito: null, comprometimento_renda: null,
  aporte: null, amortizacao: null, perfil_garantia: null,
  destinacao: null, tempo_estruturacao: null, custo_estruturacao: null,
  diferenciais: null,
};

function Toast({ msg, type, onClose }: { msg: string; type: "success" | "error"; onClose: () => void }) {
  return (
    <div className={cn(
      "fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-2xl border text-sm font-medium animate-fade-in",
      type === "success"
        ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-400"
        : "bg-red-500/15 border-red-500/40 text-red-400"
    )}>
      {type === "success" ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
      {msg}
      <button onClick={onClose} className="ml-2 opacity-60 hover:opacity-100"><X className="w-3.5 h-3.5" /></button>
    </div>
  );
}

type FormState = Omit<PortfolioLinha, "id" | "ativo" | "ordem">;

function LinhaEditRow({
  linha,
  onSave,
  onDelete,
  onToggle,
}: {
  linha: PortfolioLinha;
  onSave: (id: string, fields: Partial<PortfolioLinha>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onToggle: (id: string, ativo: boolean) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>({ ...EMPTY, ...linha });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);

  const inputCls = "w-full px-3 py-2 text-xs rounded-lg border border-[#243A66] bg-[#09081A] text-[#F0ECE4] placeholder:text-[#3A5070] focus:outline-none focus:border-[#C9A84C]/50 resize-none";

  async function handleSave() {
    setSaving(true);
    await onSave(linha.id, form);
    setSaving(false);
    setOpen(false);
  }

  async function handleDelete() {
    if (!confirmDel) { setConfirmDel(true); return; }
    setDeleting(true);
    await onDelete(linha.id);
    setDeleting(false);
  }

  return (
    <div className={cn(
      "rounded-xl border transition-all overflow-hidden",
      open ? "border-[#C9A84C]/30 bg-[#0A1628]" : "border-[#1B3050] bg-[#080F1C] hover:border-[#243A66]"
    )}>
      {/* Row header */}
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate">{linha.nome}</p>
          {linha.categoria && (
            <p className="text-[10px] text-muted-foreground mt-0.5">{linha.categoria}</p>
          )}
        </div>
        {/* Ativo toggle */}
        <button
          onClick={() => onToggle(linha.id, !linha.ativo)}
          title={linha.ativo ? "Desativar" : "Ativar"}
          className={cn(
            "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-bold border transition-all",
            linha.ativo
              ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
              : "bg-[#243A66]/40 border-[#243A66] text-muted-foreground"
          )}
        >
          <Power className="w-3 h-3" />
          {linha.ativo ? "Ativo" : "Inativo"}
        </button>
        {/* Edit */}
        <button
          onClick={() => setOpen(v => !v)}
          className="p-1.5 rounded-lg text-muted-foreground hover:text-[#C9A84C] hover:bg-[#C9A84C]/10 transition-all"
          title="Editar"
        >
          {open ? <ChevronUp className="w-4 h-4" /> : <Pencil className="w-4 h-4" />}
        </button>
        {/* Delete */}
        <button
          onClick={handleDelete}
          disabled={deleting}
          className={cn(
            "p-1.5 rounded-lg transition-all",
            confirmDel
              ? "bg-red-500/20 text-red-400 border border-red-500/30"
              : "text-muted-foreground hover:text-red-400 hover:bg-red-500/10"
          )}
          title={confirmDel ? "Confirmar exclusão" : "Excluir"}
          onBlur={() => setTimeout(() => setConfirmDel(false), 200)}
        >
          {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
        </button>
      </div>

      {/* Edit form */}
      {open && (
        <div className="px-4 pb-4 border-t border-[#1B3050] space-y-4 pt-4">
          {/* Nome + Categoria */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2 space-y-1">
              <label className="text-[10px] font-bold text-[#C9A84C] uppercase tracking-wide">Nome *</label>
              <input
                value={form.nome}
                onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                className={inputCls}
                placeholder="Nome do produto"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-[#C9A84C] uppercase tracking-wide">Categoria</label>
              <select
                value={form.categoria ?? ""}
                onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}
                className={cn(inputCls, "h-[34px]")}
              >
                {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {/* All fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {FIELDS.map(({ key, label, long }) => (
              <div key={key} className={cn("space-y-1", long && "md:col-span-2")}>
                <label className="text-[10px] font-bold text-[#7A8FA8] uppercase tracking-wide">{label}</label>
                {long ? (
                  <textarea
                    rows={3}
                    value={(form[key] as string) ?? ""}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value || null }))}
                    className={inputCls}
                    placeholder={label}
                  />
                ) : (
                  <input
                    value={(form[key] as string) ?? ""}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value || null }))}
                    className={inputCls}
                    placeholder={label}
                  />
                )}
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 pt-2">
            <button
              onClick={handleSave}
              disabled={saving || !form.nome.trim()}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#C9A84C] hover:bg-[#E8C97A] text-[#09081A] text-xs font-bold transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              {saving ? "Salvando…" : "Salvar"}
            </button>
            <button
              onClick={() => { setOpen(false); setForm({ ...EMPTY, ...linha }); }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-[#243A66] text-muted-foreground text-xs font-semibold hover:text-foreground transition-colors"
            >
              <X className="w-3.5 h-3.5" /> Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function NovaLinhaForm({ onCreated }: { onCreated: (linha: PortfolioLinha) => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>({ ...EMPTY });
  const [saving, setSaving] = useState(false);

  const inputCls = "w-full px-3 py-2 text-xs rounded-lg border border-[#243A66] bg-[#09081A] text-[#F0ECE4] placeholder:text-[#3A5070] focus:outline-none focus:border-[#C9A84C]/50 resize-none";

  async function handleCreate() {
    if (!form.nome.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/portfolio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, ativo: true, ordem: 999 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onCreated(data.linha);
      setForm({ ...EMPTY });
      setOpen(false);
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-[#C9A84C]/40 text-[#C9A84C] text-sm font-semibold hover:bg-[#C9A84C]/5 transition-all w-full justify-center"
      >
        <Plus className="w-4 h-4" /> Nova Linha de Produto
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-[#C9A84C]/30 bg-[#0A1628] p-4 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-[#C9A84C]">Nova Linha de Produto</p>
        <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="sm:col-span-2 space-y-1">
          <label className="text-[10px] font-bold text-[#C9A84C] uppercase tracking-wide">Nome *</label>
          <input
            value={form.nome}
            onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
            className={inputCls}
            placeholder="Nome do produto"
            autoFocus
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-[#C9A84C] uppercase tracking-wide">Categoria</label>
          <select
            value={form.categoria ?? ""}
            onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}
            className={cn(inputCls, "h-[34px]")}
          >
            {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {FIELDS.map(({ key, label, long }) => (
          <div key={key} className={cn("space-y-1", long && "md:col-span-2")}>
            <label className="text-[10px] font-bold text-[#7A8FA8] uppercase tracking-wide">{label}</label>
            {long ? (
              <textarea
                rows={3}
                value={(form[key] as string) ?? ""}
                onChange={e => setForm(f => ({ ...f, [key]: e.target.value || null }))}
                className={inputCls}
                placeholder={label}
              />
            ) : (
              <input
                value={(form[key] as string) ?? ""}
                onChange={e => setForm(f => ({ ...f, [key]: e.target.value || null }))}
                className={inputCls}
                placeholder={label}
              />
            )}
          </div>
        ))}
      </div>

      <div className="flex gap-2 pt-1">
        <button
          onClick={handleCreate}
          disabled={saving || !form.nome.trim()}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#C9A84C] hover:bg-[#E8C97A] text-[#09081A] text-xs font-bold transition-colors disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
          {saving ? "Criando…" : "Criar Produto"}
        </button>
        <button
          onClick={() => setOpen(false)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-[#243A66] text-muted-foreground text-xs font-semibold hover:text-foreground transition-colors"
        >
          <X className="w-3.5 h-3.5" /> Cancelar
        </button>
      </div>
    </div>
  );
}

export function PortfolioEditor() {
  const [linhas, setLinhas] = useState<PortfolioLinha[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  function showToast(msg: string, type: "success" | "error") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  useEffect(() => {
    fetch("/api/portfolio?admin=1")
      .then(r => r.json())
      .then(d => setLinhas(d.linhas ?? []))
      .finally(() => setLoading(false));
  }, []);

  async function handleSave(id: string, fields: Partial<PortfolioLinha>) {
    const res = await fetch("/api/portfolio", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...fields }),
    });
    const data = await res.json();
    if (!res.ok) { showToast(data.error ?? "Erro ao salvar", "error"); return; }
    setLinhas(prev => prev.map(l => l.id === id ? data.linha : l));
    showToast("Produto salvo com sucesso", "success");
  }

  async function handleDelete(id: string) {
    const res = await fetch("/api/portfolio", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const data = await res.json();
    if (!res.ok) { showToast(data.error ?? "Erro ao excluir", "error"); return; }
    setLinhas(prev => prev.filter(l => l.id !== id));
    showToast("Produto excluído", "success");
  }

  async function handleToggle(id: string, ativo: boolean) {
    const res = await fetch("/api/portfolio", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ativo }),
    });
    const data = await res.json();
    if (!res.ok) { showToast(data.error ?? "Erro", "error"); return; }
    setLinhas(prev => prev.map(l => l.id === id ? { ...l, ativo } : l));
  }

  function handleCreated(linha: PortfolioLinha) {
    setLinhas(prev => [...prev, linha]);
    showToast("Produto criado com sucesso", "success");
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40 gap-2 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="text-sm">Carregando portfólio…</span>
      </div>
    );
  }

  const ativos   = linhas.filter(l => l.ativo);
  const inativos = linhas.filter(l => !l.ativo);

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total de Produtos", value: linhas.length, color: "text-[#C9A84C]" },
          { label: "Ativos",            value: ativos.length, color: "text-emerald-400" },
          { label: "Inativos",          value: inativos.length, color: "text-muted-foreground" },
        ].map(s => (
          <div key={s.label} className="bg-[#080F1C] border border-[#1B3050] rounded-xl p-3 text-center">
            <p className={cn("text-xl font-bold", s.color)}>{s.value}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-wide">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Nova linha */}
      <NovaLinhaForm onCreated={handleCreated} />

      {/* Ativos */}
      {ativos.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-1">Produtos Ativos ({ativos.length})</p>
          {ativos.map(l => (
            <LinhaEditRow key={l.id} linha={l} onSave={handleSave} onDelete={handleDelete} onToggle={handleToggle} />
          ))}
        </div>
      )}

      {/* Inativos */}
      {inativos.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-1">Inativos ({inativos.length})</p>
          {inativos.map(l => (
            <LinhaEditRow key={l.id} linha={l} onSave={handleSave} onDelete={handleDelete} onToggle={handleToggle} />
          ))}
        </div>
      )}

      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
