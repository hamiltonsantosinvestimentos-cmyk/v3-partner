"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, MapPin, ShieldCheck } from "lucide-react";

type Asset = {
  anonymous_id: string;
  uf: string | null;
  municipio: string | null;
  natureza: string | null;
  valor_face: number;
  valor_atualizado: number | null;
  risk_score: number | null;
  thumbnail_url: string | null;
};

function formatBRL(v: number | null | undefined) {
  if (v === null || v === undefined) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

export default function BolsaImoveisVitrinePage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    fetch("/api/public/bolsa/imoveis")
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Erro ao carregar vitrine");
        setAssets(json.assets ?? []);
        setState("ready");
      })
      .catch(() => setState("error"));
  }, []);

  return (
    <div className="min-h-screen bg-[#09081A]">
      <div className="border-b border-[#C9A84C]/20 bg-[#12112A]">
        <div className="max-w-6xl mx-auto px-6 py-5 flex items-center gap-3">
          <img src="https://app.v3partners.com.br/v3-logo-flat-gold-alpha.png" alt="V3 Partners" className="h-9" />
          <div>
            <p className="text-sm font-bold text-[#F5F1E8]">Bolsa de Grandes Ativos</p>
            <p className="text-[10px] text-[#9BAFC5]">Imóveis e Ativos Alternativos · V3 Partners</p>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-10">
        <div className="mb-8">
          <h1 className="text-xl font-bold text-[#F5F1E8] mb-2">Vitrine de Oportunidades</h1>
          <p className="text-xs text-[#9BAFC5] max-w-2xl">
            Ativos imobiliários e alternativos de grande porte, apresentados de forma anonimizada.
            Solicite acesso a um ativo para iniciar o processo de qualificação junto à Mesa V3 Partners.
          </p>
        </div>

        {state === "loading" && (
          <div className="flex flex-col items-center justify-center py-24">
            <Loader2 className="w-8 h-8 animate-spin text-[#C9A84C] mb-4" />
            <p className="text-sm text-[#9BAFC5]">Carregando vitrine</p>
          </div>
        )}

        {state === "error" && (
          <div className="text-center py-24">
            <p className="text-sm text-[#9BAFC5]">Não foi possível carregar a vitrine agora. Tente novamente em instantes.</p>
          </div>
        )}

        {state === "ready" && assets.length === 0 && (
          <div className="text-center py-24 border border-[#9BAFC5]/10 rounded-lg bg-[#12112A]">
            <p className="text-sm text-[#9BAFC5]">Nenhum ativo imobiliário disponível no momento.</p>
          </div>
        )}

        {state === "ready" && assets.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {assets.map((asset) => (
              <Link
                key={asset.anonymous_id}
                href={`/bolsa/imoveis/${asset.anonymous_id}`}
                className="group bg-[#12112A] border border-[#9BAFC5]/10 rounded-xl overflow-hidden hover:border-[#C9A84C]/40 transition"
              >
                <div className="aspect-[4/3] bg-[#162744] overflow-hidden">
                  {asset.thumbnail_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={asset.thumbnail_url}
                      alt={asset.anonymous_id}
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[#9BAFC5]/40 text-[10px] uppercase tracking-wide">
                      Sem imagem
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <div className="flex items-center gap-1.5 text-[9px] text-[#9BAFC5] uppercase tracking-wide mb-2">
                    <MapPin size={11} />
                    {asset.municipio ? `${asset.municipio} · ${asset.uf ?? ""}` : asset.uf ?? "Localização a confirmar"}
                  </div>
                  <div className="text-base font-bold text-[#F5F1E8] mb-1">{formatBRL(asset.valor_face)}</div>
                  <div className="text-[10px] text-[#9BAFC5] mb-3">{asset.natureza ?? "Ativo alternativo"}</div>
                  {asset.risk_score !== null && (
                    <div className="flex items-center gap-1.5 text-[9px] text-[#C9A84C] font-bold uppercase">
                      <ShieldCheck size={11} />
                      Score V3: {asset.risk_score}
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
