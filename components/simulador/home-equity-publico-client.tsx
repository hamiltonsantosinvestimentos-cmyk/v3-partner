"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import {
  Home, MessageCircle, ArrowRight, RotateCcw,
  Landmark, Wallet, CalendarClock, Clock3,
} from "lucide-react";
import {
  LTV_MAX, TAXA_BASE_MENSAL, IPCA_ANUAL_REF, PRAZO_MIN, PRAZO_MAX, VALOR_IMOVEL_MIN,
  fmtBRL, fmtPct, calcSAC, calcCET,
} from "./home-equity-client";

// Fluxo passo a passo (uma pergunta por tela, barra de progresso no topo,
// card por etapa) — mesmo espírito de UX/estrutura de simuladores de mercado
// (progress bar, "Passo X de N", card com pergunta + CTA cheia + aviso de
// tempo), mas conteúdo, cores e motor de cálculo 100% V3. Cores seguem o
// brandbook V3 (navy/ouro) — a paleta azul/branco do site de referência é
// marca de terceiro, não reproduzida aqui.

const GOLD = "#C9A84C";
const GOLD_LIGHT = "#E8C97A";
const NAVY = "#09081A";
const NAVY_CARD = "#162744";
const NAVY_BASE = "#111F35";
const MUTED = "#7A8FA8";

type Step = "welcome" | "imovel" | "credito" | "prazo" | "resultado";
const STEPS: Step[] = ["welcome", "imovel", "credito", "prazo", "resultado"];

function parseCurrency(raw: string): number {
  return Math.round((parseFloat(raw.replace(/\./g, "").replace(",", ".")) || 0) * 100) / 100;
}

// ─── Progress bar fixa no topo ──────────────────────────────────────────────
function TopProgress({ pct }: { pct: number }) {
  return (
    <div className="h-1 w-full" style={{ background: "rgba(255,255,255,0.06)" }}>
      <div className="h-1 transition-all duration-300" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${GOLD}, ${GOLD_LIGHT})` }} />
    </div>
  );
}

// ─── Input de valor (label acima + caixa com borda) ─────────────────────────
function LabeledCurrencyInput({
  label, value, onChange, autoFocus, helper,
}: { label: string; value: number; onChange: (v: number) => void; autoFocus?: boolean; helper?: string }) {
  const [raw, setRaw] = useState(value > 0 ? value.toLocaleString("pt-BR") : "");
  return (
    <div className="space-y-1.5 text-left">
      <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: GOLD }}>{label}</label>
      <div className="flex items-center gap-2 px-4 py-3.5 rounded-xl border" style={{ background: NAVY, borderColor: "rgba(201,168,76,0.25)" }}>
        <span className="text-base font-semibold" style={{ color: MUTED }}>R$</span>
        <input
          type="text"
          inputMode="numeric"
          autoFocus={autoFocus}
          value={raw}
          onChange={(e) => { setRaw(e.target.value); onChange(parseCurrency(e.target.value)); }}
          placeholder="0,00"
          className="flex-1 bg-transparent text-xl font-bold text-white outline-none"
        />
      </div>
      {helper && <p className="text-xs" style={{ color: MUTED }}>{helper}</p>}
    </div>
  );
}

// ─── Card de etapa (pergunta + conteúdo + CTA + aviso) ──────────────────────
function StepCard({
  stepNum, totalSteps, title, titleHighlight, subtitle, children,
  onBack, onNext, nextLabel = "Continuar", nextDisabled, hint,
}: {
  stepNum: number; totalSteps: number; title: string; titleHighlight?: string; subtitle?: string;
  children?: React.ReactNode;
  onBack?: () => void; onNext: () => void; nextLabel?: string; nextDisabled?: boolean; hint?: string;
}) {
  return (
    <div className="w-full max-w-md mx-auto space-y-4 animate-fade-in">
      <div className="rounded-2xl border p-6 sm:p-7 space-y-5" style={{ background: NAVY_CARD, borderColor: "rgba(255,255,255,0.06)" }}>
        <div className="space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: GOLD }}>Passo {stepNum} de {totalSteps}</p>
          <h2 className="text-xl sm:text-2xl font-bold text-white leading-snug">
            {title} {titleHighlight && <span style={{ color: GOLD }}>{titleHighlight}</span>}
          </h2>
          {subtitle && <p className="text-sm" style={{ color: MUTED }}>{subtitle}</p>}
        </div>

        {children}

        <button
          onClick={onNext}
          disabled={nextDisabled}
          className="w-full py-3.5 rounded-xl font-bold text-sm text-black flex items-center justify-center gap-2 disabled:opacity-40 transition-opacity hover:opacity-90"
          style={{ background: GOLD }}
        >
          {nextLabel} <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {hint && (
        <div className="flex items-start gap-2.5 rounded-xl border px-4 py-3" style={{ background: `${GOLD}0d`, borderColor: `${GOLD}30` }}>
          <Clock3 className="w-4 h-4 shrink-0 mt-0.5" style={{ color: GOLD }} />
          <p className="text-xs" style={{ color: "#D8CCA8" }}>{hint}</p>
        </div>
      )}

      {onBack && (
        <div className="flex justify-center">
          <button onClick={onBack} className="px-5 py-2 rounded-full text-xs font-semibold" style={{ background: NAVY_CARD, color: MUTED }}>
            Voltar
          </button>
        </div>
      )}
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

  const stepIndex = STEPS.indexOf(step);
  const progressPct = (stepIndex / (STEPS.length - 1)) * 100;

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
      <TopProgress pct={progressPct} />

      {/* Header */}
      <div className="border-b border-white/5 px-6 py-4 flex items-center gap-3" style={{ background: NAVY_BASE }}>
        <div className="relative w-8 h-8">
          <Image src="/logo.jpg" alt="V3 Partners" fill className="object-contain rounded" />
        </div>
        <span className="text-sm font-bold text-white">V3 Partners</span>
      </div>

      <div className="flex-1 flex items-center justify-center px-4 py-10">
        {/* ── Boas-vindas ── */}
        {step === "welcome" && (
          <div className="w-full max-w-md mx-auto animate-fade-in">
            <div className="rounded-2xl border p-7 sm:p-8 space-y-6 text-center" style={{ background: NAVY_CARD, borderColor: "rgba(255,255,255,0.06)" }}>
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto" style={{ background: `${GOLD}20` }}>
                <Home className="w-7 h-7" style={{ color: GOLD }} />
              </div>
              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-widest" style={{ color: GOLD }}>Crédito com Garantia de Imóvel · CGI</p>
                <h1 className="text-2xl sm:text-3xl font-bold text-white leading-tight">Vamos <span style={{ color: GOLD }}>começar</span>?</h1>
                <p className="text-sm max-w-sm mx-auto" style={{ color: MUTED }}>
                  3 perguntas rápidas e você já vê taxa, parcela e prazo do seu Home Equity — sem compromisso.
                </p>
                {partnerName && (
                  <p className="text-xs pt-1" style={{ color: GOLD }}>Simulação enviada por {partnerName} — Partner V3</p>
                )}
              </div>
              <button
                onClick={() => setStep("imovel")}
                className="w-full py-3.5 rounded-xl font-bold text-sm text-black flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
                style={{ background: GOLD }}
              >
                Começar simulação <ArrowRight className="w-4 h-4" />
              </button>
            </div>
            <div className="flex items-start gap-2.5 rounded-xl border px-4 py-3 mt-4" style={{ background: `${GOLD}0d`, borderColor: `${GOLD}30` }}>
              <Clock3 className="w-4 h-4 shrink-0 mt-0.5" style={{ color: GOLD }} />
              <p className="text-xs" style={{ color: "#D8CCA8" }}>Leva menos de 1 minuto. Preencha com atenção para um resultado mais preciso.</p>
            </div>
          </div>
        )}

        {/* ── Valor do imóvel ── */}
        {step === "imovel" && (
          <StepCard
            stepNum={1} totalSteps={3}
            title="Qual o" titleHighlight="valor do imóvel?"
            subtitle="O imóvel que vai ficar em garantia da operação."
            onBack={() => setStep("welcome")}
            onNext={() => setStep("credito")}
            nextDisabled={valorImovel < VALOR_IMOVEL_MIN}
            hint={`O valor mínimo do imóvel deve ser superior a ${fmtBRL(VALOR_IMOVEL_MIN)}.`}
          >
            <LabeledCurrencyInput label="Valor aproximado do imóvel" value={valorImovel} onChange={setValorImovel} autoFocus />
          </StepCard>
        )}

        {/* ── Valor do crédito ── */}
        {step === "credito" && (
          <StepCard
            stepNum={2} totalSteps={3}
            title="Quanto você" titleHighlight="precisa de crédito?"
            subtitle="Calculamos automaticamente o teto permitido para o seu imóvel."
            onBack={() => setStep("imovel")}
            onNext={() => setStep("prazo")}
            nextDisabled={emprestimoClamped <= 0}
            hint={`Até 60% do valor do imóvel — até ${fmtBRL(valorMaxEmprestimo)} nesta simulação.`}
          >
            <LabeledCurrencyInput
              label="Valor desejado de crédito"
              value={valorEmprestimo}
              onChange={setValorEmprestimo}
              autoFocus
              helper={valorEmprestimo > valorMaxEmprestimo ? `Ajustado para o máximo permitido: ${fmtBRL(valorMaxEmprestimo)}` : undefined}
            />
          </StepCard>
        )}

        {/* ── Prazo ── */}
        {step === "prazo" && (
          <StepCard
            stepNum={3} totalSteps={3}
            title="Em quanto tempo" titleHighlight="quer pagar?"
            subtitle={`Escolha o prazo, de ${PRAZO_MIN} a ${PRAZO_MAX} meses.`}
            onBack={() => setStep("credito")}
            onNext={() => setStep("resultado")}
            nextLabel="Ver resultado"
            hint="Prazos maiores reduzem a parcela, mas aumentam o total de juros pagos."
          >
            <div className="space-y-3 text-left">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-white">{prazo}</span>
                <span className="text-sm font-medium" style={{ color: MUTED }}>meses (≈ {Math.round(prazo / 12)} anos)</span>
              </div>
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
          </StepCard>
        )}

        {/* ── Resultado ── */}
        {step === "resultado" && resultado && (
          <div className="w-full max-w-md mx-auto space-y-4 animate-fade-in">
            <div className="rounded-2xl border p-6 sm:p-7 space-y-5" style={{ background: NAVY_CARD, borderColor: "rgba(255,255,255,0.06)" }}>
              <div className="text-center space-y-1">
                <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: GOLD }}>Resultado da simulação</p>
                <h2 className="text-xl sm:text-2xl font-bold text-white">Sua simulação Home Equity</h2>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {[
                  { icon: Wallet, label: "1ª Parcela", value: fmtBRL(resultado.primeiraParc), highlight: true },
                  { icon: Landmark, label: "Crédito Liberado", value: fmtBRL(emprestimoClamped) },
                  { icon: CalendarClock, label: "Prazo", value: `${prazo} meses` },
                  { icon: Home, label: "LTV Contratado", value: fmtPct(ltv, 1) },
                ].map((k) => (
                  <div key={k.label} className="rounded-xl p-4 border text-left"
                    style={{ background: k.highlight ? `${GOLD}12` : NAVY_BASE, borderColor: k.highlight ? `${GOLD}40` : "rgba(255,255,255,0.05)" }}>
                    <k.icon className="w-4 h-4 mb-2" style={{ color: GOLD }} />
                    <p className="text-[10px] uppercase tracking-wide" style={{ color: MUTED }}>{k.label}</p>
                    <p className="text-lg font-bold" style={{ color: k.highlight ? GOLD : "white" }}>{k.value}</p>
                  </div>
                ))}
              </div>

              <p className="text-center text-[11px]" style={{ color: MUTED }}>
                CET estimado: {fmtPct(resultado.cet)} a.a. · Taxa: 0,89% a.m. + IPCA
              </p>

              <div className="pt-1 border-t space-y-3" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
                <div className="text-center pt-3">
                  <p className="text-sm font-bold text-white">Gostou do resultado?</p>
                  <p className="text-xs mt-1" style={{ color: MUTED }}>
                    {partnerName ? `Fale com ${partnerName} para avançar com a sua operação.` : "Fale com quem te enviou este link para avançar."}
                  </p>
                </div>
                {waLink ? (
                  <a href={waLink} target="_blank" rel="noreferrer"
                    className="w-full py-3.5 rounded-xl font-bold text-sm text-black flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
                    style={{ background: GOLD }}>
                    <MessageCircle className="w-4 h-4" /> Falar no WhatsApp
                  </a>
                ) : (
                  <p className="text-center text-[11px]" style={{ color: MUTED }}>
                    Dúvidas? <a href="mailto:financeiro@v3partners.com.br" className="underline" style={{ color: GOLD }}>financeiro@v3partners.com.br</a>
                  </p>
                )}
              </div>
            </div>

            <div className="flex justify-center">
              <button onClick={reiniciar} className="flex items-center gap-1.5 text-xs px-5 py-2 rounded-full" style={{ background: NAVY_CARD, color: MUTED }}>
                <RotateCcw className="w-3 h-3" /> Refazer simulação
              </button>
            </div>

            <p className="text-[10px] text-center max-w-sm mx-auto" style={{ color: MUTED }}>
              Simulação com fins ilustrativos. Sujeita a análise de crédito e avaliação do imóvel pela V3 Partners.
              LTV máximo de 60% sobre o valor de avaliação.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
