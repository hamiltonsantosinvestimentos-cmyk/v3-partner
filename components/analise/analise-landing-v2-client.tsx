"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Compass, Landmark, Handshake, ArrowRight, Check, Minus, Plus, Building2, UserRound, Users, AlertTriangle } from "lucide-react";
import { captureRefFromUrl, captureUtmFromUrl, capturePropFromUrl } from "@/lib/ref-tracking";
import { clampSelection, calcTotalCents, fmtBRL, getMinCounts, UNIT_PRICE_CENTS, type ModularSelection, type ProfileType, type CompanyStructure } from "@/lib/credit-analysis-pricing";

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
    a: "O configurador já te guia por isso: se você é Pessoa Física, só entra CPF. Se você é Empresário, o mínimo já vem travado no CNPJ da empresa mais os sócios/garantidores da operação (1 para empresa unipessoal, 2 ou mais para sociedade com múltiplos sócios), porque nenhum fundo avalia uma empresa isoladamente. Precisa incluir mais de uma empresa do grupo ou mais garantidores? É só somar no configurador.",
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

// Fluxo condicional PF/PJ (26/08/2026): blinda 2 problemas reais — empresário
// comprando só CNPJ (diagnóstico incompleto sem sócio/garantidor) e pessoa
// física sem empresa travada comprando 1 CNPJ que não precisa. Ver
// lib/credit-analysis-pricing.ts getMinCounts() para a regra de negócio.
type QualifyStep = "perfil" | "estrutura" | "configurador";

export function AnaliseLandingV2Client() {
  const [ref, setRef] = useState<string | null>(null);
  const [prop, setProp] = useState<string | null>(null);
  const [qualifyStep, setQualifyStep] = useState<QualifyStep>("perfil");
  const [profileType, setProfileType] = useState<ProfileType | null>(null);
  const [companyStructure, setCompanyStructure] = useState<CompanyStructure | null>(null);
  const [selection, setSelection] = useState<ModularSelection>({ cnpjCount: 0, cpfCount: 0, hasConsultancy: false });

  useEffect(() => {
    captureRefFromUrl();
    capturePropFromUrl();
    captureUtmFromUrl();
    const params = new URLSearchParams(window.location.search);
    setRef(params.get("ref"));
    setProp(params.get("prop"));
  }, []);

  const min = useMemo(() => getMinCounts(profileType, companyStructure), [profileType, companyStructure]);
  const totalCents = useMemo(() => calcTotalCents(selection), [selection]);
  const totalAnalyses = selection.cnpjCount + selection.cpfCount;

  function selectPessoaFisica() {
    const m = getMinCounts("PF", null);
    setProfileType("PF");
    setCompanyStructure(null);
    setSelection(clampSelection({ cnpjCount: m.minCnpj, cpfCount: m.minCpf, hasConsultancy: false }, m));
    setQualifyStep("configurador");
  }
  function selectEmpresario() {
    setProfileType("PJ");
    setQualifyStep("estrutura");
  }
  function selectStructure(structure: CompanyStructure) {
    const m = getMinCounts("PJ", structure);
    setCompanyStructure(structure);
    setSelection(clampSelection({ cnpjCount: m.minCnpj, cpfCount: m.minCpf, hasConsultancy: false }, m));
    setQualifyStep("configurador");
  }
  function trocarPerfil() {
    setQualifyStep("perfil");
    setProfileType(null);
    setCompanyStructure(null);
    setSelection({ cnpjCount: 0, cpfCount: 0, hasConsultancy: false });
  }

  function setCnpjCount(n: number) {
    setSelection((p) => clampSelection({ ...p, cnpjCount: n }, min));
  }
  function setCpfCount(n: number) {
    setSelection((p) => clampSelection({ ...p, cpfCount: n }, min));
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
    if (profileType) params.set("perfil", profileType);
    if (companyStructure) params.set("estrutura", companyStructure);
    if (ref) params.set("ref", ref);
    if (prop) params.set("prop", prop);
    return `/analise/checkout?${params.toString()}`;
  };

  return (
    <div style={{ background: N, fontFamily: "'DM Sans', sans-serif", color: CR }}>
      {/* Sinalização visual dos cards de escolha de perfil (Passo 1) e das
          opções de estrutura societária (Passo 2): pulso sutil pra chamar o
          clique (para no hover) + elevação/brilho dourado no hover. Precisa
          ser CSS de verdade (não inline) por causa do :hover e @keyframes;
          !important só nas propriedades que também têm valor inline (border,
          background), que sempre vencem uma classe CSS comum. */}
      <style>{`
        @keyframes v3ProfilePulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(201,168,76,0.28); }
          50% { box-shadow: 0 0 0 10px rgba(201,168,76,0); }
        }
        .v3-profile-card {
          animation: v3ProfilePulse 2.6s ease-in-out infinite;
          transition: transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
        }
        .v3-profile-card:hover {
          animation: none;
          transform: translateY(-4px);
          border-color: #C9A84C !important;
          box-shadow: 0 10px 28px rgba(201,168,76,0.22);
        }
        .v3-profile-card:hover .v3-profile-card-arrow { transform: translateX(4px); }
        .v3-profile-card-arrow { transition: transform 0.15s ease; }
        .v3-structure-option {
          transition: transform 0.15s ease, border-color 0.15s ease, background 0.15s ease;
        }
        .v3-structure-option:hover {
          transform: translateX(4px);
          border-color: #C9A84C !important;
          background: rgba(201,168,76,0.08) !important;
        }
        .v3-structure-option:hover .v3-profile-card-arrow { transform: translateX(4px); }
      `}</style>
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

      {/* 4. QUALIFICAÇÃO DE PERFIL + CONFIGURADOR DE DIAGNÓSTICO MODULAR */}
      <section id="configurador" style={{ padding: "48px 20px", background: N2, borderTop: `1px solid ${N4}`, borderBottom: `1px solid ${N4}`, scrollMarginTop: 76 }}>
        <div style={{ maxWidth: 640, margin: "0 auto" }}>
          <Eyebrow>Diagnóstico sob Medida</Eyebrow>
          <h2 style={{ fontSize: "clamp(22px, 4vw, 30px)", fontWeight: 800, textAlign: "center", marginBottom: 14, lineHeight: 1.3 }}>
            {qualifyStep === "perfil" ? "Antes de tudo, qual é o seu perfil?" : "Pague só pelo que a sua operação precisa analisar"}
          </h2>

          {/* PASSO 1: Pessoa Física vs Empresário/Sócio */}
          {qualifyStep === "perfil" && (
            <>
              <p style={{ fontSize: 13.5, color: MU, lineHeight: 1.7, textAlign: "center", maxWidth: 520, margin: "0 auto 8px" }}>
                A composição do seu diagnóstico muda conforme seu perfil: uma empresa nunca é avaliada isoladamente pelo mercado de crédito, sempre junto de quem responde por ela.
              </p>
              <p style={{ fontSize: 11.5, fontWeight: 700, color: GL, textTransform: "uppercase", letterSpacing: "0.06em", textAlign: "center", margin: "0 0 24px" }}>
                Toque em uma das opções abaixo para continuar
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
                <ProfileCard
                  icon={UserRound}
                  title="Sou Pessoa Física"
                  text="Não possuo empresa ou não busco crédito PJ neste momento."
                  onClick={selectPessoaFisica}
                />
                <ProfileCard
                  icon={Building2}
                  title="Sou Empresário / Sócio"
                  text="Busco crédito ou diagnóstico empresarial para minha empresa."
                  onClick={selectEmpresario}
                />
              </div>
            </>
          )}

          {/* PASSO 2: Estrutura societária (modal, só para Empresário/Sócio) */}
          {qualifyStep === "estrutura" && (
            <div role="dialog" aria-modal="true" style={{ position: "fixed", inset: 0, zIndex: 30, background: "rgba(9,8,26,0.82)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
              <div style={{ background: N3, border: `1px solid ${GO}`, borderRadius: 14, padding: 32, maxWidth: 480, width: "100%" }}>
                <div style={{ fontSize: 17, fontWeight: 800, color: CR, marginBottom: 8, textAlign: "center" }}>
                  Qual é a estrutura societária da sua empresa?
                </div>
                <p style={{ fontSize: 12.5, color: MU, lineHeight: 1.6, textAlign: "center", marginBottom: 24 }}>
                  Isso define quantos sócios/garantidores precisam entrar no diagnóstico junto com o CNPJ.
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <StructureOption
                    icon={UserRound}
                    title="Unipessoal (SLU / MEI / Apenas 1 Sócio)"
                    onClick={() => selectStructure("UNIPESSOAL")}
                  />
                  <StructureOption
                    icon={Users}
                    title="Sociedade com 2+ Sócios / Grupo Econômico"
                    onClick={() => selectStructure("MULTIPLOS_SOCIOS")}
                  />
                </div>
                <button type="button" onClick={trocarPerfil}
                  style={{ display: "block", margin: "18px auto 0", background: "none", border: "none", color: MU, fontSize: 11.5, textDecoration: "underline", cursor: "pointer" }}>
                  Voltar
                </button>
              </div>
            </div>
          )}

          {/* PASSO 3: Configurador, com mínimos já travados pelo perfil escolhido */}
          {qualifyStep === "configurador" && (
            <>
              <p style={{ fontSize: 13.5, color: MU, lineHeight: 1.7, textAlign: "center", maxWidth: 520, margin: "0 auto 20px" }}>
                Cada análise completa, de uma empresa (CNPJ) ou de um sócio/garantidor (CPF), custa R$ 197,00.
                Grupo com mais de uma empresa? Sócio que também entra como garantia da operação? Inclua quantos precisar.
              </p>
              <button type="button" onClick={trocarPerfil}
                style={{ display: "block", margin: "0 auto 20px", background: "none", border: "none", color: GL, fontSize: 11.5, textDecoration: "underline", cursor: "pointer" }}>
                Trocar perfil selecionado
              </button>

              <div style={{ background: N3, border: `1px solid ${N4}`, borderRadius: 12, padding: 28 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
                  {profileType !== "PF" && (
                    <ConfigCounter label="Empresas do grupo (CNPJ)" hint="Uma análise completa por empresa" value={selection.cnpjCount} min={min.minCnpj} onChange={setCnpjCount} />
                  )}
                  <ConfigCounter label="Sócios ou garantidores (CPF)" hint="Inclua quem também compõe a operação" value={selection.cpfCount} min={min.minCpf} onChange={setCpfCount} />
                </div>

                {companyStructure === "MULTIPLOS_SOCIOS" && (
                  <div style={{ display: "flex", gap: 10, alignItems: "flex-start", background: "rgba(201,168,76,0.08)", border: `1px solid ${GOLD_BORDER}`, borderRadius: 8, padding: 14, marginBottom: 20 }}>
                    <AlertTriangle size={16} color={GO} style={{ flexShrink: 0, marginTop: 1 }} />
                    <span style={{ fontSize: 12, color: MU, lineHeight: 1.6 }}>
                      Para avaliação precisa de risco por fundos de investimento, é obrigatória a análise da empresa e de todos os sócios/garantidores.
                    </span>
                  </div>
                )}

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
            </>
          )}
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

// Card de seleção do Passo 1 (Pessoa Física vs Empresário/Sócio). Visual de
// botão de escolha de verdade (ícone em destaque + CTA com seta), não um
// bloco informativo: achado real de UX, o card original não sinalizava que
// era clicável, e quem chegava direto no configurador (ex.: link de
// indicação com #configurador) ficava parado no Passo 1 sem entender que
// precisava tocar numa das duas opções.
function ProfileCard({ icon: Icon, title, text, onClick }: { icon: typeof UserRound; title: string; text: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="v3-profile-card"
      style={{ textAlign: "left", background: N2, border: `1px solid ${N4}`, borderRadius: 10, padding: 22, cursor: "pointer", display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ width: 44, height: 44, borderRadius: 10, background: "rgba(201,168,76,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Icon size={22} color={GO} strokeWidth={1.5} />
      </div>
      <div style={{ fontSize: 14.5, fontWeight: 700, color: CR }}>{title}</div>
      <div style={{ fontSize: 12, color: MU, lineHeight: 1.6 }}>{text}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6, fontSize: 11, fontWeight: 700, color: GO, textTransform: "uppercase", letterSpacing: "0.05em" }}>
        Escolher esta opção <ArrowRight size={13} className="v3-profile-card-arrow" />
      </div>
    </button>
  );
}

// Opção de estrutura societária do modal do Passo 2. Mesmo tratamento de
// botão-escolha do ProfileCard (seta que desliza no hover), consistência de
// interação entre os dois passos guiados.
function StructureOption({ icon: Icon, title, onClick }: { icon: typeof UserRound; title: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="v3-structure-option"
      style={{ textAlign: "left", background: N2, border: `1px solid ${N4}`, borderRadius: 10, padding: 16, cursor: "pointer", display: "flex", gap: 12, alignItems: "center" }}>
      <div style={{ width: 34, height: 34, borderRadius: 8, background: "rgba(201,168,76,0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Icon size={17} color={GO} strokeWidth={1.5} />
      </div>
      <span style={{ fontSize: 13, fontWeight: 600, color: CR, lineHeight: 1.4, flex: 1 }}>{title}</span>
      <ArrowRight size={15} color={GO} className="v3-profile-card-arrow" style={{ flexShrink: 0 }} />
    </button>
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
