"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import { Home, MessageCircle, ShieldCheck, Percent, Clock3 } from "lucide-react";
import { HomeEquitySimulator } from "./home-equity-client";

const GOLD = "#C9A84C";
const NAVY = "#09081A";
const NAVY_CARD = "#162744";
const NAVY_BASE = "#111F35";
const MUTED = "#7A8FA8";

const DESTAQUES = [
  { icon: Percent, texto: "Taxas a partir de 0,89% a.m. + IPCA" },
  { icon: ShieldCheck, texto: "Até 60% do valor do imóvel, sem vender" },
  { icon: Clock3, texto: "Prazos de 12 a 240 meses" },
];

export function HomeEquityPublicoClient() {
  const searchParams = useSearchParams();
  const ref = searchParams.get("ref") ?? "";

  const [partner, setPartner] = useState<{ full_name: string | null; whatsapp: string | null } | null>(null);

  useEffect(() => {
    if (!ref) return;
    fetch(`/api/public/partner-card?id=${encodeURIComponent(ref)}`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => setPartner(d))
      .catch(() => {});
  }, [ref]);

  const partnerName = partner?.full_name ?? null;
  const waLink = partner?.whatsapp
    ? `https://wa.me/55${partner.whatsapp}?text=${encodeURIComponent("Olá! Fiz uma simulação de Home Equity com a V3 Partners e quero avançar.")}`
    : null;

  return (
    <div className="min-h-screen" style={{ background: NAVY }}>
      {/* Header */}
      <div className="border-b border-white/5 px-6 py-4 flex items-center gap-3" style={{ background: NAVY_BASE }}>
        <div className="relative w-8 h-8">
          <Image src="/logo.jpg" alt="V3 Partners" fill className="object-contain rounded" />
        </div>
        <span className="text-sm font-bold text-white">V3 Partners</span>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-10 space-y-8">
        {/* Hero */}
        <div className="text-center space-y-3">
          <p className="text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-1.5" style={{ color: GOLD }}>
            <Home className="w-3.5 h-3.5" /> Crédito com Garantia de Imóvel · CGI
          </p>
          <h1 className="text-3xl font-bold text-white leading-tight">
            Simule seu Home Equity<br />com a V3 Partners
          </h1>
          <p className="text-sm max-w-lg mx-auto" style={{ color: MUTED }}>
            Use o valor do seu imóvel como garantia e libere crédito com as menores taxas do mercado,
            sem precisar vender. Ajuste os valores abaixo e veja o resultado na hora.
          </p>
          {partnerName && (
            <p className="text-xs" style={{ color: GOLD }}>
              Simulação enviada por {partnerName} — Partner V3
            </p>
          )}
        </div>

        {/* Destaques */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {DESTAQUES.map(d => (
            <div
              key={d.texto}
              className="rounded-xl p-3 border border-white/5 flex gap-2 items-center"
              style={{ background: NAVY_CARD }}
            >
              <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${GOLD}20` }}>
                <d.icon className="w-3.5 h-3.5" style={{ color: GOLD }} />
              </div>
              <p className="text-[11px] font-medium text-white leading-tight">{d.texto}</p>
            </div>
          ))}
        </div>

        {/* Simulador real da V3 (mesmo motor usado internamente pela Mesa) */}
        <HomeEquitySimulator />

        {/* CTA final */}
        <div className="rounded-2xl border border-white/10 p-5 text-center space-y-3" style={{ background: NAVY_BASE }}>
          <p className="text-base font-bold text-white">Gostou da simulação?</p>
          <p className="text-xs" style={{ color: MUTED }}>
            {partnerName
              ? `Fale com ${partnerName} para avançar com a sua operação.`
              : "Fale com quem te enviou este link para avançar com a sua operação."}
          </p>
          {waLink ? (
            <a
              href={waLink}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm text-black hover:opacity-90 transition-opacity"
              style={{ background: GOLD }}
            >
              <MessageCircle className="w-4 h-4" /> Falar no WhatsApp
            </a>
          ) : (
            <p className="text-[11px]" style={{ color: MUTED }}>
              Dúvidas? <a href="mailto:financeiro@v3partners.com.br" className="underline" style={{ color: GOLD }}>financeiro@v3partners.com.br</a>
            </p>
          )}
        </div>

        <p className="text-[10px] text-center" style={{ color: MUTED }}>
          Simulação com fins ilustrativos. Sujeita a análise de crédito e avaliação do imóvel pela V3 Partners.
        </p>
      </div>
    </div>
  );
}
