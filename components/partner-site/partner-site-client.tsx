"use client";

import React, { useState } from "react";
import Image from "next/image";
import { ChevronDown, ChevronUp, CheckCircle2, Send, Phone, Mail, MapPin, Globe, Shield, Zap, TrendingUp, Building2, Star, Users, Target, Award } from "lucide-react";

// ─── Paleta ─────────────────────────────────────────────────────────────────
const G = "#C9A84C";
const NAVY = "#111F35";
const NAVY2 = "#162744";
const BASE = "#09081A";
const CREAM = "#F0ECE4";
const MUTED = "#7A8FA8";

// ─── Dados do site V3 ────────────────────────────────────────────────────────

const VERTICAIS = [
  {
    num: "01",
    title: "Crédito Estruturado & Recebíveis",
    desc: "Securitização de recebíveis, Home Equity, HomeCash, CGI, CRI, FIDC e estruturação de crédito complexo para empresas e pessoas físicas.",
    icon: <TrendingUp size={22} />,
    linhas: ["V3Equity", "Home Equity", "HomeCash", "CGI", "CRI", "FIDC", "Recebíveis Judiciais"],
  },
  {
    num: "02",
    title: "Real Estate Estruturado",
    desc: "BTS, BTR, SLB, Fundos de Construção, CRI, financiamento imobiliário residencial e corporativo com estrutura institucional.",
    icon: <Building2 size={22} />,
    linhas: ["BTS", "BTR", "SLB", "Fundo de Construção", "CRI Imobiliário", "Financiamento PF"],
  },
  {
    num: "03",
    title: "Mineração & Commodities",
    desc: "Intermediação cross-border, bancarização de metais preciosos, ouro, lítio e minérios estratégicos com custódia institucional.",
    icon: <Globe size={22} />,
    linhas: ["Ouro (Cross-Border)", "Carbonato de Lítio", "Custódia de Commodities", "Trading Internacional"],
  },
  {
    num: "04",
    title: "M&A e Negócios Estratégicos",
    desc: "M&A buy-side e sell-side, Exporte-se, operações internacionais, FINIMP, ACC, ACE e expansão corporativa global.",
    icon: <Target size={22} />,
    linhas: ["M&A Buy-Side", "M&A Sell-Side", "Exporte-se", "FINIMP", "ACC / ACE"],
  },
];

const PORTFOLIO = [
  {
    categoria: "Crédito com Garantia Imobiliária",
    linhas: [
      { nome: "V3Equity", desc: "Crédito estruturado com garantia de equity imobiliário" },
      { nome: "Home Equity", desc: "Crédito com garantia de imóvel residencial ou comercial" },
      { nome: "HomeCash", desc: "Liquidez rápida com garantia imobiliária — pessoas físicas" },
      { nome: "CGI Corporativo", desc: "Crédito com garantia de imóvel para empresas" },
      { nome: "Home Equity Estressado", desc: "Ativos com restrição ou pendência jurídica" },
    ],
  },
  {
    categoria: "Financiamento Imobiliário & Construção",
    linhas: [
      { nome: "CRI", desc: "Certificado de Recebíveis Imobiliários — emissão e distribuição" },
      { nome: "Financiamento PF", desc: "Imóvel residencial — pessoas físicas" },
      { nome: "Fundo Construção Moradia", desc: "Para projetos habitacionais de médio porte" },
      { nome: "Fundo Reforma", desc: "Retrofit e melhorias em imóveis existentes" },
      { nome: "BTS (Build-to-Suit)", desc: "Construção sob encomenda para locação corporativa" },
      { nome: "BTR (Build-to-Rent)", desc: "Portfólio residencial para renda passiva" },
      { nome: "Fundo Incorporadoras", desc: "Capital para incorporadoras e loteadoras" },
      { nome: "SLB (Sale & Leaseback)", desc: "Venda com retorno operacional ao ativo" },
    ],
  },
  {
    categoria: "Crédito Veicular",
    linhas: [
      { nome: "Giro Auto", desc: "Capital de giro com garantia de frota de veículos" },
      { nome: "V3Auto", desc: "Financiamento e refinanciamento de veículos PJ" },
    ],
  },
  {
    categoria: "Crédito Sem Garantia Real",
    linhas: [
      { nome: "Aval PJ", desc: "Crédito empresarial com aval de sócios" },
      { nome: "Cash Collateral", desc: "Crédito lastreado em ativos financeiros custodiados" },
    ],
  },
  {
    categoria: "Agro, Consórcio & Sale Leaseback",
    linhas: [
      { nome: "CPR Agro", desc: "Cédula de Produto Rural — capital para produtores" },
      { nome: "Capital Maquinários", desc: "Financiamento de equipamentos e maquinário pesado" },
      { nome: "Consórcio Curado", desc: "Consórcio estruturado com curadoria institucional" },
      { nome: "Cartas Contempladas", desc: "Negociação e compra de cartas de consórcio" },
      { nome: "Sale Leaseback", desc: "Monetização de ativos com retorno operacional" },
    ],
  },
  {
    categoria: "Operações Internacionais & Cross-Border",
    linhas: [
      { nome: "Int. Cash Collateral", desc: "Crédito internacional lastreado em ativos financeiros" },
      { nome: "Int. Imóvel", desc: "Estruturação com garantia de imóvel no exterior" },
      { nome: "Câmbio Estruturado", desc: "Operações de câmbio para empresas e exportadores" },
      { nome: "FINIMP", desc: "Financiamento à importação de insumos e equipamentos" },
      { nome: "ACC", desc: "Adiantamento sobre Contrato de Câmbio" },
      { nome: "ACE", desc: "Adiantamento sobre Cambiais Entregues" },
    ],
  },
  {
    categoria: "Seguros Institucionais",
    linhas: [
      { nome: "Seguro Corporativo", desc: "Proteção para empresas, executivos e patrimônio corporativo" },
      { nome: "Seguro Patrimonial", desc: "Imóveis, frota, estoque e ativos de alto valor" },
      { nome: "Seguro Agro", desc: "Proteção para produção, equipamentos e safras" },
    ],
  },
  {
    categoria: "M&A e Expansão Internacional",
    linhas: [
      { nome: "M&A Estruturado", desc: "Assessoria buy-side, sell-side e fusões estratégicas" },
      { nome: "Exporte-se", desc: "LLC americana, imóvel na Flórida, renda em dólar (15-20% a.a.)" },
    ],
  },
];

const TOKENS_STEPS = [
  { num: "01", title: "Originação", desc: "V3 Partners identifica o ativo elegível e estrutura o enquadramento jurídico e financeiro." },
  { num: "02", title: "Estruturação", desc: "Criação da SPE, due diligence completa, laudos técnicos e aprovação regulatória CVM 88." },
  { num: "03", title: "Tokenização", desc: "Parceria Bloxs emite tokens fracionados com KYC institucional e distribuição regulada." },
  { num: "04", title: "Acesso Global", desc: "Investidores qualificados compram frações. Liquidação OTC 24/7 em qualquer jurisdição." },
];

const PILARES_CULTURA = [
  { title: "Meritocracia Implacável", desc: "Performance aferida por resultado real. Sem hierarquia de vaidade — apenas entrega." },
  { title: "Transparência Fiduciária", desc: "Cada operação documentada, auditável e alinhada com as melhores práticas CVM e COAF." },
  { title: "Inteligência Transacional", desc: "Análise de dados proprietária para mapear oportunidades antes do mercado." },
  { title: "Neutralidade Institucional", desc: "Independentes de qualquer banco ou fundo — alinhados exclusivamente ao cliente." },
];

const PRODUTOS_INTERESSE = [
  { value: "credito_varejo", label: "Crédito com Garantia Imobiliária" },
  { value: "credito_estruturado", label: "Crédito Estruturado / FIDC / CRI" },
  { value: "high_ticket", label: "High Ticket (R$ 5M+)" },
  { value: "ma", label: "M&A — Fusões e Aquisições" },
  { value: "consorcio", label: "Consórcio" },
  { value: "split", label: "Split Fiscal" },
  { value: "tokenizacao", label: "Tokenização de Ativos" },
  { value: "exporte_se", label: "Exporte-se (Internacionalização)" },
  { value: "outro", label: "Outro / Não sei ainda" },
];

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface PartnerProfile {
  id: string;
  full_name: string;
  role: string;
  avatar_url?: string | null;
  cobranding_bio?: string | null;
  cobranding_whatsapp?: string | null;
  cobranding_instagram?: string | null;
  cobranding_slug?: string | null;
}

interface Props {
  profile: PartnerProfile;
  captacaoToken: string | null;
}

// ─── Badge por role ──────────────────────────────────────────────────────────

function roleBadge(role: string) {
  const map: Record<string, { label: string; color: string; bg: string; border: string }> = {
    STARTER:     { label: "Partner Starter",    color: "#60A5FA", bg: "rgba(96,165,250,0.08)",  border: "rgba(96,165,250,0.25)" },
    PARTNER:     { label: "Partner",             color: G,         bg: "rgba(201,168,76,0.08)",  border: "rgba(201,168,76,0.25)" },
    PARTNER_PRO: { label: "Partner PRO",         color: G,         bg: "rgba(201,168,76,0.12)",  border: "rgba(201,168,76,0.4)" },
    ENTERPRISE:  { label: "Partner Enterprise",  color: "#A78BFA", bg: "rgba(167,139,250,0.08)", border: "rgba(167,139,250,0.25)" },
  };
  return map[role] ?? map["PARTNER"];
}

// ─── Accordion ───────────────────────────────────────────────────────────────

function Accordion({ categoria, linhas }: { categoria: string; linhas: { nome: string; desc: string }[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderBottom: `1px solid rgba(201,168,76,0.12)` }}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-4 px-1 text-left"
        style={{ background: "none", border: "none", cursor: "pointer" }}
      >
        <span style={{ color: CREAM, fontWeight: 700, fontSize: 14 }}>{categoria}</span>
        <span style={{ color: G }}>{open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</span>
      </button>
      {open && (
        <div className="pb-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
          {linhas.map((l) => (
            <div key={l.nome} style={{ background: "rgba(22,39,68,0.5)", borderRadius: 8, padding: "10px 14px", border: "1px solid rgba(201,168,76,0.1)" }}>
              <p style={{ color: G, fontSize: 12, fontWeight: 700, marginBottom: 2 }}>{l.nome}</p>
              <p style={{ color: MUTED, fontSize: 11, lineHeight: 1.5 }}>{l.desc}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Formulário de interesse ──────────────────────────────────────────────────

function FormularioInteresse({ token, partnerName }: { token: string | null; partnerName: string }) {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [produto, setProduto] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [lgpd, setLgpd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) { setError("Link de captação não configurado. Entre em contato com o parceiro."); return; }
    if (!lgpd) { setError("Você precisa aceitar a política de privacidade para continuar."); return; }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/captacao/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          personType: "PF",
          name: nome,
          email,
          phone: telefone,
          productInterest: produto,
          observacoes: mensagem,
          lgpdConsent: lgpd,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Erro ao enviar formulário.");
      setSuccess(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro inesperado. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  const inp: React.CSSProperties = {
    width: "100%", background: "rgba(22,39,68,0.6)", border: `1px solid rgba(201,168,76,0.15)`,
    borderRadius: 10, padding: "11px 14px", fontSize: 13, color: CREAM, outline: "none",
    fontFamily: "DM Sans, sans-serif", boxSizing: "border-box",
  };
  const lbl: React.CSSProperties = { display: "block", fontSize: 11, fontWeight: 700, color: MUTED, marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.08em" };

  if (success) return (
    <div className="text-center py-12">
      <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.3)" }}>
        <CheckCircle2 size={32} color="#34D399" />
      </div>
      <h3 style={{ color: CREAM, fontSize: 20, fontWeight: 800, marginBottom: 8 }}>Interesse Registrado!</h3>
      <p style={{ color: MUTED, fontSize: 14, lineHeight: 1.6 }}>
        {partnerName} recebeu seu interesse e entrará em contato em breve.<br />
        Guarde este contato: <span style={{ color: G }}>deal@v3partners.com.br</span>
      </p>
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label style={lbl}>Nome completo *</label>
          <input required value={nome} onChange={e => setNome(e.target.value)} placeholder="Seu nome" style={inp} />
        </div>
        <div>
          <label style={lbl}>E-mail *</label>
          <input required type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" style={inp} />
        </div>
        <div>
          <label style={lbl}>Telefone / WhatsApp *</label>
          <input required value={telefone} onChange={e => setTelefone(e.target.value)} placeholder="(11) 99999-9999" style={inp} />
        </div>
        <div>
          <label style={lbl}>Produto de interesse *</label>
          <select required value={produto} onChange={e => setProduto(e.target.value)} style={{ ...inp, appearance: "none" }}>
            <option value="">Selecione...</option>
            {PRODUTOS_INTERESSE.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label style={lbl}>Mensagem (opcional)</label>
        <textarea
          value={mensagem} onChange={e => setMensagem(e.target.value)}
          rows={3} placeholder="Descreva brevemente sua necessidade ou o ativo que deseja estruturar..."
          style={{ ...inp, resize: "vertical" }}
        />
      </div>
      <label className="flex items-start gap-3 cursor-pointer">
        <input type="checkbox" checked={lgpd} onChange={e => setLgpd(e.target.checked)} style={{ marginTop: 3, flexShrink: 0, accentColor: G }} />
        <span style={{ color: MUTED, fontSize: 11, lineHeight: 1.6 }}>
          Autorizo a V3 Partners Soluções Ltda (CNPJ 14.219.287/0001-50) a coletar e processar meus dados para análise e estruturação de operações financeiras, conforme a LGPD — Lei nº 13.709/2018.
        </span>
      </label>
      {error && <p style={{ color: "#EF4444", fontSize: 12, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, padding: "8px 12px" }}>{error}</p>}
      <button
        type="submit" disabled={loading}
        style={{
          width: "100%", height: 48, borderRadius: 10, fontWeight: 800, fontSize: 14, cursor: loading ? "not-allowed" : "pointer",
          background: loading ? "rgba(201,168,76,0.4)" : `linear-gradient(135deg, ${G}, #E8C97A)`,
          color: BASE, border: "none", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          transition: "all 0.2s",
        }}
      >
        {loading ? "Enviando..." : <><Send size={16} /> Enviar Interesse</>}
      </button>
    </form>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function PartnerSiteClient({ profile, captacaoToken }: Props) {
  const badge = roleBadge(profile.role);
  const whatsappUrl = profile.cobranding_whatsapp
    ? `https://wa.me/55${profile.cobranding_whatsapp.replace(/\D/g, "")}`
    : null;

  function scrollToForm() {
    document.getElementById("formulario")?.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <div style={{ background: BASE, color: CREAM, fontFamily: "DM Sans, sans-serif", minHeight: "100vh" }}>

      {/* ── Ambient glow ── */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", background: "radial-gradient(ellipse 70% 40% at 50% 0%, rgba(201,168,76,0.05) 0%, transparent 70%)", zIndex: 0 }} />

      {/* ════════════════════════════════════════════════════════════
          NAV
      ════════════════════════════════════════════════════════════ */}
      <nav style={{ position: "sticky", top: 0, zIndex: 50, background: "rgba(9,8,26,0.92)", backdropFilter: "blur(16px)", borderBottom: "1px solid rgba(201,168,76,0.1)" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px", height: 64, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, overflow: "hidden", border: `1px solid rgba(201,168,76,0.25)` }}>
              <Image src="/logo.jpg" alt="V3 Partners" width={36} height={36} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
            </div>
            <div>
              <p style={{ fontSize: 11, fontWeight: 800, color: G, letterSpacing: "0.15em", lineHeight: 1 }}>V3 PARTNERS</p>
              <p style={{ fontSize: 10, color: MUTED, lineHeight: 1, marginTop: 2 }}>Boutique Institucional</p>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {profile.role === "PARTNER_PRO" || profile.role === "ENTERPRISE" ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 28, height: 28, borderRadius: 6, overflow: "hidden", background: `linear-gradient(135deg, ${NAVY2}, ${NAVY})`, border: `1px solid rgba(201,168,76,0.2)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, color: G }}>
                  {profile.avatar_url
                    ? <img src={profile.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : (profile.full_name?.[0] ?? "P").toUpperCase()
                  }
                </div>
                <span style={{ fontSize: 12, color: CREAM, fontWeight: 600, display: "none" }} className="sm:inline-block">{profile.full_name}</span>
              </div>
            ) : null}
            <button onClick={scrollToForm} style={{ padding: "8px 16px", borderRadius: 8, background: G, color: BASE, fontWeight: 800, fontSize: 12, border: "none", cursor: "pointer" }}>
              Quero Soluções
            </button>
          </div>
        </div>
      </nav>

      {/* ════════════════════════════════════════════════════════════
          HERO
      ════════════════════════════════════════════════════════════ */}
      <section style={{ position: "relative", padding: "80px 24px 100px", textAlign: "center" }}>
        <div style={{ maxWidth: 800, margin: "0 auto" }}>

          {/* Logos co-branding */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 20, marginBottom: 32 }}>
            <div style={{ width: 72, height: 72, borderRadius: 16, overflow: "hidden", border: `1px solid rgba(201,168,76,0.25)`, boxShadow: "0 0 0 1px rgba(201,168,76,0.1), 0 8px 32px rgba(0,0,0,0.5)" }}>
              <Image src="/logo.jpg" alt="V3 Partners" width={72} height={72} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
            </div>
            {(profile.role === "PARTNER_PRO" || profile.role === "ENTERPRISE") && (
              <>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <div style={{ width: 1, height: 24, background: `rgba(201,168,76,0.3)` }} />
                  <span style={{ fontSize: 11, fontWeight: 800, color: G }}>×</span>
                  <div style={{ width: 1, height: 24, background: `rgba(201,168,76,0.3)` }} />
                </div>
                <div style={{ width: 72, height: 72, borderRadius: 16, overflow: "hidden", border: `1px solid rgba(201,168,76,0.25)`, background: `linear-gradient(135deg, rgba(201,168,76,0.2), ${NAVY2})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, fontWeight: 900, color: G }}>
                  {profile.avatar_url
                    ? <img src={profile.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : (profile.full_name?.[0] ?? "P").toUpperCase()
                  }
                </div>
              </>
            )}
          </div>

          {/* Badge */}
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 16px", borderRadius: 999, background: badge.bg, border: `1px solid ${badge.border}`, marginBottom: 20 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: badge.color }} />
            <span style={{ fontSize: 11, fontWeight: 800, color: badge.color, letterSpacing: "0.12em", textTransform: "uppercase" }}>{badge.label} · V3 Partners</span>
          </div>

          {/* Nome e bio */}
          <h1 style={{ fontSize: "clamp(28px, 5vw, 52px)", fontWeight: 900, color: CREAM, lineHeight: 1.15, marginBottom: 16, letterSpacing: "-0.02em" }}>
            {profile.full_name}
          </h1>
          {profile.cobranding_bio && (
            <p style={{ fontSize: 16, color: MUTED, lineHeight: 1.7, marginBottom: 24, maxWidth: 560, margin: "0 auto 24px" }}>
              {profile.cobranding_bio}
            </p>
          )}

          {/* Tagline V3 */}
          <p style={{ fontSize: "clamp(15px, 2.5vw, 20px)", color: MUTED, lineHeight: 1.6, marginBottom: 40 }}>
            Boutique institucional multiproduto com foco em<br />
            <span style={{ color: G, fontWeight: 700 }}>securitização e estruturação financeira</span>
          </p>

          {/* Métricas */}
          <div style={{ display: "flex", justifyContent: "center", gap: 40, flexWrap: "wrap", marginBottom: 48 }}>
            {[
              { val: "R$ 4,4B", label: "Pipeline mapeado" },
              { val: "30+", label: "Linhas de crédito" },
              { val: "4", label: "Verticais de atuação" },
            ].map(m => (
              <div key={m.val} style={{ textAlign: "center" }}>
                <div style={{ fontSize: "clamp(22px, 4vw, 32px)", fontWeight: 900, color: G, lineHeight: 1 }}>{m.val}</div>
                <div style={{ fontSize: 11, color: MUTED, marginTop: 4, letterSpacing: "0.05em" }}>{m.label}</div>
              </div>
            ))}
          </div>

          {/* CTAs */}
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <button onClick={scrollToForm} style={{ padding: "14px 32px", borderRadius: 10, background: `linear-gradient(135deg, ${G}, #E8C97A)`, color: BASE, fontWeight: 800, fontSize: 15, border: "none", cursor: "pointer", boxShadow: `0 4px 24px rgba(201,168,76,0.25)` }}>
              Quero conhecer as soluções
            </button>
            {whatsappUrl && (
              <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" style={{ padding: "14px 32px", borderRadius: 10, background: "#16a34a", color: "#fff", fontWeight: 800, fontSize: 15, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 8 }}>
                <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                Falar no WhatsApp
              </a>
            )}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════
          SOBRE A V3
      ════════════════════════════════════════════════════════════ */}
      <section style={{ padding: "80px 24px", background: NAVY, borderTop: `1px solid rgba(201,168,76,0.1)`, borderBottom: `1px solid rgba(201,168,76,0.1)` }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 56 }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: G, letterSpacing: "0.2em", textTransform: "uppercase" }}>Sobre a V3 Partners</span>
            <h2 style={{ fontSize: "clamp(24px, 4vw, 40px)", fontWeight: 900, color: CREAM, marginTop: 12, lineHeight: 1.2 }}>
              Transformamos Ativos Reais em Capital Global
            </h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 24 }}>
            {[
              { icon: <Target size={20} />, title: "Missão", desc: "Converter ativos complexos em produtos líquidos, seguros e acessíveis — conectando a economia real ao capital global." },
              { icon: <Star size={20} />, title: "Visão", desc: "Ser referência global em securitização independente, operando com disciplina institucional em qualquer jurisdição." },
              { icon: <Shield size={20} />, title: "Compliance", desc: "Operação alinhada com CVM, COAF e regulação internacional. Liquidação D+0 OTC, 24/7, sem janelas de mercado." },
              { icon: <Globe size={20} />, title: "Presença Global", desc: "Atuação no Brasil, EUA, Japão e El Salvador. Capital de fundos institucionais japoneses e américanos na mesa." },
            ].map(c => (
              <div key={c.title} style={{ background: "rgba(9,8,26,0.5)", border: `1px solid rgba(201,168,76,0.12)`, borderRadius: 16, padding: 28 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: `rgba(201,168,76,0.1)`, border: `1px solid rgba(201,168,76,0.2)`, display: "flex", alignItems: "center", justifyContent: "center", color: G, marginBottom: 16 }}>
                  {c.icon}
                </div>
                <h3 style={{ fontSize: 15, fontWeight: 800, color: CREAM, marginBottom: 8 }}>{c.title}</h3>
                <p style={{ fontSize: 13, color: MUTED, lineHeight: 1.7 }}>{c.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════
          VERTICAIS
      ════════════════════════════════════════════════════════════ */}
      <section style={{ padding: "80px 24px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 56 }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: G, letterSpacing: "0.2em", textTransform: "uppercase" }}>Atuação</span>
            <h2 style={{ fontSize: "clamp(24px, 4vw, 40px)", fontWeight: 900, color: CREAM, marginTop: 12 }}>
              4 Verticais de Ativos
            </h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 20 }}>
            {VERTICAIS.map(v => (
              <div key={v.num} style={{ background: NAVY, border: `1px solid rgba(201,168,76,0.12)`, borderRadius: 16, padding: 28, position: "relative", overflow: "hidden" }}>
                <div style={{ position: "absolute", top: 20, right: 20, fontSize: 40, fontWeight: 900, color: `rgba(201,168,76,0.06)`, lineHeight: 1 }}>{v.num}</div>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: `rgba(201,168,76,0.1)`, border: `1px solid rgba(201,168,76,0.2)`, display: "flex", alignItems: "center", justifyContent: "center", color: G, marginBottom: 16 }}>
                  {v.icon}
                </div>
                <h3 style={{ fontSize: 15, fontWeight: 800, color: CREAM, marginBottom: 10, lineHeight: 1.3 }}>{v.title}</h3>
                <p style={{ fontSize: 12, color: MUTED, lineHeight: 1.7, marginBottom: 16 }}>{v.desc}</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {v.linhas.map(l => (
                    <span key={l} style={{ fontSize: 10, fontWeight: 700, color: G, background: `rgba(201,168,76,0.08)`, border: `1px solid rgba(201,168,76,0.2)`, borderRadius: 6, padding: "3px 8px" }}>{l}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════
          PORTFÓLIO — 30+ LINHAS
      ════════════════════════════════════════════════════════════ */}
      <section style={{ padding: "80px 24px", background: NAVY, borderTop: `1px solid rgba(201,168,76,0.1)`, borderBottom: `1px solid rgba(201,168,76,0.1)` }}>
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 56 }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: G, letterSpacing: "0.2em", textTransform: "uppercase" }}>Portfólio</span>
            <h2 style={{ fontSize: "clamp(24px, 4vw, 40px)", fontWeight: 900, color: CREAM, marginTop: 12 }}>30+ Linhas de Crédito Estruturado</h2>
            <p style={{ fontSize: 14, color: MUTED, marginTop: 12 }}>Clique em cada categoria para explorar as linhas disponíveis</p>
          </div>
          <div style={{ background: "rgba(9,8,26,0.4)", border: `1px solid rgba(201,168,76,0.1)`, borderRadius: 16, padding: "0 24px" }}>
            {PORTFOLIO.map(p => <Accordion key={p.categoria} categoria={p.categoria} linhas={p.linhas} />)}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════
          TOKENIZAÇÃO
      ════════════════════════════════════════════════════════════ */}
      <section style={{ padding: "80px 24px" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 56 }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: G, letterSpacing: "0.2em", textTransform: "uppercase" }}>Inovação</span>
            <h2 style={{ fontSize: "clamp(24px, 4vw, 40px)", fontWeight: 900, color: CREAM, marginTop: 12 }}>
              Tokenização de Ativos Reais
            </h2>
            <p style={{ fontSize: 15, color: G, fontWeight: 700, marginTop: 8 }}>"Seu Ativo. Token. Liquidez Global"</p>
            <p style={{ fontSize: 14, color: MUTED, marginTop: 12, maxWidth: 560, margin: "12px auto 0" }}>
              Em parceria com a Bloxs (infraestrutura regulada CVM 88), fracionamos ativos reais em tokens negociáveis globalmente. Ticket mínimo R$2M · Prazo 60-90 dias.
            </p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 20 }}>
            {TOKENS_STEPS.map((s, i) => (
              <div key={s.num} style={{ background: NAVY, border: `1px solid rgba(201,168,76,0.12)`, borderRadius: 14, padding: 24, position: "relative" }}>
                {i < TOKENS_STEPS.length - 1 && (
                  <div style={{ display: "none" }} />
                )}
                <div style={{ fontSize: 32, fontWeight: 900, color: `rgba(201,168,76,0.15)`, lineHeight: 1, marginBottom: 12 }}>{s.num}</div>
                <h3 style={{ fontSize: 14, fontWeight: 800, color: G, marginBottom: 8 }}>{s.title}</h3>
                <p style={{ fontSize: 12, color: MUTED, lineHeight: 1.7 }}>{s.desc}</p>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 32, background: "rgba(201,168,76,0.04)", border: `1px solid rgba(201,168,76,0.12)`, borderRadius: 14, padding: 24 }}>
            <p style={{ fontSize: 11, fontWeight: 800, color: G, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>Ativos Elegíveis</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              {["Real Estate (urbano e rural)", "Precatórios e Recebíveis", "FIDC Fracionado", "Ouro e Carbonato de Lítio", "Participações societárias em SPE"].map(a => (
                <span key={a} style={{ fontSize: 12, color: CREAM, background: "rgba(22,39,68,0.8)", border: `1px solid rgba(201,168,76,0.15)`, borderRadius: 8, padding: "5px 12px" }}>{a}</span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════
          EXPORTE-SE
      ════════════════════════════════════════════════════════════ */}
      <section style={{ padding: "80px 24px", background: NAVY, borderTop: `1px solid rgba(201,168,76,0.1)`, borderBottom: `1px solid rgba(201,168,76,0.1)` }}>
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 48, alignItems: "center" }} className="grid-single-on-mobile">
            <div>
              <span style={{ fontSize: 11, fontWeight: 800, color: G, letterSpacing: "0.2em", textTransform: "uppercase" }}>Internacionalização</span>
              <h2 style={{ fontSize: "clamp(24px, 3.5vw, 38px)", fontWeight: 900, color: CREAM, marginTop: 12, lineHeight: 1.2 }}>Exporte-se —<br />Patrimônio em Dólar</h2>
              <p style={{ fontSize: 15, color: G, fontWeight: 700, marginTop: 8 }}>"Seu patrimônio. Em dólar. Com estrutura."</p>
              <p style={{ fontSize: 13, color: MUTED, lineHeight: 1.8, marginTop: 16, marginBottom: 24 }}>
                Estruturação completa para internacionalização patrimonial via LLC americana, imóvel na Flórida e renda passiva em dólar. Retorno estimado de 15-20% a.a. em dólar.
              </p>
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 24 }}>
                {[{ val: "15-20%", label: "a.a. em dólar" }, { val: "24m", label: "Prazo" }, { val: "R$10K", label: "Ticket mínimo" }].map(m => (
                  <div key={m.val} style={{ textAlign: "center", background: "rgba(9,8,26,0.5)", border: `1px solid rgba(201,168,76,0.15)`, borderRadius: 10, padding: "12px 20px" }}>
                    <div style={{ fontSize: 20, fontWeight: 900, color: G }}>{m.val}</div>
                    <div style={{ fontSize: 10, color: MUTED, marginTop: 2 }}>{m.label}</div>
                  </div>
                ))}
              </div>
              <button onClick={scrollToForm} style={{ padding: "12px 28px", borderRadius: 10, background: `linear-gradient(135deg, ${G}, #E8C97A)`, color: BASE, fontWeight: 800, fontSize: 13, border: "none", cursor: "pointer" }}>
                Quero estruturar meu patrimônio
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[
                { num: "01", title: "Estrutura Empresarial nos EUA", desc: "LLC americana constituída com planejamento tributário e sucessório completo." },
                { num: "02", title: "Investimento Imobiliário", desc: "Projetos selecionados na Flórida com due diligence e gestão local." },
                { num: "03", title: "Dolarização Patrimonial", desc: "Conversão e proteção do patrimônio em ativos dolarizados de alta liquidez." },
                { num: "04", title: "Renda Passiva Turnkey", desc: "Gestão completa do ativo — locação, manutenção e distribuição de renda." },
                { num: "05", title: "Planejamento Sucessório", desc: "Estrutura jurídica para transmissão internacional com eficiência fiscal." },
                { num: "06", title: "Suporte Especializado Local", desc: "Equipe parceira em Miami para suporte operacional e jurídico contínuo." },
              ].map(p => (
                <div key={p.num} style={{ display: "flex", gap: 14, alignItems: "flex-start", background: "rgba(9,8,26,0.4)", border: `1px solid rgba(201,168,76,0.1)`, borderRadius: 12, padding: "14px 18px" }}>
                  <span style={{ fontSize: 11, fontWeight: 900, color: G, flexShrink: 0, marginTop: 1 }}>{p.num}</span>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 700, color: CREAM, marginBottom: 2 }}>{p.title}</p>
                    <p style={{ fontSize: 11, color: MUTED, lineHeight: 1.6 }}>{p.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════
          GOVERNANÇA / CULTURA
      ════════════════════════════════════════════════════════════ */}
      <section style={{ padding: "80px 24px" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: G, letterSpacing: "0.2em", textTransform: "uppercase" }}>Governança</span>
            <h2 style={{ fontSize: "clamp(22px, 4vw, 36px)", fontWeight: 900, color: CREAM, marginTop: 12 }}>Cultura & Diferenciais Operacionais</h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 20, marginBottom: 32 }}>
            {PILARES_CULTURA.map(p => (
              <div key={p.title} style={{ background: NAVY, border: `1px solid rgba(201,168,76,0.12)`, borderRadius: 14, padding: 24 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: G, marginBottom: 14 }} />
                <h3 style={{ fontSize: 14, fontWeight: 800, color: CREAM, marginBottom: 8 }}>{p.title}</h3>
                <p style={{ fontSize: 12, color: MUTED, lineHeight: 1.7 }}>{p.desc}</p>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap" }}>
            {[
              { icon: <Zap size={14} />, label: "Liquidação D+0 OTC" },
              { icon: <Shield size={14} />, label: "Compliance CVM + COAF" },
              { icon: <Globe size={14} />, label: "Operação 24/7 Global" },
              { icon: <Award size={14} />, label: "Independentes de bancos" },
            ].map(d => (
              <div key={d.label} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 18px", borderRadius: 10, background: "rgba(201,168,76,0.05)", border: `1px solid rgba(201,168,76,0.15)`, color: G, fontSize: 12, fontWeight: 700 }}>
                {d.icon} {d.label}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════
          MANAGING PARTNERS
      ════════════════════════════════════════════════════════════ */}
      <section style={{ padding: "80px 24px", background: NAVY, borderTop: `1px solid rgba(201,168,76,0.1)`, borderBottom: `1px solid rgba(201,168,76,0.1)` }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: G, letterSpacing: "0.2em", textTransform: "uppercase" }}>Liderança</span>
            <h2 style={{ fontSize: "clamp(22px, 4vw, 36px)", fontWeight: 900, color: CREAM, marginTop: 12 }}>Managing Partners</h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 24 }}>
            {[
              { nome: "João Lemos Netto", cargo: "Head de Originação & Ativos", desc: "Estruturação de crédito, CGI, CRI, FIDC e operações cross-border." },
              { nome: "Robson Lino dos Santos", cargo: "COO e Compliance", desc: "Integridade operacional, compliance CVM/COAF e análise de risco." },
              { nome: "Hamilton Santos", cargo: "CFO e Relações Institucionais", desc: "Liquidez, relações com investidores institucionais e operações OTC." },
            ].map(p => (
              <div key={p.nome} style={{ background: "rgba(9,8,26,0.5)", border: `1px solid rgba(201,168,76,0.12)`, borderRadius: 16, padding: 28, textAlign: "center" }}>
                <div style={{ width: 56, height: 56, borderRadius: "50%", background: `linear-gradient(135deg, rgba(201,168,76,0.2), ${NAVY2})`, border: `1px solid rgba(201,168,76,0.25)`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", fontSize: 20, fontWeight: 900, color: G }}>
                  {p.nome[0]}
                </div>
                <h3 style={{ fontSize: 14, fontWeight: 800, color: CREAM, marginBottom: 4 }}>{p.nome}</h3>
                <p style={{ fontSize: 11, color: G, fontWeight: 700, marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>{p.cargo}</p>
                <p style={{ fontSize: 12, color: MUTED, lineHeight: 1.6 }}>{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════
          FORMULÁRIO DE INTERESSE
      ════════════════════════════════════════════════════════════ */}
      <section id="formulario" style={{ padding: "80px 24px" }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: G, letterSpacing: "0.2em", textTransform: "uppercase" }}>Contato</span>
            <h2 style={{ fontSize: "clamp(24px, 4vw, 40px)", fontWeight: 900, color: CREAM, marginTop: 12 }}>Demonstre seu Interesse</h2>
            <p style={{ fontSize: 14, color: MUTED, marginTop: 12, lineHeight: 1.6 }}>
              Preencha o formulário e <strong style={{ color: CREAM }}>{profile.full_name}</strong> entrará em contato com a solução ideal para o seu perfil.
            </p>
          </div>
          <div style={{ background: NAVY, border: `1px solid rgba(201,168,76,0.15)`, borderRadius: 20, padding: "36px 32px", boxShadow: "0 24px 64px rgba(0,0,0,0.4)" }}>
            <div style={{ height: 3, background: `linear-gradient(90deg, ${G}, #E8C97A, ${G})`, borderRadius: 999, marginBottom: 32 }} />
            <FormularioInteresse token={captacaoToken} partnerName={profile.full_name ?? "o parceiro"} />
          </div>

          {/* Info de contato direto */}
          <div style={{ marginTop: 32, display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap" }}>
            <a href="mailto:deal@v3partners.com.br" style={{ display: "flex", alignItems: "center", gap: 8, color: MUTED, fontSize: 13, textDecoration: "none" }}>
              <Mail size={14} color={G} /> deal@v3partners.com.br
            </a>
            <span style={{ color: "rgba(201,168,76,0.2)" }}>|</span>
            <span style={{ display: "flex", alignItems: "center", gap: 8, color: MUTED, fontSize: 13 }}>
              <MapPin size={14} color={G} /> Rua Visconde de Pirajá, 414 — Ipanema, RJ
            </span>
            {whatsappUrl && (
              <>
                <span style={{ color: "rgba(201,168,76,0.2)" }}>|</span>
                <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", gap: 8, color: MUTED, fontSize: 13, textDecoration: "none" }}>
                  <Phone size={14} color={G} /> WhatsApp direto
                </a>
              </>
            )}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════
          FOOTER
      ════════════════════════════════════════════════════════════ */}
      <footer style={{ background: "rgba(0,0,0,0.5)", borderTop: `1px solid rgba(201,168,76,0.1)`, padding: "40px 24px 32px" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 32, marginBottom: 40 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                <div style={{ width: 32, height: 32, borderRadius: 7, overflow: "hidden" }}>
                  <Image src="/logo.jpg" alt="V3 Partners" width={32} height={32} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                </div>
                <span style={{ fontSize: 13, fontWeight: 800, color: G }}>V3 Partners</span>
              </div>
              <p style={{ fontSize: 12, color: MUTED, lineHeight: 1.7 }}>Boutique institucional multiproduto especializada em securitização e estruturação financeira.</p>
              {profile.cobranding_instagram && (
                <a href={`https://instagram.com/${profile.cobranding_instagram.replace("@", "")}`} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 12, fontSize: 12, color: MUTED, textDecoration: "none" }}>
                  <Users size={13} color={G} /> @{profile.cobranding_instagram.replace("@", "")}
                </a>
              )}
            </div>
            <div>
              <p style={{ fontSize: 11, fontWeight: 800, color: G, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 14 }}>Verticais</p>
              {["Crédito Estruturado", "Real Estate", "Mineração & Commodities", "M&A e Expansão"].map(v => (
                <p key={v} style={{ fontSize: 12, color: MUTED, marginBottom: 6 }}>{v}</p>
              ))}
            </div>
            <div>
              <p style={{ fontSize: 11, fontWeight: 800, color: G, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 14 }}>Soluções</p>
              {["Tokenização de Ativos", "Exporte-se", "Wealth Management", "Cross-Border"].map(v => (
                <p key={v} style={{ fontSize: 12, color: MUTED, marginBottom: 6 }}>{v}</p>
              ))}
            </div>
            <div>
              <p style={{ fontSize: 11, fontWeight: 800, color: G, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 14 }}>Contato</p>
              <p style={{ fontSize: 12, color: MUTED, marginBottom: 6 }}>deal@v3partners.com.br</p>
              <p style={{ fontSize: 12, color: MUTED, marginBottom: 6 }}>Rua Visconde de Pirajá, 414, Sala 718</p>
              <p style={{ fontSize: 12, color: MUTED, marginBottom: 6 }}>Ipanema, Rio de Janeiro, RJ</p>
              <p style={{ fontSize: 12, color: MUTED }}>Brasil · EUA · Japão · El Salvador</p>
            </div>
          </div>
          <div style={{ borderTop: `1px solid rgba(201,168,76,0.08)`, paddingTop: 24, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            <p style={{ fontSize: 11, color: `${MUTED}99`, textAlign: "center" }}>
              © 2026 V3 Partners Soluções Ltda · CNPJ 14.219.287/0001-50 · v3partners.com.br
            </p>
            <p style={{ fontSize: 10, color: `${MUTED}66`, textAlign: "center" }}>
              Dados protegidos pela LGPD — Lei nº 13.709/2018 · Página apresentada por <span style={{ color: G }}>{profile.full_name}</span>
            </p>
            <div style={{ display: "flex", gap: 16, marginTop: 4 }}>
              {["Privacidade", "Termos de Uso", "Cookies"].map(l => (
                <a key={l} href="https://v3partners.com.br" target="_blank" rel="noopener noreferrer" style={{ fontSize: 10, color: `${MUTED}66`, textDecoration: "none" }}>{l}</a>
              ))}
            </div>
            <p style={{ fontSize: 10, color: `${MUTED}44`, marginTop: 4 }}>
              Powered by <span style={{ color: G }}>V3 Partners Platform</span>
            </p>
          </div>
        </div>
      </footer>

      <style>{`
        @media (max-width: 640px) {
          .grid-single-on-mobile { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
