"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import {
  Home, MessageCircle, ArrowRight, RotateCcw, Landmark, Wallet, CalendarClock, Clock3,
  TrendingUp, MoreHorizontal, CalendarDays, Search, Building, Building2, Store, User,
  CheckCircle2, XCircle, Loader2, ShieldCheck,
} from "lucide-react";
import {
  LTV_MAX, TAXA_BASE_MENSAL, IPCA_ANUAL_REF, VALOR_IMOVEL_MIN,
  fmtBRL, fmtPct, calcSAC, calcCET,
} from "./home-equity-client";

// Fluxo passo a passo (barra de progresso no topo, card por etapa, cards de
// opção pra perguntas de múltipla escolha) — estrutura no mesmo espírito de
// simuladores de mercado, conteúdo/cores/motor de cálculo 100% V3. Ao final,
// qualifica e cria um lead "Digital" no CRM (POST /api/public/home-equity-lead),
// atribuído ao partner de ?ref=, mesmo destino dos outros links de captação.

const GOLD = "#C9A84C";
const GOLD_LIGHT = "#E8C97A";
const NAVY = "#09081A";
const NAVY_CARD = "#162744";
const NAVY_BASE = "#111F35";
const MUTED = "#7A8FA8";

const PRAZOS_FIXOS = [60, 120, 180, 240];

const OCUPACOES = [
  "Assalariado", "Autônomo", "Empresário", "Profissional Liberal",
  "Aposentado", "Pensionista", "Funcionário Público", "Outro",
];

const ESTADOS_BR = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS",
  "MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
];

type Step =
  | "welcome" | "objetivo" | "urgencia" | "perfil-imovel" | "prazo"
  | "valor-imovel" | "valor-credito" | "tipo-pessoa" | "averbado" | "status-imovel"
  | "banco-financiamento" | "valor-financiamento" | "dados-pessoais"
  | "resultado";

// Passos "canônicos" só pra estimar a barra de progresso (a jornada real
// pula banco-financiamento/valor-financiamento se o imóvel estiver quitado).
// Termos de Uso, Política de Privacidade e a autorização SCR/Bacen ficam
// TODOS dentro do passo "dados-pessoais" (mesma página do formulário) — não
// são um passo separado, por pedido explícito do Hamilton em 2026-09-04.
const PROGRESS_STEPS: Step[] = [
  "welcome", "objetivo", "urgencia", "perfil-imovel", "prazo", "valor-imovel",
  "valor-credito", "tipo-pessoa", "averbado", "status-imovel", "dados-pessoais",
  "resultado",
];

interface FormState {
  objetivo: string; urgencia: string; perfilImovel: string; prazo: number;
  valorImovel: number; valorEmprestimo: number;
  tipoPessoa: "PF" | "PJ" | ""; averbado: boolean | null; statusImovel: "FINANCIADO" | "QUITADO" | "";
  bancoFinanciamento: string; valorFinanciamento: number;
  nome: string; cpf: string; ocupacao: string; renda: number; nascimento: string;
  telefone: string; email: string; cep: string; estado: string; cidade: string;
  bairro: string; rua: string; numero: string; complemento: string;
  aceiteTermos: boolean; aceiteScr: boolean;
}

const INITIAL_FORM: FormState = {
  objetivo: "", urgencia: "", perfilImovel: "", prazo: 120,
  valorImovel: 0, valorEmprestimo: 0,
  tipoPessoa: "", averbado: null, statusImovel: "",
  bancoFinanciamento: "", valorFinanciamento: 0,
  nome: "", cpf: "", ocupacao: "", renda: 0, nascimento: "",
  telefone: "", email: "", cep: "", estado: "", cidade: "",
  bairro: "", rua: "", numero: "", complemento: "",
  aceiteTermos: false, aceiteScr: false,
};

function parseCurrency(raw: string): number {
  return Math.round((parseFloat(raw.replace(/\./g, "").replace(",", ".")) || 0) * 100) / 100;
}
function maskCPF(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  return d.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}
function maskPhone(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 10) return d.replace(/(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3").trim().replace(/-$/, "");
  return d.replace(/(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3").trim().replace(/-$/, "");
}
function maskCEP(v: string) {
  return v.replace(/\D/g, "").slice(0, 8).replace(/(\d{5})(\d{1,3})/, "$1-$2");
}

// ─── Progress bar fixa no topo ──────────────────────────────────────────────
function TopProgress({ pct }: { pct: number }) {
  return (
    <div className="h-1 w-full sticky top-0 z-10" style={{ background: "rgba(255,255,255,0.06)" }}>
      <div className="h-1 transition-all duration-300" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${GOLD}, ${GOLD_LIGHT})` }} />
    </div>
  );
}

// ─── Inputs reutilizáveis ────────────────────────────────────────────────────
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5 text-left">
      <label className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: GOLD }}>{label}</label>
      {children}
    </div>
  );
}
const inputCls = "w-full px-3.5 py-2.5 rounded-xl border text-sm text-white outline-none bg-transparent";
const inputStyle = { background: NAVY, borderColor: "rgba(201,168,76,0.25)" } as const;

function LabeledCurrencyInput({
  label, value, onChange, autoFocus, helper,
}: { label: string; value: number; onChange: (v: number) => void; autoFocus?: boolean; helper?: string }) {
  const [raw, setRaw] = useState(value > 0 ? value.toLocaleString("pt-BR") : "");
  return (
    <Field label={label}>
      <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl border" style={inputStyle}>
        <span className="text-sm font-semibold" style={{ color: MUTED }}>R$</span>
        <input
          type="text" inputMode="numeric" autoFocus={autoFocus}
          value={raw}
          onChange={(e) => { setRaw(e.target.value); onChange(parseCurrency(e.target.value)); }}
          placeholder="0,00"
          className="flex-1 bg-transparent text-lg font-bold text-white outline-none"
        />
      </div>
      {helper && <p className="text-xs" style={{ color: MUTED }}>{helper}</p>}
    </Field>
  );
}

// ─── Grade de opções (auto-avança ao clicar) ────────────────────────────────
function ChoiceGrid({
  columns, options, onSelect,
}: { columns: number; options: { value: string; label: string; icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }> }[]; onSelect: (v: string) => void }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${columns}, minmax(0,1fr))`, gap: 10 }}>
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onSelect(o.value)}
          className="flex flex-col items-center gap-2 py-4 px-2 rounded-xl border transition-colors hover:border-[#C9A84C]/50"
          style={{ background: NAVY, borderColor: "rgba(255,255,255,0.08)" }}
        >
          <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: `${GOLD}18` }}>
            <o.icon className="w-4 h-4" style={{ color: GOLD }} />
          </div>
          <span className="text-xs font-semibold text-white text-center leading-tight">{o.label}</span>
        </button>
      ))}
    </div>
  );
}

// ─── Card de etapa ───────────────────────────────────────────────────────────
function StepCard({
  stepNum, totalSteps, title, titleHighlight, subtitle, children,
  onBack, onNext, nextLabel = "Continuar", nextDisabled, nextLoading, hint, wide,
}: {
  stepNum: number; totalSteps: number; title: string; titleHighlight?: string; subtitle?: string;
  children?: React.ReactNode;
  onBack?: () => void; onNext?: () => void; nextLabel?: string; nextDisabled?: boolean; nextLoading?: boolean; hint?: string; wide?: boolean;
}) {
  return (
    <div className={`w-full mx-auto space-y-4 animate-fade-in ${wide ? "max-w-xl" : "max-w-md"}`}>
      <div className="rounded-2xl border p-6 sm:p-7 space-y-5" style={{ background: NAVY_CARD, borderColor: "rgba(255,255,255,0.06)" }}>
        <div className="space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: GOLD }}>Passo {stepNum} de {totalSteps}</p>
          <h2 className="text-xl sm:text-2xl font-bold text-white leading-snug">
            {title} {titleHighlight && <span style={{ color: GOLD }}>{titleHighlight}</span>}
          </h2>
          {subtitle && <p className="text-sm" style={{ color: MUTED }}>{subtitle}</p>}
        </div>

        {children}

        {onNext && (
          <button
            onClick={onNext}
            disabled={nextDisabled || nextLoading}
            className="w-full py-3.5 rounded-xl font-bold text-sm text-black flex items-center justify-center gap-2 disabled:opacity-40 transition-opacity hover:opacity-90"
            style={{ background: GOLD }}
          >
            {nextLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>{nextLabel} <ArrowRight className="w-4 h-4" /></>}
          </button>
        )}
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
  const [, setHistory] = useState<Step[]>([]);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [leadCode, setLeadCode] = useState<string | null>(null);

  function goTo(next: Step) {
    setHistory((h) => [...h, step]);
    setStep(next);
  }
  function goBack() {
    setHistory((h) => {
      const prev = h[h.length - 1];
      if (prev) setStep(prev);
      return h.slice(0, -1);
    });
  }

  const progressIdx = PROGRESS_STEPS.indexOf(step);
  const progressPct = progressIdx >= 0 ? (progressIdx / (PROGRESS_STEPS.length - 1)) * 100 : 100;

  const valorMaxEmprestimo = form.valorImovel * LTV_MAX;
  const emprestimoClamped = Math.min(form.valorEmprestimo || 0, valorMaxEmprestimo);
  const ltv = form.valorImovel > 0 ? emprestimoClamped / form.valorImovel : 0;
  const taxaMensalIPCA = Math.pow(1 + IPCA_ANUAL_REF, 1 / 12) - 1;
  const taxaMensalTotal = TAXA_BASE_MENSAL + taxaMensalIPCA;

  const resultado = useMemo(() => {
    if (emprestimoClamped <= 0 || form.prazo <= 0) return null;
    const sac = calcSAC(emprestimoClamped, taxaMensalTotal, form.prazo);
    const cet = calcCET(emprestimoClamped, sac.primeiraParc, form.prazo);
    return { ...sac, cet };
  }, [emprestimoClamped, form.prazo, taxaMensalTotal]);

  const partnerName = partner?.full_name ?? null;
  const waLink = partner?.whatsapp
    ? `https://wa.me/55${partner.whatsapp}?text=${encodeURIComponent(
        `Olá! Simulei um Home Equity de ${fmtBRL(emprestimoClamped)} com a V3 Partners (protocolo ${leadCode ?? ""}) e quero avançar.`
      )}`
    : null;

  async function finalizarSimulacao() {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/public/home-equity-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ref: ref || null,
          objetivo: form.objetivo, urgencia: form.urgencia, perfilImovel: form.perfilImovel,
          prazoMeses: form.prazo, valorImovel: form.valorImovel, valorCredito: emprestimoClamped,
          tipoPessoa: form.tipoPessoa, averbado: form.averbado === true, statusImovel: form.statusImovel,
          bancoFinanciamento: form.bancoFinanciamento || null,
          valorFinanciamento: form.valorFinanciamento || null,
          nome: form.nome, cpf: form.cpf, ocupacao: form.ocupacao, renda: form.renda,
          nascimento: form.nascimento || null, telefone: form.telefone, email: form.email,
          cep: form.cep || null, estado: form.estado, cidade: form.cidade,
          bairro: form.bairro || null, rua: form.rua || null, numero: form.numero || null,
          complemento: form.complemento || null, consentimentoScr: true,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Falha ao registrar simulação");
      setLeadCode(json.code ?? null);
      goTo("resultado");
    } catch (e) {
      setSubmitError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  function reiniciar() {
    setForm(INITIAL_FORM); setHistory([]); setStep("welcome"); setLeadCode(null); setSubmitError(null);
  }

  const dadosPessoaisValid = Boolean(
    form.nome.trim().length >= 3 && form.cpf.replace(/\D/g, "").length === 11 && form.ocupacao &&
    form.renda >= 0 && form.telefone.replace(/\D/g, "").length >= 10 && form.email.includes("@") &&
    form.estado && form.cidade.trim()
  );

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
                  Algumas perguntas rápidas e você já vê taxa, parcela e prazo do seu Home Equity — sem compromisso.
                </p>
                {partnerName && <p className="text-xs pt-1" style={{ color: GOLD }}>Simulação enviada por {partnerName} — Partner V3</p>}
              </div>
              <button onClick={() => goTo("objetivo")}
                className="w-full py-3.5 rounded-xl font-bold text-sm text-black flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
                style={{ background: GOLD }}>
                Começar simulação <ArrowRight className="w-4 h-4" />
              </button>
            </div>
            <div className="flex items-start gap-2.5 rounded-xl border px-4 py-3 mt-4" style={{ background: `${GOLD}0d`, borderColor: `${GOLD}30` }}>
              <Clock3 className="w-4 h-4 shrink-0 mt-0.5" style={{ color: GOLD }} />
              <p className="text-xs" style={{ color: "#D8CCA8" }}>Leva poucos minutos. Preencha com atenção para um resultado mais preciso.</p>
            </div>
          </div>
        )}

        {/* ── Objetivo ── */}
        {step === "objetivo" && (
          <StepCard stepNum={1} totalSteps={11} title="Qual o" titleHighlight="objetivo do seu crédito?"
            subtitle="Para podermos escolher o melhor produto para você, vamos começar entendendo a finalidade do seu crédito."
            onBack={goBack}>
            <ChoiceGrid columns={2} onSelect={(v) => { set("objetivo", v); goTo("urgencia"); }} options={[
              { value: "Quitar dívidas", label: "Quitar dívidas", icon: Wallet },
              { value: "Investir", label: "Investir", icon: TrendingUp },
              { value: "Capital de giro", label: "Capital de giro", icon: Landmark },
              { value: "Outros", label: "Outros", icon: MoreHorizontal },
            ]} />
          </StepCard>
        )}

        {/* ── Urgência ── */}
        {step === "urgencia" && (
          <StepCard stepNum={2} totalSteps={11} title="Em quanto tempo" titleHighlight="pretende realizar a operação?"
            subtitle="Com isso entendemos sua urgência em conseguir o seu crédito."
            onBack={goBack}>
            <ChoiceGrid columns={2} onSelect={(v) => { set("urgencia", v); goTo("perfil-imovel"); }} options={[
              { value: "Imediatamente", label: "Imediatamente", icon: CheckCircle2 },
              { value: "Em até 1 mês", label: "Em até 1 mês", icon: CalendarClock },
              { value: "Em até 3 meses", label: "Em até 3 meses", icon: CalendarDays },
              { value: "Acima de 3 meses", label: "Acima de 3 meses", icon: CalendarDays },
              { value: "Apenas simulando", label: "Apenas simulando", icon: Search },
            ]} />
          </StepCard>
        )}

        {/* ── Perfil do imóvel ── */}
        {step === "perfil-imovel" && (
          <StepCard stepNum={3} totalSteps={11} title="Qual é o" titleHighlight="perfil do imóvel?"
            subtitle="Selecione o tipo do imóvel que você está dando em garantia."
            onBack={goBack}>
            <ChoiceGrid columns={2} onSelect={(v) => { set("perfilImovel", v); goTo("prazo"); }} options={[
              { value: "Casa", label: "Casa", icon: Home },
              { value: "Casa em condomínio", label: "Casa em condomínio", icon: Building },
              { value: "Apartamento", label: "Apartamento", icon: Building2 },
              { value: "Sala comercial", label: "Sala comercial", icon: Store },
              { value: "Outros", label: "Outros", icon: MoreHorizontal },
            ]} />
          </StepCard>
        )}

        {/* ── Prazo ── */}
        {step === "prazo" && (
          <StepCard stepNum={4} totalSteps={11} title="Qual prazo" titleHighlight="você prefere?"
            subtitle="Escolha a quantidade de meses que acredita se encaixar na sua renda."
            onBack={goBack}>
            <ChoiceGrid columns={2} onSelect={(v) => { set("prazo", Number(v)); goTo("valor-imovel"); }} options={PRAZOS_FIXOS.map((p) => ({
              value: String(p), label: `${p} meses`, icon: CalendarClock,
            }))} />
          </StepCard>
        )}

        {/* ── Valor do imóvel ── */}
        {step === "valor-imovel" && (
          <StepCard stepNum={5} totalSteps={11} title="Quais os" titleHighlight="valores da operação?"
            subtitle="Preencha os dados para gerarmos sua simulação."
            onBack={goBack}
            onNext={() => goTo("valor-credito")}
            nextDisabled={form.valorImovel < VALOR_IMOVEL_MIN}
            hint={`O valor mínimo do imóvel deve ser superior a ${fmtBRL(VALOR_IMOVEL_MIN)}.`}>
            <LabeledCurrencyInput label="Valor aproximado do imóvel" value={form.valorImovel} onChange={(v) => set("valorImovel", v)} autoFocus />
          </StepCard>
        )}

        {/* ── Valor do crédito ── */}
        {step === "valor-credito" && (
          <StepCard stepNum={6} totalSteps={11} title="Quanto você" titleHighlight="precisa de crédito?"
            subtitle="Calculamos automaticamente o teto permitido para o seu imóvel."
            onBack={goBack}
            onNext={() => goTo("tipo-pessoa")}
            nextDisabled={emprestimoClamped <= 0}
            hint={`Valor máximo permitido: ${fmtBRL(valorMaxEmprestimo)} (até 60% do valor do imóvel).`}>
            <LabeledCurrencyInput
              label="Valor desejado de crédito" value={form.valorEmprestimo} onChange={(v) => set("valorEmprestimo", v)} autoFocus
              helper={form.valorEmprestimo > valorMaxEmprestimo ? `Ajustado para o máximo permitido: ${fmtBRL(valorMaxEmprestimo)}` : undefined}
            />
          </StepCard>
        )}

        {/* ── Tipo de pessoa ── */}
        {step === "tipo-pessoa" && (
          <StepCard stepNum={7} totalSteps={11} title="Quem irá" titleHighlight="adquirir o crédito?"
            subtitle="Selecione se esta operação é destinada a uma pessoa jurídica ou física."
            onBack={goBack}>
            <ChoiceGrid columns={2} onSelect={(v) => { set("tipoPessoa", v as "PF" | "PJ"); goTo("averbado"); }} options={[
              { value: "PF", label: "Pessoa Física", icon: User },
              { value: "PJ", label: "Pessoa Jurídica", icon: Building2 },
            ]} />
          </StepCard>
        )}

        {/* ── Averbado ── */}
        {step === "averbado" && (
          <StepCard stepNum={8} totalSteps={11} title="O imóvel está" titleHighlight="averbado?"
            subtitle="Averbação é o registro de construção/melhorias no Cartório de Imóveis."
            onBack={goBack}>
            <ChoiceGrid columns={2} onSelect={(v) => { set("averbado", v === "sim"); goTo("status-imovel"); }} options={[
              { value: "sim", label: "Sim", icon: CheckCircle2 },
              { value: "nao", label: "Não", icon: XCircle },
            ]} />
          </StepCard>
        )}

        {/* ── Financiado ou quitado ── */}
        {step === "status-imovel" && (
          <StepCard stepNum={9} totalSteps={11} title="O imóvel está" titleHighlight="financiado ou quitado?"
            onBack={goBack}>
            <ChoiceGrid columns={2} onSelect={(v) => {
              set("statusImovel", v as "FINANCIADO" | "QUITADO");
              goTo(v === "FINANCIADO" ? "banco-financiamento" : "dados-pessoais");
            }} options={[
              { value: "FINANCIADO", label: "Financiado", icon: Landmark },
              { value: "QUITADO", label: "Quitado", icon: CheckCircle2 },
            ]} />
          </StepCard>
        )}

        {/* ── Onde financiou ── */}
        {step === "banco-financiamento" && (
          <StepCard stepNum={10} totalSteps={12} title="Aonde você" titleHighlight="financiou?"
            subtitle="Ex: Itaú, Bradesco, Caixa, etc."
            onBack={goBack}
            onNext={() => goTo("valor-financiamento")}
            nextDisabled={!form.bancoFinanciamento.trim()}>
            <Field label="Instituição financeira">
              <input value={form.bancoFinanciamento} onChange={(e) => set("bancoFinanciamento", e.target.value)}
                placeholder="Nome do banco" autoFocus className={inputCls} style={inputStyle} />
            </Field>
          </StepCard>
        )}

        {/* ── Valor do financiamento ── */}
        {step === "valor-financiamento" && (
          <StepCard stepNum={11} totalSteps={13} title="Qual é o" titleHighlight="valor do financiamento?"
            onBack={goBack}
            onNext={() => goTo("dados-pessoais")}
            nextDisabled={form.valorFinanciamento <= 0}>
            <LabeledCurrencyInput label="Saldo devedor aproximado" value={form.valorFinanciamento} onChange={(v) => set("valorFinanciamento", v)} autoFocus />
          </StepCard>
        )}

        {/* ── Dados pessoais + Termos + Privacidade + SCR/Bacen (mesma página) ── */}
        {step === "dados-pessoais" && (
          <StepCard stepNum={PROGRESS_STEPS.indexOf("dados-pessoais")} totalSteps={PROGRESS_STEPS.length - 1}
            title="Agora precisamos" titleHighlight="dos seus dados"
            subtitle="Preencha todos os dados e as autorizações abaixo para gerarmos o resultado da sua simulação."
            onBack={goBack}
            onNext={finalizarSimulacao}
            nextLabel="Autorizar e ver resultado"
            nextDisabled={!dadosPessoaisValid || !form.aceiteTermos || !form.aceiteScr}
            nextLoading={submitting}
            wide>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2"><Field label="Nome completo">
                <input value={form.nome} onChange={(e) => set("nome", e.target.value)} placeholder="Seu nome completo" autoFocus className={inputCls} style={inputStyle} />
              </Field></div>
              <Field label="CPF"><input value={form.cpf} onChange={(e) => set("cpf", maskCPF(e.target.value))} placeholder="000.000.000-00" className={inputCls} style={inputStyle} /></Field>
              <Field label="Ocupação">
                <select value={form.ocupacao} onChange={(e) => set("ocupacao", e.target.value)} className={inputCls} style={inputStyle}>
                  <option value="">Selecione</option>
                  {OCUPACOES.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </Field>
              <LabeledCurrencyInput label="Renda mensal" value={form.renda} onChange={(v) => set("renda", v)} />
              <Field label="Data de nascimento"><input type="date" value={form.nascimento} onChange={(e) => set("nascimento", e.target.value)} className={inputCls} style={inputStyle} /></Field>
              <Field label="Telefone / WhatsApp"><input value={form.telefone} onChange={(e) => set("telefone", maskPhone(e.target.value))} placeholder="(00) 00000-0000" className={inputCls} style={inputStyle} /></Field>
              <Field label="E-mail"><input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="seu@email.com" className={inputCls} style={inputStyle} /></Field>
              <Field label="CEP"><input value={form.cep} onChange={(e) => set("cep", maskCEP(e.target.value))} placeholder="00000-000" className={inputCls} style={inputStyle} /></Field>
              <Field label="Estado">
                <select value={form.estado} onChange={(e) => set("estado", e.target.value)} className={inputCls} style={inputStyle}>
                  <option value="">UF</option>
                  {ESTADOS_BR.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
              <Field label="Cidade"><input value={form.cidade} onChange={(e) => set("cidade", e.target.value)} className={inputCls} style={inputStyle} /></Field>
              <Field label="Bairro"><input value={form.bairro} onChange={(e) => set("bairro", e.target.value)} className={inputCls} style={inputStyle} /></Field>
              <Field label="Rua / Avenida"><input value={form.rua} onChange={(e) => set("rua", e.target.value)} className={inputCls} style={inputStyle} /></Field>
              <Field label="Número"><input value={form.numero} onChange={(e) => set("numero", e.target.value)} className={inputCls} style={inputStyle} /></Field>
              <div className="sm:col-span-2"><Field label="Complemento (opcional)">
                <input value={form.complemento} onChange={(e) => set("complemento", e.target.value)} className={inputCls} style={inputStyle} />
              </Field></div>
            </div>

            {/* ── Autorizações ── */}
            <div className="pt-2 border-t space-y-3" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
              <p className="text-[11px] font-bold uppercase tracking-widest text-left" style={{ color: GOLD }}>Autorizações</p>

              <label className="flex items-start gap-2.5 cursor-pointer">
                <input type="checkbox" checked={form.aceiteTermos} onChange={(e) => set("aceiteTermos", e.target.checked)} className="mt-0.5 w-4 h-4 accent-[#C9A84C]" />
                <span className="text-xs text-left" style={{ color: "#D8CCA8" }}>
                  Li e concordo com os{" "}
                  <a href="/termos-uso" target="_blank" rel="noreferrer" className="underline" style={{ color: GOLD }}>Termos de Uso</a>
                  {" "}e a{" "}
                  <a href="/politica-privacidade" target="_blank" rel="noreferrer" className="underline" style={{ color: GOLD }}>Política de Privacidade</a>
                  {" "}da V3 Partners.
                </span>
              </label>

              <div className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)" }}>
                <ShieldCheck className="w-4 h-4 shrink-0" style={{ color: "#F59E0B" }} />
                <p className="text-[11px] font-semibold text-left" style={{ color: "#F59E0B" }}>RASCUNHO — texto abaixo pendente de revisão jurídica da V3 Partners</p>
              </div>
              <div className="max-h-40 overflow-y-auto rounded-xl border p-3 text-[11px] leading-relaxed space-y-2 text-left" style={{ background: NAVY, borderColor: "rgba(255,255,255,0.08)", color: MUTED }}>
                <p>Ao marcar a opção abaixo, autorizo a <strong style={{ color: "white" }}>V3 Partners Soluções Ltda</strong> (CNPJ 14.219.287/0001-50) a consultar meus dados cadastrais e de crédito — incluindo o Sistema de Informações de Crédito (SCR) do Banco Central do Brasil — junto a bureaus de crédito e instituições financeiras envolvidas na análise, exclusivamente para fins de avaliação de crédito e estruturação da operação solicitada nesta simulação.</p>
                <p>Esta autorização: (i) é voluntária e pode ser revogada a qualquer momento mediante solicitação por escrito; (ii) tem como única finalidade a análise de crédito desta operação; (iii) respeita a Lei Geral de Proteção de Dados (Lei nº 13.709/2018 — LGPD) e as normas do Banco Central do Brasil aplicáveis ao SCR; (iv) não implica qualquer garantia de aprovação de crédito.</p>
                <p>Meus dados serão tratados com sigilo pela V3 Partners e não serão usados para outra finalidade sem novo consentimento.</p>
              </div>
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input type="checkbox" checked={form.aceiteScr} onChange={(e) => set("aceiteScr", e.target.checked)} className="mt-0.5 w-4 h-4 accent-[#C9A84C]" />
                <span className="text-xs text-left" style={{ color: "#D8CCA8" }}>Li e autorizo a consulta de crédito e ao SCR/Bacen nos termos acima.</span>
              </label>
              {submitError && <p className="text-xs text-red-400 text-left">{submitError}</p>}
            </div>
          </StepCard>
        )}

        {/* ── Resultado ── */}
        {step === "resultado" && resultado && (
          <div className="w-full max-w-md mx-auto space-y-4 animate-fade-in">
            <div className="rounded-2xl border p-6 sm:p-7 space-y-5" style={{ background: NAVY_CARD, borderColor: "rgba(255,255,255,0.06)" }}>
              <div className="text-center space-y-1">
                <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: GOLD }}>Resultado da simulação{leadCode ? ` · ${leadCode}` : ""}</p>
                <h2 className="text-xl sm:text-2xl font-bold text-white">Sua simulação Home Equity</h2>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {[
                  { icon: Wallet, label: "1ª Parcela", value: fmtBRL(resultado.primeiraParc), highlight: true },
                  { icon: Landmark, label: "Crédito Liberado", value: fmtBRL(emprestimoClamped) },
                  { icon: CalendarClock, label: "Prazo", value: `${form.prazo} meses` },
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
                  <p className="text-sm font-bold text-white">Recebemos sua simulação!</p>
                  <p className="text-xs mt-1" style={{ color: MUTED }}>
                    {partnerName ? `${partnerName} já foi notificado e vai falar com você.` : "Nossa equipe vai analisar e entrar em contato."}
                  </p>
                </div>
                {waLink ? (
                  <a href={waLink} target="_blank" rel="noreferrer"
                    className="w-full py-3.5 rounded-xl font-bold text-sm text-black flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
                    style={{ background: GOLD }}>
                    <MessageCircle className="w-4 h-4" /> Falar no WhatsApp agora
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
