"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  ShoppingBag, Users, Package, CheckCircle, XCircle, Clock,
  Loader2, Eye, Building2, RefreshCw, AlertCircle,
  Link2, Copy, Check, ExternalLink, Edit2, Trash2, Save, X,
  Percent, DollarSign, MapPin, Phone, Mail, Globe, Tag, Download,
  TrendingUp, Filter,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MARKETPLACE_CATEGORIES, PRODUCT_STATUS_LABELS } from "@/lib/constants";

const STATES = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

interface Supplier {
  id: string; company_name: string; cnpj: string; contact_name: string;
  email: string; phone: string; city: string; state: string;
  website: string | null; description: string; categories: string[];
  status: string; created_at: string;
}
interface Product {
  id: string; name: string; description: string; category: string;
  price: number | null; price_type: string;
  commission_percent: number; partner_commission_percent: number | null;
  images: string[]; status: string; created_at: string;
  supplier: { id: string; company_name: string };
}
type TabId = "suppliers" | "products" | "leads";

/* ── helpers ─────────────────────────────────────────── */
function fmtPrice(p: Product) {
  const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
  if (p.price_type === "ON_REQUEST") return "Sob consulta";
  if (p.price_type === "NEGOTIABLE") return `Negociável${p.price ? ` a partir de ${fmt(p.price)}` : ""}`;
  return p.price ? fmt(p.price) : "—";
}

function StatusBadge({ status }: { status: string }) {
  const m: Record<string, { cls: string; icon: React.ReactNode }> = {
    PENDING:  { cls: "bg-amber-500/10 text-amber-400 border-amber-500/30",   icon: <Clock className="w-3 h-3" /> },
    APPROVED: { cls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30", icon: <CheckCircle className="w-3 h-3" /> },
    REJECTED: { cls: "bg-red-500/10 text-red-400 border-red-500/30",         icon: <XCircle className="w-3 h-3" /> },
    INACTIVE: { cls: "bg-gray-500/10 text-gray-400 border-gray-500/30",      icon: <AlertCircle className="w-3 h-3" /> },
  };
  const c = m[status] ?? m["PENDING"];
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border", c.cls)}>
      {c.icon}{PRODUCT_STATUS_LABELS[status as keyof typeof PRODUCT_STATUS_LABELS] ?? status}
    </span>
  );
}

/* ── Link copy card ───────────────────────────────────── */
function LinkCard({ label, url, description }: { label: string; url: string; description: string }) {
  const [copied, setCopied] = useState(false);
  function copy() { navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); }
  return (
    <div className="bg-[#0D1929] border border-[#1B3050] rounded-xl p-4 flex items-center justify-between gap-4">
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-bold text-[#C9A84C] uppercase tracking-wider mb-0.5">{label}</p>
        <p className="text-[#7A8FA8] text-xs mb-1.5">{description}</p>
        <p className="text-[#F0ECE4] text-xs font-mono bg-[#111F35] px-2 py-1 rounded truncate">{url}</p>
      </div>
      <div className="flex gap-2 flex-shrink-0">
        <a href={url} target="_blank" rel="noopener noreferrer"
          className="p-2 rounded-lg bg-[#111F35] border border-[#1B3050] text-[#7A8FA8] hover:text-[#F0ECE4] transition-colors">
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
        <button onClick={copy}
          className={cn("flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all border",
            copied ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                   : "bg-[#C9A84C]/10 text-[#C9A84C] border-[#C9A84C]/30 hover:bg-[#C9A84C]/20")}>
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? "Copiado!" : "Copiar"}
        </button>
      </div>
    </div>
  );
}

/* ── Edit Supplier Modal ──────────────────────────────── */
function EditSupplierModal({ supplier, onClose, onSaved }: {
  supplier: Supplier; onClose: () => void; onSaved: () => void;
}) {
  const [form, setForm] = useState({
    company_name: supplier.company_name, contact_name: supplier.contact_name,
    phone: supplier.phone, city: supplier.city, state: supplier.state,
    website: supplier.website ?? "", description: supplier.description,
    categories: supplier.categories,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function set(k: string, v: string) { setForm(p => ({ ...p, [k]: v })); }
  function toggleCat(c: string) {
    setForm(p => ({ ...p, categories: p.categories.includes(c) ? p.categories.filter(x => x !== c) : [...p.categories, c] }));
  }

  async function save() {
    setSaving(true); setError("");
    try {
      const res = await fetch(`/api/marketplace/suppliers/${supplier.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Erro ao salvar");
      onSaved(); onClose();
    } catch (e: unknown) { setError(e instanceof Error ? e.message : "Erro"); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[#09081A] border border-[#1B3050] rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-[#09081A] border-b border-[#1B3050] px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <div className="flex items-center gap-2"><Edit2 className="w-4 h-4 text-[#C9A84C]" /><h2 className="text-[#F0ECE4] font-bold">Editar Fornecedor</h2></div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/5 text-[#7A8FA8]"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-6 space-y-4">
          {([
            { label: "Razão Social", key: "company_name", icon: Building2 },
            { label: "Responsável", key: "contact_name", icon: null },
            { label: "Telefone", key: "phone", icon: Phone },
            { label: "Cidade", key: "city", icon: MapPin },
            { label: "Site", key: "website", icon: Globe },
          ] as const).map(({ label, key, icon: Icon }) => (
            <div key={key}>
              <label className="block text-[10px] font-bold text-[#7A8FA8] uppercase tracking-wider mb-1.5">{label}</label>
              <div className="relative">
                {Icon && <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#7A8FA8]" />}
                <input value={form[key]} onChange={e => set(key, e.target.value)}
                  className={cn("w-full bg-[#111F35] border border-[#1B3050] rounded-lg py-2.5 text-sm text-[#F0ECE4] focus:outline-none focus:border-[#C9A84C]/50", Icon ? "pl-9 pr-3" : "px-3")} />
              </div>
            </div>
          ))}
          <div>
            <label className="block text-[10px] font-bold text-[#7A8FA8] uppercase tracking-wider mb-1.5">Estado</label>
            <select value={form.state} onChange={e => set("state", e.target.value)}
              className="w-full bg-[#111F35] border border-[#1B3050] rounded-lg px-3 py-2.5 text-sm text-[#F0ECE4] focus:outline-none">
              {STATES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-[#7A8FA8] uppercase tracking-wider mb-1.5">Sobre</label>
            <textarea value={form.description} onChange={e => set("description", e.target.value)} rows={3}
              className="w-full bg-[#111F35] border border-[#1B3050] rounded-lg px-3 py-2.5 text-sm text-[#F0ECE4] focus:outline-none resize-none" />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-[#7A8FA8] uppercase tracking-wider mb-2">Categorias</label>
            <div className="flex flex-wrap gap-2">
              {MARKETPLACE_CATEGORIES.map(c => (
                <button key={c} type="button" onClick={() => toggleCat(c)}
                  className={cn("px-3 py-1 rounded-full text-xs font-medium border transition-all",
                    form.categories.includes(c) ? "bg-[#C9A84C]/20 text-[#C9A84C] border-[#C9A84C]/40" : "bg-[#111F35] text-[#7A8FA8] border-[#1B3050]")}>
                  {c}
                </button>
              ))}
            </div>
          </div>
          {error && <p className="text-red-400 text-xs">{error}</p>}
          <button onClick={save} disabled={saving}
            className="w-full flex items-center justify-center gap-2 py-3 bg-[#C9A84C] hover:bg-[#E8C97A] text-[#09081A] font-bold rounded-xl text-sm disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Approve Product Modal (sets partner commission) ─── */
function ApproveProductModal({ product, onClose, onApproved }: {
  product: Product; onClose: () => void; onApproved: () => void;
}) {
  const [partnerComm, setPartnerComm] = useState(
    product.partner_commission_percent?.toString() ?? Math.floor(product.commission_percent * 0.5).toString()
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function approve() {
    const pc = parseFloat(partnerComm);
    if (isNaN(pc) || pc <= 0 || pc > product.commission_percent) {
      setError(`Comissão do partner deve ser entre 0,1% e ${product.commission_percent}% (margem oferecida pelo fornecedor)`);
      return;
    }
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/marketplace/products", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: product.id, status: "APPROVED", partner_commission_percent: pc }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Erro ao aprovar");
      onApproved(); onClose();
    } catch (e: unknown) { setError(e instanceof Error ? e.message : "Erro"); }
    finally { setLoading(false); }
  }

  const margin = product.commission_percent - (parseFloat(partnerComm) || 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[#09081A] border border-[#1B3050] rounded-2xl w-full max-w-md">
        <div className="border-b border-[#1B3050] px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-emerald-400" /><h2 className="text-[#F0ECE4] font-bold">Aprovar Produto</h2></div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/5 text-[#7A8FA8]"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-6 space-y-5">
          <div className="bg-[#111F35] rounded-xl p-4 space-y-1">
            <p className="text-[#F0ECE4] font-semibold text-sm">{product.name}</p>
            <p className="text-[#7A8FA8] text-xs">{product.supplier.company_name} · {product.category}</p>
          </div>

          {/* Commission breakdown */}
          <div className="bg-[#C9A84C]/05 border border-[#C9A84C]/20 rounded-xl p-4 space-y-3">
            <p className="text-[10px] font-bold text-[#C9A84C] uppercase tracking-wider">Estrutura de Comissão</p>
            <div className="flex items-center justify-between py-2 border-b border-[#1B3050]">
              <span className="text-[#7A8FA8] text-xs">Comissão oferecida pelo Fornecedor</span>
              <span className="text-[#F0ECE4] font-bold text-sm">{product.commission_percent}%</span>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-[#7A8FA8] uppercase tracking-wider mb-2">
                Comissão que o Partner recebe (%)
              </label>
              <div className="relative">
                <Percent className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#C9A84C]" />
                <input
                  type="number" min="0.1" max={product.commission_percent} step="0.5"
                  value={partnerComm} onChange={e => setPartnerComm(e.target.value)}
                  className="w-full bg-[#111F35] border border-[#C9A84C]/30 rounded-lg pl-10 pr-4 py-2.5 text-sm text-[#F0ECE4] focus:outline-none focus:border-[#C9A84C]/60 font-bold"
                />
              </div>
            </div>
            <div className="flex items-center justify-between py-2 border-t border-[#1B3050]">
              <span className="text-[#7A8FA8] text-xs">Margem V3 Partners</span>
              <span className={cn("font-bold text-sm", margin >= 0 ? "text-emerald-400" : "text-red-400")}>
                {margin >= 0 ? `${margin.toFixed(1)}%` : "⚠ Inválido"}
              </span>
            </div>
          </div>

          {error && <p className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>}

          <button onClick={approve} disabled={loading || margin < 0}
            className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-500 hover:bg-emerald-400 text-white font-bold rounded-xl text-sm disabled:opacity-50 transition-colors">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
            {loading ? "Aprovando..." : "Aprovar e Publicar"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Edit Product Modal ───────────────────────────────── */
function EditProductModal({ product, onClose, onSaved }: {
  product: Product; onClose: () => void; onSaved: () => void;
}) {
  const [form, setForm] = useState({
    name: product.name, description: product.description, category: product.category,
    commission_percent: product.commission_percent.toString(),
    partner_commission_percent: product.partner_commission_percent?.toString() ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    setSaving(true); setError("");
    try {
      const res = await fetch("/api/marketplace/products", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: product.id,
          name: form.name, description: form.description, category: form.category,
          commission_percent: parseFloat(form.commission_percent),
          partner_commission_percent: form.partner_commission_percent ? parseFloat(form.partner_commission_percent) : null,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Erro ao salvar");
      onSaved(); onClose();
    } catch (e: unknown) { setError(e instanceof Error ? e.message : "Erro"); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[#09081A] border border-[#1B3050] rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-[#09081A] border-b border-[#1B3050] px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <div className="flex items-center gap-2"><Edit2 className="w-4 h-4 text-[#C9A84C]" /><h2 className="text-[#F0ECE4] font-bold">Editar Produto</h2></div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/5 text-[#7A8FA8]"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-[10px] font-bold text-[#7A8FA8] uppercase tracking-wider mb-1.5">Nome</label>
            <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              className="w-full bg-[#111F35] border border-[#1B3050] rounded-lg px-3 py-2.5 text-sm text-[#F0ECE4] focus:outline-none focus:border-[#C9A84C]/50" />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-[#7A8FA8] uppercase tracking-wider mb-1.5">Categoria</label>
            <div className="relative">
              <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#7A8FA8]" />
              <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
                className="w-full appearance-none bg-[#111F35] border border-[#1B3050] rounded-lg pl-9 pr-4 py-2.5 text-sm text-[#F0ECE4] focus:outline-none">
                {MARKETPLACE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-[#7A8FA8] uppercase tracking-wider mb-1.5">Descrição</label>
            <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={4}
              className="w-full bg-[#111F35] border border-[#1B3050] rounded-lg px-3 py-2.5 text-sm text-[#F0ECE4] focus:outline-none resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-[#7A8FA8] uppercase tracking-wider mb-1.5">Comissão Fornecedor (%)</label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#7A8FA8]" />
                <input type="number" min="0" max="100" step="0.5"
                  value={form.commission_percent} onChange={e => setForm(p => ({ ...p, commission_percent: e.target.value }))}
                  className="w-full bg-[#111F35] border border-[#1B3050] rounded-lg pl-9 pr-3 py-2.5 text-sm text-[#F0ECE4] focus:outline-none" />
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-[#C9A84C] uppercase tracking-wider mb-1.5">Comissão Partner (%)</label>
              <div className="relative">
                <Percent className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#C9A84C]" />
                <input type="number" min="0" max="100" step="0.5"
                  value={form.partner_commission_percent} onChange={e => setForm(p => ({ ...p, partner_commission_percent: e.target.value }))}
                  className="w-full bg-[#111F35] border border-[#C9A84C]/30 rounded-lg pl-9 pr-3 py-2.5 text-sm text-[#F0ECE4] focus:outline-none focus:border-[#C9A84C]/50" />
              </div>
            </div>
          </div>
          {error && <p className="text-red-400 text-xs">{error}</p>}
          <button onClick={save} disabled={saving}
            className="w-full flex items-center justify-center gap-2 py-3 bg-[#C9A84C] hover:bg-[#E8C97A] text-[#09081A] font-bold rounded-xl text-sm disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? "Salvando..." : "Salvar Alterações"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Confirm Delete Dialog ────────────────────────────── */
function ConfirmDelete({ label, onConfirm, onCancel }: { label: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[#09081A] border border-red-500/30 rounded-2xl w-full max-w-sm p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
            <Trash2 className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <h3 className="text-[#F0ECE4] font-bold">Confirmar exclusão</h3>
            <p className="text-[#7A8FA8] text-xs">Esta ação não pode ser desfeita</p>
          </div>
        </div>
        <p className="text-[#7A8FA8] text-sm bg-[#111F35] rounded-xl px-4 py-3 border border-[#1B3050]">
          <span className="text-[#F0ECE4] font-semibold">{label}</span> será excluído permanentemente.
        </p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-2.5 bg-[#111F35] border border-[#1B3050] text-[#7A8FA8] rounded-xl text-sm font-semibold">Cancelar</button>
          <button onClick={onConfirm} className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-semibold transition-colors">Excluir</button>
        </div>
      </div>
    </div>
  );
}

/* ── Supplier Row ─────────────────────────────────────── */
function SupplierRow({ supplier, onRefresh }: { supplier: Supplier; onRefresh: () => void }) {
  const [loading, setLoading] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [reason, setReason] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  async function handleStatus(status: string) {
    setLoading(true);
    await fetch("/api/marketplace/suppliers", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: supplier.id, status, rejection_reason: status === "REJECTED" ? reason : undefined }),
    });
    setLoading(false); setShowReject(false); onRefresh();
  }

  async function handleDelete() {
    setLoading(true);
    await fetch(`/api/marketplace/suppliers/${supplier.id}`, { method: "DELETE" });
    setLoading(false); setDeleteOpen(false); onRefresh();
  }

  return (
    <>
      <div className="bg-[#0D1929] border border-[#1B3050] rounded-xl p-5 space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Building2 className="w-4 h-4 text-[#C9A84C]" />
              <h3 className="text-[#F0ECE4] font-semibold">{supplier.company_name}</h3>
              <StatusBadge status={supplier.status} />
            </div>
            <p className="text-[#7A8FA8] text-xs">CNPJ: {supplier.cnpj}</p>
            <p className="text-[#7A8FA8] text-xs">{supplier.contact_name} · {supplier.email} · {supplier.phone}</p>
            <p className="text-[#7A8FA8] text-xs">{supplier.city}/{supplier.state}</p>
            <div className="flex flex-wrap gap-1 mt-2">
              {supplier.categories.map(c => <span key={c} className="text-[9px] bg-[#162744] text-[#7A8FA8] px-2 py-0.5 rounded-full">{c}</span>)}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button onClick={() => setEditOpen(true)}
              className="p-2 rounded-lg bg-[#111F35] border border-[#1B3050] text-[#7A8FA8] hover:text-[#C9A84C] transition-colors" title="Editar">
              <Edit2 className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => setDeleteOpen(true)}
              className="p-2 rounded-lg bg-[#111F35] border border-[#1B3050] text-[#7A8FA8] hover:text-red-400 transition-colors" title="Excluir">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
            <span className="text-[#7A8FA8] text-[10px]">{new Date(supplier.created_at).toLocaleDateString("pt-BR")}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 pt-2 border-t border-[#1B3050]">
          {supplier.status !== "APPROVED" && (
            <button onClick={() => handleStatus("APPROVED")} disabled={loading}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50">
              {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
              Aprovar
            </button>
          )}
          {supplier.status !== "REJECTED" && (
            <button onClick={() => setShowReject(v => !v)} disabled={loading}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50">
              <XCircle className="w-3 h-3" />
              Reprovar
            </button>
          )}
          {supplier.status === "APPROVED" && (
            <button onClick={() => handleStatus("INACTIVE")} disabled={loading}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-gray-500/10 hover:bg-gray-500/20 border border-gray-500/30 text-gray-400 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50">
              <AlertCircle className="w-3 h-3" />
              Inativar
            </button>
          )}
        </div>

        {showReject && (
          <div className="space-y-2">
            <textarea value={reason} onChange={e => setReason(e.target.value)}
              placeholder="Motivo da reprovação (obrigatório)" rows={2}
              className="w-full bg-[#111F35] border border-red-500/30 rounded-lg px-3 py-2 text-sm text-[#F0ECE4] placeholder:text-[#7A8FA8]/50 focus:outline-none resize-none" />
            <button onClick={() => handleStatus("REJECTED")} disabled={!reason.trim() || loading}
              className="px-4 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg text-xs font-semibold transition-colors disabled:opacity-50">
              Confirmar Reprovação
            </button>
          </div>
        )}
      </div>

      {editOpen && <EditSupplierModal supplier={supplier} onClose={() => setEditOpen(false)} onSaved={onRefresh} />}
      {deleteOpen && <ConfirmDelete label={supplier.company_name} onConfirm={handleDelete} onCancel={() => setDeleteOpen(false)} />}
    </>
  );
}

/* ── Product Row ──────────────────────────────────────── */
function ProductRow({ product, onRefresh, leadStats }: {
  product: Product;
  onRefresh: () => void;
  leadStats?: { total: number; converted: number; last: string };
}) {
  const [loading, setLoading] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [reason, setReason] = useState("");
  const [approveOpen, setApproveOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  async function handleReject() {
    setLoading(true);
    await fetch("/api/marketplace/products", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: product.id, status: "REJECTED", rejection_reason: reason }),
    });
    setLoading(false); setShowReject(false); onRefresh();
  }

  async function handleDelete() {
    setLoading(true);
    await fetch(`/api/marketplace/products/${product.id}`, { method: "DELETE" });
    setLoading(false); setDeleteOpen(false); onRefresh();
  }

  return (
    <>
      <div className="bg-[#0D1929] border border-[#1B3050] rounded-xl p-5 space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex gap-4 flex-1">
            {product.images[0] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={product.images[0]} alt="" className="w-16 h-16 rounded-lg object-cover flex-shrink-0 border border-[#1B3050]" />
            ) : (
              <div className="w-16 h-16 rounded-lg bg-[#111F35] flex items-center justify-center flex-shrink-0">
                <Package className="w-6 h-6 text-[#7A8FA8]/30" />
              </div>
            )}
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-[#F0ECE4] font-semibold text-sm">{product.name}</h3>
                <StatusBadge status={product.status} />
              </div>
              <p className="text-[#7A8FA8] text-xs">{product.category} · {product.supplier.company_name}</p>
              <p className="text-[#7A8FA8] text-xs">{fmtPrice(product)}</p>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-[#7A8FA8] text-xs">Fornecedor oferece: <span className="text-[#F0ECE4] font-semibold">{product.commission_percent}%</span></span>
                {product.partner_commission_percent != null && (
                  <span className="text-[#7A8FA8] text-xs">Partner recebe: <span className="text-[#C9A84C] font-bold">{product.partner_commission_percent}%</span></span>
                )}
              </div>
              <p className="text-[#7A8FA8] text-xs mt-1 line-clamp-2">{product.description}</p>
              {leadStats && (
                <div className="flex items-center gap-3 mt-1.5">
                  <span className="text-[#7A8FA8] text-[10px]">
                    <span className="text-blue-400 font-bold">{leadStats.total}</span> leads ·{" "}
                    <span className="text-emerald-400 font-bold">{leadStats.converted}</span> convertidos ·{" "}
                    último: {new Date(leadStats.last).toLocaleDateString("pt-BR")}
                  </span>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button onClick={() => setEditOpen(true)}
              className="p-2 rounded-lg bg-[#111F35] border border-[#1B3050] text-[#7A8FA8] hover:text-[#C9A84C] transition-colors" title="Editar">
              <Edit2 className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => setDeleteOpen(true)}
              className="p-2 rounded-lg bg-[#111F35] border border-[#1B3050] text-[#7A8FA8] hover:text-red-400 transition-colors" title="Excluir">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
            <span className="text-[#7A8FA8] text-[10px]">{new Date(product.created_at).toLocaleDateString("pt-BR")}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 pt-2 border-t border-[#1B3050]">
          {product.status !== "APPROVED" && (
            <button onClick={() => setApproveOpen(true)} disabled={loading}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50">
              <CheckCircle className="w-3 h-3" />
              Aprovar & Definir Comissão
            </button>
          )}
          {product.status !== "REJECTED" && (
            <button onClick={() => setShowReject(v => !v)} disabled={loading}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50">
              <XCircle className="w-3 h-3" />
              Reprovar
            </button>
          )}
          {product.status === "APPROVED" && (
            <button onClick={async () => {
              setLoading(true);
              await fetch("/api/marketplace/products", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: product.id, status: "INACTIVE" }) });
              setLoading(false); onRefresh();
            }} disabled={loading}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-gray-500/10 hover:bg-gray-500/20 border border-gray-500/30 text-gray-400 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50">
              <AlertCircle className="w-3 h-3" />
              Inativar
            </button>
          )}
        </div>

        {showReject && (
          <div className="space-y-2">
            <textarea value={reason} onChange={e => setReason(e.target.value)}
              placeholder="Motivo da reprovação" rows={2}
              className="w-full bg-[#111F35] border border-red-500/30 rounded-lg px-3 py-2 text-sm text-[#F0ECE4] placeholder:text-[#7A8FA8]/50 focus:outline-none resize-none" />
            <button onClick={handleReject} disabled={!reason.trim() || loading}
              className="px-4 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg text-xs font-semibold transition-colors disabled:opacity-50">
              Confirmar Reprovação
            </button>
          </div>
        )}
      </div>

      {approveOpen && <ApproveProductModal product={product} onClose={() => setApproveOpen(false)} onApproved={onRefresh} />}
      {editOpen && <EditProductModal product={product} onClose={() => setEditOpen(false)} onSaved={onRefresh} />}
      {deleteOpen && <ConfirmDelete label={product.name} onConfirm={handleDelete} onCancel={() => setDeleteOpen(false)} />}
    </>
  );
}

interface Lead {
  id: string; status: string; message: string | null;
  client_name: string | null; client_contact: string | null;
  notes: string | null; created_at: string;
  product: { id: string; name: string; category: string; commission_percent: number; partner_commission_percent: number | null } | null;
  partner: { id: string; full_name: string; email: string } | null;
  supplier: { id: string; company_name: string } | null;
}

const LEAD_STATUS_MAP: Record<string, { label: string; cls: string }> = {
  NEW:         { label: "Novo",          cls: "bg-blue-500/10 text-blue-400 border-blue-500/30" },
  IN_PROGRESS: { label: "Em andamento",  cls: "bg-amber-500/10 text-amber-400 border-amber-500/30" },
  CONVERTED:   { label: "Convertido",    cls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" },
  LOST:        { label: "Perdido",       cls: "bg-red-500/10 text-red-400 border-red-500/30" },
  PENDING:     { label: "Aguardando",    cls: "bg-gray-500/10 text-gray-400 border-gray-500/30" },
};

/* ── Main Component ───────────────────────────────────── */
export function AdminMarketplaceClient() {
  const [tab, setTab] = useState<TabId>("suppliers");
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("PENDING");
  const [filterSupplier, setFilterSupplier] = useState("");
  const [origin, setOrigin] = useState("");
  const [exportingCsv, setExportingCsv] = useState(false);

  useEffect(() => { setOrigin(window.location.origin); }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [supRes, prodRes, leadsRes] = await Promise.all([
        fetch("/api/marketplace/suppliers"),
        fetch("/api/marketplace/products?admin=true"),
        fetch("/api/marketplace/leads?admin=true"),
      ]);
      setSuppliers((await supRes.json()).suppliers ?? []);
      setProducts((await prodRes.json()).products ?? []);
      setLeads((await leadsRes.json()).leads ?? []);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function exportCsv() {
    setExportingCsv(true);
    try {
      const res = await fetch("/api/marketplace/export-leads");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `marketplace-leads-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExportingCsv(false);
    }
  }

  const pendingSuppliers = suppliers.filter(s => s.status === "PENDING").length;
  const pendingProducts = products.filter(p => p.status === "PENDING").length;

  const filteredSuppliers = suppliers.filter(s => !filterStatus || s.status === filterStatus);
  const filteredProducts = products.filter(p =>
    (!filterStatus || p.status === filterStatus) &&
    (!filterSupplier || p.supplier.id === filterSupplier)
  );

  // Prospecting stats: leads per product
  const leadsByProduct = leads.reduce<Record<string, { total: number; converted: number; last: string }>>((acc, l) => {
    const pid = l.product?.id;
    if (!pid) return acc;
    if (!acc[pid]) acc[pid] = { total: 0, converted: 0, last: l.created_at };
    acc[pid].total++;
    if (l.status === "CONVERTED") acc[pid].converted++;
    if (l.created_at > acc[pid].last) acc[pid].last = l.created_at;
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-[#09081A] p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#C9A84C]/15 flex items-center justify-center">
            <ShoppingBag className="w-5 h-5 text-[#C9A84C]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#F0ECE4]">Admin Marketplace</h1>
            <p className="text-[#7A8FA8] text-sm">Aprovação de fornecedores e produtos · Gestão de comissões</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportCsv} disabled={exportingCsv}
            className="flex items-center gap-2 px-3 py-2 bg-[#0D1929] border border-[#1B3050] rounded-lg text-[#7A8FA8] hover:text-[#C9A84C] text-sm transition-colors disabled:opacity-50">
            {exportingCsv ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Exportar Leads CSV
          </button>
          <button onClick={fetchData}
            className="flex items-center gap-2 px-3 py-2 bg-[#0D1929] border border-[#1B3050] rounded-lg text-[#7A8FA8] hover:text-[#F0ECE4] text-sm transition-colors">
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
            Atualizar
          </button>
        </div>
      </div>

      {/* Links */}
      <div className="bg-[#0D1929] border border-[#C9A84C]/20 rounded-xl p-5 space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <Link2 className="w-4 h-4 text-[#C9A84C]" />
          <h2 className="text-[#F0ECE4] font-semibold text-sm">Links para Enviar aos Fornecedores</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <LinkCard label="Cadastro de Fornecedor" url={`${origin}/fornecedor/cadastro`} description="Envie para novos fornecedores se cadastrarem" />
          <LinkCard label="Portal do Fornecedor (Login)" url={`${origin}/fornecedor/login`} description="Acesso ao portal para fornecedores já cadastrados" />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Fornecedores", value: suppliers.length, icon: Building2, color: "text-[#C9A84C]" },
          { label: "Fornec. Pendentes", value: pendingSuppliers, icon: Clock, color: "text-amber-400" },
          { label: "Produtos", value: products.length, icon: Package, color: "text-blue-400" },
          { label: "Leads Totais", value: leads.length, icon: TrendingUp, color: "text-emerald-400" },
          { label: "Leads Convertidos", value: leads.filter(l => l.status === "CONVERTED").length, icon: CheckCircle, color: "text-emerald-400" },
          { label: "Produtos Pendentes", value: pendingProducts, icon: Eye, color: "text-amber-400" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-[#0D1929] border border-[#1B3050] rounded-xl p-4 flex items-center gap-3">
            <div className={cn("w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0", color)}>
              <Icon className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[9px] text-[#7A8FA8] uppercase tracking-wider leading-none mb-1">{label}</p>
              <p className={cn("text-xl font-bold", color)}>{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {([
          { id: "suppliers" as TabId, label: "Fornecedores", icon: Users, badge: pendingSuppliers },
          { id: "products" as TabId, label: "Produtos", icon: Package, badge: pendingProducts },
          { id: "leads" as TabId, label: `Leads (${leads.length})`, icon: TrendingUp, badge: 0 },
        ]).map(({ id, label, icon: Icon, badge }) => (
          <button key={id} onClick={() => setTab(id)}
            className={cn("flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all",
              tab === id ? "bg-[#C9A84C] text-[#09081A]" : "bg-[#0D1929] border border-[#1B3050] text-[#7A8FA8] hover:text-[#F0ECE4]")}>
            <Icon className="w-4 h-4" />
            {label}
            {badge > 0 && (
              <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-full",
                tab === id ? "bg-[#09081A]/30" : "bg-amber-500/20 text-amber-400")}>
                {badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Filters */}
      {(tab === "suppliers" || tab === "products") && (
        <div className="space-y-2">
          <div className="flex gap-2 flex-wrap">
            {["", "PENDING", "APPROVED", "REJECTED", "INACTIVE"].map(s => (
              <button key={s || "all"} onClick={() => setFilterStatus(s)}
                className={cn("px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                  filterStatus === s ? "bg-[#C9A84C]/20 text-[#C9A84C] border border-[#C9A84C]/40"
                                    : "bg-[#111F35] text-[#7A8FA8] border border-[#1B3050] hover:text-[#F0ECE4]")}>
                {s === "" ? "Todos" : (PRODUCT_STATUS_LABELS[s as keyof typeof PRODUCT_STATUS_LABELS] ?? s)}
              </button>
            ))}
          </div>
          {tab === "products" && suppliers.length > 0 && (
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-[#7A8FA8]" />
              <select value={filterSupplier} onChange={e => setFilterSupplier(e.target.value)}
                className="bg-[#0D1929] border border-[#1B3050] rounded-lg px-3 py-1.5 text-sm text-[#F0ECE4] focus:outline-none focus:border-[#C9A84C]/50">
                <option value="">Todos os fornecedores</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.company_name}</option>)}
              </select>
            </div>
          )}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 animate-spin text-[#C9A84C]" />
        </div>
      ) : (
        <div className="space-y-4">
          {tab === "suppliers" && (
            filteredSuppliers.length === 0
              ? <div className="text-center py-16 text-[#7A8FA8]">Nenhum fornecedor neste status</div>
              : filteredSuppliers.map(s => <SupplierRow key={s.id} supplier={s} onRefresh={fetchData} />)
          )}
          {tab === "products" && (
            filteredProducts.length === 0
              ? <div className="text-center py-16 text-[#7A8FA8]">Nenhum produto neste status</div>
              : filteredProducts.map(p => (
                <ProductRow key={p.id} product={p} onRefresh={fetchData}
                  leadStats={leadsByProduct[p.id]} />
              ))
          )}
          {tab === "leads" && (
            leads.length === 0
              ? <div className="text-center py-16 text-[#7A8FA8]">Nenhum lead ainda</div>
              : leads.map(lead => {
                const st = LEAD_STATUS_MAP[lead.status] ?? LEAD_STATUS_MAP.PENDING;
                return (
                  <div key={lead.id} className="bg-[#0D1929] border border-[#1B3050] rounded-xl p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-[#F0ECE4] font-semibold text-sm">{lead.product?.name ?? "Produto"}</p>
                          <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border", st.cls)}>
                            {st.label}
                          </span>
                        </div>
                        <p className="text-[#7A8FA8] text-xs">{lead.supplier?.company_name} · {lead.product?.category}</p>
                        <p className="text-[#7A8FA8] text-xs mt-0.5">
                          Partner: <span className="text-[#F0ECE4]">{lead.partner?.full_name}</span> ({lead.partner?.email})
                        </p>
                        {lead.client_name && (
                          <p className="text-[#7A8FA8] text-xs mt-0.5">
                            Cliente: <span className="text-[#F0ECE4]">{lead.client_name}</span>
                            {lead.client_contact && <> · {lead.client_contact}</>}
                          </p>
                        )}
                        {lead.message && (
                          <p className="text-[#F0ECE4] text-xs bg-[#111F35] rounded-lg px-3 py-2 mt-2 italic">&ldquo;{lead.message}&rdquo;</p>
                        )}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-[#7A8FA8] text-xs">{new Date(lead.created_at).toLocaleDateString("pt-BR")}</p>
                        {lead.product?.partner_commission_percent && (
                          <p className="text-[#C9A84C] text-xs font-bold mt-0.5">{lead.product.partner_commission_percent}% comissão</p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
          )}
        </div>
      )}
    </div>
  );
}
