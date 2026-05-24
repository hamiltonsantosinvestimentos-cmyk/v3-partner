"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { ChevronDown, ChevronRight, X, Menu, Check, Plus, Minus } from "lucide-react";

// ── Paleta V3 ──────────────────────────────────────────────────────────────
const G  = "#C9A84C";   // Ouro V3
const G2 = "#E8C97A";   // Ouro claro
const N  = "#09081A";   // Navy profundo
const N2 = "#111F35";   // Navy base
const N3 = "#162744";   // Navy card
const N4 = "#243A66";   // Navy médio
const CR = "#F0ECE4";   // Cream
const MT = "#7A8FA8";   // Muted

// ── FAQ Item ───────────────────────────────────────────────────────────────
function FAQItem({ n, q, a }: { n: number; q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      onClick={() => setOpen(o => !o)}
      style={{ borderBottom: `1px solid ${N4}`, cursor: "pointer" }}
    >
      <div className="flex items-center justify-between py-5 gap-4">
        <p style={{ fontWeight: 600, fontSize: 15, color: open ? G : CR, lineHeight: 1.4 }}>
          {n}. {q}
        </p>
        <div className="flex-shrink-0" style={{ color: G }}>
          {open ? <Minus size={18} /> : <Plus size={18} />}
        </div>
      </div>
      {open && (
        <div className="pb-6">
          <p style={{ fontSize: 14, color: MT, lineHeight: 1.8 }}>{a}</p>
        </div>
      )}
    </div>
  );
}

// ── Solução Card ───────────────────────────────────────────────────────────
function SolucaoCard({ titulo, desc, tags }: { titulo: string; desc: string; tags: string }) {
  return (
    <div style={{ borderBottom: `1px solid ${N4}`, paddingTop: 28, paddingBottom: 28 }}>
      <h3 style={{ fontWeight: 800, fontSize: 15, color: CR, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>{titulo}</h3>
      <p style={{ fontSize: 13, color: MT, lineHeight: 1.7, marginBottom: 10 }}>{desc}</p>
      <p style={{ fontSize: 11, color: G, fontWeight: 600, letterSpacing: 0.5 }}>{tags}</p>
    </div>
  );
}

// ── Benefício Row ──────────────────────────────────────────────────────────
function BenRow({ icon, children }: { icon: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-5 py-5" style={{ borderBottom: `1px solid ${N4}` }}>
      <div className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-lg" style={{ background: `${G}15`, border: `1px solid ${G}25` }}>
        {icon}
      </div>
      <p style={{ fontSize: 14, color: MT, lineHeight: 1.75 }}>{children}</p>
    </div>
  );
}

// ── Quem Pode Card ─────────────────────────────────────────────────────────
function QuemCard({ icon, bold, rest }: { icon: string; bold: string; rest: string }) {
  return (
    <div className="flex items-start gap-4 py-5" style={{ borderBottom: `1px solid ${N4}` }}>
      <div className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-lg" style={{ background: `${G}15`, border: `1px solid ${G}25` }}>
        {icon}
      </div>
      <p style={{ fontSize: 14, color: MT, lineHeight: 1.7 }}>
        <strong style={{ color: CR }}>{bold}</strong> {rest}
      </p>
    </div>
  );
}

// ── CTA Button ─────────────────────────────────────────────────────────────
function CTA({ onClick, children, outline = false }: { onClick: () => void; children: React.ReactNode; outline?: boolean }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-2 font-bold transition-all hover:opacity-85"
      style={{
        background: outline ? "transparent" : G,
        color: outline ? G : N,
        border: `2px solid ${G}`,
        padding: "14px 36px",
        borderRadius: 4,
        fontSize: 13,
        letterSpacing: 1.5,
        textTransform: "uppercase" as const,
      }}
    >
      {children} <ChevronRight size={14} />
    </button>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────
export function LandingPageClient() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [formData, setFormData] = useState({
    nome: "", email: "", telefone: "", instagram: "", linkedin: "",
    segmento: "", plano: "PARTNER_PRO",
  });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", h);
    return () => window.removeEventListener("scroll", h);
  }, []);

  function go(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    setMenuOpen(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.nome || !formData.email || !formData.telefone) {
      setFormError("Preencha nome, e-mail e telefone."); return;
    }
    setSending(true); setFormError("");
    try {
      const res = await fetch("/api/parceiro/cadastro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (res.ok) setSent(true);
      else { const d = await res.json(); setFormError(d.error ?? "Erro ao enviar."); }
    } catch { setFormError("Erro de conexão. Tente novamente."); }
    finally { setSending(false); }
  }

  return (
    <div style={{ background: N, color: CR, fontFamily: "'DM Sans', sans-serif", overflowX: "hidden" }}>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />

      {/* ── NAVBAR ────────────────────────────────────────────────────── */}
      <nav
        className="fixed top-0 left-0 right-0 z-50 transition-all"
        style={{
          background: scrolled ? "rgba(9,8,26,0.97)" : "transparent",
          backdropFilter: scrolled ? "blur(16px)" : "none",
          borderBottom: scrolled ? `1px solid ${N4}` : "none",
        }}
      >
        <div className="max-w-5xl mx-auto px-6 flex items-center justify-between" style={{ height: 72 }}>
          <div className="flex items-center gap-3">
            <Image src="/logo.jpg" alt="V3 Partners" width={36} height={36} className="rounded-lg" />
            <span style={{ fontWeight: 900, fontSize: 14, color: G, letterSpacing: 3 }}>V3 PARTNERS</span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            {[["O que é", "oque"], ["Planos", "planos"], ["Soluções", "solucoes"], ["FAQ", "faq"]].map(([l, id]) => (
              <button key={id} onClick={() => go(id)} style={{ fontSize: 12, fontWeight: 600, color: MT, letterSpacing: 0.5 }} className="hover:text-white transition-colors">{l}</button>
            ))}
          </div>
          <button onClick={() => go("form")} className="hidden md:flex items-center gap-1.5 font-bold transition-all hover:opacity-85"
            style={{ background: G, color: N, padding: "10px 24px", borderRadius: 4, fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase" }}>
            Quero ser Partner
          </button>
          <button onClick={() => setMenuOpen(o => !o)} className="md:hidden" style={{ color: CR }}>
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
        {menuOpen && (
          <div className="md:hidden px-6 py-4 space-y-1" style={{ background: "rgba(9,8,26,0.99)", borderTop: `1px solid ${N4}` }}>
            {[["O que é", "oque"], ["Planos", "planos"], ["Soluções", "solucoes"], ["FAQ", "faq"], ["Quero ser Partner", "form"]].map(([l, id]) => (
              <button key={id} onClick={() => go(id)} className="block w-full text-left py-3 text-sm font-medium" style={{ color: CR, borderBottom: `1px solid ${N4}` }}>{l}</button>
            ))}
          </div>
        )}
      </nav>

      {/* ── 01 · HERO ─────────────────────────────────────────────────── */}
      <section style={{ background: N, paddingTop: 120, paddingBottom: 100, borderBottom: `1px solid ${N4}`, position: "relative", overflow: "hidden" }}>
        {/* Subtle radial glow */}
        <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse 70% 50% at 50% 0%, ${G}0A 0%, transparent 70%)`, pointerEvents: "none" }} />
        {/* Top gold line */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${G}, transparent)` }} />

        <div className="max-w-5xl mx-auto px-6 relative">
          {/* Eyebrow */}
          <div className="flex items-center gap-3 mb-6">
            <div style={{ width: 32, height: 2, background: G }} />
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 3, color: G }}>LICENCIAMENTO V3 PARTNERS</span>
          </div>

          <h1 style={{ fontSize: "clamp(40px, 7vw, 88px)", fontWeight: 900, lineHeight: 1.03, color: CR, marginBottom: 32, maxWidth: 820 }}>
            PARCEIRO<br />
            <span style={{ color: G }}>V3 PARTNERS</span>
          </h1>

          <p style={{ fontSize: "clamp(16px, 2vw, 20px)", color: MT, lineHeight: 1.75, maxWidth: 680, marginBottom: 20 }}>
            Uma carreira exclusiva, meritocrática e altamente rentável no Mercado Financeiro Institucional.
          </p>

          <p style={{ fontSize: "clamp(15px, 1.8vw, 18px)", color: CR, lineHeight: 1.75, maxWidth: 700, marginBottom: 48, fontWeight: 500 }}>
            Torne-se um <strong style={{ color: G }}>Partner V3</strong> e atue na intermediação de operações high ticket, com{" "}
            <strong style={{ color: G }}>comissionamentos que podem chegar a R$400 mil por operação.</strong>
          </p>

          <div className="flex flex-wrap gap-4">
            <CTA onClick={() => go("form")}>Quero ser Partner</CTA>
            <CTA onClick={() => go("oque")} outline>Descubra como funciona</CTA>
          </div>
        </div>
      </section>

      {/* ── 02 · O QUE É A V3 PARTNERS ───────────────────────────────── */}
      <section id="oque" style={{ background: N2, padding: "80px 0", borderBottom: `1px solid ${N4}` }}>
        <div className="max-w-5xl mx-auto px-6">
          <div className="max-w-5xl">
            <div className="flex items-center gap-3 mb-8">
              <div style={{ width: 32, height: 2, background: G }} />
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 3, color: G }}>O QUE É A V3 PARTNERS</span>
            </div>
            <p style={{ fontSize: "clamp(15px, 1.8vw, 17px)", color: MT, lineHeight: 1.85, marginBottom: 24, maxWidth: 780 }}>
              Somos uma boutique financeira institucional especializada em operações de crédito estruturado, M&A (fusões e aquisições), securitização e real estate. Trabalhamos com soluções financeiras de alto valor e operamos com as melhores estruturas do mercado, com tickets a partir de R$200.000.
            </p>
            <p style={{ fontSize: "clamp(15px, 1.8vw, 17px)", color: MT, lineHeight: 1.85, marginBottom: 40, maxWidth: 780 }}>
              Atuamos ao lado das mais conceituadas instituições financeiras, fundos de investimento e estruturas white label (Bloxs S.A.), oferecendo soluções completas para levantamento de capital, aquisições, securitização, expansão empresarial e estruturação patrimonial.
            </p>
            <CTA onClick={() => go("form")}>Descubra como funciona</CTA>
          </div>
        </div>
      </section>

      {/* ── 03 · O QUE FAZ UM PARTNER ────────────────────────────────── */}
      <section style={{ background: N, padding: "100px 0", borderBottom: `1px solid ${N4}` }}>
        <div className="max-w-5xl mx-auto px-6">
          <div className="flex items-center gap-3 mb-10">
            <div style={{ width: 32, height: 2, background: G }} />
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 3, color: G }}>O QUE FAZ UM PARTNER V3</span>
          </div>
          <h2 style={{ fontSize: "clamp(22px, 3.5vw, 40px)", fontWeight: 800, color: CR, lineHeight: 1.3, marginBottom: 28, maxWidth: 860 }}>
            O Partner V3 atua na intermediação de operações high ticket e é uma peça fundamental no processo financeiro corporativo. Trata-se de uma carreira dinâmica, marcada por reuniões estratégicas e relacionamento direto com grandes empresas, executivos e instituições financeiras.
          </h2>
          <h2 style={{ fontSize: "clamp(20px, 3vw, 34px)", fontWeight: 700, color: G, lineHeight: 1.35, marginBottom: 48, maxWidth: 800 }}>
            É uma profissão meritocrática, escassa e altamente valorizada no Mercado Financeiro, com comissionamentos que podem ultrapassar R$400.000,00 por operação.
          </h2>
          <CTA onClick={() => go("form")}>Quero ser Partner</CTA>
        </div>
      </section>

      {/* ── 04 · QUEM PODE SER ───────────────────────────────────────── */}
      <section style={{ background: N2, padding: "80px 0", borderBottom: `1px solid ${N4}` }}>
        <div className="max-w-5xl mx-auto px-6">
          <div className="flex items-center gap-3 mb-8">
            <div style={{ width: 32, height: 2, background: G }} />
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 3, color: G }}>QUEM PODE SER UM PARTNER V3</span>
          </div>
          <div className="grid md:grid-cols-2 gap-x-16 mb-12">
            <div style={{ borderTop: `1px solid ${N4}` }}>
              <QuemCard icon="💼" bold="Profissionais que desejam ingressar no mercado financeiro" rest="e empreender em uma área de alta valorização, atuando com crédito estruturado, M&A e operações institucionais." />
              <QuemCard icon="📊" bold="Consultores, gestores, empresários e autônomos" rest="que desejam ampliar seu portfólio e oferecer soluções financeiras de alto valor para sua base de clientes." />
              <QuemCard icon="💰" bold="Pessoas que buscam comissionamentos elevados," rest="crescimento acelerado e a possibilidade de operar em um mercado escasso e altamente rentável." />
              <QuemCard icon="🏦" bold="Contadores, gestores financeiros e consultores empresariais" rest="que possuem acesso direto à realidade financeira das empresas e identificam oportunidades de crédito e M&A." />
            </div>
            <div style={{ borderTop: `1px solid ${N4}` }}>
              <QuemCard icon="⚖️" bold="Advogados empresariais, societários e tributários," rest="envolvidos em processos de expansão, aquisições, reestruturações societárias e operações de M&A." />
              <QuemCard icon="🏛️" bold="Correspondentes bancários e profissionais do mercado de crédito" rest="que buscam maior liberdade operacional, produtos mais inteligentes e comissionamentos superiores." />
              <QuemCard icon="🤝" bold="Consultores e profissionais autônomos" rest="que desejam ampliar seu portfólio com soluções financeiras corporativas de alto valor agregado." />
              <QuemCard icon="🏗️" bold="Corretores de imóveis comerciais e de alto padrão" rest="que atuam com empresários, investidores e operações de grande volume." />
            </div>
          </div>
          <div className="rounded-2xl px-8 py-6 mb-10" style={{ background: `${G}0D`, border: `1px solid ${G}25` }}>
            <p style={{ fontSize: "clamp(16px, 2vw, 20px)", color: CR, fontWeight: 600, lineHeight: 1.6 }}>
              A principal qualificação é{" "}
              <strong style={{ color: G }}>a disposição para trazer novos negócios</strong>{" "}
              à mesa de crédito e M&A.
            </p>
          </div>
          <CTA onClick={() => go("form")}>Quero ser Partner</CTA>
        </div>
      </section>

      {/* ── 05 · MODELO DE NEGÓCIO ───────────────────────────────────── */}
      <section style={{ background: N, padding: "80px 0", borderBottom: `1px solid ${N4}` }}>
        <div className="max-w-5xl mx-auto px-6">
          <div className="flex items-center gap-3 mb-8">
            <div style={{ width: 32, height: 2, background: G }} />
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 3, color: G }}>NOSSO MODELO DE NEGÓCIO VAI TE DAR ACESSO A:</span>
          </div>
          <div className="grid md:grid-cols-2 gap-x-16 mb-12">
            <div style={{ borderTop: `1px solid ${N4}` }}>
              <BenRow icon="💎">
                Comercializar operações financeiras exclusivas e high ticket, incluindo Crédito Estruturado, M&A e Securitização, com{" "}
                <strong style={{ color: G }}>comissionamentos que podem ultrapassar R$400 mil por operação.</strong>
              </BenRow>
              <BenRow icon="📚">
                Receber <strong style={{ color: CR }}>treinamentos e materiais comerciais personalizados</strong>, garantindo segurança e profissionalismo no atendimento aos clientes.
              </BenRow>
              <BenRow icon="📅">
                Participar de <strong style={{ color: CR }}>reuniões semanais de capacitação</strong>, focadas em estratégias comerciais, crescimento e resultados no mercado financeiro.
              </BenRow>
            </div>
            <div style={{ borderTop: `1px solid ${N4}` }}>
              <BenRow icon="🛡️">
                Contar com <strong style={{ color: CR }}>suporte especializado da equipe V3 Partners</strong> no acompanhamento de clientes, operações e ativos em M&A.
              </BenRow>
              <BenRow icon="🚀">
                Ter <strong style={{ color: CR }}>visibilidade e protagonismo conjunto nas ações da V3 Partners</strong>, incluindo participação em eventos, fortalecendo imagem, autoridade e networking.
              </BenRow>
              <BenRow icon="🌐">
                Ter a <strong style={{ color: CR }}>oportunidade de atuar como empreendedor no mercado financeiro institucional</strong>, construindo uma carreira escalável e de alto impacto.
              </BenRow>
            </div>
          </div>
          <CTA onClick={() => go("form")}>Comece sua jornada</CTA>
        </div>
      </section>

      {/* ── 06 · PLANOS / LICENCIAMENTO ──────────────────────────────── */}
      <section id="planos" style={{ background: N2, padding: "80px 0", borderBottom: `1px solid ${N4}` }}>
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-4" onClick={() => go("form")} style={{ cursor: "pointer" }}>
            <button className="font-bold transition-all hover:opacity-85 mb-12"
              style={{ background: G, color: N, padding: "14px 36px", borderRadius: 4, fontSize: 12, letterSpacing: 2, textTransform: "uppercase" as const }}>
              QUERO GARANTIR MEU LICENCIAMENTO
            </button>
          </div>

          <div className="flex items-center gap-3 mb-4">
            <div style={{ width: 32, height: 2, background: G }} />
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 3, color: G }}>MODELOS DE LICENCIAMENTO</span>
          </div>

          <div className="grid md:grid-cols-3 gap-5 mb-12">
            {[
              {
                titulo: "V3 Partner Entry",
                sub: "Modelo de entrada no ecossistema V3,",
                desc: "com foco em rápida ativação comercial. O licenciado tem acesso às soluções mais demandadas do portfólio, iniciando a construção da carteira com produtos estratégicos como crédito recorrente e split fiscal.",
                destaques: ["Crédito N1 e N2", "CRM + IA", "Academy base", "Chat com a mesa", "30% de comissão"],
              },
              {
                titulo: "V3 Partner",
                sub: "Ideal para",
                desc: "quem deseja ingressar no mercado financeiro com estrutura e suporte profissional. Acesso à comercialização de diversas linhas de crédito, capacitação contínua e metodologia prática para desenvolver operações com segurança e foco em crescimento.",
                destaques: ["Crédito N1, N2 e N3", "Mesa de crédito completa", "Relatórios e KPIs", "Consórcio corporativo", "30% de comissão"],
                destaque: true,
              },
              {
                titulo: "V3 Partner PRO",
                sub: "Modelo completo para",
                desc: "quem busca alto posicionamento, autoridade e máxima rentabilidade no mercado financeiro. O licenciado atua com crédito estruturado, M&A e acesso a benefícios exclusivos, ampliando visibilidade e resultados de forma estratégica.",
                destaques: ["Tudo do Partner +", "Mesa M&A dedicada", "Deal Rooms e VDR", "Co-branding V3", "50% de comissão"],
              },
            ].map(({ titulo, sub, desc, destaques, destaque }) => (
              <div key={titulo} className="rounded-xl p-7 flex flex-col gap-4" style={{
                background: destaque ? `${G}0F` : N3,
                border: `1px solid ${destaque ? G + "50" : N4}`,
              }}>
                {destaque && (
                  <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2, color: G, background: `${G}20`, border: `1px solid ${G}40`, padding: "4px 10px", borderRadius: 20, display: "inline-block", alignSelf: "flex-start" }}>
                    MAIS INDICADO
                  </div>
                )}
                <h3 style={{ fontWeight: 900, fontSize: 18, color: destaque ? G : CR }}>{titulo}</h3>
                <p style={{ fontSize: 13, color: MT, lineHeight: 1.7 }}>
                  <em style={{ color: CR, fontStyle: "normal" }}>{sub}</em> {desc}
                </p>
                <div className="space-y-2 pt-4" style={{ borderTop: `1px solid ${N4}` }}>
                  {destaques.map(d => (
                    <div key={d} className="flex items-center gap-2.5">
                      <Check size={13} color={G} className="flex-shrink-0" />
                      <p style={{ fontSize: 12, color: d.includes("comissão") ? G : MT, fontWeight: d.includes("comissão") ? 700 : 400 }}>{d}</p>
                    </div>
                  ))}
                </div>
                <button onClick={() => go("form")} className="mt-auto w-full py-3 rounded-lg font-bold text-xs transition-all hover:opacity-85"
                  style={{ background: destaque ? G : "transparent", color: destaque ? N : G, border: `1px solid ${G}`, letterSpacing: 1.5, textTransform: "uppercase" as const }}>
                  Solicitar acesso
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 07 · SOLUÇÕES FINANCEIRAS ────────────────────────────────── */}
      <section id="solucoes" style={{ background: N, padding: "80px 0", borderBottom: `1px solid ${N4}` }}>
        <div className="max-w-5xl mx-auto px-6">
          <div className="flex items-center gap-3 mb-8">
            <div style={{ width: 32, height: 2, background: G }} />
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 3, color: G }}>ALGUMAS DAS NOSSAS SOLUÇÕES FINANCEIRAS</span>
          </div>
          <div className="grid md:grid-cols-2 gap-x-16 mb-12">
            <div style={{ borderTop: `1px solid ${N4}` }}>
              <SolucaoCard titulo="Crédito com Garantia Imobiliária" desc="Soluções estruturadas para capital de giro, alavancagem patrimonial e aquisição de imóveis." tags="Home Equity • CGI PJ • CRI • Giro Equity • Financiamentos Imobiliários" />
              <SolucaoCard titulo="Securitização de Recebíveis" desc="Transforme ativos em capital com estruturas de securitização ágeis e flexíveis." tags="FIDC • CRI • Precatórios • Cessão de Crédito • Notas Comerciais" />
              <SolucaoCard titulo="M&A | Fusões e Aquisições" desc="Estruturação completa de compra, venda e fusão de empresas com IA proprietária FORJA." tags="Valuation • NDA • Teaser Cego • CIM • Deal Rooms • Matching IA" />
              <SolucaoCard titulo="Crédito Corporativo" desc="Soluções completas para fortalecer caixa, adquirir ativos e escalar empresas." tags="Capital de Giro • Leasing • Consórcio • Cash Collateral • Antecipação" />
              <SolucaoCard titulo="Crédito Agro" desc="Soluções financeiras para produtores rurais e empresas do agronegócio." tags="CPR • Fundo Agro • Sale & Leaseback • Maquinários • Custeio" />
            </div>
            <div style={{ borderTop: `1px solid ${N4}` }}>
              <SolucaoCard titulo="Real Estate Estruturado" desc="Financiamento e estruturação para projetos e empreendimentos imobiliários." tags="SLB • BTS • BTR • Fundos Imobiliários • Construção • Incorporação" />
              <SolucaoCard titulo="Operações Internacionais" desc="Acesso a capital global e estruturas financeiras internacionais com Bloxs S.A." tags="ACC • ACE • Câmbio • Cross-Border OTC • Cripto 24/7 • Liquidação" />
              <SolucaoCard titulo="Mineração & Commodities" desc="Soluções para produtores e traders de commodities e metais preciosos." tags="Ouro • Lítio • Metais Preciosos • Financiamento de Projetos" />
              <SolucaoCard titulo="Split Fiscal Inteligente" desc="Estrutura financeira com eficiência tributária que organiza custos e maximiza margem líquida." tags="Split de Pagamentos • Conta Técnica • Inteligência Tributária • Compliance" />
              <SolucaoCard titulo="Operações Distressed" desc="Alternativas financeiras para empresas em cenário crítico ou restritivo." tags="Fundo Estressado • Home Equity Distressed • Recebíveis Restritivos" />
            </div>
          </div>
          <CTA onClick={() => go("form")}>Descubra como funciona</CTA>
        </div>
      </section>

      {/* ── 08 · SOBRE A V3 PARTNERS ─────────────────────────────────── */}
      <section style={{ background: N2, padding: "80px 0", borderBottom: `1px solid ${N4}` }}>
        <div className="max-w-5xl mx-auto px-6">
          <div className="flex items-center gap-3 mb-8">
            <div style={{ width: 32, height: 2, background: G }} />
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 3, color: G }}>SOBRE A V3 PARTNERS</span>
          </div>
          <div className="max-w-3xl">
            <p style={{ fontSize: 15, color: MT, lineHeight: 1.9, marginBottom: 20 }}>
              A V3 Partners nasceu da visão de{" "}
              <strong style={{ color: CR }}>Hamilton Santos, João Lemos Netto e Robson Lino</strong>, que uniram expertise em finanças estruturadas, originação de negócios e compliance para transformar a forma como o mercado financeiro conecta oportunidades a soluções institucionais.
            </p>
            <p style={{ fontSize: 15, color: MT, lineHeight: 1.9, marginBottom: 20 }}>
              Com{" "}
              <strong style={{ color: CR }}>infraestrutura white label Bloxs S.A.</strong> para tokenização, KYC e liquidação OTC/cripto 24/7, operamos com o que há de mais avançado em fintech institucional no Brasil. Nossa plataforma tecnológica própria integra IA, CRM, mesa de crédito e Deal Rooms em um único ecossistema.
            </p>
            <p style={{ fontSize: 15, color: MT, lineHeight: 1.9 }}>
              A história da V3 Partners é sobre{" "}
              <strong style={{ color: G }}>transformar profissionais em protagonistas do mercado financeiro institucional</strong>, oferecendo estrutura, tecnologia e suporte para que cada partner opere com a credibilidade de uma boutique de alto padrão.
            </p>
          </div>
        </div>
      </section>

      {/* ── 09 · FAQ ──────────────────────────────────────────────────── */}
      <section id="faq" style={{ background: N, padding: "80px 0", borderBottom: `1px solid ${N4}` }}>
        <div className="max-w-5xl mx-auto px-6">
          <div className="flex items-center gap-3 mb-8">
            <div style={{ width: 32, height: 2, background: G }} />
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 3, color: G }}>FAQ</span>
          </div>
          <div style={{ borderTop: `1px solid ${N4}`, maxWidth: 820 }}>
            {[
              { q: "Como faço para me tornar um Partner V3?", a: "Preencha o formulário de interesse nesta página. Nossa equipe de Novos Negócios entrará em contato em até 24 horas úteis para apresentar o processo completo, tirar dúvidas e iniciar o onboarding." },
              { q: "Quais são os requisitos para ser um Partner V3?", a: "Não exigimos experiência prévia no mercado financeiro. A principal qualificação é a disposição para trazer novos negócios e relacionar-se com empresários, executivos e tomadores de decisão. A V3 oferece toda a capacitação técnica." },
              { q: "Quanto tempo leva para começar a atuar?", a: "Após a aprovação e assinatura do contrato digital (via ClickSign), o acesso à plataforma é liberado em até 24h. O onboarding guiado acontece nas primeiras semanas, com suporte da mesa operacional." },
              { q: "Quando receberei meus primeiros comissionamentos?", a: "Depende do tipo de operação. Em crédito estruturado, o ciclo médio é de 30 a 90 dias. Em M&A, pode levar de 3 a 12 meses. Operações de split fiscal e antecipação de recebíveis tendem a ser mais rápidas." },
              { q: "Posso trabalhar em paralelo com minha profissão atual?", a: "Sim. A parceria V3 é não exclusiva. Você pode manter outras atividades profissionais e relacionamentos comerciais sem restrição. A plataforma foi desenhada para uso assíncrono." },
              { q: "Quais são os percentuais de comissão?", a: "O Partner recebe 30% do resultado líquido de cada operação fechada. O Partner PRO recebe 50%. Os valores são rastreados em tempo real na plataforma e pagos após a liquidação da operação." },
              { q: "O que são operações mandatadas?", a: "São operações onde a V3 Partners atua como mandatária — responsável por toda a estruturação, análise, compliance e condução do processo. O partner origina e a V3 executa, garantindo qualidade institucional em cada negócio." },
              { q: "Quero ser partner, mas não tenho network nem experiência com crédito. E agora?", a: "Comece pelo Academy V3. Nossa trilha de capacitação é desenhada para profissionais de qualquer área. Você aprende o que precisa, constrói sua carteira gradualmente e conta com suporte da mesa operacional em cada operação." },
              { q: "Qual a diferença prática entre Partner e Partner PRO?", a: "Além do comissionamento maior (50% vs 30%), o Partner PRO tem acesso ao nível N3 de crédito (operações acima de R$5M), Mesa M&A dedicada, co-branding V3, Deal Rooms com VDR e Academy M&A avançado com operações de cross-border." },
              { q: "Como é a plataforma da V3 Partners?", a: "É uma plataforma SaaS proprietária com módulos de CRM, Mesa de Crédito (N1/N2/N3), Mesa M&A com IA FORJA, Deal Rooms, Academy, Chat com a mesa, relatórios de comissões, marketplace e 7 squads de IA especializada." },
            ].map(({ q, a }, i) => (
              <FAQItem key={q} n={i + 1} q={q} a={a} />
            ))}
          </div>
        </div>
      </section>

      {/* ── 10 · FORMULÁRIO ───────────────────────────────────────────── */}
      <section id="form" style={{ background: N2, padding: "80px 0", borderBottom: `1px solid ${N4}` }}>
        <div className="max-w-3xl mx-auto px-6">
          <div className="flex items-center gap-3 mb-6">
            <div style={{ width: 32, height: 2, background: G }} />
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 3, color: G }}>SOLICITAR LICENCIAMENTO</span>
          </div>

          {sent ? (
            <div className="rounded-2xl p-12 text-center" style={{ background: N3, border: `1px solid ${G}40` }}>
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6" style={{ background: `${G}15`, border: `1px solid ${G}35` }}>
                <Check size={28} color={G} />
              </div>
              <h3 style={{ fontWeight: 900, fontSize: 24, color: CR, marginBottom: 12 }}>Solicitação recebida!</h3>
              <p style={{ color: MT, fontSize: 15, lineHeight: 1.8 }}>
                Obrigado, <strong style={{ color: CR }}>{formData.nome}</strong>!{" "}
                Nossa equipe de Novos Negócios entrará em contato pelo e-mail{" "}
                <strong style={{ color: G }}>{formData.email}</strong> em até 24 horas úteis.
              </p>
            </div>
          ) : (
            <>
              <p style={{ fontSize: 15, color: MT, lineHeight: 1.75, marginBottom: 40, maxWidth: 640 }}>
                Preencha seus dados e nosso time de Novos Negócios entrará em contato para te mostrar como se tornar um Partner V3 Partners.
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Nome */}
                <div>
                  <label style={{ fontSize: 10, fontWeight: 700, color: MT, letterSpacing: 2, display: "block", marginBottom: 8 }}>NOME COMPLETO *</label>
                  <input type="text" value={formData.nome} onChange={e => setFormData(f => ({ ...f, nome: e.target.value }))}
                    placeholder="Seu nome completo" required
                    className="w-full px-5 py-4 text-sm focus:outline-none transition-colors"
                    style={{ background: N3, border: `1px solid ${N4}`, borderRadius: 4, color: CR }} />
                </div>
                {/* Email + Telefone */}
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label style={{ fontSize: 10, fontWeight: 700, color: MT, letterSpacing: 2, display: "block", marginBottom: 8 }}>E-MAIL *</label>
                    <input type="email" value={formData.email} onChange={e => setFormData(f => ({ ...f, email: e.target.value }))}
                      placeholder="seu@email.com" required
                      className="w-full px-5 py-4 text-sm focus:outline-none transition-colors"
                      style={{ background: N3, border: `1px solid ${N4}`, borderRadius: 4, color: CR }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 10, fontWeight: 700, color: MT, letterSpacing: 2, display: "block", marginBottom: 8 }}>TELEFONE / WHATSAPP *</label>
                    <input type="tel" value={formData.telefone} onChange={e => setFormData(f => ({ ...f, telefone: e.target.value }))}
                      placeholder="(11) 99999-9999" required
                      className="w-full px-5 py-4 text-sm focus:outline-none transition-colors"
                      style={{ background: N3, border: `1px solid ${N4}`, borderRadius: 4, color: CR }} />
                  </div>
                </div>
                {/* Instagram + LinkedIn */}
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label style={{ fontSize: 10, fontWeight: 700, color: MT, letterSpacing: 2, display: "block", marginBottom: 8 }}>INSTAGRAM</label>
                    <input type="text" value={formData.instagram} onChange={e => setFormData(f => ({ ...f, instagram: e.target.value }))}
                      placeholder="@seuperfil"
                      className="w-full px-5 py-4 text-sm focus:outline-none transition-colors"
                      style={{ background: N3, border: `1px solid ${N4}`, borderRadius: 4, color: CR }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 10, fontWeight: 700, color: MT, letterSpacing: 2, display: "block", marginBottom: 8 }}>LINKEDIN</label>
                    <input type="text" value={formData.linkedin} onChange={e => setFormData(f => ({ ...f, linkedin: e.target.value }))}
                      placeholder="linkedin.com/in/seu-perfil"
                      className="w-full px-5 py-4 text-sm focus:outline-none transition-colors"
                      style={{ background: N3, border: `1px solid ${N4}`, borderRadius: 4, color: CR }} />
                  </div>
                </div>
                {/* Segmento */}
                <div>
                  <label style={{ fontSize: 10, fontWeight: 700, color: MT, letterSpacing: 2, display: "block", marginBottom: 8 }}>RAMO DE ATUAÇÃO</label>
                  <input type="text" value={formData.segmento} onChange={e => setFormData(f => ({ ...f, segmento: e.target.value }))}
                    placeholder="Ex: Consultor financeiro, Advogado, Corretor..."
                    className="w-full px-5 py-4 text-sm focus:outline-none transition-colors"
                    style={{ background: N3, border: `1px solid ${N4}`, borderRadius: 4, color: CR }} />
                </div>
                {/* Plano */}
                <div>
                  <label style={{ fontSize: 10, fontWeight: 700, color: MT, letterSpacing: 2, display: "block", marginBottom: 10 }}>LICENCIAMENTO DE INTERESSE</label>
                  <div className="grid sm:grid-cols-3 gap-3">
                    {[
                      ["PARTNER_ENTRY", "V3 Partner Entry", "30% · Entrada"],
                      ["PARTNER", "V3 Partner", "30% · Completo"],
                      ["PARTNER_PRO", "V3 Partner PRO", "50% · Máximo"],
                    ].map(([val, label, sub]) => (
                      <button key={val} type="button" onClick={() => setFormData(f => ({ ...f, plano: val }))}
                        className="py-4 px-3 text-left transition-all"
                        style={{ background: formData.plano === val ? `${G}15` : N3, border: `1px solid ${formData.plano === val ? G + "60" : N4}`, borderRadius: 4 }}>
                        <p style={{ fontSize: 12, fontWeight: 700, color: formData.plano === val ? G : CR, marginBottom: 2 }}>{label}</p>
                        <p style={{ fontSize: 10, color: MT }}>{sub}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {formError && (
                  <p style={{ fontSize: 12, color: "#EF4444", padding: "10px 14px", borderRadius: 4, background: "#EF444415", border: "1px solid #EF444430" }}>{formError}</p>
                )}

                <button type="submit" disabled={sending}
                  className="w-full py-4 font-bold text-sm transition-all hover:opacity-85"
                  style={{ background: G, color: N, borderRadius: 4, fontSize: 12, letterSpacing: 2, textTransform: "uppercase" as const, opacity: sending ? 0.7 : 1, marginTop: 8 }}>
                  {sending ? "ENVIANDO..." : "ENTRAR EM CONTATO"}
                </button>

                <p style={{ fontSize: 11, color: MT, textAlign: "center", lineHeight: 1.6 }}>
                  Ao enviar, você concorda que nossa equipe entre em contato. Sem spam, sem compromisso.
                </p>
              </form>
            </>
          )}
        </div>
      </section>

      {/* ── FOOTER ────────────────────────────────────────────────────── */}
      <footer style={{ background: N, borderTop: `1px solid ${N4}` }}>
        <div className="max-w-5xl mx-auto px-6 py-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <Image src="/logo.jpg" alt="V3 Partners" width={32} height={32} className="rounded-lg" />
            <div>
              <p style={{ fontWeight: 900, fontSize: 13, color: G, letterSpacing: 3 }}>V3 PARTNERS</p>
              <p style={{ fontSize: 10, color: MT, marginTop: 2 }}>V3 Partners Soluções Ltda · CNPJ 14.219.287/0001-50</p>
            </div>
          </div>
          <p style={{ fontSize: 11, color: MT }}>© 2026 V3 PARTNERS | Todos os direitos reservados.</p>
        </div>
      </footer>

    </div>
  );
}
