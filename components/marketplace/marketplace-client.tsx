"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Search, Filter, ShoppingBag, Tag, TrendingUp, ChevronRight, X,
  Send, Loader2, Package, Heart, Eye, ExternalLink, CheckCircle,
  Clock, Star,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MARKETPLACE_CATEGORIES } from "@/lib/constants";

interface Supplier {
  id: string;
  company_name: string;
  logo_url: string | null;
  city: string;
  state: string;
}

interface Product {
  id: string;
  name: string;
  description: string;
  category: string;
  price: number | null;
  price_type: "FIXED" | "NEGOTIABLE" | "ON_REQUEST";
  commission_percent: number;
  partner_commission_percent: number | null;
  images: string[];
  specs: Record<string, string>;
  min_order: number | null;
  delivery_days: number | null;
  available_nationwide: boolean;
  states: string[];
  status: string;
  created_at: string;
  supplier: Supplier;
}

interface Lead {
  id: string;
  status: string;
  message: string | null;
  client_name: string | null;
  client_contact: string | null;
  created_at: string;
  product: { id: string; name: string; category: string; partner_commission_percent: number | null; commission_percent: number } | null;
  supplier: { id: string; company_name: string } | null;
}

type TabId = "catalog" | "leads" | "favorites";

function fmtCurrency(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

function PriceLabel({ price, type }: { price: number | null; type: string }) {
  if (type === "ON_REQUEST") return <span className="text-[#C9A84C] font-bold text-sm">Sob consulta</span>;
  if (type === "NEGOTIABLE") return <span className="text-[#C9A84C] font-bold text-sm">Negociável{price ? ` a partir de ${fmtCurrency(price)}` : ""}</span>;
  if (price) return <span className="text-[#C9A84C] font-bold text-sm">{fmtCurrency(price)}</span>;
  return null;
}

const LEAD_STATUS_MAP: Record<string, { label: string; cls: string }> = {
  NEW:         { label: "Novo",          cls: "bg-blue-500/10 text-blue-400 border-blue-500/30" },
  IN_PROGRESS: { label: "Em andamento",  cls: "bg-amber-500/10 text-amber-400 border-amber-500/30" },
  CONVERTED:   { label: "Convertido",    cls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" },
  LOST:        { label: "Perdido",       cls: "bg-red-500/10 text-red-400 border-red-500/30" },
  PENDING:     { label: "Aguardando",    cls: "bg-gray-500/10 text-gray-400 border-gray-500/30" },
};

function ProductCard({ product, favorites, onToggleFavorite, myLeadProductIds }: {
  product: Product;
  favorites: Set<string>;
  onToggleFavorite: (id: string) => void;
  myLeadProductIds: Set<string>;
}) {
  const commRate = product.partner_commission_percent ?? product.commission_percent ?? 0;
  const isFav = favorites.has(product.id);
  const hasLead = myLeadProductIds.has(product.id);

  return (
    <div className="group relative bg-[#0D1929] border border-[#1B3050] rounded-xl overflow-hidden hover:border-[#C9A84C]/40 transition-all duration-200 hover:shadow-[0_0_20px_rgba(201,168,76,0.08)]">
      {/* Image */}
      <Link href={`/marketplace/${product.id}`} className="block">
        <div className="relative h-44 bg-[#111F35] flex items-center justify-center overflow-hidden">
          {product.images[0] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
          ) : (
            <Package className="w-16 h-16 text-[#7A8FA8]/30" />
          )}
          {/* Commission badge */}
          {commRate > 0 && (
            <div className="absolute top-2 right-2 bg-[#09081A]/90 border border-[#C9A84C]/40 rounded-full px-2.5 py-1">
              <span className="text-[#C9A84C] text-[10px] font-bold">{commRate}% comissão</span>
            </div>
          )}
        </div>
      </Link>

      {/* Favorite button */}
      <button
        onClick={e => { e.preventDefault(); onToggleFavorite(product.id); }}
        className={cn(
          "absolute top-2 left-2 p-1.5 rounded-full border transition-all z-10",
          isFav
            ? "bg-red-500/20 border-red-500/40 text-red-400"
            : "bg-[#09081A]/80 border-[#1B3050] text-[#7A8FA8] hover:text-red-400 opacity-0 group-hover:opacity-100"
        )}
      >
        <Heart className={cn("w-3.5 h-3.5", isFav && "fill-red-400")} />
      </button>

      {/* Info */}
      <div className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[9px] font-bold tracking-wider text-[#7A8FA8] uppercase bg-[#162744] px-2 py-0.5 rounded-full">
            {product.category}
          </span>
          {hasLead && (
            <span className="text-[9px] font-bold tracking-wider text-emerald-400 uppercase bg-emerald-400/10 border border-emerald-400/30 px-2 py-0.5 rounded-full">
              Lead enviado
            </span>
          )}
        </div>

        <Link href={`/marketplace/${product.id}`}>
          <h3 className="text-[#F0ECE4] font-semibold text-sm leading-snug mb-1 line-clamp-2 group-hover:text-[#E8C97A] transition-colors">
            {product.name}
          </h3>
        </Link>

        <p className="text-[#7A8FA8] text-xs leading-relaxed line-clamp-2 mb-3">
          {product.description}
        </p>

        <div className="flex items-center justify-between">
          <PriceLabel price={product.price} type={product.price_type} />
          <div className="flex items-center gap-1 text-[#7A8FA8] text-xs">
            <span>{product.supplier.company_name}</span>
          </div>
        </div>

        <div className="flex items-center justify-between mt-2">
          {product.available_nationwide && (
            <div className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span className="text-[10px] text-emerald-400">Nacional</span>
            </div>
          )}
          <Link href={`/marketplace/${product.id}`}
            className="flex items-center gap-1 text-[10px] text-[#C9A84C] hover:text-[#E8C97A] ml-auto transition-colors">
            <Eye className="w-3 h-3" />
            Ver detalhe
          </Link>
        </div>
      </div>
    </div>
  );
}

function QuickModal({ product, onClose }: { product: Product; onClose: () => void }) {
  const [message, setMessage] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientContact, setClientContact] = useState("");
  const [saleValue, setSaleValue] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const commRate = product.partner_commission_percent ?? product.commission_percent ?? 0;
  const estimatedCommission = saleValue && !isNaN(parseFloat(saleValue)) && parseFloat(saleValue) > 0 && commRate > 0
    ? parseFloat(saleValue) * commRate / 100
    : null;

  async function handleInteresse() {
    if (!clientName.trim()) { setError("Informe o nome do cliente antes de enviar."); return; }
    setSending(true);
    setError("");
    try {
      const res = await fetch("/api/marketplace/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_id: product.id, message, client_name: clientName, client_contact: clientContact }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Erro ao enviar");
      setSent(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro ao enviar interesse");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="relative bg-[#09081A] border border-[#1B3050] rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-[#09081A] border-b border-[#1B3050] px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
          <div>
            <p className="text-[10px] font-bold tracking-widest text-[#C9A84C] uppercase">{product.category}</p>
            <h2 className="text-[#F0ECE4] font-bold text-lg leading-tight">{product.name}</h2>
          </div>
          <div className="flex items-center gap-2">
            <Link href={`/marketplace/${product.id}`}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#111F35] border border-[#1B3050] text-[#7A8FA8] hover:text-[#C9A84C] rounded-lg text-xs transition-colors">
              <ExternalLink className="w-3.5 h-3.5" />
              Ver página completa
            </Link>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/5 text-[#7A8FA8] hover:text-[#F0ECE4] transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {product.images[0] && (
            <div className="rounded-xl overflow-hidden h-56">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover" />
            </div>
          )}

          {/* Price + commission + calculator */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-[#111F35] rounded-xl p-4 border border-[#1B3050]">
              <p className="text-[10px] text-[#7A8FA8] uppercase tracking-wider mb-1">Valor</p>
              <PriceLabel price={product.price} type={product.price_type} />
            </div>
            <div className="bg-[#C9A84C]/10 rounded-xl p-4 border border-[#C9A84C]/30">
              <p className="text-[10px] text-[#C9A84C] uppercase tracking-wider mb-1">Sua Comissão</p>
              <p className="text-[#C9A84C] font-bold text-xl">{commRate > 0 ? `${commRate}%` : "A definir"}</p>
              {product.price && commRate > 0 && (
                <p className="text-[#7A8FA8] text-xs mt-0.5">≈ {fmtCurrency(product.price * commRate / 100)} por venda</p>
              )}
            </div>
          </div>

          {/* Commission calculator */}
          <div className="bg-[#0D1929] rounded-xl p-4 border border-[#1B3050]">
            <p className="text-[10px] font-bold text-[#C9A84C] uppercase tracking-wider mb-2">Calculadora de Comissão</p>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#7A8FA8] text-sm">R$</span>
              <input
                type="number" min="0" step="100"
                value={saleValue} onChange={e => setSaleValue(e.target.value)}
                placeholder="Valor estimado da venda"
                className="w-full bg-[#111F35] border border-[#1B3050] rounded-lg pl-9 pr-3 py-2.5 text-sm text-[#F0ECE4] focus:outline-none focus:border-[#C9A84C]/50 placeholder:text-[#7A8FA8]/40"
              />
            </div>
            {estimatedCommission !== null && (
              <div className="mt-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-3 py-2 text-center">
                <p className="text-[10px] text-emerald-400 uppercase tracking-wider">Você recebe</p>
                <p className="text-emerald-400 font-bold text-lg">{fmtCurrency(estimatedCommission)}</p>
              </div>
            )}
          </div>

          <div>
            <h3 className="text-[#C9A84C] text-xs font-bold uppercase tracking-wider mb-2">Descrição</h3>
            <p className="text-[#7A8FA8] text-sm leading-relaxed">{product.description}</p>
          </div>

          {Object.keys(product.specs ?? {}).filter(k => !k.startsWith("_")).length > 0 && (
            <div>
              <h3 className="text-[#C9A84C] text-xs font-bold uppercase tracking-wider mb-2">Especificações</h3>
              <div className="space-y-2">
                {Object.entries(product.specs ?? {}).filter(([k]) => !k.startsWith("_")).map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between py-2 border-b border-[#1B3050]">
                    <span className="text-[#7A8FA8] text-xs">{k}</span>
                    <span className="text-[#F0ECE4] text-xs font-medium">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-[#111F35] rounded-xl p-4 border border-[#1B3050]">
            <h3 className="text-[#C9A84C] text-xs font-bold uppercase tracking-wider mb-2">Fornecedor</h3>
            <p className="text-[#F0ECE4] font-semibold">{product.supplier.company_name}</p>
            <p className="text-[#7A8FA8] text-xs">{product.supplier.city} — {product.supplier.state}</p>
            <Link href={`/fornecedor/vitrine/${product.supplier.id}`}
              className="text-[#C9A84C] text-xs mt-1 hover:underline inline-block">Ver vitrine do fornecedor</Link>
          </div>

          {!sent ? (
            <div className="bg-[#0D1929] rounded-xl p-4 border border-[#C9A84C]/20">
              <h3 className="text-[#C9A84C] text-xs font-bold uppercase tracking-wider mb-4 flex items-center gap-2">
                <TrendingUp className="w-3.5 h-3.5" />
                Quero vender este produto
              </h3>
              <div className="space-y-3">
                <div>
                  <input value={clientName} onChange={e => setClientName(e.target.value)}
                    placeholder="Nome do cliente *"
                    className="w-full bg-[#111F35] border border-[#C9A84C]/30 rounded-lg px-3 py-2 text-sm text-[#F0ECE4] placeholder:text-[#7A8FA8]/50 focus:outline-none focus:border-[#C9A84C]/60" />
                  <p className="text-[10px] text-[#7A8FA8] mt-1">Obrigatório — identifica o lead para o fornecedor</p>
                </div>
                <input value={clientContact} onChange={e => setClientContact(e.target.value)}
                  placeholder="WhatsApp ou e-mail do cliente (opcional)"
                  className="w-full bg-[#111F35] border border-[#1B3050] rounded-lg px-3 py-2 text-sm text-[#F0ECE4] placeholder:text-[#7A8FA8]/50 focus:outline-none focus:border-[#C9A84C]/50" />
                <textarea value={message} onChange={e => setMessage(e.target.value)}
                  placeholder="Mensagem ao fornecedor (opcional)" rows={3}
                  className="w-full bg-[#111F35] border border-[#1B3050] rounded-lg px-3 py-2 text-sm text-[#F0ECE4] placeholder:text-[#7A8FA8]/50 focus:outline-none focus:border-[#C9A84C]/50 resize-none" />
                {error && <p className="text-red-400 text-xs">{error}</p>}
                <button onClick={handleInteresse} disabled={sending}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#C9A84C] hover:bg-[#E8C97A] text-[#09081A] font-bold rounded-lg text-sm transition-colors disabled:opacity-50">
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  {sending ? "Enviando..." : "Enviar Interesse"}
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-6 text-center">
              <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
              <p className="text-emerald-400 font-semibold">Interesse registrado!</p>
              <p className="text-[#7A8FA8] text-xs mt-1">O fornecedor será notificado e entrará em contato.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function MarketplaceClient() {
  const [tab, setTab] = useState<TabId>("catalog");
  const [products, setProducts] = useState<Product[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [selected, setSelected] = useState<Product | null>(null);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (category) params.set("category", category);
      const res = await fetch(`/api/marketplace/products?${params}`);
      const j = await res.json();
      setProducts(j.products ?? []);
    } finally {
      setLoading(false);
    }
  }, [search, category]);

  const fetchLeads = useCallback(async () => {
    const res = await fetch("/api/marketplace/leads");
    const j = await res.json();
    setLeads(j.leads ?? []);
  }, []);

  const fetchFavorites = useCallback(async () => {
    const res = await fetch("/api/marketplace/favorites");
    const j = await res.json();
    setFavorites(new Set(j.favorites ?? []));
  }, []);

  useEffect(() => { fetchProducts(); fetchFavorites(); fetchLeads(); }, [fetchProducts, fetchFavorites, fetchLeads]);

  async function toggleFavorite(productId: string) {
    const isFav = favorites.has(productId);
    setFavorites(prev => {
      const next = new Set(prev);
      isFav ? next.delete(productId) : next.add(productId);
      return next;
    });
    await fetch("/api/marketplace/favorites", {
      method: isFav ? "DELETE" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product_id: productId }),
    });
  }

  const favoriteProducts = products.filter(p => favorites.has(p.id));
  const myLeadProductIds = new Set(leads.map(l => l.product?.id).filter(Boolean) as string[]);
  const avgComm = products.length
    ? Math.round(products.reduce((a, p) => a + (p.partner_commission_percent ?? p.commission_percent), 0) / products.length)
    : 0;

  return (
    <div className="min-h-screen bg-[#09081A] p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 rounded-xl bg-[#C9A84C]/15 flex items-center justify-center">
              <ShoppingBag className="w-5 h-5 text-[#C9A84C]" />
            </div>
            <h1 className="text-2xl font-bold text-[#F0ECE4]">Marketplace V3</h1>
          </div>
          <p className="text-[#7A8FA8] text-sm ml-12">Produtos e serviços para oferecer aos seus clientes e ganhar comissão</p>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Produtos Disponíveis", value: products.length.toString(), icon: Package, color: "text-[#C9A84C]" },
          { label: "Categorias", value: MARKETPLACE_CATEGORIES.length.toString(), icon: Tag, color: "text-blue-400" },
          { label: "Comissão Média", value: products.length ? `${avgComm}%` : "—", icon: TrendingUp, color: "text-emerald-400" },
          { label: "Favoritos", value: favorites.size.toString(), icon: Heart, color: "text-red-400" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-[#0D1929] border border-[#1B3050] rounded-xl p-4 flex items-center gap-4">
            <div className={cn("w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center", color)}>
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] text-[#7A8FA8] uppercase tracking-wider">{label}</p>
              <p className={cn("text-xl font-bold", color)}>{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {([
          { id: "catalog" as TabId, label: "Catálogo", icon: ShoppingBag },
          { id: "favorites" as TabId, label: `Favoritos (${favorites.size})`, icon: Heart },
          { id: "leads" as TabId, label: `Meus Leads (${leads.length})`, icon: TrendingUp },
        ]).map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className={cn("flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all",
              tab === id ? "bg-[#C9A84C] text-[#09081A]" : "bg-[#0D1929] border border-[#1B3050] text-[#7A8FA8] hover:text-[#F0ECE4]")}>
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Catalog tab */}
      {tab === "catalog" && (
        <>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7A8FA8]" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Buscar produtos..."
                className="w-full bg-[#0D1929] border border-[#1B3050] rounded-xl pl-10 pr-4 py-2.5 text-sm text-[#F0ECE4] placeholder:text-[#7A8FA8]/50 focus:outline-none focus:border-[#C9A84C]/40" />
            </div>
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7A8FA8]" />
              <select value={category} onChange={e => setCategory(e.target.value)}
                className="appearance-none bg-[#0D1929] border border-[#1B3050] rounded-xl pl-10 pr-8 py-2.5 text-sm text-[#F0ECE4] focus:outline-none focus:border-[#C9A84C]/40 min-w-[200px]">
                <option value="">Todas as categorias</option>
                {MARKETPLACE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7A8FA8] rotate-90 pointer-events-none" />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button onClick={() => setCategory("")}
              className={cn("px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                category === "" ? "bg-[#C9A84C] text-[#09081A]" : "bg-[#111F35] text-[#7A8FA8] hover:text-[#F0ECE4] border border-[#1B3050]")}>
              Todos
            </button>
            {MARKETPLACE_CATEGORIES.map(c => (
              <button key={c} onClick={() => setCategory(c === category ? "" : c)}
                className={cn("px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                  c === category ? "bg-[#C9A84C] text-[#09081A]" : "bg-[#111F35] text-[#7A8FA8] hover:text-[#F0ECE4] border border-[#1B3050]")}>
                {c}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-24"><Loader2 className="w-8 h-8 animate-spin text-[#C9A84C]" /></div>
          ) : products.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <ShoppingBag className="w-16 h-16 text-[#7A8FA8]/30 mb-4" />
              <p className="text-[#F0ECE4] font-semibold mb-1">Nenhum produto encontrado</p>
              <p className="text-[#7A8FA8] text-sm">{search || category ? "Tente outros filtros" : "Em breve novos produtos estarão disponíveis"}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {products.map(p => (
                <ProductCard key={p.id} product={p} favorites={favorites} onToggleFavorite={toggleFavorite} myLeadProductIds={myLeadProductIds} />
              ))}
            </div>
          )}
        </>
      )}

      {/* Favorites tab */}
      {tab === "favorites" && (
        favoriteProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <Heart className="w-16 h-16 text-[#7A8FA8]/30 mb-4" />
            <p className="text-[#F0ECE4] font-semibold mb-1">Nenhum favorito ainda</p>
            <p className="text-[#7A8FA8] text-sm">Clique no coração nos produtos do catálogo para favoritar</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {favoriteProducts.map(p => (
              <ProductCard key={p.id} product={p} favorites={favorites} onToggleFavorite={toggleFavorite} myLeadProductIds={myLeadProductIds} />
            ))}
          </div>
        )
      )}

      {/* Leads tab */}
      {tab === "leads" && (
        leads.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <TrendingUp className="w-16 h-16 text-[#7A8FA8]/30 mb-4" />
            <p className="text-[#F0ECE4] font-semibold mb-1">Nenhum lead ainda</p>
            <p className="text-[#7A8FA8] text-sm">Seus leads de interesse em produtos aparecem aqui</p>
          </div>
        ) : (
          <div className="space-y-3">
            {leads.map(lead => {
              const st = LEAD_STATUS_MAP[lead.status] ?? LEAD_STATUS_MAP.PENDING;
              const commRate = lead.product?.partner_commission_percent ?? lead.product?.commission_percent ?? 0;
              return (
                <div key={lead.id} className="bg-[#0D1929] border border-[#1B3050] rounded-xl p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-[#F0ECE4] font-semibold text-sm">{lead.product?.name ?? "Produto"}</p>
                        <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border", st.cls)}>
                          {st.label === "Convertido" ? <CheckCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                          {st.label}
                        </span>
                      </div>
                      <p className="text-[#7A8FA8] text-xs">{lead.supplier?.company_name} · {lead.product?.category}</p>
                      {commRate > 0 && <p className="text-[#C9A84C] text-xs font-semibold mt-0.5">{commRate}% comissão</p>}
                      {lead.client_name && <p className="text-[#7A8FA8] text-xs mt-1">Cliente: {lead.client_name}{lead.client_contact ? ` · ${lead.client_contact}` : ""}</p>}
                      {lead.message && <p className="text-[#F0ECE4] text-xs bg-[#111F35] rounded-lg px-3 py-2 mt-2 italic">&ldquo;{lead.message}&rdquo;</p>}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-[#7A8FA8] text-xs">{new Date(lead.created_at).toLocaleDateString("pt-BR")}</p>
                      {lead.product && (
                        <Link href={`/marketplace/${lead.product.id}`}
                          className="flex items-center gap-1 text-[#C9A84C] text-xs mt-1 hover:underline justify-end">
                          <Star className="w-3 h-3" />
                          Ver produto
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {selected && <QuickModal product={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
