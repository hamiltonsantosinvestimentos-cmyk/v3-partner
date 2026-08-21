"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { PlayCircle, ShieldCheck, Scale, Target, ArrowRight, Check } from "lucide-react";
import { captureRefFromUrl } from "@/lib/ref-tracking";

const N = "#09081A", N2 = "#13223A", N3 = "#162744", N4 = "#243A66";
const GO = "#C9A84C", GL = "#E8C97A", CR = "#F5F1E8", MU = "#9BAFC5";

const PILARES = [
  {
    icon: ShieldCheck,
    title: "Risco / SCR",
    text: "Histórico no Sistema de Informações de Crédito (SCR) do Banco Central, restrições, protestos e sanções administrativas moldam a primeira leitura de qualquer fundo sobre a operação.",
  },
  {
    icon: Scale,
    title: "Qualidade das Garantias",
    text: "Nem toda garantia tem a mesma liquidez para quem está do outro lado da mesa. A estruturação correta da garantia muda diretamente o spread oferecido.",
  },
  {
    icon: Target,
    title: "Tese do Fundo",
    text: "Cada fundo, FIDC ou securitizadora opera dentro de uma tese específica: setor, ticket, prazo, garantia aceita. Uma operação sólida pode ser recusada só por não aderir à tese daquele fundo.",
  },
];

const ETAPAS = [
  { num: "01", title: "Diagnóstico", text: "Análise completa do CNPJ e dos sócios: situação cadastral, histórico judicial, restrições e rating de mercado." },
  { num: "02", title: "Adequação", text: "Mapeamento de riscos e orientação sobre o que ajustar no perfil antes de qualquer apresentação a fundos." },
  { num: "03", title: "Conexão", text: "Apresentação da operação aos fundos e FIDCs cuja tese de investimento é aderente ao perfil da empresa." },
  { num: "04", title: "Estruturação", text: "Formalização da operação, com a V3 atuando como estruturadora entre a empresa e o mercado de capitais." },
];

const FAQ = [
  {
    q: "A V3 é um banco ou uma corretora?",
    a: "Não. A V3 Partners é uma boutique de estruturação financeira e securitização. Não emprestamos dinheiro nem somos intermediários regulados de valores mobiliários: estruturamos operações e conectamos empresas aos fundos, FIDCs e securitizadoras cuja tese é aderente ao perfil de cada cliente.",
  },
  {
    q: "Quanto tempo leva para sair o relatório?",
    a: "O relatório é processado pelo motor de análise V3 assim que os dados são confirmados. A consultoria adicional é agendada conforme disponibilidade da mesa.",
  },
  {
    q: "O relatório garante que terei crédito aprovado?",
    a: "Não. O relatório mostra o diagnóstico real do perfil de crédito da empresa e onde estão os pontos de atenção. A aprovação final depende da análise de cada fundo. O que a V3 oferece é clareza sobre o que precisa ser ajustado antes de buscar capital, e conexão com os fundos cuja tese é mais aderente ao perfil da operação.",
  },
];

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: GL, marginBottom: 10, textAlign: "center" }}>
      {children}
    </div>
  );
}

export function AnaliseLandingClient() {
  const [ref, setRef] = useState<string | null>(null);

  useEffect(() => {
    captureRefFromUrl();
    const params = new URLSearchParams(window.location.search);
    setRef(params.get("ref"));
  }, []);

  const checkoutHref = (plano: string) => `/analise/checkout?plano=${plano}${ref ? `&ref=${ref}` : ""}`;

  return (
    <div style={{ background: N, fontFamily: "'DM Sans', sans-serif", color: CR }}>
      {/* Header */}
      <header style={{ position: "sticky", top: 0, zIndex: 20, background: "rgba(9,8,26,0.92)", backdropFilter: "blur(8px)", borderBottom: `1px solid ${N4}`, padding: "16px 20px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", justifyContent: "center" }}>
          <Image src="/v3-logo-flat-gold-alpha.png" alt="V3 Partners" width={130} height={36} style={{ height: 36, width: "auto" }} />
        </div>
      </header>

      {/* 1. HERO */}
      <section style={{ padding: "56px 20px 48px", textAlign: "center" }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <Eyebrow>V3 Partners · Diagnóstico de Crédito</Eyebrow>
          <h1 style={{ fontSize: "clamp(26px, 5vw, 42px)", fontWeight: 800, lineHeight: 1.25, color: CR, marginBottom: 20 }}>
            Antes de buscar crédito, saiba qual é o perfil real da sua empresa.
          </h1>
          <p style={{ fontSize: 15, lineHeight: 1.7, color: MU, maxWidth: 600, margin: "0 auto 32px" }}>
            A maior parte das negativas de crédito para PMEs não vem de falta de capital disponível no mercado: vem do desalinhamento entre o perfil real da empresa e as exigências específicas de cada fundo. A V3 estrutura esse diagnóstico antes de qualquer aproximação com o mercado de capitais.
          </p>
          <Link href={checkoutHref("credit_analysis")}
            style={{ display: "inline-flex", alignItems: "center", gap: 8, background: GO, color: N, fontWeight: 700, fontSize: 14, padding: "14px 28px", borderRadius: 8, textDecoration: "none" }}>
            Iniciar minha Análise de Crédito <ArrowRight size={16} />
          </Link>
        </div>

        {/* Video placeholder */}
        <div style={{ maxWidth: 720, margin: "40px auto 0" }}>
          <div style={{ position: "relative", aspectRatio: "16/9", background: N2, border: `1px solid ${N4}`, borderRadius: 12, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10 }}>
            <PlayCircle size={48} color={GO} strokeWidth={1.5} />
            <span style={{ fontSize: 11, color: MU, letterSpacing: "0.04em", textTransform: "uppercase" }}>Vídeo explicativo em produção</span>
          </div>
        </div>
      </section>

      {/* 2. DIAGNÓSTICO */}
      <section style={{ padding: "48px 20px", background: N2, borderTop: `1px solid ${N4}`, borderBottom: `1px solid ${N4}` }}>
        <div style={{ maxWidth: 960, margin: "0 auto" }}>
          <Eyebrow>O Diagnóstico</Eyebrow>
          <h2 style={{ fontSize: "clamp(22px, 4vw, 30px)", fontWeight: 800, textAlign: "center", marginBottom: 40, lineHeight: 1.3 }}>
            Por que bancos e fundos negam crédito, mesmo com garantias reais
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 20, marginBottom: 32 }}>
            {PILARES.map((p) => (
              <div key={p.title} style={{ background: N3, border: `1px solid ${N4}`, borderRadius: 10, padding: 24 }}>
                <p.icon size={26} color={GO} strokeWidth={1.5} style={{ marginBottom: 14 }} />
                <div style={{ fontSize: 15, fontWeight: 700, color: CR, marginBottom: 8 }}>{p.title}</div>
                <div style={{ fontSize: 13, color: MU, lineHeight: 1.65 }}>{p.text}</div>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 14, color: MU, lineHeight: 1.7, textAlign: "center", maxWidth: 680, margin: "0 auto" }}>
            A V3 Partners existe para traduzir o perfil real da sua empresa para a linguagem que cada fundo entende, e reduzir o spread ao aproximar a operação da tese certa desde o início.
          </p>
        </div>
      </section>

      {/* 3. COMO FUNCIONA */}
      <section style={{ padding: "48px 20px" }}>
        <div style={{ maxWidth: 960, margin: "0 auto" }}>
          <Eyebrow>O Caminho do Capital</Eyebrow>
          <h2 style={{ fontSize: "clamp(22px, 4vw, 30px)", fontWeight: 800, textAlign: "center", marginBottom: 40, lineHeight: 1.3 }}>
            Como a V3 estrutura sua operação
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 18 }}>
            {ETAPAS.map((e) => (
              <div key={e.num} style={{ background: N2, border: `1px solid ${N4}`, borderRadius: 10, padding: 22 }}>
                <div style={{ fontSize: 26, fontWeight: 800, color: N4, marginBottom: 10, fontVariantNumeric: "tabular-nums" }}>{e.num}</div>
                <div style={{ fontSize: 14.5, fontWeight: 700, color: CR, marginBottom: 8 }}>{e.title}</div>
                <div style={{ fontSize: 12.5, color: MU, lineHeight: 1.6 }}>{e.text}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 4. PREÇOS */}
      <section style={{ padding: "48px 20px", background: N2, borderTop: `1px solid ${N4}`, borderBottom: `1px solid ${N4}` }}>
        <div style={{ maxWidth: 860, margin: "0 auto" }}>
          <Eyebrow>Planos</Eyebrow>
          <h2 style={{ fontSize: "clamp(22px, 4vw, 30px)", fontWeight: 800, textAlign: "center", marginBottom: 40, lineHeight: 1.3 }}>
            Escolha o nível de profundidade do seu diagnóstico
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 24 }}>
            {/* Plano 1 */}
            <div style={{ background: N3, border: `1px solid ${N4}`, borderRadius: 12, padding: 28, display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: CR, marginBottom: 4 }}>Relatório de Análise de Crédito</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: GO, margin: "12px 0 20px" }}>R$ 497,00</div>
              <ul style={{ listStyle: "none", padding: 0, margin: "0 0 24px", display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
                {["Diagnóstico completo do CNPJ e dos sócios", "Mapeamento de restrições e rating de mercado", "Relatório em PDF gerado pelo motor V3"].map((item) => (
                  <li key={item} style={{ display: "flex", gap: 8, fontSize: 12.5, color: MU, lineHeight: 1.5 }}>
                    <Check size={15} color={GO} style={{ flexShrink: 0, marginTop: 1 }} /> {item}
                  </li>
                ))}
              </ul>
              <Link href={checkoutHref("credit_analysis")}
                style={{ textAlign: "center", background: N4, color: CR, fontWeight: 700, fontSize: 13, padding: "12px 0", borderRadius: 8, textDecoration: "none" }}>
                Contratar Análise
              </Link>
            </div>

            {/* Plano 2: recomendado */}
            <div style={{ background: N3, border: `1px solid ${GO}`, borderRadius: 12, padding: 28, display: "flex", flexDirection: "column", position: "relative" }}>
              <div style={{ position: "absolute", top: -12, left: 28, background: GO, color: N, fontSize: 9.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", padding: "4px 10px", borderRadius: 4 }}>
                Recomendado
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: CR, marginBottom: 4, marginTop: 6 }}>Análise + Consultoria Estratégica V3</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: GO, margin: "12px 0 20px" }}>R$ 997,00</div>
              <ul style={{ listStyle: "none", padding: 0, margin: "0 0 24px", display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
                {["Tudo do Relatório de Análise de Crédito", "Reunião de 45 minutos com especialista de crédito V3", "Devolutiva personalizada do relatório", "Plano de ação para adequação do perfil"].map((item) => (
                  <li key={item} style={{ display: "flex", gap: 8, fontSize: 12.5, color: MU, lineHeight: 1.5 }}>
                    <Check size={15} color={GO} style={{ flexShrink: 0, marginTop: 1 }} /> {item}
                  </li>
                ))}
              </ul>
              <Link href={checkoutHref("credit_analysis_consultoria")}
                style={{ textAlign: "center", background: GO, color: N, fontWeight: 700, fontSize: 13, padding: "12px 0", borderRadius: 8, textDecoration: "none" }}>
                Contratar Análise + Consultoria
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 5. FAQ */}
      <section style={{ padding: "48px 20px" }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <Eyebrow>Perguntas Frequentes</Eyebrow>
          <h2 style={{ fontSize: "clamp(22px, 4vw, 30px)", fontWeight: 800, textAlign: "center", marginBottom: 36, lineHeight: 1.3 }}>
            O que você precisa saber
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {FAQ.map((f) => (
              <details key={f.q} style={{ background: N2, border: `1px solid ${N4}`, borderRadius: 10, padding: "16px 20px" }}>
                <summary style={{ cursor: "pointer", fontSize: 14, fontWeight: 700, color: CR, listStyle: "none" }}>{f.q}</summary>
                <p style={{ fontSize: 13, color: MU, lineHeight: 1.7, marginTop: 12 }}>{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ padding: "32px 20px", borderTop: `1px solid ${N4}`, textAlign: "center" }}>
        <div style={{ fontSize: 10.5, color: MU, lineHeight: 1.8 }}>
          V3 Partners Soluções Ltda · CNPJ 14.219.287/0001-50<br />
          <a href="mailto:financeiro@v3partners.com.br" style={{ color: MU }}>financeiro@v3partners.com.br</a>
        </div>
      </footer>
    </div>
  );
}
