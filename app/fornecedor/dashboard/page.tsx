"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ShoppingBag, Package, TrendingUp, Users, Plus, LogOut,
  CheckCircle, Clock, XCircle, Loader2, Eye, AlertCircle,
  Edit2, Save, X, Building2, Phone, Globe, MapPin, Tag,
  DollarSign,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MARKETPLACE_CATEGORIES } from "@/lib/constants";

const STATES = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

interface SupplierProfile {
  id: string;
  company_name: string;
  cnpj: string;
  contact_name: string;
  email: string;
  phone: string;
  city: string;
  state: string;
  website: string | null;
  description: string;
  categories: string[];
  status: string;
}

interface Product {
  id: string;
  name: string;
  description: string;
  category: string;
  price: number | null;
  price_type: string;
  commission_percent: number;
  status: string;
  created_at: string;
  images: string[];
  views?: number;
}

interface Lead {
  id: string;
  message: string | null;
  client_name: string | null;
  client_contact: string | null;
  status: string;
  created_at: string;
  product: { id: string; name: string; category: string };
  partner: { id: string; full_name: string; email: string };
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { cls: string; icon: React.ReactNode; label: string }> = {
    PENDING: { cls: "bg-amber-500/10 text-amber-400 border-amber-500/30", icon: <Clock className="w-3 h-3" />, label: "Aguardando" },
    APPROVED: { cls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30", icon: <CheckCircle className="w-3 h-3" />, label: "Aprovado" },
    REJECTED: { cls: "bg-red-500/10 text-red-400 border-red-500/30", icon: <XCircle className="w-3 h-3" />, label: "Reprovado" },
    NEW: { cls: "bg-blue-500/10 text-blue-400 border-blue-500/30", icon: <Eye className="w-3 h-3" />, label: "Novo" },
    INACTIVE: { cls: "bg-gray-500/10 text-gray-400 border-gray-500/30", icon: <AlertCircle className="w-3 h-3" />, label: "Inativo" },
  };
  const c = map[status] ?? map["PENDING"];
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border", c.cls)}>
      {c.icon}{c.label}
    </span>
  );
}

function EditPerfilModal({ supplier, onClose, onSaved }: {
  supplier: SupplierProfile;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    company_name: supplier.company_name,
    contact_name: supplier.contact_name,
    phone: supplier.phone,
    city: supplier.city,
    state: supplier.state,
    website: supplier.website ?? "",
    description: supplier.description,
    categories: supplier.categories,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function set(k: string, v: string) { setForm(prev => ({ ...prev, [k]: v })); }

  function toggleCategory(c: string) {
    setForm(prev => ({
      ...prev,
      categories: prev.categories.includes(c)
        ? prev.categories.filter(x => x !== c)
        : [...prev.categories, c],
    }));
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/marketplace/suppliers/${supplier.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const j = await res.json();
        throw new Error(typeof j.error === "string" ? j.error : "Erro ao salvar");
      }
      onSaved();
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="relative bg-[#09081A] border border-[#1B3050] rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-[#09081A] border-b border-[#1B3050] px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
          <div className="flex items-center gap-2">
            <Edit2 className="w-4 h-4 text-[#C9A84C]" />
            <h2 className="text-[#F0ECE4] font-bold">Editar Perfil</h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/5 text-[#7A8FA8]">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {[
            { label: "Razão Social", key: "company_name", icon: Building2 },
            { label: "Nome do Responsável", key: "contact_name", icon: null },
            { label: "Telefone", key: "phone", icon: Phone },
            { label: "Cidade", key: "city", icon: MapPin },
            { label: "Site", key: "website", icon: Globe },
          ].map(({ label, key, icon: Icon }) => (
            <div key={key}>
              <label className="block text-[10px] font-bold text-[#7A8FA8] uppercase tracking-wider mb-1.5">{label}</label>
              <div className="relative">
                {Icon && <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#7A8FA8]" />}
                <input
                  value={form[key as keyof typeof form] as string}
                  onChange={e => set(key, e.target.value)}
                  className={cn(
                    "w-full bg-[#111F35] border border-[#1B3050] rounded-lg py-2.5 text-sm text-[#F0ECE4] focus:outline-none focus:border-[#C9A84C]/50 placeholder:text-[#7A8FA8]/40",
                    Icon ? "pl-9 pr-3" : "px-3"
                  )}
                />
              </div>
            </div>
          ))}

          <div>
            <label className="block text-[10px] font-bold text-[#7A8FA8] uppercase tracking-wider mb-1.5">Estado</label>
            <select value={form.state} onChange={e => set("state", e.target.value)}
              className="w-full bg-[#111F35] border border-[#1B3050] rounded-lg px-3 py-2.5 text-sm text-[#F0ECE4] focus:outline-none focus:border-[#C9A84C]/50">
              {STATES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-[#7A8FA8] uppercase tracking-wider mb-1.5">Sobre a Empresa</label>
            <textarea value={form.description} onChange={e => set("description", e.target.value)}
              rows={4} className="w-full bg-[#111F35] border border-[#1B3050] rounded-lg px-3 py-2.5 text-sm text-[#F0ECE4] focus:outline-none focus:border-[#C9A84C]/50 resize-none" />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-[#7A8FA8] uppercase tracking-wider mb-2">Categorias</label>
            <div className="flex flex-wrap gap-2">
              {MARKETPLACE_CATEGORIES.map(c => (
                <button key={c} type="button" onClick={() => toggleCategory(c)}
                  className={cn("px-3 py-1.5 rounded-full text-xs font-medium transition-all border",
                    form.categories.includes(c)
                      ? "bg-[#C9A84C]/20 text-[#C9A84C] border-[#C9A84C]/40"
                      : "bg-[#111F35] text-[#7A8FA8] border-[#1B3050] hover:text-[#F0ECE4]"
                  )}>
                  {c}
                </button>
              ))}
            </div>
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button onClick={handleSave} disabled={saving}
            className="w-full flex items-center justify-center gap-2 py-3 bg-[#C9A84C] hover:bg-[#E8C97A] text-[#09081A] font-bold rounded-xl text-sm transition-colors disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? "Salvando..." : "Salvar Alterações"}
          </button>
        </div>
      </div>
    </div>
  );
}

function EditProductModal({ product, supplierId, onClose, onSaved }: {
  product: Product; supplierId: string; onClose: () => void; onSaved: () => void;
}) {
  const [form, setForm] = useState({
    name: product.name,
    description: product.description,
    category: product.category,
    commission_percent: product.commission_percent.toString(),
    price_type: product.price_type,
    price: product.price?.toString() ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    setSaving(true); setError("");
    try {
      const res = await fetch("/api/marketplace/products", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-supplier-id": supplierId },
        body: JSON.stringify({
          id: product.id,
          name: form.name,
          description: form.description,
          category: form.category,
          commission_percent: parseFloat(form.commission_percent),
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Erro ao salvar");
      onSaved(); onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro ao salvar");
    } finally { setSaving(false); }
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
            <label className="block text-[10px] font-bold text-[#7A8FA8] uppercase tracking-wider mb-1.5">Nome *</label>
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
            <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              rows={4} className="w-full bg-[#111F35] border border-[#1B3050] rounded-lg px-3 py-2.5 text-sm text-[#F0ECE4] focus:outline-none resize-none" />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-[#7A8FA8] uppercase tracking-wider mb-1.5">Comissão oferecida à V3 Partners (%)</label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#7A8FA8]" />
              <input type="number" min="1" max="80" step="0.5"
                value={form.commission_percent} onChange={e => setForm(p => ({ ...p, commission_percent: e.target.value }))}
                className="w-full bg-[#111F35] border border-[#1B3050] rounded-lg pl-9 pr-3 py-2.5 text-sm text-[#F0ECE4] focus:outline-none" />
            </div>
          </div>
          {error && <p className="text-red-400 text-xs">{error}</p>}
          <button onClick={handleSave} disabled={saving}
            className="w-full flex items-center justify-center gap-2 py-3 bg-[#C9A84C] hover:bg-[#E8C97A] text-[#09081A] font-bold rounded-xl text-sm disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? "Salvando..." : "Salvar Alterações"}
          </button>
        </div>
      </div>
    </div>
  );
}

const LEAD_STATUS_OPTIONS = [
  { value: "NEW",         label: "Novo",          cls: "text-blue-400 border-blue-500/30 bg-blue-500/10" },
  { value: "IN_PROGRESS", label: "Em andamento",  cls: "text-amber-400 border-amber-500/30 bg-amber-500/10" },
  { value: "CONVERTED",   label: "Convertido",    cls: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10" },
  { value: "LOST",        label: "Perdido",       cls: "text-red-400 border-red-500/30 bg-red-500/10" },
];

function LeadCard({ lead, supplierId, onRefresh }: { lead: Lead; supplierId: string; onRefresh: () => void }) {
  const [updating, setUpdating] = useState(false);
  const currentStatus = LEAD_STATUS_OPTIONS.find(s => s.value === lead.status) ?? LEAD_STATUS_OPTIONS[0];

  async function updateStatus(status: string) {
    setUpdating(true);
    await fetch(`/api/marketplace/leads/${lead.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-supplier-id": supplierId },
      body: JSON.stringify({ status }),
    });
    setUpdating(false);
    onRefresh();
  }

  return (
    <div className="bg-[#0D1929] border border-[#1B3050] rounded-xl p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <p className="text-[#F0ECE4] font-semibold text-sm">{lead.product.name}</p>
            <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border", currentStatus.cls)}>
              {currentStatus.label}
            </span>
          </div>
          <p className="text-[#7A8FA8] text-xs">Partner: {lead.partner.full_name} ({lead.partner.email})</p>
          {lead.client_name && <p className="text-[#7A8FA8] text-xs">Cliente: {lead.client_name}{lead.client_contact ? ` · ${lead.client_contact}` : ""}</p>}
          {lead.message && <p className="text-[#F0ECE4] text-xs mt-1 bg-[#111F35] rounded-lg px-3 py-2">{lead.message}</p>}
        </div>
        <span className="text-[#7A8FA8] text-xs flex-shrink-0">{new Date(lead.created_at).toLocaleDateString("pt-BR")}</span>
      </div>

      {/* Status update buttons */}
      <div className="flex flex-wrap gap-2 pt-1 border-t border-[#1B3050]">
        {LEAD_STATUS_OPTIONS.filter(s => s.value !== lead.status).map(s => (
          <button key={s.value} onClick={() => updateStatus(s.value)} disabled={updating}
            className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors disabled:opacity-50", s.cls)}>
            {updating ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function FornecedorDashboardPage() {
  const router = useRouter();
  const [supplierId, setSupplierId] = useState<string | null>(null);
  const [supplierStatus, setSupplierStatus] = useState<string | null>(null);
  const [supplier, setSupplier] = useState<SupplierProfile | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"products" | "leads">("products");
  const [showEdit, setShowEdit] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);

  const fetchData = useCallback(async (sid: string) => {
    setLoading(true);
    try {
      const [supRes, prodRes, leadsRes] = await Promise.all([
        fetch(`/api/marketplace/suppliers/${sid}`),
        fetch(`/api/marketplace/products?supplier_id=${sid}`),
        fetch(`/api/marketplace/leads?supplier_id=${sid}`),
      ]);
      const supJson = await supRes.json();
      const prodJson = await prodRes.json();
      const leadsJson = await leadsRes.json();
      if (supJson.supplier) setSupplier(supJson.supplier);
      setProducts(prodJson.products ?? []);
      setLeads(leadsJson.leads ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const sid = sessionStorage.getItem("supplier_id");
    const sts = sessionStorage.getItem("supplier_status");
    if (!sid) {
      router.push("/fornecedor/login");
      return;
    }
    setSupplierId(sid);
    setSupplierStatus(sts);
    fetchData(sid);
  }, [router, fetchData]);

  async function handleLogout() {
    await fetch("/api/marketplace/auth", { method: "DELETE" }).catch(() => {});
    sessionStorage.removeItem("supplier_id");
    sessionStorage.removeItem("supplier_status");
    window.location.href = "/fornecedor/login";
  }

  if (!supplierId) return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="w-8 h-8 animate-spin text-[#C9A84C]" />
    </div>
  );

  const approvedProducts = products.filter(p => p.status === "APPROVED").length;
  const pendingProducts = products.filter(p => p.status === "PENDING").length;
  const newLeads = leads.filter(l => l.status === "NEW").length;

  return (
    <div className="min-h-screen bg-[#09081A]">
      {/* Top nav */}
      <header className="border-b border-[#1B3050] bg-[#0D1929] px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#C9A84C]/15 flex items-center justify-center">
            <ShoppingBag className="w-5 h-5 text-[#C9A84C]" />
          </div>
          <div>
            <p className="text-[#C9A84C] font-bold text-xs tracking-wider">V3 PARTNERS</p>
            <p className="text-[#7A8FA8] text-[10px]">Portal do Fornecedor</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {supplierStatus === "PENDING" && (
            <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 rounded-full px-3 py-1.5">
              <Clock className="w-3 h-3 text-amber-400" />
              <span className="text-amber-400 text-xs font-medium">Aguardando aprovação da V3</span>
            </div>
          )}
          {supplierStatus === "APPROVED" && (
            <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 rounded-full px-3 py-1.5">
              <CheckCircle className="w-3 h-3 text-emerald-400" />
              <span className="text-emerald-400 text-xs font-medium">Fornecedor ativo</span>
            </div>
          )}
          <button onClick={() => setShowEdit(true)}
            className="flex items-center gap-2 px-3 py-2 bg-[#C9A84C]/10 border border-[#C9A84C]/30 rounded-lg text-[#C9A84C] hover:bg-[#C9A84C]/20 text-xs transition-colors">
            <Edit2 className="w-3.5 h-3.5" />
            Editar Perfil
          </button>
          <button onClick={handleLogout} className="flex items-center gap-2 px-3 py-2 bg-[#111F35] border border-[#1B3050] rounded-lg text-[#7A8FA8] hover:text-[#F0ECE4] text-xs transition-colors">
            <LogOut className="w-3.5 h-3.5" />
            Sair
          </button>
        </div>
      </header>

      <main className="p-6 space-y-6 max-w-5xl mx-auto">
        {supplierStatus === "PENDING" && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-5 flex gap-4">
            <Clock className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-amber-400 font-semibold">Cadastro em análise</p>
              <p className="text-[#7A8FA8] text-sm mt-1">Seu cadastro está sendo revisado pela equipe V3 Partners. Você receberá um e-mail quando for aprovado. Prazo: até 2 dias úteis.</p>
            </div>
          </div>
        )}

        {/* Supplier info card */}
        {supplier && (
          <div className="bg-[#0D1929] border border-[#1B3050] rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="text-[#F0ECE4] font-semibold">{supplier.company_name}</p>
              <p className="text-[#7A8FA8] text-xs">{supplier.contact_name} · {supplier.email} · {supplier.city}/{supplier.state}</p>
              <div className="flex flex-wrap gap-1 mt-1.5">
                {supplier.categories.map(c => (
                  <span key={c} className="text-[9px] bg-[#162744] text-[#7A8FA8] px-2 py-0.5 rounded-full">{c}</span>
                ))}
              </div>
            </div>
            <button onClick={() => setShowEdit(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#111F35] border border-[#1B3050] rounded-lg text-[#7A8FA8] hover:text-[#C9A84C] text-xs transition-colors flex-shrink-0">
              <Edit2 className="w-3 h-3" />
              Editar
            </button>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Produtos Ativos", value: approvedProducts, icon: Package, color: "text-emerald-400" },
            { label: "Aguardando Aprovação", value: pendingProducts, icon: Clock, color: "text-amber-400" },
            { label: "Leads Recebidos", value: leads.length, icon: Users, color: "text-blue-400" },
            { label: "Novos Leads", value: newLeads, icon: TrendingUp, color: "text-[#C9A84C]" },
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
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            {([
              { id: "products", label: "Meus Produtos" },
              { id: "leads", label: `Leads (${leads.length})` },
            ] as const).map(({ id, label }) => (
              <button key={id} onClick={() => setTab(id)}
                className={cn("px-5 py-2.5 rounded-xl text-sm font-semibold transition-all",
                  tab === id ? "bg-[#C9A84C] text-[#09081A]" : "bg-[#0D1929] border border-[#1B3050] text-[#7A8FA8] hover:text-[#F0ECE4]"
                )}>
                {label}
              </button>
            ))}
          </div>

          {tab === "products" && supplierStatus === "APPROVED" && supplierId && (
            <Link href={`/fornecedor/produtos/novo?supplier_id=${supplierId}`}
              className="flex items-center gap-2 px-4 py-2 bg-[#C9A84C]/10 hover:bg-[#C9A84C]/20 border border-[#C9A84C]/30 text-[#C9A84C] rounded-xl text-sm font-semibold transition-colors">
              <Plus className="w-4 h-4" />
              Novo Produto
            </Link>
          )}
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-[#C9A84C]" />
          </div>
        ) : (
          <div className="space-y-4">
            {tab === "products" && (
              products.length === 0 ? (
                <div className="text-center py-16 space-y-4">
                  <Package className="w-16 h-16 text-[#7A8FA8]/30 mx-auto" />
                  <p className="text-[#F0ECE4] font-semibold">Nenhum produto cadastrado</p>
                  {supplierStatus === "APPROVED" && supplierId && (
                    <Link href={`/fornecedor/produtos/novo?supplier_id=${supplierId}`}
                      className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#C9A84C] hover:bg-[#E8C97A] text-[#09081A] font-bold rounded-xl text-sm transition-colors">
                      <Plus className="w-4 h-4" />
                      Cadastrar primeiro produto
                    </Link>
                  )}
                </div>
              ) : (
                products.map(p => (
                  <div key={p.id} className="bg-[#0D1929] border border-[#1B3050] rounded-xl p-4 flex items-center justify-between">
                    <div className="flex gap-3 flex-1">
                      {p.images?.[0] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.images[0]} alt="" className="w-12 h-12 rounded-lg object-cover border border-[#1B3050] flex-shrink-0" />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-[#111F35] flex items-center justify-center flex-shrink-0">
                          <Package className="w-5 h-5 text-[#7A8FA8]/30" />
                        </div>
                      )}
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-[#F0ECE4] font-semibold text-sm">{p.name}</h3>
                          <StatusBadge status={p.status} />
                        </div>
                        <p className="text-[#7A8FA8] text-xs">{p.category} · {p.commission_percent}% comissão</p>
                        {(p.views ?? 0) > 0 && (
                          <div className="flex items-center gap-1 mt-0.5 text-[#7A8FA8] text-xs">
                            <Eye className="w-3 h-3" />
                            {p.views} visualizações
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {p.status === "APPROVED" && supplierId && (
                        <button onClick={() => setEditProduct(p)}
                          className="p-2 rounded-lg bg-[#111F35] border border-[#1B3050] text-[#7A8FA8] hover:text-[#C9A84C] transition-colors">
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <span className="text-[#7A8FA8] text-xs">{new Date(p.created_at).toLocaleDateString("pt-BR")}</span>
                    </div>
                  </div>
                ))
              )
            )}

            {tab === "leads" && (
              leads.length === 0 ? (
                <div className="text-center py-16">
                  <Users className="w-16 h-16 text-[#7A8FA8]/30 mx-auto mb-4" />
                  <p className="text-[#F0ECE4] font-semibold">Nenhum lead ainda</p>
                  <p className="text-[#7A8FA8] text-sm mt-1">Quando Partners expressarem interesse nos seus produtos, aparecerá aqui</p>
                </div>
              ) : (
                leads.map(lead => (
                  <LeadCard key={lead.id} lead={lead} supplierId={supplierId!} onRefresh={() => fetchData(supplierId!)} />
                ))
              )
            )}
          </div>
        )}
      </main>

      {showEdit && supplier && (
        <EditPerfilModal
          supplier={supplier}
          onClose={() => setShowEdit(false)}
          onSaved={() => supplierId && fetchData(supplierId)}
        />
      )}
      {editProduct && supplierId && (
        <EditProductModal
          product={editProduct}
          supplierId={supplierId}
          onClose={() => setEditProduct(null)}
          onSaved={() => { setEditProduct(null); fetchData(supplierId); }}
        />
      )}
    </div>
  );
}
