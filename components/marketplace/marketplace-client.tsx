"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Search, ShoppingBag, TrendingUp, X,
  Send, Loader2, Package, Heart, Eye, ExternalLink, CheckCircle,
  Clock, Star, SlidersHorizontal, ArrowUpDown, Stethoscope,
  BrainCircuit, Cpu, Banknote, GraduationCap, Building2,
  Wheat, LayoutGrid, ChevronRight, Share2, Sparkles, Copy, Check,
  Trophy, MapPin, Building,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MARKETPLACE_CATEGORIES } from "@/lib/constants";
import { PartnerScoreBadge } from "@/components/marketplace/partner-score-badge";

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
  views?: number;
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

type TabId = "catalog" | "leads" | "favorites" | "suppliers";
type SortId = "commission" | "recent" | "price_asc" | "price_desc";

interface SupplierRanking {
  id: string;
  company_name: string;
  logo_url: string | null;
  city: string;
  state: string;
  products_count: number;
  categories: string[];
}

/* ── helpers ────────────────────────────────────────────── */
function fmtCurrency(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

function fmtCurrencyCompact(v: number) {
  if (v >= 1000) return `R$${(v / 1000).toFixed(0)}k`;
  return fmtCurrency(v);
}

function PriceLabel({ price, type, size = "sm" }: { price: number | null; type: string; size?: "sm" | "lg" }) {
  const cls = size === "lg" ? "text-base font-bold text-[#C9A84C]" : "text-sm font-bold text-[#C9A84C]";
  if (type === "ON_REQUEST") return <span className={cls}>Sob consulta</span>;
  if (type === "NEGOTIABLE") return <span className={cls}>Negociável{price ? ` a partir de ${fmtCurrency(price)}` : ""}</span>;
  if (price) return <span className={cls}>{fmtCurrency(price)}</span>;
  return null;
}

const LEAD_STATUS_MAP: Record<string, { label: string; cls: string }> = {
  NEW:         { label: "Novo",          cls: "bg-blue-500/10 text-blue-400 border-blue-500/30" },
  IN_PROGRESS: { label: "Em andamento",  cls: "bg-amber-500/10 text-amber-400 border-amber-500/30" },
  CONVERTED:   { label: "Convertido",    cls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" },
  LOST:        { label: "Perdido",       cls: "bg-red-500/10 text-red-400 border-red-500/30" },
  PENDING:     { label: "Aguardando",    cls: "bg-gray-500/10 text-gray-400 border-gray-500/30" },
};

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  "Equipamentos de Saúde": Stethoscope,
  "Mentoria & Consultoria": BrainCircuit,
  "Tecnologia & SaaS": Cpu,
  "Serviços Financeiros": Banknote,
  "Treinamentos & Cursos": GraduationCap,
  "Imóveis & Real Estate": Building2,
  "Agronegócio": Wheat,
  "Outros": LayoutGrid,
};

/* ── Product Card ────────────────────────────────────────── */
function ProductCard({ product, favorites, onToggleFavorite, myLeadProductIds, onQuickView }: {
  product: Product;
  favorites: Set<string>;
  onToggleFavorite: (id: string) => void;
  myLeadProductIds: Set<string>;
  onQuickView: (p: Product) => void;
}) {
  const commRate = product.partner_commission_percent ?? product.commission_percent ?? 0;
  const isFav = favorites.has(product.id);
  const hasLead = myLeadProductIds.has(product.id);
  const estimatedComm = product.price && product.price_type === "FIXED" ? product.price * commRate / 100 : null;
  const isHighComm = commRate >= 10;

  return (
    <div className="group relative bg-[#0D1929] border border-[#1B3050] rounded-2xl overflow-hidden hover:border-[#C9A84C]/50 transition-all duration-300 hover:shadow-[0_4px_32px_rgba(201,168,76,0.12)] flex flex-col">

      {/* Image */}
      <div className="relative h-48 bg-[#111F35] overflow-hidden flex-shrink-0">
        {product.images[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={product.images[0]} alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Package className="w-14 h-14 text-[#7A8FA8]/20" />
          </div>
        )}

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0D1929]/80 via-transparent to-transparent" />

        {/* Top badges */}
        <div className="absolute top-3 left-3 right-3 flex items-start justify-between gap-2">
          {/* Commission badge */}
          {commRate > 0 && (
            <div className={cn(
              "flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold backdrop-blur-sm",
              isHighComm
                ? "bg-[#C9A84C] text-[#09081A]"
                : "bg-[#09081A]/80 border border-[#C9A84C]/40 text-[#C9A84C]"
            )}>
              {isHighComm && <Star className="w-2.5 h-2.5 fill-[#09081A]" />}
              {commRate}% comissão
            </div>
          )}

          {/* Favorite */}
          <button
            onClick={e => { e.preventDefault(); onToggleFavorite(product.id); }}
            className={cn(
              "p-1.5 rounded-full border backdrop-blur-sm transition-all ml-auto",
              isFav
                ? "bg-red-500/30 border-red-500/50 text-red-400"
                : "bg-[#09081A]/60 border-white/10 text-white/50 hover:text-red-400 hover:border-red-500/40 opacity-0 group-hover:opacity-100"
            )}>
            <Heart className={cn("w-3.5 h-3.5", isFav && "fill-red-400")} />
          </button>
        </div>

        {/* Bottom: lead sent + quick view */}
        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
          {hasLead && (
            <span className="flex items-center gap-1 bg-emerald-500/20 border border-emerald-400/30 backdrop-blur-sm text-emerald-400 text-[9px] font-bold px-2 py-1 rounded-full">
              <CheckCircle className="w-2.5 h-2.5" />
              Lead enviado
            </span>
          )}
          <button
            onClick={() => onQuickView(product)}
            className="ml-auto flex items-center gap-1 bg-[#09081A]/70 border border-white/10 backdrop-blur-sm text-white/60 hover:text-[#C9A84C] hover:border-[#C9A84C]/40 text-[10px] font-semibold px-2.5 py-1 rounded-full transition-all opacity-0 group-hover:opacity-100">
            <Eye className="w-3 h-3" />
            Ver rápido
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="p-4 flex flex-col flex-1">
        {/* Category */}
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[9px] font-bold tracking-wider text-[#7A8FA8] uppercase bg-[#162744] px-2 py-0.5 rounded-full">
            {product.category}
          </span>
          {product.available_nationwide && (
            <span className="flex items-center gap-1 text-[9px] text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
              Nacional
            </span>
          )}
        </div>

        {/* Name */}
        <Link href={`/marketplace/${product.id}`}>
          <h3 className="text-[#F0ECE4] font-semibold text-sm leading-snug mb-1.5 line-clamp-2 group-hover:text-[#E8C97A] transition-colors">
            {product.name}
          </h3>
        </Link>

        {/* Description */}
        <p className="text-[#7A8FA8] text-xs leading-relaxed line-clamp-2 mb-3 flex-1">
          {product.description}
        </p>

        {/* Footer */}
        <div className="border-t border-[#1B3050] pt-3 mt-auto space-y-2">
          {/* Price row */}
          <div className="flex items-center justify-between">
            <PriceLabel price={product.price} type={product.price_type} />
            <span className="text-[#7A8FA8] text-[10px] truncate max-w-[120px] text-right">
              {product.supplier.company_name}
            </span>
          </div>

          {/* Earn estimate */}
          {estimatedComm !== null && estimatedComm > 0 && (
            <div className="flex items-center justify-between bg-[#C9A84C]/08 border border-[#C9A84C]/20 rounded-lg px-2.5 py-1.5">
              <span className="text-[10px] text-[#7A8FA8]">Você ganha por venda</span>
              <span className="text-[#C9A84C] text-xs font-bold">{fmtCurrencyCompact(estimatedComm)}</span>
            </div>
          )}

          {/* CTA + WhatsApp share */}
          <div className="flex gap-2">
            <button
              onClick={() => onQuickView(product)}
              className="flex-1 py-2 bg-[#C9A84C]/10 hover:bg-[#C9A84C]/20 border border-[#C9A84C]/30 text-[#C9A84C] rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5" />
              Quero vender
            </button>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(`Olá! Vi este produto no Marketplace V3 Partners e achei relevante para você:\n\n*${product.name}*\n${product.description.slice(0, 100)}...\n\nVeja mais: https://app.v3partners.com.br/marketplace/${product.id}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              title="Compartilhar no WhatsApp"
              className="p-2 bg-emerald-600/10 hover:bg-emerald-600/25 border border-emerald-600/30 text-emerald-400 rounded-xl transition-all flex items-center justify-center">
              <Share2 className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Quick Modal ─────────────────────────────────────────── */
function QuickModal({
  product,
  relatedProducts,
  onClose,
  onOpenProduct,
}: {
  product: Product;
  relatedProducts: Product[];
  onClose: () => void;
  onOpenProduct: (p: Product) => void;
}) {
  const [message, setMessage] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientContact, setClientContact] = useState("");
  const [saleValue, setSaleValue] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  // AI Proposal state
  const [showProposal, setShowProposal] = useState(false);
  const [proposalClientName, setProposalClientName] = useState("");
  const [proposalLoading, setProposalLoading] = useState(false);
  const [proposalResult, setProposalResult] = useState<string | null>(null);
  const [proposalCopied, setProposalCopied] = useState(false);

  const commRate = product.partner_commission_percent ?? product.commission_percent ?? 0;
  const estimatedCommission = saleValue && !isNaN(parseFloat(saleValue)) && parseFloat(saleValue) > 0 && commRate > 0
    ? parseFloat(saleValue) * commRate / 100
    : null;

  async function handleInteresse() {
    if (!clientName.trim()) { setError("Informe o nome do cliente antes de enviar."); return; }
    setSending(true); setError("");
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
    } finally { setSending(false); }
  }

  async function handleGenerateProposal() {
    if (!proposalClientName.trim()) return;
    setProposalLoading(true);
    setProposalResult(null);
    try {
      const res = await fetch("/api/marketplace/proposal-template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_id: product.id,
          client_name: proposalClientName,
        }),
      });
      if (!res.ok) throw new Error("Erro ao gerar proposta");
      const data = await res.json();
      setProposalResult(data.whatsapp_text ?? data.proposal_text ?? "");
    } catch {
      setProposalResult("Erro ao gerar proposta. Tente novamente.");
    } finally {
      setProposalLoading(false);
    }
  }

  function copyProposal() {
    if (!proposalResult) return;
    navigator.clipboard.writeText(proposalResult).then(() => {
      setProposalCopied(true);
      setTimeout(() => setProposalCopied(false), 2000);
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-0 sm:p-4">
      <div className="relative bg-[#09081A] border border-[#1B3050] rounded-t-3xl sm:rounded-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto">

        {/* Drag handle mobile */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 rounded-full bg-[#1B3050]" />
        </div>

        {/* Header */}
        <div className="sticky top-0 bg-[#09081A] border-b border-[#1B3050] px-5 py-4 flex items-start justify-between gap-3 z-10">
          <div>
            <p className="text-[9px] font-bold tracking-widest text-[#C9A84C] uppercase mb-0.5">{product.category}</p>
            <h2 className="text-[#F0ECE4] font-bold text-base leading-tight line-clamp-2">{product.name}</h2>
            <p className="text-[#7A8FA8] text-xs mt-0.5">{product.supplier.company_name}</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Link href={`/marketplace/${product.id}`}
              className="p-2 rounded-lg bg-[#111F35] border border-[#1B3050] text-[#7A8FA8] hover:text-[#C9A84C] transition-colors" title="Ver página completa">
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/5 text-[#7A8FA8] hover:text-[#F0ECE4] transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-5">
          {/* Image */}
          {product.images[0] && (
            <div className="rounded-xl overflow-hidden h-48">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover" />
            </div>
          )}

          {/* Price + commission */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#111F35] rounded-xl p-3.5 border border-[#1B3050]">
              <p className="text-[9px] text-[#7A8FA8] uppercase tracking-wider mb-1">Valor do produto</p>
              <PriceLabel price={product.price} type={product.price_type} size="lg" />
            </div>
            <div className="bg-[#C9A84C]/10 rounded-xl p-3.5 border border-[#C9A84C]/30">
              <p className="text-[9px] text-[#C9A84C] uppercase tracking-wider mb-1">Sua comissão</p>
              <p className="text-[#C9A84C] font-bold text-xl">{commRate > 0 ? `${commRate}%` : "A definir"}</p>
              {product.price && commRate > 0 && (
                <p className="text-[#7A8FA8] text-[10px] mt-0.5">≈ {fmtCurrency(product.price * commRate / 100)} / venda</p>
              )}
            </div>
          </div>

          {/* Commission calculator */}
          <div className="bg-[#0D1929] rounded-xl p-4 border border-[#1B3050]">
            <p className="text-[9px] font-bold text-[#C9A84C] uppercase tracking-wider mb-2.5">Calculadora de Comissão</p>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#7A8FA8] text-sm font-medium">R$</span>
              <input type="number" min="0" step="100"
                value={saleValue} onChange={e => setSaleValue(e.target.value)}
                placeholder="Valor estimado da venda"
                className="w-full bg-[#111F35] border border-[#1B3050] rounded-lg pl-9 pr-3 py-2.5 text-sm text-[#F0ECE4] focus:outline-none focus:border-[#C9A84C]/50 placeholder:text-[#7A8FA8]/40" />
            </div>
            {estimatedCommission !== null && (
              <div className="mt-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-3 py-2.5 flex items-center justify-between">
                <p className="text-[10px] text-emerald-400 uppercase tracking-wider">Você recebe</p>
                <p className="text-emerald-400 font-bold text-lg">{fmtCurrency(estimatedCommission)}</p>
              </div>
            )}
          </div>

          {/* Description */}
          <div>
            <p className="text-[9px] font-bold text-[#C9A84C] uppercase tracking-wider mb-2">Descrição</p>
            <p className="text-[#7A8FA8] text-sm leading-relaxed">{product.description}</p>
          </div>

          {/* AI Proposal — Feature 4 */}
          <div className="bg-[#0D1929] rounded-xl border border-[#243A66] overflow-hidden">
            <button
              onClick={() => setShowProposal(v => !v)}
              className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-white/5 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-[#C9A84C]" />
                <span className="text-xs font-semibold text-[#C9A84C]">Gerar proposta com IA</span>
              </div>
              <ChevronRight className={cn("w-3.5 h-3.5 text-[#7A8FA8] transition-transform", showProposal && "rotate-90")} />
            </button>

            {showProposal && (
              <div className="px-4 pb-4 space-y-3 border-t border-[#243A66]">
                <div className="pt-3 flex gap-2">
                  <input
                    value={proposalClientName}
                    onChange={e => setProposalClientName(e.target.value)}
                    placeholder="Nome do cliente"
                    className="flex-1 bg-[#111F35] border border-[#1B3050] rounded-lg px-3 py-2 text-sm text-[#F0ECE4] placeholder:text-[#7A8FA8]/50 focus:outline-none focus:border-[#C9A84C]/50"
                  />
                  <button
                    onClick={handleGenerateProposal}
                    disabled={proposalLoading || !proposalClientName.trim()}
                    className="flex items-center gap-1.5 px-3 py-2 bg-[#C9A84C]/10 hover:bg-[#C9A84C]/20 border border-[#C9A84C]/40 text-[#C9A84C] rounded-lg text-xs font-bold transition-all disabled:opacity-40"
                  >
                    {proposalLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                    {proposalLoading ? "Gerando..." : "Gerar"}
                  </button>
                </div>

                {proposalResult && (
                  <div className="bg-[#111F35] border border-[#1B3050] rounded-lg p-3 relative">
                    <p className="text-[#7A8FA8] text-xs leading-relaxed whitespace-pre-line pr-8">{proposalResult}</p>
                    <button
                      onClick={copyProposal}
                      title="Copiar texto"
                      className="absolute top-2.5 right-2.5 p-1.5 rounded-lg bg-[#162744] hover:bg-[#243A66] text-[#7A8FA8] hover:text-[#C9A84C] transition-colors"
                    >
                      {proposalCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Related Products — Feature 5 */}
          {relatedProducts.length > 0 && (
            <div>
              <p className="text-[9px] font-bold text-[#C9A84C] uppercase tracking-wider mb-2">Produtos relacionados</p>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {relatedProducts.slice(0, 3).map(rp => (
                  <button
                    key={rp.id}
                    onClick={() => { onOpenProduct(rp); }}
                    className="flex-shrink-0 w-40 bg-[#111F35] border border-[#1B3050] rounded-xl p-2.5 text-left hover:border-[#C9A84C]/40 transition-all"
                  >
                    <p className="text-xs font-semibold text-[#F0ECE4] line-clamp-2 mb-1">{rp.name}</p>
                    <span className="text-[10px] font-bold text-[#C9A84C]">
                      {rp.partner_commission_percent ?? rp.commission_percent}% comissão
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Lead form */}
          {!sent ? (
            <div className="bg-[#0D1929] rounded-xl p-4 border border-[#C9A84C]/20 space-y-3">
              <p className="text-[9px] font-bold text-[#C9A84C] uppercase tracking-wider flex items-center gap-2">
                <TrendingUp className="w-3.5 h-3.5" />
                Enviar cliente para este produto
              </p>
              <div className="space-y-2.5">
                <div>
                  <input value={clientName} onChange={e => setClientName(e.target.value)}
                    placeholder="Nome do cliente *"
                    className="w-full bg-[#111F35] border border-[#C9A84C]/30 rounded-lg px-3 py-2.5 text-sm text-[#F0ECE4] placeholder:text-[#7A8FA8]/50 focus:outline-none focus:border-[#C9A84C]/60" />
                  <p className="text-[10px] text-[#7A8FA8] mt-1">Obrigatório — identifica seu lead</p>
                </div>
                <input value={clientContact} onChange={e => setClientContact(e.target.value)}
                  placeholder="WhatsApp ou e-mail do cliente (opcional)"
                  className="w-full bg-[#111F35] border border-[#1B3050] rounded-lg px-3 py-2.5 text-sm text-[#F0ECE4] placeholder:text-[#7A8FA8]/50 focus:outline-none focus:border-[#C9A84C]/50" />
                <textarea value={message} onChange={e => setMessage(e.target.value)}
                  placeholder="Contexto para o fornecedor (opcional)" rows={2}
                  className="w-full bg-[#111F35] border border-[#1B3050] rounded-lg px-3 py-2.5 text-sm text-[#F0ECE4] placeholder:text-[#7A8FA8]/50 focus:outline-none focus:border-[#C9A84C]/50 resize-none" />
                {error && <p className="text-red-400 text-xs">{error}</p>}
                <button onClick={handleInteresse} disabled={sending}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-[#C9A84C] hover:bg-[#E8C97A] text-[#09081A] font-bold rounded-xl text-sm transition-colors disabled:opacity-50">
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  {sending ? "Enviando..." : "Enviar Lead"}
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-5 text-center">
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-3">
                <CheckCircle className="w-6 h-6 text-emerald-400" />
              </div>
              <p className="text-emerald-400 font-bold">Lead registrado com sucesso!</p>
              <p className="text-[#7A8FA8] text-xs mt-1">O fornecedor será notificado e entrará em contato.</p>
              <div className="flex flex-col items-center gap-2 mt-4">
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(`Olá! Registrei seu interesse no produto *${product.name}*.\n\nUm especialista V3 Partners vai entrar em contato em breve para apresentar os detalhes.\n\nAcesse: https://app.v3partners.com.br/marketplace/${product.id}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors w-full justify-center">
                  <Share2 className="w-3.5 h-3.5" />
                  Avisar o cliente via WhatsApp
                </a>
                <Link href={`/marketplace/${product.id}`}
                  className="inline-flex items-center gap-1.5 text-[#C9A84C] text-xs hover:underline">
                  <ExternalLink className="w-3 h-3" />
                  Ver página completa do produto
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Category Pill ──────────────────────────────────────── */
function CategoryPill({ cat, active, onClick }: { cat: string; active: boolean; onClick: () => void }) {
  const Icon = CATEGORY_ICONS[cat] ?? LayoutGrid;
  return (
    <button onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-1.5 px-4 py-3 rounded-2xl border text-xs font-semibold transition-all flex-shrink-0 min-w-[88px]",
        active
          ? "bg-[#C9A84C] border-[#C9A84C] text-[#09081A]"
          : "bg-[#0D1929] border-[#1B3050] text-[#7A8FA8] hover:border-[#C9A84C]/40 hover:text-[#F0ECE4]"
      )}>
      <Icon className="w-5 h-5" />
      <span className="text-center leading-tight text-[10px]">{cat.split(" & ")[0]}</span>
    </button>
  );
}

/* ── Suppliers Tab ──────────────────────────────────────── */
function SuppliersTab() {
  const [suppliers, setSuppliers] = useState<SupplierRanking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/marketplace/suppliers/ranking")
      .then(r => r.json())
      .then(j => setSuppliers(j.suppliers ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-[#C9A84C]" />
      </div>
    );
  }

  if (!suppliers.length) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="w-20 h-20 rounded-2xl bg-[#0D1929] border border-[#1B3050] flex items-center justify-center mb-5">
          <Building className="w-10 h-10 text-[#7A8FA8]/30" />
        </div>
        <p className="text-[#F0ECE4] font-semibold mb-1">Nenhum fornecedor disponível</p>
        <p className="text-[#7A8FA8] text-sm">Em breve novos fornecedores serão aprovados</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-[#7A8FA8] text-sm">
        <span className="text-[#F0ECE4] font-semibold">{suppliers.length}</span> fornecedor{suppliers.length !== 1 ? "es" : ""} ativo{suppliers.length !== 1 ? "s" : ""}
      </p>

      <div className="bg-[#0D1929] border border-[#1B3050] rounded-2xl overflow-hidden">
        {/* Table header */}
        <div className="grid grid-cols-[32px_1fr_auto_auto] gap-3 px-4 py-3 border-b border-[#1B3050]">
          <span className="text-[9px] font-bold text-[#7A8FA8] uppercase tracking-wider">#</span>
          <span className="text-[9px] font-bold text-[#7A8FA8] uppercase tracking-wider">Fornecedor</span>
          <span className="text-[9px] font-bold text-[#7A8FA8] uppercase tracking-wider text-center">Produtos</span>
          <span className="text-[9px] font-bold text-[#7A8FA8] uppercase tracking-wider text-right">Ação</span>
        </div>

        {/* Rows */}
        {suppliers.map((s, i) => {
          const initials = s.company_name
            .split(" ")
            .slice(0, 2)
            .map(w => w[0])
            .join("")
            .toUpperCase();

          const rankStyle =
            i === 0 ? "text-[#C9A84C] font-black" :
            i === 1 ? "text-[#7A8FA8] font-bold" :
            i === 2 ? "text-amber-700 font-bold" :
            "text-[#7A8FA8]/50 font-semibold";

          return (
            <div
              key={s.id}
              className="grid grid-cols-[32px_1fr_auto_auto] gap-3 px-4 py-3.5 border-b border-[#111F35] last:border-0 hover:bg-white/[0.02] transition-colors items-center"
            >
              {/* Rank */}
              <span className={cn("text-sm text-center", rankStyle)}>
                {i === 0 ? <Trophy className="w-4 h-4 inline" /> : i + 1}
              </span>

              {/* Company info */}
              <div className="flex items-center gap-3 min-w-0">
                {s.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.logo_url} alt={s.company_name} className="w-9 h-9 rounded-xl object-cover flex-shrink-0" />
                ) : (
                  <div className="w-9 h-9 rounded-xl bg-[#162744] border border-[#243A66] flex items-center justify-center flex-shrink-0">
                    <span className="text-[#C9A84C] text-xs font-bold">{initials}</span>
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-[#F0ECE4] font-semibold text-sm truncate">{s.company_name}</p>
                  {(s.city || s.state) && (
                    <p className="text-[#7A8FA8] text-xs flex items-center gap-1">
                      <MapPin className="w-2.5 h-2.5 flex-shrink-0" />
                      {[s.city, s.state].filter(Boolean).join(", ")}
                    </p>
                  )}
                  {s.categories?.length > 0 && (
                    <p className="text-[#7A8FA8] text-[10px] mt-0.5 truncate">
                      {s.categories.slice(0, 2).join(" · ")}
                    </p>
                  )}
                </div>
              </div>

              {/* Products count */}
              <div className="text-center">
                <span className="text-[#C9A84C] font-bold text-base">{s.products_count}</span>
                <p className="text-[#7A8FA8] text-[9px]">produtos</p>
              </div>

              {/* CTA */}
              <div className="text-right">
                <Link
                  href={`/marketplace/fornecedor/${s.id}`}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#162744] hover:bg-[#243A66] border border-[#243A66] hover:border-[#C9A84C]/30 text-[#F0ECE4] hover:text-[#C9A84C] rounded-lg text-xs font-semibold transition-all"
                >
                  <Eye className="w-3 h-3" />
                  Vitrine
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Main Component ─────────────────────────────────────── */
export function MarketplaceClient() {
  const [tab, setTab] = useState<TabId>("catalog");
  const [products, setProducts] = useState<Product[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState<SortId>("recent");
  const [selected, setSelected] = useState<Product | null>(null);
  const [showSortMenu, setShowSortMenu] = useState(false);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (category) params.set("category", category);
      const res = await fetch(`/api/marketplace/products?${params}`);
      const j = await res.json();
      setProducts(j.products ?? []);
    } finally { setLoading(false); }
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

  /* ── Derived data ─────────────────────────── */
  const myLeadProductIds = new Set(leads.map(l => l.product?.id).filter(Boolean) as string[]);
  const convertedLeads = leads.filter(l => l.status === "CONVERTED").length;
  const favoriteProducts = products.filter(p => favorites.has(p.id));
  const maxComm = products.length ? Math.max(...products.map(p => p.partner_commission_percent ?? p.commission_percent)) : 0;

  const sortedProducts = [...products].sort((a, b) => {
    const ra = a.partner_commission_percent ?? a.commission_percent;
    const rb = b.partner_commission_percent ?? b.commission_percent;
    if (sort === "commission") return rb - ra;
    if (sort === "price_asc") return (a.price ?? 0) - (b.price ?? 0);
    if (sort === "price_desc") return (b.price ?? 0) - (a.price ?? 0);
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  // Featured products: top 3 by views DESC, fallback to first 3 APPROVED
  const featuredProducts = [...products]
    .sort((a, b) => (b.views ?? 0) - (a.views ?? 0))
    .slice(0, 3);

  const SORT_LABELS: Record<SortId, string> = {
    commission: "Maior comissão",
    recent: "Mais recente",
    price_asc: "Menor preço",
    price_desc: "Maior preço",
  };

  // Related products for QuickModal
  const relatedProducts = selected
    ? products.filter(p => p.category === selected.category && p.id !== selected.id)
    : [];

  return (
    <div className="min-h-screen bg-[#09081A]">

      {/* ── Hero Banner ──────────────────────────────────── */}
      <div className="relative overflow-hidden bg-gradient-to-br from-[#111F35] via-[#0D1929] to-[#09081A] border-b border-[#1B3050]">
        {/* Decorative glow */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#C9A84C]/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-[#C9A84C]/3 rounded-full blur-3xl pointer-events-none" />

        <div className="relative px-6 pt-8 pb-7 max-w-4xl">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-xl bg-[#C9A84C]/15 flex items-center justify-center">
              <ShoppingBag className="w-4 h-4 text-[#C9A84C]" />
            </div>
            <span className="text-[9px] font-bold tracking-widest text-[#C9A84C] uppercase">V3 Marketplace</span>
          </div>

          <h1 className="text-3xl font-bold text-[#F0ECE4] leading-tight mb-2">
            Ganhe comissão vendendo<br />
            <span className="text-[#C9A84C]">produtos financeiros</span>
          </h1>
          <p className="text-[#7A8FA8] text-sm max-w-lg">
            Encontre produtos para oferecer aos seus clientes e receba comissão em cada negócio fechado.
          </p>

          {/* Search bar */}
          <div className="relative mt-5 max-w-xl">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7A8FA8]" />
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Buscar produtos, categorias, fornecedores..."
              className="w-full bg-[#111F35] border border-[#243A66] rounded-2xl pl-11 pr-4 py-3.5 text-sm text-[#F0ECE4] placeholder:text-[#7A8FA8]/50 focus:outline-none focus:border-[#C9A84C]/60 transition-colors"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#7A8FA8] hover:text-[#F0ECE4]">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="px-6 py-6 space-y-6">

        {/* ── Partner Stats ─────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            {
              label: "Produtos disponíveis",
              value: products.length.toString(),
              icon: Package,
              color: "text-[#C9A84C]",
              bg: "bg-[#C9A84C]/10 border-[#C9A84C]/20",
            },
            {
              label: "Maior comissão",
              value: maxComm > 0 ? `${maxComm}%` : "—",
              icon: TrendingUp,
              color: "text-emerald-400",
              bg: "bg-emerald-500/10 border-emerald-500/20",
            },
            {
              label: "Leads enviados",
              value: leads.length.toString(),
              icon: Send,
              color: "text-blue-400",
              bg: "bg-blue-500/10 border-blue-500/20",
            },
            {
              label: "Convertidos",
              value: convertedLeads.toString(),
              icon: CheckCircle,
              color: "text-emerald-400",
              bg: "bg-emerald-500/10 border-emerald-500/20",
            },
          ].map(({ label, value, icon: Icon, color, bg }) => (
            <div key={label} className={cn("rounded-2xl border p-4 flex items-center gap-3", bg)}>
              <div className={cn("w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center flex-shrink-0", color)}>
                <Icon className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[9px] text-[#7A8FA8] uppercase tracking-wider leading-none mb-1">{label}</p>
                <p className={cn("text-xl font-bold leading-none", color)}>{value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── Tabs ──────────────────────────────────────── */}
        <div className="flex gap-2 flex-wrap">
          {([
            { id: "catalog" as TabId, label: "Catálogo", icon: ShoppingBag },
            { id: "favorites" as TabId, label: `Favoritos${favorites.size > 0 ? ` (${favorites.size})` : ""}`, icon: Heart },
            { id: "leads" as TabId, label: `Meus Leads${leads.length > 0 ? ` (${leads.length})` : ""}`, icon: TrendingUp },
            { id: "suppliers" as TabId, label: "Fornecedores", icon: Building },
          ]).map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setTab(id)}
              className={cn(
                "flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all",
                tab === id
                  ? "bg-[#C9A84C] text-[#09081A] shadow-[0_0_20px_rgba(201,168,76,0.2)]"
                  : "bg-[#0D1929] border border-[#1B3050] text-[#7A8FA8] hover:text-[#F0ECE4] hover:border-[#243A66]"
              )}>
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {/* ── Catalog Tab ───────────────────────────────── */}
        {tab === "catalog" && (
          <>
            {/* Category pills — horizontal scroll */}
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
              <button
                onClick={() => setCategory("")}
                className={cn(
                  "flex flex-col items-center gap-1.5 px-4 py-3 rounded-2xl border text-xs font-semibold transition-all flex-shrink-0 min-w-[88px]",
                  category === ""
                    ? "bg-[#C9A84C] border-[#C9A84C] text-[#09081A]"
                    : "bg-[#0D1929] border-[#1B3050] text-[#7A8FA8] hover:border-[#C9A84C]/40 hover:text-[#F0ECE4]"
                )}>
                <LayoutGrid className="w-5 h-5" />
                <span className="text-[10px]">Todos</span>
              </button>
              {MARKETPLACE_CATEGORIES.map(c => (
                <CategoryPill key={c} cat={c} active={c === category} onClick={() => setCategory(c === category ? "" : c)} />
              ))}
            </div>

            {/* Featured products — Feature 6A */}
            {!loading && featuredProducts.length > 0 && !search && !category && (
              <div>
                <p className="text-xs font-bold text-[#C9A84C] uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Star className="w-3.5 h-3.5 fill-[#C9A84C]" />
                  Em Destaque
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-2">
                  {featuredProducts.map(p => {
                    const commRate = p.partner_commission_percent ?? p.commission_percent ?? 0;
                    return (
                      <div
                        key={p.id}
                        className="group relative bg-[#0D1929] border-2 border-[#C9A84C]/30 rounded-2xl overflow-hidden hover:border-[#C9A84C]/60 transition-all cursor-pointer"
                        onClick={() => setSelected(p)}
                      >
                        {/* Image */}
                        <div className="relative h-40 bg-[#111F35] overflow-hidden">
                          {p.images[0] ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={p.images[0]} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Package className="w-10 h-10 text-[#7A8FA8]/20" />
                            </div>
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-[#0D1929]/80 via-transparent to-transparent" />

                          {/* Destaque badge */}
                          <div className="absolute top-2.5 left-2.5 flex items-center gap-1 bg-[#C9A84C] text-[#09081A] text-[9px] font-black px-2 py-0.5 rounded-full">
                            <Star className="w-2.5 h-2.5 fill-[#09081A]" />
                            DESTAQUE
                          </div>
                        </div>

                        <div className="p-3">
                          <p className="text-[#F0ECE4] font-semibold text-sm leading-snug line-clamp-2 mb-1.5 group-hover:text-[#E8C97A] transition-colors">
                            {p.name}
                          </p>
                          <div className="flex items-center justify-between">
                            <span className="text-[#C9A84C] text-xs font-bold">{commRate}% comissão</span>
                            <span className="text-[9px] text-[#7A8FA8]">{p.supplier.company_name}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Sort + result count */}
            <div className="flex items-center justify-between">
              <p className="text-[#7A8FA8] text-sm">
                {loading ? "Carregando..." : (
                  <>
                    <span className="text-[#F0ECE4] font-semibold">{sortedProducts.length}</span>
                    {" "}produto{sortedProducts.length !== 1 ? "s" : ""}
                    {category && <> em <span className="text-[#C9A84C]">{category}</span></>}
                    {search && <> para <span className="text-[#C9A84C]">&quot;{search}&quot;</span></>}
                  </>
                )}
              </p>
              <div className="relative">
                <button
                  onClick={() => setShowSortMenu(v => !v)}
                  className="flex items-center gap-2 px-3 py-2 bg-[#0D1929] border border-[#1B3050] rounded-xl text-xs text-[#7A8FA8] hover:text-[#F0ECE4] hover:border-[#243A66] transition-colors">
                  <ArrowUpDown className="w-3.5 h-3.5" />
                  {SORT_LABELS[sort]}
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                </button>
                {showSortMenu && (
                  <div className="absolute right-0 top-full mt-1.5 bg-[#0D1929] border border-[#1B3050] rounded-xl overflow-hidden z-30 w-48 shadow-xl">
                    {(Object.entries(SORT_LABELS) as [SortId, string][]).map(([k, v]) => (
                      <button key={k}
                        onClick={() => { setSort(k); setShowSortMenu(false); }}
                        className={cn(
                          "w-full text-left px-4 py-2.5 text-xs transition-colors",
                          sort === k
                            ? "text-[#C9A84C] bg-[#C9A84C]/10 font-semibold"
                            : "text-[#7A8FA8] hover:text-[#F0ECE4] hover:bg-white/5"
                        )}>
                        {v}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Grid */}
            {loading ? (
              <div className="flex items-center justify-center py-24">
                <Loader2 className="w-8 h-8 animate-spin text-[#C9A84C]" />
              </div>
            ) : sortedProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <div className="w-20 h-20 rounded-2xl bg-[#0D1929] border border-[#1B3050] flex items-center justify-center mb-5">
                  <ShoppingBag className="w-10 h-10 text-[#7A8FA8]/30" />
                </div>
                <p className="text-[#F0ECE4] font-semibold mb-1">Nenhum produto encontrado</p>
                <p className="text-[#7A8FA8] text-sm">
                  {search || category ? "Tente outros filtros" : "Em breve novos produtos estarão disponíveis"}
                </p>
                {(search || category) && (
                  <button onClick={() => { setSearch(""); setCategory(""); }}
                    className="mt-4 px-4 py-2 bg-[#C9A84C]/10 border border-[#C9A84C]/30 text-[#C9A84C] rounded-xl text-xs font-semibold hover:bg-[#C9A84C]/20 transition-colors">
                    Limpar filtros
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {sortedProducts.map(p => (
                  <ProductCard key={p.id} product={p} favorites={favorites}
                    onToggleFavorite={toggleFavorite}
                    myLeadProductIds={myLeadProductIds}
                    onQuickView={setSelected} />
                ))}
              </div>
            )}
          </>
        )}

        {/* ── Favorites Tab ─────────────────────────────── */}
        {tab === "favorites" && (
          favoriteProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="w-20 h-20 rounded-2xl bg-[#0D1929] border border-[#1B3050] flex items-center justify-center mb-5">
                <Heart className="w-10 h-10 text-[#7A8FA8]/30" />
              </div>
              <p className="text-[#F0ECE4] font-semibold mb-1">Nenhum favorito ainda</p>
              <p className="text-[#7A8FA8] text-sm">Clique no coração nos produtos para favoritar</p>
              <button onClick={() => setTab("catalog")}
                className="mt-4 flex items-center gap-2 px-4 py-2 bg-[#C9A84C]/10 border border-[#C9A84C]/30 text-[#C9A84C] rounded-xl text-xs font-semibold hover:bg-[#C9A84C]/20 transition-colors">
                <ShoppingBag className="w-3.5 h-3.5" />
                Explorar catálogo
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {favoriteProducts.map(p => (
                <ProductCard key={p.id} product={p} favorites={favorites}
                  onToggleFavorite={toggleFavorite}
                  myLeadProductIds={myLeadProductIds}
                  onQuickView={setSelected} />
              ))}
            </div>
          )
        )}

        {/* ── Leads Tab ─────────────────────────────────── */}
        {tab === "leads" && (
          leads.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="w-20 h-20 rounded-2xl bg-[#0D1929] border border-[#1B3050] flex items-center justify-center mb-5">
                <TrendingUp className="w-10 h-10 text-[#7A8FA8]/30" />
              </div>
              <p className="text-[#F0ECE4] font-semibold mb-1">Nenhum lead ainda</p>
              <p className="text-[#7A8FA8] text-sm">Abra um produto e clique em &quot;Quero vender&quot; para enviar seu primeiro lead</p>
              <button onClick={() => setTab("catalog")}
                className="mt-4 flex items-center gap-2 px-4 py-2 bg-[#C9A84C]/10 border border-[#C9A84C]/30 text-[#C9A84C] rounded-xl text-xs font-semibold hover:bg-[#C9A84C]/20 transition-colors">
                <ShoppingBag className="w-3.5 h-3.5" />
                Ver catálogo
              </button>
            </div>
          ) : (
            <>
              {/* Summary cards */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Total enviados", value: leads.length, cls: "text-[#F0ECE4]", bg: "bg-[#0D1929] border-[#1B3050]" },
                  { label: "Convertidos", value: convertedLeads, cls: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
                  {
                    label: "Taxa",
                    value: leads.length ? `${Math.round(convertedLeads / leads.length * 100)}%` : "—",
                    cls: "text-[#C9A84C]",
                    bg: "bg-[#C9A84C]/10 border-[#C9A84C]/20"
                  },
                ].map(({ label, value, cls, bg }) => (
                  <div key={label} className={cn("rounded-2xl border p-4 text-center", bg)}>
                    <p className="text-[9px] text-[#7A8FA8] uppercase tracking-wider mb-1.5">{label}</p>
                    <p className={cn("text-2xl font-bold", cls)}>{value}</p>
                  </div>
                ))}
              </div>

              <div className="space-y-3">
                {leads.map(lead => {
                  const st = LEAD_STATUS_MAP[lead.status] ?? LEAD_STATUS_MAP.PENDING;
                  const commRate = lead.product?.partner_commission_percent ?? lead.product?.commission_percent ?? 0;
                  return (
                    <div key={lead.id} className="bg-[#0D1929] border border-[#1B3050] rounded-2xl p-4 hover:border-[#243A66] transition-colors">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <p className="text-[#F0ECE4] font-semibold text-sm">{lead.product?.name ?? "Produto"}</p>
                            <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border", st.cls)}>
                              {lead.status === "CONVERTED" ? <CheckCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                              {st.label}
                            </span>
                          </div>
                          <p className="text-[#7A8FA8] text-xs">{lead.supplier?.company_name} · {lead.product?.category}</p>
                          {commRate > 0 && (
                            <p className="text-[#C9A84C] text-xs font-semibold mt-0.5">{commRate}% comissão</p>
                          )}
                          {lead.client_name && (
                            <p className="text-[#7A8FA8] text-xs mt-1">
                              Cliente: <span className="text-[#F0ECE4]">{lead.client_name}</span>
                              {lead.client_contact && <> · {lead.client_contact}</>}
                            </p>
                          )}
                          {lead.message && (
                            <p className="text-[#F0ECE4] text-xs bg-[#111F35] rounded-lg px-3 py-2 mt-2 italic border border-[#1B3050]">
                              &ldquo;{lead.message}&rdquo;
                            </p>
                          )}
                        </div>
                        <div className="text-right flex-shrink-0 space-y-1">
                          <p className="text-[#7A8FA8] text-xs">{new Date(lead.created_at).toLocaleDateString("pt-BR")}</p>
                          {lead.product && (
                            <Link href={`/marketplace/${lead.product.id}`}
                              className="flex items-center gap-1 text-[#C9A84C] text-xs hover:underline justify-end">
                              <ChevronRight className="w-3 h-3" />
                              Ver produto
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )
        )}

        {/* ── Suppliers Tab — Feature 6B ─────────────────── */}
        {tab === "suppliers" && <SuppliersTab />}
      </div>

      {selected && (
        <QuickModal
          product={selected}
          relatedProducts={relatedProducts}
          onClose={() => setSelected(null)}
          onOpenProduct={(p) => setSelected(p)}
        />
      )}
    </div>
  );
}
