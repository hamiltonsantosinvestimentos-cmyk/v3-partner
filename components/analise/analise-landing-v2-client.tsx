"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Compass, Landmark, Handshake, ArrowRight, Check } from "lucide-react";
import { captureRefFromUrl, captureUtmFromUrl } from "@/lib/ref-tracking";

const N = "#09081A", N2 = "#13223A", N3 = "#162744", N4 = "#243A66";
const GO = "#C9A84C", GL = "#E8C97A", CR = "#F5F1E8", MU = "#9BAFC5";
const GOLD_BORDER = "rgba(201,168,76,0.35)";

function sectionBg(url: string) {
  return {
    backgroundImage: `radial-gradient(ellipse 1000px 650px at 50% 15%, rgba(9,8,26,0.93) 0%, rgba(9,8,26,0.8) 55%, rgba(9,8,26,0.62) 100%), url('${url}')`,
    backgroundSize: "cover",
    backgroundPosition: "center",
  } as const;
}

function cardBg(url: string) {
  return {
    backgroundImage: `linear-gradient(rgba(9,8,26,0.87), rgba(9,8,26,0.87)), url('${url}')`,
    backgroundSize: "cover",
    backgroundPosition: "center",
  } as const;
}

const PILARES = [
  {
    icon: Compass,
    title: "Seu Raio-X Financeiro",
    image: "/analise-v2/pilar-1.jpg",
    text: "Como o Banco Central e o mercado enxergam a saúde do seu CNPJ hoje: histórico, restrições e sinais de risco que moldam a primeira leitura de qualquer fundo sobre a operação.",
  },
  {
    icon: Landmark,
    title: "Sua Garantia Real",
    image: "/analise-v2/pilar-2.jpg",
    text: "Imóveis, máquinas ou recebíveis futuros: cada fundo aceita e valoriza um tipo diferente de garantia. Usar a garantia errada pode travar uma operação sólida.",
  },
  {
    icon: Handshake,
    title: "O Encontro Certo",
    image: "/analise-v2/pilar-3.jpg",
    text: "Cada fundo, FIDC ou securitizadora opera dentro de uma tese própria de investimento. A V3 conecta sua empresa ao fundo cuja tese realmente combina com o seu perfil.",
  },
];

const ETAPAS = [
  { num: "01", title: "O Raio-X do CNPJ", text: "Descobrimos onde estão as travas que hoje bloqueiam o crédito da sua empresa." },
  { num: "02", title: "A Arrumação da Casa", text: "Mostramos exatamente o que ajustar no perfil para ficar mais atraente para investidores institucionais." },
  { num: "03", title: "A Ponte para o Capital", text: "Apresentamos sua empresa diretamente aos fundos e securitizadoras cuja tese é aderente ao seu perfil." },
  { num: "04", title: "Estruturação", text: "Acompanhamos o processo até a operação formalizada, com a V3 atuando como estruturadora entre a empresa e o mercado de capitais." },
];

const FAQ = [
  {
    q: "A V3 é um banco?",
    a: "Não. A V3 Partners não empresta dinheiro. Somos uma boutique de estruturação financeira: organizamos o perfil da sua empresa e fazemos a ponte até os fundos, FIDCs e securitizadoras cuja tese é aderente ao seu caso.",
  },
  {
    q: "Em quanto tempo eu recebo o resultado?",
    a: "O relatório é processado assim que seus dados são confirmados. Se você escolher a consultoria, a conversa com nosso especialista é agendada conforme a disponibilidade da mesa.",
  },
  {
    q: "Contratando a análise, meu crédito é aprovado?",
    a: "A análise não garante aprovação: nenhuma empresa séria pode prometer isso. O que ela garante é clareza: você entende exatamente onde está travado e qual caminho tem mais chance de funcionar, antes de gastar tempo batendo na porta errada.",
  },
];

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: GL, marginBottom: 10, textAlign: "center" }}>
      {children}
    </div>
  );
}

export function AnaliseLandingV2Client() {
  const [ref, setRef] = useState<string | null>(null);

  useEffect(() => {
    captureRefFromUrl();
    captureUtmFromUrl();
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
      <section style={{ ...sectionBg("/analise-v2/hero.jpg"), padding: "56px 20px 48px", textAlign: "center" }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <Eyebrow>V3 Partners · Bússola de Crédito</Eyebrow>
          <h1 style={{ fontSize: "clamp(26px, 5vw, 42px)", fontWeight: 800, lineHeight: 1.25, color: CR, marginBottom: 20 }}>
            Buscar crédito sem o mapa certo é como andar no escuro. A V3 é a bússola até o capital certo para a sua empresa.
          </h1>
          <p style={{ fontSize: 15, lineHeight: 1.7, color: MU, maxWidth: 600, margin: "0 auto 32px" }}>
            Muitos empresários têm o crédito negado no banco tradicional não porque a empresa é ruim, mas porque bateram na porta errada e apresentaram a operação numa linguagem que aquele banco não usa. A V3 organiza o perfil do seu CNPJ e mostra qual fundo tem mais chance de dizer sim.
          </p>
          <Link href={checkoutHref("credit_analysis")}
            style={{ display: "inline-flex", alignItems: "center", gap: 8, background: GO, color: N, fontWeight: 700, fontSize: 14, padding: "14px 28px", borderRadius: 8, textDecoration: "none" }}>
            Descobrir o Perfil do Meu CNPJ Agora <ArrowRight size={16} />
          </Link>
        </div>

        {/* Video explicativo da Analise de Credito.
            Substituiu o placeholder "Video explicativo em producao" em 10/08/2026,
            que ficava visivel ao cliente numa pagina de venda ativa.
            loading lazy para nao competir com o carregamento do Hero. */}
        <div style={{ maxWidth: 720, margin: "40px auto 0" }}>
          <div style={{ position: "relative", aspectRatio: "16/9", background: "rgba(9,8,26,0.55)", border: `1px solid ${GOLD_BORDER}`, borderRadius: 12, overflow: "hidden" }}>
            <iframe
              src="https://www.youtube.com/embed/Mt7Q-WwYlXw?rel=0&modestbranding=1"
              title="Análise de Crédito V3 Partners"
              loading="lazy"
              allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 }}
            />
          </div>
        </div>
      </section>

      {/* 2. O PROBLEMA & A BÚSSOLA */}
      <section style={{ ...sectionBg("/analise-v2/problema.jpg"), padding: "48px 20px", borderTop: `1px solid ${N4}`, borderBottom: `1px solid ${N4}` }}>
        <div style={{ maxWidth: 960, margin: "0 auto" }}>
          <Eyebrow>Por que a porta certa muda tudo</Eyebrow>
          <h2 style={{ fontSize: "clamp(22px, 4vw, 30px)", fontWeight: 800, textAlign: "center", marginBottom: 24, lineHeight: 1.3 }}>
            Por que seu banco diz não, enquanto existem fundos buscando exatamente esse tipo de operação?
          </h2>
          <p style={{ fontSize: 14, color: MU, lineHeight: 1.7, textAlign: "center", maxWidth: 680, margin: "0 auto 40px" }}>
            Imagine ter um mapa na mão, mas não saber ler as coordenadas. É isso que acontece quando uma empresa pede crédito sem preparo: o banco de varejo olha para fotos antigas do passado da empresa. Os fundos de investimento e as securitizadoras olham para o futuro, mas só enxergam esse futuro quando ele é apresentado na linguagem certa.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 20 }}>
            {PILARES.map((p) => (
              <div key={p.title} style={{ ...cardBg(p.image), border: `1px solid ${GOLD_BORDER}`, borderRadius: 10, padding: 24 }}>
                <p.icon size={26} color={GO} strokeWidth={1.5} style={{ marginBottom: 14 }} />
                <div style={{ fontSize: 15, fontWeight: 700, color: CR, marginBottom: 8 }}>{p.title}</div>
                <div style={{ fontSize: 13, color: MU, lineHeight: 1.65 }}>{p.text}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 3. PASSO A PASSO */}
      <section style={{ ...sectionBg("/analise-v2/caminho.jpg"), padding: "48px 20px" }}>
        <div style={{ maxWidth: 960, margin: "0 auto" }}>
          <Eyebrow>O Caminho até o Capital</Eyebrow>
          <h2 style={{ fontSize: "clamp(22px, 4vw, 30px)", fontWeight: 800, textAlign: "center", marginBottom: 40, lineHeight: 1.3 }}>
            O passo a passo da V3 até a operação estruturada
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 18 }}>
            {ETAPAS.map((e) => (
              <div key={e.num} style={{ background: "rgba(19,34,58,0.75)", backdropFilter: "blur(6px)", border: `1px solid ${N4}`, borderRadius: 10, padding: 22 }}>
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
                {["Raio-X completo do CNPJ e CPF dos sócios", "Mapeamento de restrições e notas de risco (rating)", "Relatório visual entregue em PDF"].map((item) => (
                  <li key={item} style={{ display: "flex", gap: 8, fontSize: 12.5, color: MU, lineHeight: 1.5 }}>
                    <Check size={15} color={GO} style={{ flexShrink: 0, marginTop: 1 }} /> {item}
                  </li>
                ))}
              </ul>
              <Link href={checkoutHref("credit_analysis")}
                style={{ textAlign: "center", background: N4, color: CR, fontWeight: 700, fontSize: 13, padding: "12px 0", borderRadius: 8, textDecoration: "none" }}>
                Comprar Somente a Análise
              </Link>
            </div>

            {/* Plano 2: recomendado */}
            <div style={{ ...cardBg("/analise-v2/consultoria.jpg"), border: `1px solid ${GO}`, borderRadius: 12, padding: 28, display: "flex", flexDirection: "column", position: "relative" }}>
              <div style={{ position: "absolute", top: -12, left: 28, background: GO, color: N, fontSize: 9.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", padding: "4px 10px", borderRadius: 4 }}>
                Recomendado
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: CR, marginBottom: 4, marginTop: 6 }}>Análise + Consultoria Estratégica V3</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: GO, margin: "12px 0 20px" }}>R$ 997,00</div>
              <ul style={{ listStyle: "none", padding: 0, margin: "0 0 24px", display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
                {["Tudo do Relatório de Análise", "Reunião online de 45 minutos com especialista da V3", "Devolutiva personalizada + plano de ação prático para o CNPJ"].map((item) => (
                  <li key={item} style={{ display: "flex", gap: 8, fontSize: 12.5, color: MU, lineHeight: 1.5 }}>
                    <Check size={15} color={GO} style={{ flexShrink: 0, marginTop: 1 }} /> {item}
                  </li>
                ))}
              </ul>
              <Link href={checkoutHref("credit_analysis_consultoria")}
                style={{ textAlign: "center", background: GO, color: N, fontWeight: 700, fontSize: 13, padding: "12px 0", borderRadius: 8, textDecoration: "none" }}>
                Garantir Análise + Consultoria do Time V3
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
          <a href="mailto:operacoes@v3partners.com.br" style={{ color: MU }}>operacoes@v3partners.com.br</a>
        </div>
      </footer>
    </div>
  );
}
