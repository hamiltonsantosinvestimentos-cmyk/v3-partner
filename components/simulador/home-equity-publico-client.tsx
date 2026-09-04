"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import {
  Home, MessageCircle, ArrowRight, ArrowLeft, RotateCcw,
  Landmark, Wallet, CalendarClock,
} from "lucide-react";
import {
  LTV_MAX, TAXA_BASE_MENSAL, IPCA_ANUAL_REF, PRAZO_MIN, PRAZO_MAX, VALOR_IMOVEL_MIN,
  fmtBRL, fmtPct, calcSAC, calcCET,
} from "./home-equity-client";

// Fluxo passo a passo (uma pergunta por tela) — mesmo espírito de UX de
// simuladores de mercado (ex: Bext), mas com conteúdo, marca e motor de
// cálculo 100% da V3 (importados de home-equity-client.tsx, nunca duplicados
// — mesma taxa/fórmula usada internamente pela Mesa em /simulador-home-equity).

const GOLD = "#C9A84C";
const NAVY = "#09081A";
const NAVY_CARD = "#162744";
const NAVY_BASE = "#111F35";
const MUTED = "#7A8FA8";

type Step = "welcome" | "imovel" | "credito" | "prazo" | "resultado";

function parseCurrency(raw: string): number {
  return Math.round((parseFloat(raw.replace(/\./g, "").replace(",", ".")) || 0) * 100) / 100;
}

function BigCurrencyInput({
  value, onChange, autoFocus,
}: { value: number; onChange: (v: number) => void; autoFocus?: boolean }) {
  const [raw, setRaw] = useState(value > 0 ? value.toLocaleString("pt-BR") : "");
  return (
    <div className="flex items-center justify-center gap-2 w-full">
      <span className="text-2xl font-bold" style={{ color: GOLD }}>R$</span>
      <input
        type="text"
        inputMode="numeric"
        autoFocus={autoFocus}
        value={raw}
        onChange={(e) => { setRaw(e.target.value); onChange(parseCurrency(e.target.value)); }}
        placeholder="0"
        className="bg-transparent text-4xl sm:text-5xl font-bold text-white text-center outline-none w-full max-w-xs"
        style={{ borderBottom: `2px solid ${GOLD}40` }}
      />
    </div>
  );
}

function StepShell({
  step, total, title, subtitle, children, onBack, onNext, nextLabel, nextDisabled,
}: {
  step: number; total: number; title: string; subtitle?: string;
  children: React.ReactNode;
  onBack?: () => void; onNext?: () => void; nextLabel?: string; nextDisabled?: boolean;
}) {
  return (
    <div className="w-full max-w-lg mx-auto flex flex-col items-center text-center gap-8 animate-fade-in">
      {/* Progresso */}
      <div className="flex items-center gap-1.5 w-full max-w-xs">
        {Array.from({ length: total }).map((_, i) => (
          <div key={i} className="flex-1 h-1 rounded-full" style={{ background: i < step ? GOLD : "rgba(255,255,255,0.08)" }} />
        ))}
      </div>

      <div className="space-y-2">
        <h2 className="text-2xl sm:text-3xl font-bold text-white leading-tight">{title}</h2>
        {subtitle && <p className="text-sm max-w-sm mx-auto" style={{ color: MUTED }}>{subtitle}</p>}
      </div>

      <div className="w-full">{children}</div>

      <div className="flex items-center gap-3 w-full max-w-xs">
        {onBack && (
          <button onClick={onBack} className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: NAVY_CARD, color: MUTED }}>
            <ArrowLeft className="w-4 h-4" />
          </button>
        )}
        {onNext && (
          <button
            onClick={onNext}
            disabled={nextDisabled}
            className="flex-1 h-11 rounded-xl font-bold text-sm text-black flex items-center justify-center gap-2 disabled:opacity-40 transition-opacity"
            style={{ background: GOLD }}
          >
            {nextLabel ?? "Continuar"} <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

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

  const [step, setStep] = useState<Step>("welcome");
  const [valorImovel, setValorImovel] = useState(0);
  const [valorEmprestimo, setValorEmprestimo] = useState(0);
  const [prazo, setPrazo] = useState(120);

  const valorMaxEmprestimo = valorImovel * LTV_MAX;
  const emprestimoClamped = Math.min(valorEmprestimo || 0, valorMaxEmprestimo);
  const ltv = valorImovel > 0 ? emprestimoClamped / valorImovel : 0;
  const taxaMensalIPCA = Math.pow(1 + IPCA_ANUAL_REF, 1 / 12) - 1;
  const taxaMensalTotal = TAXA_BASE_MENSAL + taxaMensalIPCA;

  const resultado = useMemo(() => {
    if (emprestimoClamped <= 0 || prazo <= 0) return null;
    const sac = calcSAC(emprestimoClamped, taxaMensalTotal, prazo);
    const cet = calcCET(emprestimoClamped, sac.primeiraParc, prazo);
    return { ...sac, cet };
  }, [emprestimoClamped, prazo, taxaMensalTotal]);

  const partnerName = partner?.full_name ?? null;
  const waLink = partner?.whatsapp
    ? `https://wa.me/55${partner.whatsapp}?text=${encodeURIComponent(
        `Olá! Simulei um Home Equity de ${fmtBRL(emprestimoClamped)} com a V3 Partners e quero avançar.`
      )}`
    : null;

  function reiniciar() {
    setValorImovel(0); setValorEmprestimo(0); setPrazo(120); setStep("welcome");
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: NAVY }}>
      {/* Header */}
      <div className="border-b border-white/5 px-6 py-4 flex items-center gap-3" style={{ background: NAVY_BASE }}>
        <div className="relative w-8 h-8">
          <Image src="/logo.jpg" alt="V3 Partners" fill className="object-contain rounded" />
        </div>
        <span className="text-sm font-bold text-white">V3 Partners</span>
      </div>

      <div className="flex-1 flex items-center justify-center px-4 py-12">
        {/* ── Boas-vindas ── */}
        {step === "welcome" && (
          <div className="w-full max-w-lg mx-auto flex flex-col items-center text-center gap-6 animate-fade-in">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: `${GOLD}20` }}>
              <Home className="w-7 h-7" style={{ color: GOLD }} />
            </div>
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-widest" style={{ color: GOLD }}>Crédito com Garantia de Imóvel · CGI</p>
              <h1 className="text-3xl sm:text-4xl font-bold text-white leading-tight">Vamos simular seu<br />Home Equity?</h1>
              <p className="text-sm max-w-sm mx-auto" style={{ color: MUTED }}>
                3 perguntas rápidas e você já vê taxa, parcela e prazo — sem compromisso.
              </p>
              {partnerName && (
                <p className="text-xs pt-1" style={{ color: GOLD }}>Simulação enviada por {partnerName} — Partner V3</p>
              )}
            </div>
            <button
              onClick={() => setStep("imovel")}
              className="px-8 py-3.5 rounded-xl font-bold text-sm text-black flex items-center gap-2 hover:opacity-90 transition-opacity"
              style={{ background: GOLD }}
            >
              Começar simulação <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* ── Valor do imóvel ── */}
        {step === "imovel" && (
          <StepShell
            step={1} total={3}
            title="Qual o valor do imóvel?"
            subtitle="O imóvel que vai ficar em garantia da operação (mínimo R$ 150.000)."
            onBack={() => setStep("welcome")}
            onNext={() => setStep("credito")}
            nextDisabled={valorImovel < VALOR_IMOVEL_MIN}
          >
            <BigCurrencyInput value={valorImovel} onChange={setValorImovel} autoFocus />
            {valorImovel > 0 && valorImovel < VALOR_IMOVEL_MIN && (
              <p className="text-xs mt-3" style={{ color: "#F59E0B" }}>Valor mínimo de imóvel: {fmtBRL(VALOR_IMOVEL_MIN)}</p>
            )}
          </StepShell>
        )}

        {/* ── Valor do crédito ── */}
        {step === "credito" && (
          <StepShell
            step={2} total={3}
            title="Quanto você precisa?"
            subtitle={`Até 60% do valor do imóvel — até ${fmtBRL(valorMaxEmprestimo)} nesta simulação.`}
            onBack={() => setStep("imovel")}
            onNext={() => setStep("prazo")}
            nextDisabled={emprestimoClamped <= 0}
          >
            <BigCurrencyInput value={valorEmprestimo} onChange={setValorEmprestimo} autoFocus />
            {valorEmprestimo > valorMaxEmprestimo && (
              <p className="text-xs mt-3" style={{ color: GOLD }}>
                Ajustado para o máximo permitido: {fmtBRL(valorMaxEmprestimo)}
              </p>
            )}
          </StepShell>
        )}

        {/* ── Prazo ── */}
        {step === "prazo" && (
          <StepShell
            step={3} total={3}
            title="Em quantos meses quer pagar?"
            subtitle={`De ${PRAZO_MIN} a ${PRAZO_MAX} meses.`}
            onBack={() => setStep("credito")}
            onNext={() => setStep("resultado")}
            nextLabel="Ver resultado"
          >
            <div className="space-y-4 w-full max-w-xs mx-auto">
              <p className="text-4xl font-bold text-white">{prazo} <span className="text-lg font-medium" style={{ color: MUTED }}>meses</span></p>
              <p className="text-xs" style={{ color: MUTED }}>≈ {Math.round(prazo / 12)} anos</p>
              <input
                type="range" min={PRAZO_MIN} max={PRAZO_MAX} step={6}
                value={prazo}
                onChange={(e) => setPrazo(Number(e.target.value))}
                className="w-full accent-[#C9A84C]"
              />
              <div className="flex justify-between text-[10px]" style={{ color: MUTED }}>
                <span>{PRAZO_MIN} meses</span>
                <span>{PRAZO_MAX} meses</span>
              </div>
            </div>
          </StepShell>
        )}

        {/* ── Resultado ── */}
        {step === "resultado" && resultado && (
          <div className="w-full max-w-lg mx-auto flex flex-col items-center text-center gap-6 animate-fade-in">
            <p className="text-xs font-bold uppercase tracking-widest" style={{ color: GOLD }}>Resultado da simulação</p>
            <h2 className="text-2xl sm:text-3xl font-bold text-white">Sua simulação Home Equity</h2>

            <div className="grid grid-cols-2 gap-3 w-full">
              {[
                { icon: Wallet, label: "1ª Parcela", value: fmtBRL(resultado.primeiraParc), highlight: true },
                { icon: Landmark, label: "Crédito Liberado", value: fmtBRL(emprestimoClamped) },
                { icon: CalendarClock, label: "Prazo", value: `${prazo} meses` },
                { icon: Home, label: "LTV Contratado", value: fmtPct(ltv, 1) },
              ].map((k) => (
                <div
                  key={k.label}
                  className="rounded-xl p-4 border text-left"
                  style={{ background: k.highlight ? `${GOLD}10` : NAVY_CARD, borderColor: k.highlight ? `${GOLD}40` : "rgba(255,255,255,0.05)" }}
                >
                  <k.icon className="w-4 h-4 mb-2" style={{ color: GOLD }} />
                  <p className="text-[10px] uppercase tracking-wide" style={{ color: MUTED }}>{k.label}</p>
                  <p className="text-lg font-bold" style={{ color: k.highlight ? GOLD : "white" }}>{k.value}</p>
                </div>
              ))}
            </div>

            <p className="text-[11px]" style={{ color: MUTED }}>
              CET estimado: {fmtPct(resultado.cet)} a.a. · Taxa: 0,89% a.m. + IPCA
            </p>

            <div className="w-full rounded-2xl border p-5 space-y-3" style={{ background: NAVY_BASE, borderColor: "rgba(255,255,255,0.08)" }}>
              <p className="text-sm font-bold text-white">Gostou do resultado?</p>
              <p className="text-xs" style={{ color: MUTED }}>
                {partnerName ? `Fale com ${partnerName} para avançar com a sua operação.` : "Fale com quem te enviou este link para avançar."}
              </p>
              {waLink ? (
                <a href={waLink} target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm text-black hover:opacity-90 transition-opacity"
                  style={{ background: GOLD }}>
                  <MessageCircle className="w-4 h-4" /> Falar no WhatsApp
                </a>
              ) : (
                <p className="text-[11px]" style={{ color: MUTED }}>
                  Dúvidas? <a href="mailto:financeiro@v3partners.com.br" className="underline" style={{ color: GOLD }}>financeiro@v3partners.com.br</a>
                </p>
              )}
            </div>

            <button onClick={reiniciar} className="flex items-center gap-1.5 text-xs" style={{ color: MUTED }}>
              <RotateCcw className="w-3 h-3" /> Refazer simulação
            </button>

            <p className="text-[10px] max-w-sm" style={{ color: MUTED }}>
              Simulação com fins ilustrativos. Sujeita a análise de crédito e avaliação do imóvel pela V3 Partners.
              LTV máximo de 60% sobre o valor de avaliação.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
