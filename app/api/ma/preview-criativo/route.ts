import { NextResponse } from "next/server";
import { createClient as sc } from "@supabase/supabase-js";
import { DEMO_DEALS } from "@/lib/demo-data";

const IS_DEMO = false;

const FONT = `https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;0,9..40,800;1,9..40,400&display=swap`;

const CSS_BASE = `
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'DM Sans',sans-serif;background:#09081A;color:#F0ECE4}
  .gold{color:#C9A84C} .gold-light{color:#E8C97A} .muted{color:#7A8FA8}
  .card{background:#162744;border:1px solid #243A66;border-radius:12px;padding:24px}
  .label{font-size:9px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:#C9A84C}
  .divider{height:1px;background:linear-gradient(90deg,#C9A84C33,transparent);margin:20px 0}
  @media print{
    html,body{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;margin:0!important;padding:0!important;}
  }
`;

function formatBRL(v: number) {
  if (v >= 1e9) return `R$ ${(v / 1e9).toFixed(1)} B`;
  if (v >= 1e6) return `R$ ${(v / 1e6).toFixed(1)} MM`;
  if (v >= 1e3) return `R$ ${(v / 1e3).toFixed(0)} K`;
  return `R$ ${v}`;
}

function formatUSD(v: number) {
  const usd = v / 5.1;
  if (usd >= 1e9) return `USD ${(usd / 1e9).toFixed(1)}B`;
  if (usd >= 1e6) return `USD ${(usd / 1e6).toFixed(1)}M`;
  return `USD ${(usd / 1e3).toFixed(0)}K`;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getForjaData(ad: any) {
  const fr = ad?.forja_result ?? {};
  return {
    narrative_pt: (fr.narrative_pt ?? "") as string,
    narrative_en: (fr.narrative_en ?? "") as string,
    tese: Array.isArray(fr.tese_investimento) ? fr.tese_investimento as string[] : [],
  };
}

// Renderiza tese_investimento como bullets (array) ou parágrafo (string legado)
function renderTese(tese: string[] | string, style = "font-size:12px;color:#7A8FA8;line-height:1.7"): string {
  if (Array.isArray(tese) && tese.length > 0) {
    return tese.map(b =>
      `<div style="display:flex;align-items:flex-start;gap:10px;margin-bottom:10px;">
         <div style="width:5px;height:5px;border-radius:50%;background:#C9A84C;flex-shrink:0;margin-top:5px;"></div>
         <p style="${style}">${b}</p>
       </div>`
    ).join("");
  }
  if (typeof tese === "string" && tese.trim()) {
    return `<p style="${style}">${tese}</p>`;
  }
  return "";
}

// ── CIM — Memorando de Informação Confidencial ──────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildCIM(deal: any, lang: string): string {
  const ad = deal.asset_data ?? {};
  const isPt = lang === "pt-br";
  const forja = getForjaData(ad);

  // Descrição: preferência FORJA narrative → gerar-kit-ia descricao
  const desc = isPt
    ? (forja.narrative_pt || ad.descricao_ptbr || ad.descricao || "")
    : (forja.narrative_en || ad.descricao_en || ad.descricao_ptbr || "");

  // Tese: preferência FORJA tese_investimento (array) → legado string
  const tese = forja.tese.length > 0
    ? forja.tese
    : isPt ? (ad.tese_investimento ?? "") : (ad.tese_investimento_en ?? ad.tese_investimento ?? "");

  const metricas: { label: string; value: string; sub?: string }[] = ad.metricas ?? [];
  const diferenciais: string[] = ad.diferenciais ?? [];
  const riscos: { nivel: string; descricao: string; mitigacao: string }[] = ad.riscos ?? [];

  const t = isPt ? {
    confidencial: "MEMORANDO DE INFORMAÇÃO CONFIDENCIAL",
    sumario: "Sumário Executivo",
    visao: "Visão Geral do Negócio",
    metricas: "Métricas-Chave",
    difer: "Diferenciais Competitivos",
    riscos: "Riscos e Mitigações",
    operacao: "Dados da Operação",
    tese: "Tese de Investimento",
    aviso: "Este documento é estritamente confidencial e destinado exclusivamente ao destinatário autorizado. A reprodução, distribuição ou divulgação sem autorização prévia da V3 Partners é expressamente proibida.",
    processo: "Processo",
    setor: "Setor",
    localizacao: "Localização",
    fechamento: "Fechamento Previsto",
    valorDeal: "Valor do Deal",
    multiploEbitda: "Múltiplo EBITDA",
    probabilidade: "Probabilidade",
    nivel: "Nível",
    mitigacao: "Mitigação",
    pag: "Página",
    de: "de",
    regulatorio: "Registro Regulatório",
  } : {
    confidencial: "CONFIDENTIAL INFORMATION MEMORANDUM",
    sumario: "Executive Summary",
    visao: "Business Overview",
    metricas: "Key Metrics",
    difer: "Competitive Advantages",
    riscos: "Risk Factors & Mitigations",
    operacao: "Transaction Details",
    tese: "Investment Thesis",
    aviso: "This document is strictly confidential and intended solely for the authorized recipient. Reproduction, distribution or disclosure without prior written consent from V3 Partners is expressly prohibited.",
    processo: "Process",
    setor: "Sector",
    localizacao: "Location",
    fechamento: "Expected Close",
    valorDeal: "Deal Value",
    multiploEbitda: "EBITDA Multiple",
    probabilidade: "Probability",
    nivel: "Level",
    mitigacao: "Mitigation",
    pag: "Page",
    de: "of",
    regulatorio: "Regulatory Registration",
  };

  const nivelColor = (n: string) =>
    n === "baixo" || n === "low" ? "#10b981" : n === "medio" || n === "medium" ? "#f59e0b" : "#ef4444";

  return `<!DOCTYPE html><html lang="${lang}"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>CIM — ${deal.target_company}</title>
<link href="${FONT}" rel="stylesheet">
<style>
${CSS_BASE}
@page{size:A4 portrait;margin:0}
/* ── WRAPPER: fundo escuro com páginas A4 centralizadas ── */
body{background:#060515;padding:40px 0;min-height:100vh}
/* ── PÁGINA A4: 794×1123px a 96dpi. Borda gold sutil + sombra visível ── */
.page{
  width:794px;min-height:1123px;
  margin:0 auto 32px;padding:52px 60px;
  position:relative;page-break-after:always;
  border:1px solid rgba(201,168,76,0.18);
  box-shadow:0 2px 0 0 rgba(201,168,76,0.4),0 8px 48px rgba(0,0,0,0.8),0 0 0 1px rgba(201,168,76,0.06);
  overflow:hidden;
}
.page-cover{background:linear-gradient(155deg,#09081A 55%,#111F35 100%);display:flex;flex-direction:column;height:1123px}
.page-inner{background:#111F35;min-height:1123px}
/* ── FAIXA OURO NO TOPO DE CADA PÁGINA ── */
.page::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,transparent,#C9A84C,#E8C97A 50%,#C9A84C,transparent)}
@media print{
  body{padding:0!important;background:#09081A!important;}
  .page{
    width:210mm!important;height:297mm!important;min-height:297mm!important;
    padding:14mm 18mm!important;border:none!important;
    margin:0!important;box-shadow:none!important;overflow:visible!important;
    page-break-after:always;
  }
  .page-cover{height:297mm!important;}
  .page::before{-webkit-print-color-adjust:exact;print-color-adjust:exact;}
}
/* ── CAPA ── */
.cover-logo{display:flex;align-items:center;gap:14px;margin-bottom:auto}
.cover-title{font-size:40px;font-weight:800;line-height:1.1;color:#F0ECE4;margin-bottom:10px}
.cover-sub{font-size:13px;color:#7A8FA8;margin-bottom:40px;line-height:1.5}
.cover-bar{width:60px;height:3px;background:linear-gradient(90deg,#C9A84C,#E8C97A);border-radius:2px;margin-bottom:28px}
.cover-meta{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:32px}
.cover-meta-item{background:rgba(22,39,68,0.6);border:1px solid rgba(201,168,76,0.15);border-radius:6px;padding:14px 16px}
.cover-meta-item p:first-child{font-size:8px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:#C9A84C;margin-bottom:6px}
.cover-meta-item p:last-child{font-size:18px;font-weight:800;color:#E8C97A}
.cover-confidential{font-size:8px;font-weight:700;letter-spacing:4px;text-transform:uppercase;color:rgba(201,168,76,0.6);border:1px solid rgba(201,168,76,0.2);padding:5px 12px;border-radius:3px;display:inline-block}
.page-num{position:absolute;bottom:28px;right:52px;font-size:9px;color:rgba(122,143,168,0.5);letter-spacing:1px}
/* ── PÁGINAS INTERNAS ── */
.section-title{font-size:20px;font-weight:700;color:#F0ECE4;margin-bottom:6px}
.section-sub{font-size:11px;color:#7A8FA8;margin-bottom:24px;line-height:1.6}
.metric-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:14px;margin-top:16px}
.metric-item{background:#162744;border:1px solid #243A66;border-radius:8px;padding:18px;border-top:2px solid #C9A84C}
.metric-item .val{font-size:20px;font-weight:800;color:#E8C97A;margin:5px 0 2px}
.metric-item .sub{font-size:10px;color:#7A8FA8}
.diff-item{display:flex;align-items:flex-start;gap:12px;padding:12px 14px;background:#162744;border:1px solid #243A66;border-radius:6px;margin-bottom:8px}
.diff-dot{width:5px;height:5px;border-radius:50%;background:#C9A84C;margin-top:6px;flex-shrink:0}
.diff-text{font-size:12px;color:#7A8FA8;line-height:1.6}
.risk-item{border:1px solid #243A66;border-radius:6px;padding:12px 14px;margin-bottom:8px;display:flex;gap:12px;align-items:flex-start}
.risk-badge{padding:2px 7px;border-radius:3px;font-size:8px;font-weight:700;text-transform:uppercase;white-space:nowrap;flex-shrink:0;margin-top:2px}
.data-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:14px}
.data-item dt{font-size:8px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#C9A84C;margin-bottom:4px}
.data-item dd{font-size:13px;font-weight:600;color:#F0ECE4}
.tese-box{background:#162744;border:1px solid rgba(201,168,76,0.2);border-left:3px solid #C9A84C;border-radius:0 6px 6px 0;padding:18px 22px}
.aviso-box{background:#162744;border:1px solid #243A66;border-radius:6px;padding:14px;font-size:10px;color:#7A8FA8;line-height:1.7}
</style>
</head><body>

<!-- CAPA -->
<div class="page page-cover">
  <div class="cover-logo">
    <img src="/v3-logo-flat-gold-alpha.png" alt="V3 Partners" style="height:44px;width:auto;">
    <div>
      <p style="font-size:11px;font-weight:700;color:#F0ECE4">V3 Partners</p>
      <p style="font-size:9px;color:#7A8FA8">M&A · Fusões e Aquisições</p>
    </div>
  </div>

  <div>
    <div class="cover-bar"></div>
    <p class="label" style="margin-bottom:16px">${t.confidencial}</p>
    <h1 class="cover-title">${deal.target_company}</h1>
    <p class="cover-sub">${deal.sector}${deal.location ? " · " + deal.location : ""}</p>
    <div class="cover-meta">
      <div class="cover-meta-item">
        <p>${t.valorDeal}</p>
        <p>${deal.deal_value ? formatBRL(deal.deal_value) : "—"}</p>
      </div>
      ${deal.ebitda_multiple ? `<div class="cover-meta-item"><p>${t.multiploEbitda}</p><p>${deal.ebitda_multiple}x</p></div>` : ""}
      ${deal.sector ? `<div class="cover-meta-item"><p>${t.setor}</p><p>${deal.sector}</p></div>` : ""}
    </div>
    <p style="margin-top:32px" class="cover-confidential">${t.confidencial}</p>
  </div>
  <span class="page-num">${t.pag} 1 ${t.de} 6</span>
</div>

<!-- PÁG 2 — AVISO LEGAL + PROCESSO -->
<div class="page page-inner">
  <p class="label" style="margin-bottom:24px">${t.operacao}</p>
  <div class="data-grid" style="margin-bottom:32px">
    ${ad.processo_v3 ? `<div class="data-item"><dt>${t.processo} V3</dt><dd>${ad.processo_v3}</dd></div>` : ""}
    ${ad.processo_regulatorio ? `<div class="data-item"><dt>${t.regulatorio}</dt><dd>${ad.processo_regulatorio}</dd></div>` : ""}
    <div class="data-item"><dt>${t.setor}</dt><dd>${deal.sector}</dd></div>
    ${deal.location ? `<div class="data-item"><dt>${t.localizacao}</dt><dd>${deal.location}</dd></div>` : ""}
    ${deal.expected_close_date ? `<div class="data-item"><dt>${t.fechamento}</dt><dd>${deal.expected_close_date}</dd></div>` : ""}
    <div class="data-item"><dt>${t.valorDeal}</dt><dd>${deal.deal_value ? formatBRL(deal.deal_value) + " · " + formatUSD(deal.deal_value) : "—"}</dd></div>
  </div>
  <div class="divider"></div>
  <div class="aviso-box">${t.aviso}</div>
  <span class="page-num">${t.pag} 2 ${t.de} 6</span>
</div>

<!-- PÁG 3 — SUMÁRIO EXECUTIVO -->
<div class="page page-inner">
  <p class="label" style="margin-bottom:8px">${t.sumario}</p>
  <h2 class="section-title">${deal.target_company}</h2>
  <p class="section-sub">${deal.sector}${deal.location ? " · " + deal.location : ""}</p>
  <p style="font-size:13px;color:#7A8FA8;line-height:1.8;margin-bottom:24px">${desc}</p>
  ${(Array.isArray(tese) ? tese.length > 0 : !!tese) ? `
  <p class="label" style="margin-bottom:12px">${t.tese}</p>
  <div class="tese-box">
    ${renderTese(tese, "font-size:12px;color:#F0ECE4;line-height:1.75")}
  </div>` : ""}
  <span class="page-num">${t.pag} 3 ${t.de} 6</span>
</div>

<!-- PÁG 4 — MÉTRICAS -->
<div class="page page-inner">
  <p class="label" style="margin-bottom:8px">${t.metricas}</p>
  <h2 class="section-title" style="margin-bottom:4px">Performance & Valuation</h2>
  ${metricas.length > 0 ? `
  <div class="metric-grid">
    ${metricas.map(m => `
    <div class="metric-item">
      <p class="label">${m.label}</p>
      <p class="val">${m.value}</p>
      ${m.sub ? `<p class="sub">${m.sub}</p>` : ""}
    </div>`).join("")}
  </div>` : `<p style="color:#7A8FA8;font-size:13px;margin-top:20px">Métricas financeiras detalhadas disponíveis sob solicitação com NDA assinado.</p>`}
  <span class="page-num">${t.pag} 4 ${t.de} 6</span>
</div>

<!-- PÁG 5 — DIFERENCIAIS -->
<div class="page page-inner">
  <p class="label" style="margin-bottom:8px">${t.difer}</p>
  <h2 class="section-title" style="margin-bottom:20px">Por que este ativo?</h2>
  ${diferenciais.map(d => `<div class="diff-item"><span class="diff-dot"></span><p class="diff-text">${d}</p></div>`).join("")}
  <span class="page-num">${t.pag} 5 ${t.de} 6</span>
</div>

<!-- PÁG 6 — RISCOS + CONTATO -->
<div class="page page-inner">
  <p class="label" style="margin-bottom:8px">${t.riscos}</p>
  <h2 class="section-title" style="margin-bottom:20px">Risk Framework</h2>
  ${riscos.map(r => `
  <div class="risk-item">
    <span class="risk-badge" style="background:${nivelColor(r.nivel)}22;color:${nivelColor(r.nivel)}">${r.nivel.toUpperCase()}</span>
    <div>
      <p style="font-size:12px;font-weight:600;color:#F0ECE4;margin-bottom:4px">${r.descricao}</p>
      <p style="font-size:11px;color:#7A8FA8">${t.mitigacao}: ${r.mitigacao}</p>
    </div>
  </div>`).join("")}
  <div class="divider"></div>
  <div style="display:flex;align-items:center;gap:16px;margin-top:24px">
    <img src="/v3-logo-flat-gold-alpha.png" alt="V3 Partners" style="height:40px;width:auto;flex-shrink:0;">
    <div>
      <p style="font-size:11px;font-weight:700;color:#F0ECE4">V3 Partners — Mesa M&A</p>
      <p style="font-size:10px;color:#7A8FA8">v3partners.com.br · Rua Visconde de Pirajá, 414, Sala 718 — Ipanema, Rio de Janeiro</p>
    </div>
  </div>
  <span class="page-num">${t.pag} 6 ${t.de} 6</span>
</div>

</body></html>`;
}

// ── TEASER CEGO ──────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildTeaser(deal: any, lang: string): string {
  const ad = deal.asset_data ?? {};
  const isPt = lang === "pt-br";
  const forja = getForjaData(ad);

  // Descrição cega: preferência FORJA narrative → legado curto
  const desc = isPt
    ? (forja.narrative_pt || ad.teaser_ptbr || ad.descricao_ptbr || "")
    : (forja.narrative_en || ad.teaser_en || ad.descricao_en || "");

  // Tese: FORJA array → legado string
  const tese = forja.tese.length > 0
    ? forja.tese
    : isPt ? (ad.tese_investimento ?? "") : (ad.tese_investimento_en ?? ad.tese_investimento ?? "");

  // Região CEGA: apenas estado/UF
  const loc = (deal.location ?? "") as string;
  const regiaoBlind = (() => {
    const ufMatch = loc.match(/\b([A-Z]{2})\b/);
    if (ufMatch) return ufMatch[1];
    const estado = loc.match(/(Rio de Janeiro|São Paulo|Minas Gerais|Bahia|Paraná|Rio Grande do Sul|Pernambuco|Ceará|Goiás|Mato Grosso)/i);
    if (estado) return estado[0];
    const parts = loc.split(/[-·,\s]+/).filter(Boolean);
    return parts[parts.length - 1] ?? "Brasil";
  })();

  const metricas: { label: string; value: string; sub?: string }[] = ad.metricas ?? [];
  const diferenciais: string[] = ad.diferenciais ?? [];

  const t = isPt ? {
    teaser: "TEASER CEGO — OPORTUNIDADE M&A",
    oport: "Oportunidade de Aquisição",
    tese: "Tese de Investimento",
    metricas: "Métricas-Chave",
    difer: "Diferenciais",
    nda: "Mais informações disponíveis mediante NDA assinado.",
    ndaBtn: "Solicitar NDA e CIM Completo",
    aviso: "Documento confidencial. Destinado exclusivamente a investidores qualificados.",
    setor: "Setor",
    locRegiao: "Região",
    deal: "Valor do Deal",
    multiplo: "Múltiplo EBITDA",
  } : {
    teaser: "BLIND TEASER — M&A OPPORTUNITY",
    oport: "Acquisition Opportunity",
    tese: "Investment Thesis",
    metricas: "Key Metrics",
    difer: "Competitive Advantages",
    nda: "Full details available upon signed NDA.",
    ndaBtn: "Request NDA & Full CIM",
    aviso: "Confidential document. Intended solely for qualified investors.",
    setor: "Sector",
    locRegiao: "Region",
    deal: "Deal Value",
    multiplo: "EBITDA Multiple",
  };

  return `<!DOCTYPE html><html lang="${lang}"><head><meta charset="UTF-8">
<title>Teaser — ${deal.sector}</title>
<link href="${FONT}" rel="stylesheet">
<style>
${CSS_BASE}
@page{size:A4 portrait;margin:0}
body{background:#060515;padding:40px 0;display:flex;justify-content:center;min-height:100vh}
/* A4 exato em tela: 794px × 1123px */
.wrap{
  width:794px;height:1123px;
  padding:52px 60px;
  background:linear-gradient(155deg,#09081A 55%,#111F35 100%);
  display:flex;flex-direction:column;
  border:1px solid rgba(201,168,76,0.18);
  box-shadow:0 2px 0 0 rgba(201,168,76,0.4),0 8px 48px rgba(0,0,0,0.8);
  overflow:hidden;position:relative;
}
.wrap::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,transparent,#C9A84C,#E8C97A 50%,#C9A84C,transparent)}
@media print{
  body{padding:0!important;}
  .wrap{
    width:210mm!important;height:297mm!important;
    padding:14mm 18mm!important;
    box-shadow:none!important;border:none!important;
    overflow:visible!important;
  }
  .wrap::before{-webkit-print-color-adjust:exact;print-color-adjust:exact;}
}
.top{display:flex;align-items:center;justify-content:space-between;margin-bottom:48px}
.logo-box{display:inline-block}
.v3-name{font-size:12px;font-weight:700;color:#F0ECE4;margin-left:10px}
.badge-conf{font-size:9px;font-weight:700;letter-spacing:3px;color:#C9A84C;border:1px solid #C9A84C33;padding:5px 12px;border-radius:4px}
.bar{height:2px;background:linear-gradient(90deg,#C9A84C,#E8C97A,transparent);border-radius:2px;margin-bottom:36px}
.hero-label{font-size:9px;font-weight:700;letter-spacing:4px;text-transform:uppercase;color:#C9A84C;margin-bottom:10px}
.hero-title{font-size:36px;font-weight:800;color:#F0ECE4;line-height:1.1;margin-bottom:8px}
.hero-sub{font-size:14px;color:#7A8FA8;margin-bottom:36px}
.meta-row{display:flex;gap:24px;flex-wrap:wrap;margin-bottom:36px}
.meta-item p:first-child{font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#C9A84C;margin-bottom:4px}
.meta-item p:last-child{font-size:18px;font-weight:800;color:#F0ECE4}
.tese{background:#162744;border:1px solid #243A66;border-left:3px solid #C9A84C;border-radius:0 8px 8px 0;padding:18px 22px;margin-bottom:28px}
.tese p{font-size:12px;color:#7A8FA8;line-height:1.7}
.metrics-row{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-bottom:28px}
.metric-box{background:#162744;border:1px solid #243A66;border-radius:8px;padding:16px;border-top:2px solid #C9A84C}
.metric-box .label{font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#C9A84C;margin-bottom:4px}
.metric-box .val{font-size:20px;font-weight:800;color:#E8C97A}
.metric-box .sub{font-size:10px;color:#7A8FA8;margin-top:2px}
.diff-list{list-style:none;margin-bottom:32px}
.diff-list li{display:flex;gap:10px;align-items:flex-start;padding:10px 0;border-bottom:1px solid #243A6650}
.diff-list li:last-child{border:none}
.diff-list li::before{content:"";width:5px;height:5px;background:#C9A84C;border-radius:50%;margin-top:6px;flex-shrink:0}
.diff-list li span{font-size:12px;color:#7A8FA8;line-height:1.5}
.nda-box{background:#162744;border:1px solid #C9A84C33;border-radius:10px;padding:20px;display:flex;align-items:center;justify-content:space-between;gap:16px;margin-top:auto}
.nda-box p:first-child{font-size:12px;font-weight:600;color:#F0ECE4}
.nda-box p:last-child{font-size:10px;color:#7A8FA8;margin-top:2px}
.nda-btn{background:linear-gradient(135deg,#C9A84C,#E8C97A);color:#09081A;font-size:11px;font-weight:700;padding:10px 18px;border-radius:8px;text-decoration:none;white-space:nowrap;flex-shrink:0}
.footer{margin-top:32px;padding-top:16px;border-top:1px solid #243A66;display:flex;justify-content:space-between;align-items:center}
.footer p{font-size:10px;color:#7A8FA8}
</style>
</head><body>
<div class="wrap">
  <div class="top">
    <div style="display:flex;align-items:center;gap:10px">
      <img src="/v3-logo-flat-gold-alpha.png" alt="V3 Partners" style="height:40px;width:auto;">
      <span class="v3-name">V3 Partners</span>
    </div>
    <span class="badge-conf">${t.teaser}</span>
  </div>
  <div class="bar"></div>
  <p class="hero-label">${t.oport}</p>
  <h1 class="hero-title">${deal.sector}</h1>
  <p class="hero-sub">${regiaoBlind} · ${deal.deal_value ? formatBRL(deal.deal_value) : ""}</p>
  <div class="meta-row">
    ${deal.deal_value ? `<div class="meta-item"><p>${t.deal}</p><p>${formatBRL(deal.deal_value)}</p></div>` : ""}
    ${deal.ebitda_multiple ? `<div class="meta-item"><p>${t.multiplo}</p><p>${deal.ebitda_multiple}x</p></div>` : ""}
    <div class="meta-item"><p>${isPt ? "Região" : "Region"}</p><p>${regiaoBlind}</p></div>
  </div>
  ${(Array.isArray(tese) ? tese.length > 0 : !!tese) ? `
  <p class="label" style="margin-bottom:10px">${t.tese}</p>
  <div class="tese">
    ${renderTese(tese, "font-size:11px;color:#C4CDD8;line-height:1.7")}
  </div>` : ""}
  ${desc ? `<p style="font-size:11px;color:#7A8FA8;line-height:1.75;margin-bottom:20px;border-left:2px solid rgba(201,168,76,0.3);padding-left:12px;">${desc.slice(0, 500)}${desc.length > 500 ? "..." : ""}</p>` : ""}
  ${metricas.length > 0 ? `
  <p class="label" style="margin-bottom:12px">${t.metricas}</p>
  <div class="metrics-row">
    ${metricas.map(m => `<div class="metric-box"><p class="label">${m.label}</p><p class="val">${m.value}</p>${m.sub ? `<p class="sub">${m.sub}</p>` : ""}</div>`).join("")}
  </div>` : ""}
  ${diferenciais.length > 0 ? `
  <p class="label" style="margin-bottom:12px">${t.difer}</p>
  <ul class="diff-list">
    ${diferenciais.map(d => `<li><span>${d}</span></li>`).join("")}
  </ul>` : ""}
  ${!desc && !metricas.length && !diferenciais.length && !(Array.isArray(tese) ? tese.length > 0 : !!tese) ? `
  <div style="background:#162744;border:1px solid #243A66;border-radius:8px;padding:20px;margin-bottom:24px;">
    <p style="font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#C9A84C;margin-bottom:8px">Ativo em Análise</p>
    <p style="font-size:12px;color:#7A8FA8;line-height:1.7">
      ${isPt
        ? `Oportunidade no setor de ${deal.sector ?? "M&A"} com valor de ${deal.deal_value ? formatBRL(deal.deal_value) : "a confirmar"}. Execute o FORJA para gerar a narrativa completa e a tese de investimento.`
        : `${deal.sector ?? "M&A"} sector opportunity valued at ${deal.deal_value ? formatBRL(deal.deal_value) : "TBD"}. Run FORJA analysis to generate the full investment narrative.`
      }
    </p>
  </div>` : ""}
  <div class="nda-box">
    <div>
      <p>${t.nda}</p>
      <p>${t.aviso}</p>
    </div>
    <span class="nda-btn">${t.ndaBtn}</span>
  </div>
  <div class="footer">
    <p>V3 Partners — v3partners.com.br</p>
    <p>${t.aviso}</p>
  </div>
</div>
</body></html>`;
}

// ── LINKEDIN POST 1080×1350 ───────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildLinkedInPost(deal: any, lang: string): string {
  const ad = deal.asset_data ?? {};
  const isPt = lang === "pt-br";
  const metricas: { label: string; value: string; sub?: string }[] = (ad.metricas ?? []).slice(0, 4);
  const tese = isPt ? (ad.tese_investimento ?? "") : (ad.tese_investimento_en ?? ad.tese_investimento ?? "");

  const t = isPt ? {
    tag: "OPORTUNIDADE M&A",
    cta: "Solicite o CIM completo",
    aviso: "Confidencial · NDA Requerido",
    setor: deal.sector,
    deal: "Valor do Deal",
  } : {
    tag: "M&A OPPORTUNITY",
    cta: "Request the full CIM",
    aviso: "Confidential · NDA Required",
    setor: deal.sector,
    deal: "Deal Value",
  };

  return `<!DOCTYPE html><html lang="${lang}"><head><meta charset="UTF-8">
<title>LinkedIn Post — ${deal.target_company}</title>
<link href="${FONT}" rel="stylesheet">
<style>
${CSS_BASE}
/* Canvas social media: 1080×1350px (proporção 4:5 LinkedIn) */
html,body{width:1080px;height:1350px;overflow:hidden;margin:0;padding:0}
body{background:#09081A;display:flex;align-items:stretch}
.wrap{flex:1;background:linear-gradient(160deg,#09081A 40%,#111F35);padding:72px 80px;display:flex;flex-direction:column;position:relative;overflow:hidden}
@page{size:A4 portrait;margin:0}
@media print{
  html,body{width:210mm!important;height:297mm!important;overflow:hidden!important;}
  body{display:flex!important;align-items:stretch!important;}
  .wrap{width:100%!important;height:100%!important;flex:1!important;padding:54px 60px!important;}
}
.wrap::before{content:"";position:absolute;top:-200px;right:-200px;width:600px;height:600px;background:radial-gradient(circle,#C9A84C08 0%,transparent 70%)}
.top{display:flex;align-items:center;justify-content:space-between;margin-bottom:56px}
.logo{display:flex;align-items:center;gap:12px}
.logo-box{display:inline-block}
.logo-name{font-size:15px;font-weight:700;color:#F0ECE4}
.badge{font-size:10px;font-weight:700;letter-spacing:3px;color:#C9A84C;border:1px solid #C9A84C44;padding:6px 16px;border-radius:5px}
.bar{height:2px;background:linear-gradient(90deg,#C9A84C,#E8C97A,transparent);margin-bottom:44px}
.hero-tag{font-size:10px;font-weight:700;letter-spacing:4px;text-transform:uppercase;color:#C9A84C;margin-bottom:14px}
.hero-title{font-size:52px;font-weight:800;color:#F0ECE4;line-height:1.05;margin-bottom:12px}
.hero-sub{font-size:16px;color:#7A8FA8;margin-bottom:40px}
.tese{font-size:15px;color:#7A8FA8;line-height:1.65;margin-bottom:40px;padding-left:16px;border-left:3px solid #C9A84C}
.metrics{display:grid;grid-template-columns:repeat(2,1fr);gap:16px;margin-bottom:auto}
.metric{background:#162744;border:1px solid #243A66;border-radius:12px;padding:22px;border-top:3px solid #C9A84C}
.metric .label{font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#C9A84C;margin-bottom:8px}
.metric .val{font-size:28px;font-weight:800;color:#E8C97A;line-height:1}
.metric .sub{font-size:11px;color:#7A8FA8;margin-top:4px}
.footer{padding-top:28px;border-top:1px solid #243A66;display:flex;align-items:center;justify-content:space-between}
.cta{font-size:12px;font-weight:700;color:#C9A84C}
.url{font-size:11px;color:#7A8FA8}
</style>
</head><body>
<div class="wrap">
  <div class="top">
    <div class="logo">
      <img src="/v3-logo-flat-gold-alpha.png" alt="V3 Partners" style="height:48px;width:auto;">
      <span class="logo-name">V3 Partners</span>
    </div>
    <span class="badge">${t.tag}</span>
  </div>
  <div class="bar"></div>
  <p class="hero-tag">${t.setor}</p>
  <h1 class="hero-title">${deal.sector}</h1>
  <p class="hero-sub">${deal.location ?? "Brasil"} · ${deal.deal_value ? formatBRL(deal.deal_value) : ""}</p>
  ${tese ? `<p class="tese">${tese.substring(0, 220)}${tese.length > 220 ? "..." : ""}</p>` : ""}
  ${metricas.length > 0 ? `
  <div class="metrics">
    ${metricas.map(m => `
    <div class="metric">
      <p class="label">${m.label}</p>
      <p class="val">${m.value}</p>
      ${m.sub ? `<p class="sub">${m.sub}</p>` : ""}
    </div>`).join("")}
  </div>` : ""}
  <div class="footer">
    <p class="cta">${t.cta} →</p>
    <p class="url">v3partners.com.br</p>
  </div>
</div>
</body></html>`;
}

// ── LINKEDIN STORY 1080×1920 ─────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildLinkedInStory(deal: any, lang: string): string {
  const ad = deal.asset_data ?? {};
  const isPt = lang === "pt-br";
  const metricas: { label: string; value: string; sub?: string }[] = (ad.metricas ?? []).slice(0, 4);
  const diferenciais: string[] = (ad.diferenciais ?? []).slice(0, 3);

  const t = isPt ? {
    tag: "OPORTUNIDADE M&A",
    difer: "POR QUE ESTE ATIVO?",
    cta: "Solicite o CIM",
    url: "v3partners.com.br",
    aviso: "Confidencial · NDA Requerido",
    deal: "Valor do Deal",
  } : {
    tag: "M&A OPPORTUNITY",
    difer: "WHY THIS ASSET?",
    cta: "Request the CIM",
    url: "v3partners.com.br",
    aviso: "Confidential · NDA Required",
    deal: "Deal Value",
  };

  return `<!DOCTYPE html><html lang="${lang}"><head><meta charset="UTF-8">
<title>LinkedIn Story — ${deal.target_company}</title>
<link href="${FONT}" rel="stylesheet">
<style>
${CSS_BASE}
/* Canvas social media: 1080×1920px (proporção 9:16 LinkedIn Story) */
html,body{width:1080px;height:1920px;overflow:hidden;margin:0;padding:0}
body{background:#09081A}
.wrap{width:1080px;height:1920px;background:linear-gradient(190deg,#09081A 30%,#111F35 70%,#162744);padding:100px 80px;display:flex;flex-direction:column;position:relative;overflow:hidden}
@page{size:A4 portrait;margin:0}
@media print{
  html,body{width:210mm!important;height:297mm!important;overflow:hidden!important;}
  .wrap{width:100%!important;height:100%!important;padding:72px 56px!important;}
  .glow,.glow2{display:none!important;}
}
.glow{position:absolute;top:0;left:50%;transform:translateX(-50%);width:700px;height:700px;background:radial-gradient(circle,#C9A84C0A 0%,transparent 70%);pointer-events:none}
.glow2{position:absolute;bottom:0;right:0;width:500px;height:500px;background:radial-gradient(circle,#C9A84C06 0%,transparent 70%);pointer-events:none}
.top{display:flex;align-items:center;justify-content:space-between;margin-bottom:80px}
.logo-box{display:inline-block}
.logo-name{font-size:17px;font-weight:700;color:#F0ECE4;margin-left:14px}
.badge{font-size:10px;font-weight:700;letter-spacing:3px;color:#C9A84C;border:1px solid #C9A84C44;padding:8px 18px;border-radius:5px}
.bar{height:3px;background:linear-gradient(90deg,#C9A84C,#E8C97A,transparent);border-radius:2px;margin-bottom:60px}
.hero-tag{font-size:11px;font-weight:700;letter-spacing:5px;text-transform:uppercase;color:#C9A84C;margin-bottom:18px}
.hero-title{font-size:68px;font-weight:800;color:#F0ECE4;line-height:1;margin-bottom:18px}
.hero-sub{font-size:20px;color:#7A8FA8;margin-bottom:60px}
.metrics{display:grid;grid-template-columns:repeat(2,1fr);gap:18px;margin-bottom:52px}
.metric{background:#162744cc;border:1px solid #243A66;border-radius:14px;padding:26px;border-top:3px solid #C9A84C}
.metric .label{font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#C9A84C;margin-bottom:8px}
.metric .val{font-size:32px;font-weight:800;color:#E8C97A;line-height:1}
.metric .sub{font-size:12px;color:#7A8FA8;margin-top:5px}
.difer-label{font-size:10px;font-weight:700;letter-spacing:4px;text-transform:uppercase;color:#C9A84C;margin-bottom:20px}
.difer-item{display:flex;align-items:flex-start;gap:14px;padding:16px;background:#162744aa;border:1px solid #243A6680;border-radius:10px;margin-bottom:12px}
.difer-item::before{content:"";width:6px;height:6px;background:#C9A84C;border-radius:50%;margin-top:6px;flex-shrink:0}
.difer-item span{font-size:14px;color:#7A8FA8;line-height:1.5}
.cta-box{margin-top:auto;background:linear-gradient(135deg,#162744,#243A66);border:1px solid #C9A84C44;border-radius:14px;padding:28px;display:flex;align-items:center;justify-content:space-between}
.cta-text p:first-child{font-size:15px;font-weight:700;color:#F0ECE4}
.cta-text p:last-child{font-size:12px;color:#7A8FA8;margin-top:3px}
.cta-btn{background:linear-gradient(135deg,#C9A84C,#E8C97A);color:#09081A;font-size:13px;font-weight:800;padding:14px 24px;border-radius:10px;text-align:center;white-space:nowrap}
</style>
</head><body>
<div class="wrap">
  <div class="glow"></div>
  <div class="glow2"></div>
  <div class="top">
    <div style="display:flex;align-items:center;gap:14px">
      <img src="/v3-logo-flat-gold-alpha.png" alt="V3 Partners" style="height:56px;width:auto;">
      <span class="logo-name">V3 Partners</span>
    </div>
    <span class="badge">${t.tag}</span>
  </div>
  <div class="bar"></div>
  <p class="hero-tag">${deal.sector}</p>
  <h1 class="hero-title">${deal.deal_value ? formatBRL(deal.deal_value) : "Deal"}</h1>
  <p class="hero-sub">${deal.location ?? "Brasil"}</p>
  ${metricas.length > 0 ? `
  <div class="metrics">
    ${metricas.map(m => `
    <div class="metric">
      <p class="label">${m.label}</p>
      <p class="val">${m.value}</p>
      ${m.sub ? `<p class="sub">${m.sub}</p>` : ""}
    </div>`).join("")}
  </div>` : ""}
  ${diferenciais.length > 0 ? `
  <p class="difer-label">${t.difer}</p>
  ${diferenciais.map(d => `<div class="difer-item"><span>${d}</span></div>`).join("")}` : ""}
  <div class="cta-box">
    <div class="cta-text">
      <p>${t.cta} completo</p>
      <p>${t.aviso}</p>
    </div>
    <div class="cta-btn">${t.url}</div>
  </div>
</div>
</body></html>`;
}

function injectFormat(html: string, format: string, type: string): string {
  const isLinkedIn = type.startsWith("linkedin");

  if (format === "pdf") {
    // Aguarda 800ms para garantir carregamento das fontes antes de disparar o print
    const script = `<script>window.onload=function(){setTimeout(function(){window.print();},800);}<\/script>`;

    // CRÍTICO: não adicionar padding-top no LinkedIn (overflow:hidden corta o conteúdo)
    const bodyPadding = isLinkedIn ? "" : "body{padding-top:48px!important;}";

    const style = `<style>
      @media screen{
        .fmt-bar{
          display:flex;align-items:center;justify-content:space-between;gap:12px;
          background:#C9A84C;color:#09081A;
          padding:12px 20px;
          font-family:'DM Sans',Arial,sans-serif;font-size:11px;font-weight:700;
          position:fixed;top:0;left:0;right:0;z-index:99999;
          box-shadow:0 2px 8px rgba(0,0,0,0.4);
        }
        .fmt-bar .fmt-steps{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
        .fmt-bar .fmt-step{
          background:rgba(0,0,0,0.15);border-radius:4px;
          padding:3px 8px;font-size:10px;font-weight:700;
        }
        .fmt-bar button{
          background:#09081A;color:#C9A84C;border:none;
          padding:8px 16px;border-radius:6px;font-weight:700;
          cursor:pointer;font-size:11px;white-space:nowrap;flex-shrink:0;
        }
        ${bodyPadding}
      }
      @media print{
        .fmt-bar{display:none!important;}
        html,body{
          -webkit-print-color-adjust:exact!important;
          print-color-adjust:exact!important;
          padding:0!important;margin:0!important;
        }
      }
    <\/style>`;

    // Instrução completa e clara — o passo "Gráficos de fundo" é obrigatório para fundos navy
    const banner = `<div class="fmt-bar">
      <div class="fmt-steps">
        <span>Salvar como PDF:</span>
        <span class="fmt-step">1. Ctrl+P</span>
        <span class="fmt-step">2. Mais configurações</span>
        <span class="fmt-step">3. ✅ Gráficos de fundo</span>
        <span class="fmt-step">4. Margens: Nenhuma</span>
        <span class="fmt-step">5. Salvar como PDF</span>
      </div>
      <button onclick="window.print()">🖨️ Imprimir / PDF</button>
    </div>`;

    return html.replace("</head>", style + script + "</head>").replace("<body>", `<body>${banner}`);
  }

  if (format === "jpg" || format === "jpeg") {
    const bodyPadding = isLinkedIn ? "" : "body{padding-top:48px!important;}";
    const sizeLabel = type === "linkedin_story" ? "1080×1920 px" : type === "linkedin_post" ? "1080×1350 px" : "794×1123 px";

    const style = `<style>
      @media screen{
        .fmt-bar{
          display:flex;align-items:center;gap:10px;
          background:#162744;color:#F0ECE4;
          padding:10px 20px;
          font-family:'DM Sans',Arial,sans-serif;font-size:11px;
          position:fixed;top:0;left:0;right:0;z-index:99999;
          border-bottom:2px solid #C9A84C;
        }
        .fmt-bar strong{color:#C9A84C;}
        .fmt-bar code{background:#09081A;padding:2px 6px;border-radius:4px;font-size:10px;color:#E8C97A;}
        ${bodyPadding}
      }
    <\/style>`;

    const banner = `<div class="fmt-bar">
      🖼️ JPEG <strong>${sizeLabel}</strong> →
      Chrome: <code>F12</code> → <code>Ctrl+Shift+P</code> → digita <strong>"screenshot"</strong> → <code>Capture full size screenshot</code>
    </div>`;

    return html.replace("</head>", style + "</head>").replace("<body>", `<body>${banner}`);
  }

  return html;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const dealId = searchParams.get("dealId");
  const type = searchParams.get("type") ?? "cim";
  const lang = searchParams.get("lang") ?? "pt-br";
  const format = searchParams.get("format") ?? "";

  if (!dealId) {
    return NextResponse.json({ error: "dealId obrigatório" }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let deal: any = null;

  if (IS_DEMO) {
    deal = DEMO_DEALS.find((d) => d.id === dealId) ?? null;
  } else {
    // Service client — bypassa RLS para que o preview funcione sem sessão ativa
    // (necessário para aba anônima e compartilhamento de links)
    const svc = sc(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const { data } = await svc.from("ma_deals").select("*").eq("id", dealId).single();
    deal = data;
  }

  if (!deal) {
    return new Response(
      `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Deal não encontrado</title>
      <style>body{font-family:sans-serif;background:#09081A;color:#F0ECE4;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}
      .box{text-align:center}.code{font-size:64px;font-weight:800;color:#C9A84C}.msg{color:#7A8FA8;margin-top:8px}</style></head>
      <body><div class="box"><div class="code">404</div><div class="msg">Deal não encontrado ou ID inválido.</div></div></body></html>`,
      { status: 404, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  let html = "";
  switch (type) {
    case "teaser":        html = buildTeaser(deal, lang); break;
    case "linkedin_post": html = buildLinkedInPost(deal, lang); break;
    case "linkedin_story":html = buildLinkedInStory(deal, lang); break;
    default:              html = buildCIM(deal, lang);
  }

  if (format) html = injectFormat(html, format, type);

  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
