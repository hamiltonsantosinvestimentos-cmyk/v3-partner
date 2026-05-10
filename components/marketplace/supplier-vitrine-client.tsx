"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { ShoppingBag, MapPin, Globe, Package, ArrowLeft, Loader2, Tag } from "lucide-react";
import { cn } from "@/lib/utils";

interface Supplier {
  id: string;
  company_name: string;
  logo_url: string | null;
  city: string;
  state: string;
  description: string;
  website: string | null;
  categories: string[];
}

interface Product {
  id: string;
  name: string;
  description: string;
  category: string;
  price: number | null;
  price_type: string;
  commission_percent: number;
  partner_commission_percent: number | null;
  images: string[];
  status: string;
}

function fmtCurrency(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

function PriceLabel({ price, type }: { price: number | null; type: string }) {
  if (type === "ON_REQUEST") return <span className="text-[#C9A84C] font-bold text-sm">Sob consulta</span>;
  if (type === "NEGOTIABLE") return <span className="text-[#C9A84C] font-bold text-sm">Negociável{price ? ` a partir de ${fmtCurrency(price)}` : ""}</span>;
  if (price) return <span className="text-[#C9A84C] font-bold text-sm">{fmtCurrency(price)}</span>;
  return null;
}

export function SupplierVitrineClient({ supplierId }: { supplierId: string }) {
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [supRes, prodRes] = await Promise.all([
          fetch(`/api/marketplace/suppliers/${supplierId}`),
          fetch(`/api/marketplace/products?supplier_id=${supplierId}`),
        ]);
        const s = await supRes.json();
        const p = await prodRes.json();
        if (s.supplier) setSupplier(s.supplier);
        setProducts((p.products ?? []).filter((pr: Product) => pr.status === "APPROVED"));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [supplierId]);

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen bg-[#09081A]">
      <Loader2 className="w-8 h-8 animate-spin text-[#C9A84C]" />
    </div>
  );

  if (!supplier) return (
    <div className="flex items-center justify-center min-h-screen bg-[#09081A]">
      <div className="text-center space-y-4">
        <Package className="w-16 h-16 text-[#7A8FA8]/30 mx-auto" />
        <p className="text-[#F0ECE4]">Fornecedor não encontrado</p>
        <Link href="/marketplace" className="text-[#C9A84C] underline text-sm">Voltar ao Marketplace</Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#09081A]">
      {/* Header */}
      <div className="border-b border-[#1B3050] bg-[#0D1929]">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link href="/marketplace" className="p-2 rounded-lg bg-[#111F35] border border-[#1B3050] text-[#7A8FA8] hover:text-[#F0ECE4] transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex items-center gap-4 flex-1">
            {supplier.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={supplier.logo_url} alt="" className="w-14 h-14 rounded-xl object-cover border border-[#1B3050]" />
            ) : (
              <div className="w-14 h-14 rounded-xl bg-[#C9A84C]/10 border border-[#C9A84C]/20 flex items-center justify-center">
                <span className="text-[#C9A84C] font-bold text-2xl">{supplier.company_name[0]}</span>
              </div>
            )}
            <div>
              <h1 className="text-[#F0ECE4] font-bold text-xl">{supplier.company_name}</h1>
              <div className="flex items-center gap-3 mt-0.5">
                <div className="flex items-center gap-1 text-[#7A8FA8] text-xs">
                  <MapPin className="w-3 h-3" />
                  {supplier.city}, {supplier.state}
                </div>
                {supplier.website && (
                  <a href={supplier.website} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 text-[#C9A84C] text-xs hover:underline">
                    <Globe className="w-3 h-3" />
                    Site
                  </a>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-[#C9A84C]/15 flex items-center justify-center">
              <ShoppingBag className="w-5 h-5 text-[#C9A84C]" />
            </div>
            <div>
              <p className="text-[#C9A84C] font-bold text-xs">V3 PARTNERS</p>
              <p className="text-[#7A8FA8] text-[10px]">Marketplace</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-6 space-y-6">
        {/* About */}
        {supplier.description && (
          <div className="bg-[#0D1929] border border-[#1B3050] rounded-xl p-5">
            <h2 className="text-[10px] font-bold text-[#C9A84C] uppercase tracking-wider mb-2">Sobre a Empresa</h2>
            <p className="text-[#7A8FA8] text-sm leading-relaxed">{supplier.description}</p>
          </div>
        )}

        {/* Categories */}
        {supplier.categories.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {supplier.categories.map(c => (
              <span key={c} className="flex items-center gap-1 bg-[#162744] border border-[#1B3050] text-[#7A8FA8] text-xs px-3 py-1.5 rounded-full">
                <Tag className="w-3 h-3" />
                {c}
              </span>
            ))}
          </div>
        )}

        {/* Products */}
        <div>
          <h2 className="text-[#F0ECE4] font-bold text-lg mb-4">
            Produtos & Serviços
            <span className="text-[#7A8FA8] text-sm font-normal ml-2">({products.length})</span>
          </h2>

          {products.length === 0 ? (
            <div className="text-center py-16">
              <Package className="w-16 h-16 text-[#7A8FA8]/30 mx-auto mb-4" />
              <p className="text-[#7A8FA8]">Nenhum produto disponível no momento</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {products.map(p => {
                const commRate = p.partner_commission_percent ?? p.commission_percent;
                return (
                  <Link key={p.id} href={`/marketplace/${p.id}`}
                    className="group bg-[#0D1929] border border-[#1B3050] rounded-xl overflow-hidden hover:border-[#C9A84C]/40 transition-all hover:shadow-[0_0_20px_rgba(201,168,76,0.08)]">
                    <div className="relative h-40 bg-[#111F35] flex items-center justify-center overflow-hidden">
                      {p.images[0] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.images[0]} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                      ) : (
                        <Package className="w-12 h-12 text-[#7A8FA8]/30" />
                      )}
                      <div className="absolute top-2 right-2 bg-[#09081A]/90 border border-[#C9A84C]/40 rounded-full px-2.5 py-1">
                        <span className="text-[#C9A84C] text-[10px] font-bold">{commRate}% comissão</span>
                      </div>
                    </div>
                    <div className="p-4">
                      <span className={cn("text-[9px] font-bold tracking-wider text-[#7A8FA8] uppercase bg-[#162744] px-2 py-0.5 rounded-full")}>
                        {p.category}
                      </span>
                      <h3 className="text-[#F0ECE4] font-semibold text-sm mt-2 mb-1 line-clamp-2 group-hover:text-[#E8C97A] transition-colors">
                        {p.name}
                      </h3>
                      <PriceLabel price={p.price} type={p.price_type} />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
