"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Compass, Landmark, Handshake, ArrowRight, Check, Minus, Plus } from "lucide-react";
import { captureRefFromUrl, captureUtmFromUrl, capturePropFromUrl } from "@/lib/ref-tracking";
import { UNIT_PRICE_CENTS, MIN_CNPJ_COUNT, MIN_CPF_COUNT, clampSelection, calcTotalCents, fmtBRL, type ModularSelection } from "@/lib/credit-analysis-pricing";

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
    q: "Quantos CNPJs ou CPFs eu devo incluir?",
    a: "Inclua um CNPJ para cada empresa do seu grupo econômico que vai compor a operação, e um CPF para cada sócio ou garantidor que também precisa ser analisado. Na dúvida, comece com 1 CNPJ: nossa mesa orienta se for necessário ampliar depois.",
  },
  {
    q: "Em quanto tempo eu recebo o resultado?",
    a: "O relatório é processado assim que seus dados são confirmados. Se você escolher a consultoria, a conversa com nosso especialista é agendada conforme a disponibilidade da mesa.",
  },
  {
    q: "O que está incluído na Consultoria Estratégica?",
    a: "Uma reunião online de 45 minutos com a mesa de crédito da V3, com a devolutiva completa dos relatórios gerados e um plano de ação prático para os próximos passos da captação.",
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
  const [prop, setProp] = useState<string | null>(null);
  const [selection, setSelection] = useState<ModularSelection>({ cnpjCount: MIN_CNPJ_COUNT, cpfCount: MIN_CPF_COUNT, hasConsultancy: false });

  useEffect(() => {
    captureRefFromUrl();
    capturePropFromUrl();
    captureUtmFromUrl();
    const params = new URLSearchParams(window.location.search);
    setRef(params.get("ref"));
    setProp(params.get("prop"));
  }, []);

  const totalCents = useMemo(() => calcTotalCents(selection), [selection]);
  const totalAnalyses = selection.cnpjCount + selection.cpfCount;

  function setCnpjCount(n: number) {
    setSelection((p) => clampSelection({ ...p, cnpjCount: n }));
  }
  function setCpfCount(n: number) {
    setSelection((p) => clampSelection({ ...p, cpfCount: n }));
  }
  function toggleConsultancy() {
    setSelection((p) => ({ ...p, hasConsultancy: !p.hasConsultancy }));
  }

  const configuratorCheckoutHref = () => {
    const params = new URLSearchParams({
      cnpj: String(selection.cnpjCount),
      cpf: String(selection.cpfCount),
      consultoria: selection.hasConsultancy ? "1" : "0",
    });
    if (ref) params.set("ref", ref);
    if (prop) params.set("prop", prop);
    return `/analise/checkout?${params.toString()}`;
  };

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
          <a href="#configurador"
            style={{ display: "inline-flex", alignItems: "center", gap: 8, background: GO, color: N, fontWeight: 700, fontSize: 14, padding: "14px 28px", borderRadius: 8, textDecoration: "none" }}>
            Montar Meu Diagnóstico a partir de R$ 197 <ArrowRight size={16} />
          </a>
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

      {/* 4. CONFIGURADOR DE DIAGNÓSTICO MODULAR */}
      <section id="configurador" style={{ padding: "48px 20px", background: N2, borderTop: `1px solid ${N4}`, borderBottom: `1px solid ${N4}`, scrollMarginTop: 76 }}>
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
          <Eyebrow>Diagnóstico sob Medida</Eyebrow>
          <h2 style={{ fontSize: "clamp(22px, 4vw, 30px)", fontWeight: 800, textAlign: "center", marginBottom: 14, lineHeight: 1.3 }}>
            Pague só pelo que a sua operação precisa analisar
          </h2>
          <p style={{ fontSize: 13.5, color: MU, lineHeight: 1.7, textAlign: "center", maxWidth: 520, margin: "0 auto 36px" }}>
            Cada análise completa, de uma empresa (CNPJ) ou de um sócio/garantidor (CPF), custa R$ 197,00.
            Grupo com mais de uma empresa? Sócio que também entra como garantia da operação? Inclua quantos precisar.
          </p>

          <div style={{ background: N3, border: `1px solid ${N4}`, borderRadius: 12, padding: 28 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
              <ConfigCounter label="Empresas do grupo (CNPJ)" hint="Uma análise completa por empresa" value={selection.cnpjCount} min={MIN_CNPJ_COUNT} onChange={setCnpjCount} />
              <ConfigCounter label="Sócios ou garantidores (CPF)" hint="Inclua quem também compõe a operação" value={selection.cpfCount} min={MIN_CPF_COUNT} onChange={setCpfCount} />
            </div>

            <ul style={{ listStyle: "none", padding: 0, margin: "0 0 20px", display: "flex", flexDirection: "column", gap: 8 }}>
              {["Raio-X completo de cada CNPJ ou CPF incluído", "Mapeamento de restrições e notas de risco (rating)", "Relatório visual entregue em PDF"].map((item) => (
                <li key={item} style={{ display: "flex", gap: 8, fontSize: 12.5, color: MU, lineHeight: 1.5 }}>
                  <Check size={15} color={GO} style={{ flexShrink: 0, marginTop: 1 }} /> {item}
                </li>
              ))}
            </ul>

            <button
              type="button"
              onClick={toggleConsultancy}
              style={{
                width: "100%", textAlign: "left", background: selection.hasConsultancy ? "rgba(201,168,76,0.08)" : N2,
                border: `1px solid ${selection.hasConsultancy ? GO : N4}`, borderRadius: 10, padding: 16, cursor: "pointer",
                display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 20,
              }}
            >
              <ConfigSwitch on={selection.hasConsultancy} />
              <span style={{ fontSize: 12.5, color: MU, lineHeight: 1.6 }}>
                <strong style={{ color: CR }}>Quer a devolutiva com um especialista da mesa de crédito?</strong><br />
                Adicione uma reunião online de 45 minutos: você recebe a leitura completa dos relatórios e o plano de ação prático pra captar, direto com quem estrutura a operação. + {fmtBRL(UNIT_PRICE_CENTS)}
              </span>
            </button>

            <div style={{ borderTop: `1px solid ${N4}`, paddingTop: 18, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 18 }}>
              <div style={{ fontSize: 11.5, color: MU, lineHeight: 1.5 }}>
                {totalAnalyses} análise{totalAnalyses !== 1 ? "s" : ""} selecionada{totalAnalyses !== 1 ? "s" : ""}<br />
                Consultoria {selection.hasConsultancy ? "incluída" : "não incluída"}
              </div>
              <div style={{ fontSize: 26, fontWeight: 800, color: GO, whiteSpace: "nowrap" }}>{fmtBRL(totalCents)}</div>
            </div>

            <Link href={configuratorCheckoutHref()}
              style={{ display: "block", textAlign: "center", background: GO, color: N, fontWeight: 700, fontSize: 14, padding: "14px 0", borderRadius: 8, textDecoration: "none" }}>
              Avançar para Pagamento Seguro
            </Link>
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

// Contador +/- reutilizado para CNPJ e CPF no configurador da Seção 4.
function ConfigCounter({ label, hint, value, min, onChange }: { label: string; hint: string; value: number; min: number; onChange: (n: number) => void }) {
  return (
    <div style={{ background: N2, border: `1px solid ${N4}`, borderRadius: 8, padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: CR }}>{label}</div>
        <div style={{ fontSize: 11, color: MU, marginTop: 2 }}>{hint}</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
        <button type="button" onClick={() => onChange(value - 1)} disabled={value <= min}
          style={{ width: 28, height: 28, borderRadius: 6, border: `1px solid ${N4}`, background: N3, color: value <= min ? N4 : CR, display: "flex", alignItems: "center", justifyContent: "center", cursor: value <= min ? "not-allowed" : "pointer" }}>
          <Minus size={14} />
        </button>
        <span style={{ minWidth: 18, textAlign: "center", fontSize: 15, fontWeight: 700, color: CR, fontVariantNumeric: "tabular-nums" }}>{value}</span>
        <button type="button" onClick={() => onChange(value + 1)}
          style={{ width: 28, height: 28, borderRadius: 6, border: `1px solid ${GO}`, background: N3, color: GO, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
          <Plus size={14} />
        </button>
      </div>
    </div>
  );
}

// Switch visual do upsell de Consultoria (estado controlado pelo clique no card inteiro).
function ConfigSwitch({ on }: { on: boolean }) {
  return (
    <span style={{ flexShrink: 0, width: 34, height: 19, borderRadius: 10, background: on ? GO : N4, position: "relative", transition: "background 0.15s", marginTop: 2 }}>
      <span style={{ position: "absolute", top: 2, left: on ? 17 : 2, width: 15, height: 15, borderRadius: "50%", background: N, transition: "left 0.15s" }} />
    </span>
  );
}
