"use client";

import { useState, useEffect } from "react";
import {
  Plus, Pencil, Trash2, ChevronDown, ChevronUp,
  Save, X, Loader2, CheckCircle2, AlertCircle, Power, FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { PortfolioLinha, Documento } from "./portfolio-viewer";

const CATEGORIAS = ["Imobiliário", "Auto", "Capital de Giro", "Consórcio", "Construção", "Agro", "Internacional", "Seguros", "M&A", "Outros"];

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

const DOCS_PF_PADRAO: Documento[] = [
  { id: "pf-1",  nome: "RG/CNH",                                    obrigatorio: true },
  { id: "pf-2",  nome: "Comprovante de endereço do mês vigente",    obrigatorio: true },
  { id: "pf-3",  nome: "Certidão civil",                            obrigatorio: true },
  { id: "pf-4",  nome: "RG/CNH do cônjuge (se casado)",             obrigatorio: false },
  { id: "pf-5",  nome: "Extrato Bancário dos últimos 3 meses",      obrigatorio: true },
  { id: "pf-6",  nome: "Matrícula do Imóvel",                       obrigatorio: true },
  { id: "pf-7",  nome: "IPTU do ano vigente",                       obrigatorio: true },
  { id: "pf-8",  nome: "3 fotos internas do imóvel",                obrigatorio: true },
  { id: "pf-9",  nome: "3 fotos externas do imóvel",                obrigatorio: true },
  { id: "pf-10", nome: "IRPF do último exercício — Declaração",     obrigatorio: true },
  { id: "pf-11", nome: "IRPF do último exercício — Recibo",         obrigatorio: true },
];

const DOCS_PJ_PADRAO: Documento[] = [
  { id: "pj-1",  nome: "Contrato social com a última alteração",           obrigatorio: true },
  { id: "pj-2",  nome: "Balanço e DRE do ano anterior consolidado",        obrigatorio: true },
  { id: "pj-3",  nome: "Balancete do último trimestre",                    obrigatorio: true },
  { id: "pj-4",  nome: "Faturamento dos últimos 12 meses",                 obrigatorio: true },
  { id: "pj-5",  nome: "Comprovante de endereço da empresa do mês vigente",obrigatorio: true },
  { id: "pj-6",  nome: "RG/CNH",                                           obrigatorio: true },
  { id: "pj-7",  nome: "Comprovante de endereço do mês vigente",           obrigatorio: true },
  { id: "pj-8",  nome: "Certidão civil",                                   obrigatorio: true },
  { id: "pj-9",  nome: "RG/CNH do cônjuge (se casado)",                    obrigatorio: false },
  { id: "pj-10", nome: "Extrato Bancário dos últimos 3 meses",             obrigatorio: true },
  { id: "pj-11", nome: "Matrícula do Imóvel",                              obrigatorio: true },
  { id: "pj-12", nome: "IPTU do ano vigente",                              obrigatorio: true },
  { id: "pj-13", nome: "3 fotos internas do imóvel",                       obrigatorio: true },
  { id: "pj-14", nome: "3 fotos externas do imóvel",                       obrigatorio: true },
  { id: "pj-15", nome: "IRPF do último exercício — Declaração",            obrigatorio: true },
  { id: "pj-16", nome: "IRPF do último exercício — Recibo",                obrigatorio: true },
];

const EMPTY: Omit<PortfolioLinha, "id" | "ativo" | "ordem"> = {
  nome: "", descricao: null, categoria: "Imobiliário",
  publico_alvo: null, prazo_pagamento: null, taxas: null,
  outras_despesas: null, limite_credito: null, comprometimento_renda: null,
  aporte: null, amortizacao: null, perfil_garantia: null,
  destinacao: null, tempo_estruturacao: null, custo_estruturacao: null,
  diferenciais: null,
  documentos_pf: DOCS_PF_PADRAO.map(d => ({ ...d, id: crypto.randomUUID() })),
  documentos_pj: DOCS_PJ_PADRAO.map(d => ({ ...d, id: crypto.randomUUID() })),
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
type FormStateRecord = Record<string, string | null | Documento[] | Documento[]>;

// ── Documentos Editor ─────────────────────────────────────────────────────────
function DocumentosEditor({
  documentos,
  onChange,
  inputCls,
}: {
  documentos: Documento[];
  onChange: (docs: Documento[]) => void;
  inputCls: string;
}) {
  const [newNome, setNewNome] = useState("");

  function addDoc() {
    const nome = newNome.trim();
    if (!nome) return;
    onChange([...documentos, { id: crypto.randomUUID(), nome, obrigatorio: true }]);
    setNewNome("");
  }

  function removeDoc(id: string) {
    onChange(documentos.filter(d => d.id !== id));
  }

  function toggleObrig(id: string) {
    onChange(documentos.map(d => d.id === id ? { ...d, obrigatorio: !d.obrigatorio } : d));
  }

  return (
    <div className="space-y-2">
      {documentos.length === 0 && (
        <p className="text-[11px] text-muted-foreground italic px-1">Nenhum documento cadastrado.</p>
      )}

      <div className="space-y-1.5">
        {documentos.map((doc, idx) => (
          <div
            key={doc.id}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#080F1C] border border-[#1B3050]"
          >
            <span className="text-[9px] text-muted-foreground w-4 text-center flex-shrink-0">{idx + 1}</span>
            <button
              type="button"
              onClick={() => toggleObrig(doc.id)}
              title="Clique para alternar obrigatório/opcional"
              className={cn(
                "text-[9px] font-bold px-2 py-0.5 rounded border transition-all flex-shrink-0",
                doc.obrigatorio
                  ? "bg-amber-500/15 border-amber-500/30 text-amber-400"
                  : "bg-[#243A66]/40 border-[#243A66] text-muted-foreground"
              )}
            >
              {doc.obrigatorio ? "OBRIG." : "OPCION."}
            </button>
            <span className="text-xs text-[#F0ECE4] flex-1 truncate">{doc.nome}</span>
            <button
              type="button"
              onClick={() => removeDoc(doc.id)}
              className="text-muted-foreground hover:text-red-400 transition-colors flex-shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      {/* Add new document */}
      <div className="flex gap-2">
        <input
          value={newNome}
          onChange={e => setNewNome(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addDoc(); } }}
          placeholder="Nome do documento… (Enter para adicionar)"
          className={inputCls}
        />
        <button
          type="button"
          onClick={addDoc}
          disabled={!newNome.trim()}
          className="flex-shrink-0 px-3 py-2 rounded-lg bg-[#C9A84C]/15 border border-[#C9A84C]/30 text-[#C9A84C] hover:bg-[#C9A84C]/25 transition-all disabled:opacity-40"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

// ── Linha Edit Row ─────────────────────────────────────────────────────────────
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
  const [form, setForm] = useState<FormState>({
    ...EMPTY,
    ...linha,
    documentos_pf: (linha.documentos_pf ?? []).length > 0
      ? linha.documentos_pf!
      : DOCS_PF_PADRAO.map(d => ({ ...d, id: crypto.randomUUID() })),
    documentos_pj: (linha.documentos_pj ?? []).length > 0
      ? linha.documentos_pj!
      : DOCS_PJ_PADRAO.map(d => ({ ...d, id: crypto.randomUUID() })),
  });
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

  const docCount = (linha.documentos_pf ?? []).length + (linha.documentos_pj ?? []).length;

  return (
    <div className={cn(
      "rounded-xl border transition-all overflow-hidden",
      open ? "border-[#C9A84C]/30 bg-[#0A1628]" : "border-[#1B3050] bg-[#080F1C] hover:border-[#243A66]"
    )}>
      {/* Row header */}
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate">{linha.nome}</p>
          <div className="flex items-center gap-2 mt-0.5">
            {linha.categoria && (
              <p className="text-[10px] text-muted-foreground">{linha.categoria}</p>
            )}
            {docCount > 0 && (
              <span className="text-[9px] text-[#C9A84C] flex items-center gap-1">
                <FileText className="w-2.5 h-2.5" />{docCount} doc{docCount !== 1 ? "s" : ""}
              </span>
            )}
          </div>
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

          {/* Product fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {FIELDS.map(({ key, label, long }) => (
              <div key={key} className={cn("space-y-1", long && "md:col-span-2")}>
                <label className="text-[10px] font-bold text-[#7A8FA8] uppercase tracking-wide">{label}</label>
                {long ? (
                  <textarea
                    rows={3}
                    value={((form as FormStateRecord)[key] as string) ?? ""}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value || null }))}
                    className={inputCls}
                    placeholder={label}
                  />
                ) : (
                  <input
                    value={((form as FormStateRecord)[key] as string) ?? ""}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value || null }))}
                    className={inputCls}
                    placeholder={label}
                  />
                )}
              </div>
            ))}
          </div>

          {/* Documentos PF / PJ */}
          <div className="space-y-3 md:col-span-2">
            <label className="text-[10px] font-bold text-[#C9A84C] uppercase tracking-widest flex items-center gap-1.5">
              <FileText className="w-3 h-3" /> Checklist de Documentos
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <p className="text-[10px] font-bold text-[#7A8FA8] uppercase tracking-widest">Pessoa Física (PF)</p>
                <DocumentosEditor
                  documentos={form.documentos_pf}
                  onChange={docs => setForm(f => ({ ...f, documentos_pf: docs }))}
                  inputCls={inputCls}
                />
              </div>
              <div className="space-y-2">
                <p className="text-[10px] font-bold text-[#7A8FA8] uppercase tracking-widest">Pessoa Jurídica (PJ)</p>
                <DocumentosEditor
                  documentos={form.documentos_pj}
                  onChange={docs => setForm(f => ({ ...f, documentos_pj: docs }))}
                  inputCls={inputCls}
                />
              </div>
            </div>
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
              onClick={() => { setOpen(false); setForm({ ...EMPTY, ...linha, documentos_pf: (linha.documentos_pf ?? []).length > 0 ? linha.documentos_pf! : DOCS_PF_PADRAO.map(d => ({ ...d, id: crypto.randomUUID() })), documentos_pj: (linha.documentos_pj ?? []).length > 0 ? linha.documentos_pj! : DOCS_PJ_PADRAO.map(d => ({ ...d, id: crypto.randomUUID() })) }); }}
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

// ── Nova Linha Form ───────────────────────────────────────────────────────────
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
      setForm({ ...EMPTY, documentos_pf: DOCS_PF_PADRAO.map(d => ({ ...d, id: crypto.randomUUID() })), documentos_pj: DOCS_PJ_PADRAO.map(d => ({ ...d, id: crypto.randomUUID() })) });
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
                value={((form as FormStateRecord)[key] as string) ?? ""}
                onChange={e => setForm(f => ({ ...f, [key]: e.target.value || null }))}
                className={inputCls}
                placeholder={label}
              />
            ) : (
              <input
                value={((form as FormStateRecord)[key] as string) ?? ""}
                onChange={e => setForm(f => ({ ...f, [key]: e.target.value || null }))}
                className={inputCls}
                placeholder={label}
              />
            )}
          </div>
        ))}
      </div>

      {/* Documentos PF / PJ */}
      <div className="space-y-3">
        <label className="text-[10px] font-bold text-[#C9A84C] uppercase tracking-widest flex items-center gap-1.5">
          <FileText className="w-3 h-3" /> Checklist de Documentos
        </label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <p className="text-[10px] font-bold text-[#7A8FA8] uppercase tracking-widest">Pessoa Física (PF)</p>
            <DocumentosEditor
              documentos={form.documentos_pf}
              onChange={docs => setForm(f => ({ ...f, documentos_pf: docs }))}
              inputCls={inputCls}
            />
          </div>
          <div className="space-y-2">
            <p className="text-[10px] font-bold text-[#7A8FA8] uppercase tracking-widest">Pessoa Jurídica (PJ)</p>
            <DocumentosEditor
              documentos={form.documentos_pj}
              onChange={docs => setForm(f => ({ ...f, documentos_pj: docs }))}
              inputCls={inputCls}
            />
          </div>
        </div>
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

// ── Portfolio Editor ──────────────────────────────────────────────────────────
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
