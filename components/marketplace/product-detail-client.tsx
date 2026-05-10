"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft, Package, MapPin, Globe, Star, TrendingUp,
  Send, Loader2, Heart, Eye, CheckCircle, ChevronLeft, ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ProductDetail {
  id: string;
  name: string;
  description: string;
  category: string;
  price: number | null;
  price_type: string;
  commission_percent: number;
  partner_commission_percent: number | null;
  images: string[];
  specs: Record<string, string>;
  min_order: number | null;
  delivery_days: number | null;
  available_nationwide: boolean;
  states: string[];
  status: string;
  views: number;
  supplier: {
    id: string;
    company_name: string;
    logo_url: string | null;
    city: string;
    state: string;
    description: string;
    website: string | null;
    categories: string[];
  };
}

interface Review {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  partner: { full_name: string } | null;
}

function fmtCurrency(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

function StarRating({ rating, onRate }: { rating: number; onRate?: (r: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(i => (
        <button
          key={i}
          type="button"
          onClick={() => onRate?.(i)}
          onMouseEnter={() => onRate && setHover(i)}
          onMouseLeave={() => onRate && setHover(0)}
          className={cn("transition-colors", onRate ? "cursor-pointer" : "cursor-default")}
        >
          <Star
            className={cn("w-4 h-4", (hover || rating) >= i ? "text-[#C9A84C] fill-[#C9A84C]" : "text-[#7A8FA8]")}
          />
        </button>
      ))}
    </div>
  );
}

export function ProductDetailClient({ productId }: { productId: string }) {
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFavorite, setIsFavorite] = useState(false);
  const [imgIdx, setImgIdx] = useState(0);

  // Interest form
  const [clientName, setClientName] = useState("");
  const [clientContact, setClientContact] = useState("");
  const [message, setMessage] = useState("");
  const [saleValue, setSaleValue] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [sendError, setSendError] = useState("");

  // Review form
  const [myRating, setMyRating] = useState(0);
  const [myComment, setMyComment] = useState("");
  const [savingReview, setSavingReview] = useState(false);
  const [reviewDone, setReviewDone] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [prodRes, favRes, revRes] = await Promise.all([
        fetch(`/api/marketplace/products/${productId}`),
        fetch("/api/marketplace/favorites"),
        fetch(`/api/marketplace/reviews?product_id=${productId}`),
      ]);
      const p = await prodRes.json();
      const f = await favRes.json();
      const r = await revRes.json();
      if (p.product) setProduct(p.product);
      setIsFavorite((f.favorites ?? []).includes(productId));
      setReviews(r.reviews ?? []);
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => { load(); }, [load]);

  async function toggleFavorite() {
    const method = isFavorite ? "DELETE" : "POST";
    await fetch("/api/marketplace/favorites", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product_id: productId }),
    });
    setIsFavorite(!isFavorite);
  }

  async function handleInteresse() {
    setSending(true);
    setSendError("");
    try {
      const res = await fetch("/api/marketplace/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_id: productId, message, client_name: clientName, client_contact: clientContact }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Erro ao enviar");
      setSent(true);
    } catch (e: unknown) {
      setSendError(e instanceof Error ? e.message : "Erro ao enviar interesse");
    } finally {
      setSending(false);
    }
  }

  async function handleReview() {
    if (!myRating) return;
    setSavingReview(true);
    try {
      await fetch("/api/marketplace/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_id: productId, rating: myRating, comment: myComment }),
      });
      setReviewDone(true);
      load();
    } finally {
      setSavingReview(false);
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen bg-[#09081A]">
      <Loader2 className="w-8 h-8 animate-spin text-[#C9A84C]" />
    </div>
  );

  if (!product) return (
    <div className="flex items-center justify-center min-h-screen bg-[#09081A]">
      <div className="text-center space-y-4">
        <Package className="w-16 h-16 text-[#7A8FA8]/30 mx-auto" />
        <p className="text-[#F0ECE4]">Produto não encontrado</p>
        <Link href="/marketplace" className="text-[#C9A84C] underline text-sm">Voltar ao Marketplace</Link>
      </div>
    </div>
  );

  const commissionRate = product.partner_commission_percent ?? product.commission_percent;
  const estimatedCommission = saleValue && !isNaN(parseFloat(saleValue))
    ? parseFloat(saleValue) * commissionRate / 100
    : null;

  const avgRating = reviews.length
    ? Math.round(reviews.reduce((a, r) => a + r.rating, 0) / reviews.length * 10) / 10
    : null;

  const visibleSpecs = Object.entries(product.specs ?? {}).filter(([k]) => !k.startsWith("_anexo_"));
  const attachments: { url: string; name: string }[] = [];
  Object.entries(product.specs ?? {}).forEach(([k, v]) => {
    if (k.startsWith("_anexo_") && !k.endsWith("_nome")) {
      const nameKey = `${k}_nome`;
      attachments.push({ url: v, name: product.specs[nameKey] ?? "Documento" });
    }
  });

  return (
    <div className="min-h-screen bg-[#09081A]">
      {/* Top nav */}
      <div className="border-b border-[#1B3050] bg-[#0D1929] px-6 py-4 flex items-center gap-4">
        <Link href="/marketplace" className="p-2 rounded-lg bg-[#111F35] border border-[#1B3050] text-[#7A8FA8] hover:text-[#F0ECE4] transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex-1">
          <p className="text-[10px] font-bold tracking-widest text-[#C9A84C] uppercase">{product.category}</p>
          <h1 className="text-[#F0ECE4] font-bold text-lg leading-tight">{product.name}</h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-[#7A8FA8] text-xs">
            <Eye className="w-3.5 h-3.5" />
            {product.views ?? 0}
          </div>
          <button onClick={toggleFavorite}
            className={cn("p-2 rounded-lg border transition-all",
              isFavorite
                ? "bg-red-500/20 border-red-500/40 text-red-400"
                : "bg-[#111F35] border-[#1B3050] text-[#7A8FA8] hover:text-red-400"
            )}>
            <Heart className={cn("w-4 h-4", isFavorite && "fill-red-400")} />
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left col */}
        <div className="lg:col-span-2 space-y-6">
          {/* Image gallery */}
          {product.images.length > 0 && (
            <div className="relative rounded-2xl overflow-hidden bg-[#111F35] aspect-video">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={product.images[imgIdx]} alt={product.name} className="w-full h-full object-cover" />
              {product.images.length > 1 && (
                <>
                  <button onClick={() => setImgIdx(i => (i - 1 + product.images.length) % product.images.length)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 p-2 bg-black/60 rounded-full text-white hover:bg-black/80">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button onClick={() => setImgIdx(i => (i + 1) % product.images.length)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-black/60 rounded-full text-white hover:bg-black/80">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                    {product.images.map((_, i) => (
                      <button key={i} onClick={() => setImgIdx(i)}
                        className={cn("w-2 h-2 rounded-full transition-all", i === imgIdx ? "bg-[#C9A84C]" : "bg-white/40")} />
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Thumbnails */}
          {product.images.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {product.images.map((img, i) => (
                <button key={i} onClick={() => setImgIdx(i)}
                  className={cn("w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 border-2 transition-all",
                    i === imgIdx ? "border-[#C9A84C]" : "border-[#1B3050]")}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}

          {/* Description */}
          <div className="bg-[#0D1929] border border-[#1B3050] rounded-xl p-5">
            <h2 className="text-[10px] font-bold text-[#C9A84C] uppercase tracking-wider mb-3">Descrição</h2>
            <p className="text-[#7A8FA8] text-sm leading-relaxed whitespace-pre-line">{product.description}</p>
          </div>

          {/* Specs */}
          {visibleSpecs.length > 0 && (
            <div className="bg-[#0D1929] border border-[#1B3050] rounded-xl p-5">
              <h2 className="text-[10px] font-bold text-[#C9A84C] uppercase tracking-wider mb-3">Especificações Técnicas</h2>
              <div className="space-y-0">
                {visibleSpecs.map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between py-2.5 border-b border-[#1B3050] last:border-0">
                    <span className="text-[#7A8FA8] text-sm">{k}</span>
                    <span className="text-[#F0ECE4] text-sm font-medium">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Attachments */}
          {attachments.length > 0 && (
            <div className="bg-[#0D1929] border border-[#1B3050] rounded-xl p-5">
              <h2 className="text-[10px] font-bold text-[#C9A84C] uppercase tracking-wider mb-3">Documentos</h2>
              <div className="space-y-2">
                {attachments.map((att, i) => (
                  <a key={i} href={att.url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-3 bg-[#111F35] border border-[#1B3050] rounded-lg px-3 py-2.5 hover:border-[#C9A84C]/40 transition-colors group">
                    <Package className="w-4 h-4 text-[#C9A84C]" />
                    <span className="text-[#F0ECE4] text-sm group-hover:text-[#C9A84C] transition-colors">{att.name}</span>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Supplier */}
          <div className="bg-[#0D1929] border border-[#1B3050] rounded-xl p-5">
            <h2 className="text-[10px] font-bold text-[#C9A84C] uppercase tracking-wider mb-3">Fornecedor</h2>
            <div className="flex items-start gap-4">
              {product.supplier.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={product.supplier.logo_url} alt="" className="w-12 h-12 rounded-lg object-cover border border-[#1B3050]" />
              ) : (
                <div className="w-12 h-12 rounded-lg bg-[#C9A84C]/10 border border-[#C9A84C]/20 flex items-center justify-center">
                  <span className="text-[#C9A84C] font-bold text-lg">{product.supplier.company_name[0]}</span>
                </div>
              )}
              <div className="flex-1">
                <p className="text-[#F0ECE4] font-semibold">{product.supplier.company_name}</p>
                <div className="flex items-center gap-1 text-[#7A8FA8] text-xs mt-0.5">
                  <MapPin className="w-3 h-3" />
                  {product.supplier.city}, {product.supplier.state}
                </div>
                {product.supplier.website && (
                  <a href={product.supplier.website} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 text-[#C9A84C] text-xs mt-0.5 hover:underline">
                    <Globe className="w-3 h-3" />
                    {product.supplier.website}
                  </a>
                )}
                {product.supplier.description && (
                  <p className="text-[#7A8FA8] text-xs mt-2 line-clamp-2">{product.supplier.description}</p>
                )}
                <Link href={`/fornecedor/vitrine/${product.supplier.id}`}
                  className="inline-flex items-center gap-1 mt-2 text-xs text-[#C9A84C] hover:underline">
                  Ver todos os produtos deste fornecedor
                </Link>
              </div>
            </div>
          </div>

          {/* Reviews */}
          <div className="bg-[#0D1929] border border-[#1B3050] rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-[10px] font-bold text-[#C9A84C] uppercase tracking-wider">Avaliações</h2>
              {avgRating && (
                <div className="flex items-center gap-2">
                  <StarRating rating={Math.round(avgRating)} />
                  <span className="text-[#F0ECE4] font-bold">{avgRating}</span>
                  <span className="text-[#7A8FA8] text-xs">({reviews.length})</span>
                </div>
              )}
            </div>

            {reviews.map(r => (
              <div key={r.id} className="bg-[#111F35] rounded-xl p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[#F0ECE4] text-xs font-semibold">{r.partner?.full_name ?? "Partner"}</span>
                  <div className="flex items-center gap-2">
                    <StarRating rating={r.rating} />
                    <span className="text-[#7A8FA8] text-xs">{new Date(r.created_at).toLocaleDateString("pt-BR")}</span>
                  </div>
                </div>
                {r.comment && <p className="text-[#7A8FA8] text-xs">{r.comment}</p>}
              </div>
            ))}

            {!reviewDone ? (
              <div className="border-t border-[#1B3050] pt-4 space-y-3">
                <p className="text-[#F0ECE4] text-xs font-semibold">Sua avaliação</p>
                <StarRating rating={myRating} onRate={setMyRating} />
                <textarea value={myComment} onChange={e => setMyComment(e.target.value)}
                  placeholder="Comentário (opcional)"
                  rows={2}
                  className="w-full bg-[#111F35] border border-[#1B3050] rounded-lg px-3 py-2 text-sm text-[#F0ECE4] placeholder:text-[#7A8FA8]/50 focus:outline-none focus:border-[#C9A84C]/50 resize-none" />
                <button onClick={handleReview} disabled={!myRating || savingReview}
                  className="flex items-center gap-2 px-4 py-2 bg-[#C9A84C]/10 border border-[#C9A84C]/30 text-[#C9A84C] rounded-lg text-xs font-semibold transition-colors hover:bg-[#C9A84C]/20 disabled:opacity-50">
                  {savingReview ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Star className="w-3.5 h-3.5" />}
                  Enviar Avaliação
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-emerald-400 text-sm pt-2 border-t border-[#1B3050]">
                <CheckCircle className="w-4 h-4" />
                Avaliação enviada!
              </div>
            )}
          </div>
        </div>

        {/* Right col — sticky sidebar */}
        <div className="space-y-4">
          {/* Price + commission */}
          <div className="bg-[#0D1929] border border-[#1B3050] rounded-xl p-5 space-y-4 sticky top-6">
            <div>
              <p className="text-[10px] text-[#7A8FA8] uppercase tracking-wider mb-1">Valor</p>
              {product.price_type === "ON_REQUEST" && <p className="text-[#C9A84C] font-bold text-xl">Sob consulta</p>}
              {product.price_type === "NEGOTIABLE" && <p className="text-[#C9A84C] font-bold text-xl">Negociável{product.price ? ` a partir de ${fmtCurrency(product.price)}` : ""}</p>}
              {product.price_type === "FIXED" && product.price && <p className="text-[#C9A84C] font-bold text-xl">{fmtCurrency(product.price)}</p>}
            </div>

            <div className="bg-[#C9A84C]/10 rounded-xl p-4 border border-[#C9A84C]/30">
              <p className="text-[10px] text-[#C9A84C] uppercase tracking-wider mb-1">Sua Comissão</p>
              <p className="text-[#C9A84C] font-bold text-2xl">{commissionRate}%</p>
            </div>

            {/* Commission calculator */}
            <div>
              <p className="text-[10px] text-[#7A8FA8] uppercase tracking-wider mb-2">Calculadora de Comissão</p>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#7A8FA8] text-sm">R$</span>
                <input
                  type="number"
                  min="0"
                  step="100"
                  value={saleValue}
                  onChange={e => setSaleValue(e.target.value)}
                  placeholder="Valor da venda"
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

            {/* Logistics */}
            <div className="space-y-1.5 text-xs text-[#7A8FA8] border-t border-[#1B3050] pt-3">
              {product.min_order && <p>Pedido mínimo: <span className="text-[#F0ECE4]">{product.min_order} unid.</span></p>}
              {product.delivery_days && <p>Prazo entrega: <span className="text-[#F0ECE4]">{product.delivery_days} dias</span></p>}
              {product.available_nationwide && (
                <p className="flex items-center gap-1 text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                  Disponível em todo o Brasil
                </p>
              )}
            </div>

            {/* Interest form */}
            {!sent ? (
              <div className="border-t border-[#1B3050] pt-4 space-y-3">
                <p className="text-[10px] font-bold text-[#C9A84C] uppercase tracking-wider flex items-center gap-2">
                  <TrendingUp className="w-3.5 h-3.5" />
                  Quero vender este produto
                </p>
                <input value={clientName} onChange={e => setClientName(e.target.value)}
                  placeholder="Nome do cliente (opcional)"
                  className="w-full bg-[#111F35] border border-[#1B3050] rounded-lg px-3 py-2 text-sm text-[#F0ECE4] placeholder:text-[#7A8FA8]/50 focus:outline-none focus:border-[#C9A84C]/50" />
                <input value={clientContact} onChange={e => setClientContact(e.target.value)}
                  placeholder="Contato do cliente (opcional)"
                  className="w-full bg-[#111F35] border border-[#1B3050] rounded-lg px-3 py-2 text-sm text-[#F0ECE4] placeholder:text-[#7A8FA8]/50 focus:outline-none focus:border-[#C9A84C]/50" />
                <textarea value={message} onChange={e => setMessage(e.target.value)}
                  placeholder="Mensagem (opcional)" rows={2}
                  className="w-full bg-[#111F35] border border-[#1B3050] rounded-lg px-3 py-2 text-sm text-[#F0ECE4] placeholder:text-[#7A8FA8]/50 focus:outline-none focus:border-[#C9A84C]/50 resize-none" />
                {sendError && <p className="text-red-400 text-xs">{sendError}</p>}
                <button onClick={handleInteresse} disabled={sending}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-[#C9A84C] hover:bg-[#E8C97A] text-[#09081A] font-bold rounded-xl text-sm transition-colors disabled:opacity-50">
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  {sending ? "Enviando..." : "Enviar Interesse"}
                </button>
              </div>
            ) : (
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 text-center">
                <CheckCircle className="w-6 h-6 text-emerald-400 mx-auto mb-1" />
                <p className="text-emerald-400 font-semibold text-sm">Interesse registrado!</p>
                <p className="text-[#7A8FA8] text-xs mt-0.5">O fornecedor será notificado.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
