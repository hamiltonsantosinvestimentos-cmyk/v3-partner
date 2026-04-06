/**
 * V3 Partners — Kit Generator
 * Recebe os dados de um deal (ma_deals) e gera os 10 arquivos criativos.
 * Usa os mesmos HTMLs do case jazida-esmeralda como template.
 */

const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs");
const os = require("os");

// Brandbook V3 — constantes CSS
const V3_CSS = `
  :root {
    --navy:  #09081A;
    --base:  #111F35;
    --card:  #162744;
    --mid:   #243A66;
    --gold:  #C9A84C;
    --goldl: #E8C97A;
    --cream: #F0ECE4;
    --muted: #7A8FA8;
  }
`;

const GOOGLE_FONTS = `<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">`;

const LOGO_PATH = "C:/Users/jlemo/Downloads/v3 partners logo aprovada 3D.jpeg";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatCurrency(value, currency = "R$") {
  if (!value) return "—";
  if (value >= 1_000_000) return `${currency} ${(value / 1_000_000).toFixed(2).replace(".", ",")} MM`;
  if (value >= 1_000) return `${currency} ${(value / 1_000).toFixed(0)}.000`;
  return `${currency} ${value.toLocaleString("pt-BR")}`;
}

function buildMetricas(deal) {
  const assetData = deal.asset_data ?? {};
  const metricas = assetData.metricas ?? [];

  // Complementa com dados financeiros do deal se asset_data não tem métricas
  if (metricas.length === 0) {
    if (deal.deal_value)      metricas.push({ label: "Valor do Deal",   value: formatCurrency(deal.deal_value),  sub: "Valor de transação M&A" });
    if (deal.ebitda_multiple) metricas.push({ label: "Múltiplo EBITDA", value: `${deal.ebitda_multiple}x`,      sub: "Enterprise value / EBITDA" });
    if (deal.revenue_ttm)     metricas.push({ label: "Receita TTM",     value: formatCurrency(deal.revenue_ttm), sub: "Últimos 12 meses" });
    if (deal.ebitda_ttm)      metricas.push({ label: "EBITDA TTM",      value: formatCurrency(deal.ebitda_ttm),  sub: "Últimos 12 meses" });
  }
  return metricas;
}

function coverKpisHtml(metricas, deal) {
  const items = [
    { label: "Valor do Deal", value: formatCurrency(deal.deal_value) },
    ...metricas.slice(0, 4),
  ];
  return items.map(m =>
    `<div class="ck"><div class="ck-label">${m.label}</div><div class="ck-value">${m.value}</div></div>`
  ).join("");
}

function metricasGridHtml(metricas) {
  return metricas.map(m => `
    <div class="kpi">
      <div class="kpi-label">${m.label}</div>
      <div class="kpi-value md">${m.value}</div>
      ${m.sub ? `<div class="kpi-sub">${m.sub}</div>` : ""}
    </div>`
  ).join("");
}

function diferenciaisHtml(diferenciais) {
  return diferenciais.map(d => `
    <div class="hl-item">
      <span class="hl-icon">›</span>
      <span class="hl-text">${d}</span>
    </div>`
  ).join("");
}

function riscosHtml(riscos) {
  return riscos.map(r => `
    <div class="risk-item">
      <span class="risk-level ${r.nivel}">${r.nivel.toUpperCase()}</span>
      <div class="risk-text"><strong>${r.descricao}</strong><br>${r.mitigacao}</div>
    </div>`
  ).join("");
}

function pageHeader(docLabel, confTag) {
  return `
  <div class="stripe-top"></div>
  <div class="page-header">
    <div class="ph-left">
      <div class="ph-logo"><img src="file:///${LOGO_PATH.replace(/\\/g, "/")}" alt="V3 Partners"></div>
      <div class="ph-divider"></div>
      <div class="ph-doc">${docLabel}</div>
    </div>
    <div class="ph-right"><span class="ph-conf">${confTag}</span></div>
  </div>`;
}

function pageFooter(leftText, pageNum) {
  return `
  <div class="page-footer">
    <div class="pf-left">${leftText}</div>
    <div class="pf-right">Pág. ${pageNum}</div>
  </div>
  <div class="stripe-bot"></div>`;
}

// ── CIM Builder ───────────────────────────────────────────────────────────────

function buildCimHtml(deal, lang) {
  const d = deal.asset_data ?? {};
  const isEn = lang === "en";
  const metricas = buildMetricas(deal);
  const diferenciais = d.diferenciais ?? [];
  const riscos = d.riscos ?? [];

  const nome       = isEn ? (deal.target_company || deal.title) : deal.target_company;
  const localizacao = deal.location ?? "";
  const setor      = deal.sector ?? "";
  const desc       = isEn ? (d.descricao_en ?? d.descricao_ptbr ?? "") : (d.descricao_ptbr ?? "");
  const tese       = isEn ? (d.tese_investimento_en ?? d.tese_investimento ?? "") : (d.tese_investimento ?? "");
  const processoV3 = d.processo_v3 ?? deal.code ?? "";
  const processoReg = d.processo_regulatorio ?? "";
  const coverPhoto = deal.cover_photo_url;

  const docLabel   = isEn ? "Confidential Information Memorandum" : "Memorando de Informações Confidenciais";
  const confTag    = "CONFIDENTIAL";
  const footerLeft = `V3 Partners · ${nome} · ${new Date().getFullYear()}`;

  const photoCoverStyle = coverPhoto
    ? `background: url('${coverPhoto}') center/cover no-repeat; opacity:0.45;`
    : `background: linear-gradient(135deg, rgba(22,39,68,0.5), rgba(9,8,26,0.8));`;

  return `<!DOCTYPE html>
<html lang="${isEn ? "en" : "pt-BR"}">
<head>
<meta charset="UTF-8">
<title>${docLabel} — ${nome} · V3 Partners</title>
${GOOGLE_FONTS}
<style>
  @page { size: A4 portrait; margin: 0; }
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  ${V3_CSS}
  html, body { font-family:'DM Sans',sans-serif; background:var(--base); color:var(--cream); -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  .page { width:210mm; min-height:297mm; background:var(--base); display:flex; flex-direction:column; page-break-after:always; }
  .page:last-child { page-break-after:avoid; }
  .page.navy { background:var(--navy); }
  .stripe-top { height:5px; background:linear-gradient(to right,var(--navy),var(--gold),var(--goldl),var(--gold),var(--navy)); flex-shrink:0; }
  .stripe-bot { height:3px; background:linear-gradient(to right,var(--navy),var(--gold),var(--navy)); opacity:0.5; flex-shrink:0; }
  .page-header { background:var(--navy); padding:5mm 12mm; display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(201,168,76,0.2); flex-shrink:0; }
  .ph-left { display:flex; align-items:center; gap:8mm; }
  .ph-logo img { height:10mm; width:auto; }
  .ph-divider { width:1px; height:8mm; background:rgba(201,168,76,0.25); }
  .ph-doc { font-size:7.5px; font-weight:700; letter-spacing:2px; text-transform:uppercase; color:var(--muted); }
  .ph-conf { background:rgba(201,168,76,0.08); border:1px solid rgba(201,168,76,0.3); border-radius:2px; padding:2px 8px; font-size:6px; font-weight:700; letter-spacing:2px; text-transform:uppercase; color:var(--gold); }
  .page-body { flex:1; padding:7mm 12mm; display:flex; flex-direction:column; gap:5mm; }
  .page-footer { background:var(--navy); border-top:1px solid rgba(201,168,76,0.15); padding:3mm 12mm; display:flex; justify-content:space-between; align-items:center; flex-shrink:0; }
  .pf-left { font-size:6.5px; color:var(--muted); }
  .pf-right { font-size:6.5px; font-weight:700; color:rgba(201,168,76,0.4); font-family:monospace; }
  .section-label { font-size:6px; font-weight:700; letter-spacing:3px; text-transform:uppercase; color:var(--gold); margin-bottom:3mm; display:flex; align-items:center; gap:6px; }
  .section-label::after { content:''; flex:1; height:1px; background:rgba(201,168,76,0.2); }
  h2.section-title { font-size:14px; font-weight:700; color:var(--cream); margin-bottom:3mm; }
  p.body { font-size:8.5px; color:var(--muted); line-height:1.7; }
  p.body strong { color:var(--cream); }
  .kpi-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:3mm; }
  .kpi { background:var(--card); border:1px solid var(--mid); border-top:2px solid var(--gold); border-radius:3px; padding:4mm 4.5mm; }
  .kpi-label { font-size:5.5px; font-weight:700; letter-spacing:2px; text-transform:uppercase; color:var(--gold); margin-bottom:2mm; }
  .kpi-value { font-size:18px; font-weight:800; color:var(--goldl); line-height:1; margin-bottom:1mm; }
  .kpi-value.md { font-size:14px; }
  .kpi-sub { font-size:7px; color:var(--muted); line-height:1.4; }
  .hl-list { display:flex; flex-direction:column; gap:2mm; }
  .hl-item { display:flex; align-items:flex-start; gap:5px; padding:2.5mm 4mm; background:rgba(22,39,68,0.5); border-left:2px solid var(--gold); border-radius:0 2px 2px 0; }
  .hl-icon { font-size:7px; font-weight:700; color:var(--gold); flex-shrink:0; margin-top:1px; }
  .hl-text { font-size:8px; color:var(--muted); line-height:1.55; }
  .highlight-box { background:rgba(201,168,76,0.06); border:1px solid rgba(201,168,76,0.25); border-radius:4px; padding:5mm 6mm; }
  .hb-label { font-size:6px; font-weight:700; letter-spacing:3px; text-transform:uppercase; color:var(--gold); margin-bottom:3mm; }
  .hb-body { font-size:8.5px; color:var(--muted); line-height:1.7; }
  .hb-body strong { color:var(--cream); }
  .risk-item { display:flex; gap:4mm; padding:3mm 4mm; background:var(--card); border:1px solid var(--mid); border-radius:3px; margin-bottom:2mm; }
  .risk-level { font-size:6px; font-weight:700; letter-spacing:1px; text-transform:uppercase; padding:2px 6px; border-radius:2px; flex-shrink:0; align-self:flex-start; margin-top:1px; }
  .risk-level.baixo { background:rgba(122,143,168,0.15); color:var(--muted); }
  .risk-level.medio { background:rgba(201,168,76,0.12); color:var(--gold); }
  .risk-level.alto  { background:rgba(200,80,80,0.12); color:#C07070; }
  .risk-text { font-size:8px; color:var(--muted); line-height:1.5; }
  .risk-text strong { color:var(--cream); }
  .process-steps { display:grid; grid-template-columns:repeat(4,1fr); gap:2mm; position:relative; }
  .process-steps::before { content:''; position:absolute; top:6mm; left:12%; right:12%; height:1px; background:rgba(201,168,76,0.25); }
  .step { text-align:center; }
  .step-num { width:12mm; height:12mm; background:var(--card); border:1.5px solid var(--gold); border-radius:50%; font-size:10px; font-weight:800; color:var(--gold); display:flex; align-items:center; justify-content:center; margin:0 auto 2mm; position:relative; z-index:1; }
  .step-title { font-size:7.5px; font-weight:700; color:var(--cream); margin-bottom:1mm; }
  .step-desc  { font-size:7px; color:var(--muted); line-height:1.4; }
  .disclaimer { background:rgba(201,168,76,0.04); border:1px dashed rgba(201,168,76,0.2); border-radius:3px; padding:3mm 4mm; font-size:7px; color:var(--muted); line-height:1.6; }
  /* CAPA */
  .cover-hero { flex:1; background:var(--navy); position:relative; overflow:hidden; display:flex; flex-direction:column; justify-content:flex-end; padding:10mm 12mm; }
  .cover-photo { position:absolute; inset:0; ${photoCoverStyle} }
  .cover-grad  { position:absolute; inset:0; background:linear-gradient(to top,rgba(9,8,26,1) 0%,rgba(9,8,26,0.88) 45%,rgba(9,8,26,0.55) 75%,rgba(9,8,26,0.25) 100%); }
  .cover-content { position:relative; z-index:2; }
  .cover-tag   { font-size:6.5px; font-weight:700; letter-spacing:3px; text-transform:uppercase; color:var(--gold); margin-bottom:4mm; }
  .cover-title { font-size:36px; font-weight:800; color:var(--cream); line-height:1.1; margin-bottom:3mm; }
  .cover-title span { color:var(--goldl); }
  .cover-sub  { font-size:11px; color:var(--muted); line-height:1.6; max-width:130mm; margin-bottom:8mm; }
  .cover-sub strong { color:var(--cream); }
  .cover-kpis { display:flex; gap:5mm; flex-wrap:wrap; }
  .ck { background:rgba(22,39,68,0.8); border:1px solid rgba(201,168,76,0.25); border-radius:3px; padding:3mm 5mm; }
  .ck-label { font-size:6px; font-weight:700; letter-spacing:2px; text-transform:uppercase; color:var(--muted); margin-bottom:2mm; }
  .ck-value { font-size:13px; font-weight:800; color:var(--goldl); }
  .cover-footer { background:var(--navy); padding:5mm 12mm; border-top:1px solid rgba(201,168,76,0.2); display:flex; justify-content:space-between; align-items:center; flex-shrink:0; }
  .cf-left { font-size:8px; color:var(--muted); line-height:1.6; }
  .cf-left strong { color:var(--cream); display:block; font-size:10px; margin-bottom:1mm; }
  .cf-right img { height:11mm; width:auto; }
</style>
</head>
<body>

<!-- CAPA -->
<div class="page navy">
  <div class="stripe-top"></div>
  <div class="cover-hero">
    <div class="cover-photo"></div>
    <div class="cover-grad"></div>
    <div class="cover-content">
      <div class="cover-tag">${docLabel} · ${processoV3}</div>
      <h1 class="cover-title">${nome}<br><span>${localizacao}</span></h1>
      <p class="cover-sub">${desc} <strong>${isEn ? "Exclusive advisor: V3 Partners." : "Assessoria exclusiva: V3 Partners."}</strong></p>
      <div class="cover-kpis">${coverKpisHtml(metricas, deal)}</div>
    </div>
  </div>
  <div class="cover-footer">
    <div class="cf-left">
      <strong>${isEn ? "Exclusive Advisor" : "Assessoria Exclusiva"}: V3 Partners</strong>
      ${isEn ? "Restricted document — NDA required for access." : "Documento restrito — NDA requerido para acesso."}<br>
      ${processoReg}
    </div>
    <div class="cf-right"><img src="file:///${LOGO_PATH.replace(/\\/g, "/")}" alt="V3 Partners"></div>
  </div>
  <div style="background:var(--navy);padding:2mm 12mm;display:flex;justify-content:flex-end;">
    <span style="font-size:6px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:rgba(201,168,76,0.35);font-family:monospace;">${processoV3}</span>
  </div>
</div>

<!-- PÁG 2: SUMÁRIO EXECUTIVO -->
<div class="page">
  ${pageHeader(docLabel, confTag)}
  <div class="page-body">
    <div class="section-label">01 · ${isEn ? "Executive Summary" : "Sumário Executivo"}</div>
    <div class="kpi-grid">${metricasGridHtml(metricas)}</div>
    ${tese ? `
    <div class="highlight-box">
      <div class="hb-label">${isEn ? "Investment Thesis" : "Tese de Investimento"}</div>
      <div class="hb-body">${tese}</div>
    </div>` : ""}
    ${diferenciais.length > 0 ? `
    <div class="section-label">02 · ${isEn ? "Differentials" : "Diferenciais"}</div>
    <div class="hl-list">${diferenciaisHtml(diferenciais)}</div>` : ""}
  </div>
  ${pageFooter(footerLeft, 2)}
</div>

<!-- PÁG 3: ATIVO E ESTRUTURA -->
<div class="page">
  ${pageHeader(docLabel, confTag)}
  <div class="page-body">
    <div class="section-label">03 · ${isEn ? "Asset Overview" : "Visão do Ativo"}</div>
    <p class="body">${desc}</p>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:4mm;margin-top:2mm;">
      <div style="background:var(--card);border:1px solid var(--mid);border-radius:3px;padding:4mm 5mm;">
        <div class="kpi-label">${isEn ? "Sector" : "Setor"}</div>
        <div style="font-size:11px;font-weight:700;color:var(--cream);">${setor || "—"}</div>
      </div>
      <div style="background:var(--card);border:1px solid var(--mid);border-radius:3px;padding:4mm 5mm;">
        <div class="kpi-label">${isEn ? "Location" : "Localização"}</div>
        <div style="font-size:11px;font-weight:700;color:var(--cream);">${localizacao || "—"}</div>
      </div>
      <div style="background:var(--card);border:1px solid var(--mid);border-radius:3px;padding:4mm 5mm;">
        <div class="kpi-label">${isEn ? "V3 Process" : "Processo V3"}</div>
        <div style="font-size:11px;font-weight:700;color:var(--cream);font-family:monospace;">${processoV3}</div>
      </div>
      <div style="background:var(--card);border:1px solid var(--mid);border-radius:3px;padding:4mm 5mm;">
        <div class="kpi-label">${isEn ? "Official Reg." : "Reg. Oficial"}</div>
        <div style="font-size:11px;font-weight:700;color:var(--cream);">${processoReg || "—"}</div>
      </div>
    </div>
  </div>
  ${pageFooter(footerLeft, 3)}
</div>

<!-- PÁG 4: MODELO FINANCEIRO -->
<div class="page">
  ${pageHeader(docLabel, confTag)}
  <div class="page-body">
    <div class="section-label">04 · ${isEn ? "Financial Model" : "Modelo Financeiro"}</div>
    <div class="kpi-grid">${metricasGridHtml(metricas.slice(0, 4))}</div>
    <div class="highlight-box" style="margin-top:2mm;">
      <div class="hb-label">${isEn ? "Transaction Structure" : "Estrutura da Transação"}</div>
      <div class="hb-body">
        <strong>${isEn ? "Deal Value:" : "Valor do Deal:"}</strong> ${formatCurrency(deal.deal_value)}<br>
        ${deal.ebitda_multiple ? `<strong>EBITDA Multiple:</strong> ${deal.ebitda_multiple}x<br>` : ""}
        ${deal.revenue_ttm ? `<strong>${isEn ? "Revenue TTM:" : "Receita TTM:"}</strong> ${formatCurrency(deal.revenue_ttm)}<br>` : ""}
        <strong>${isEn ? "Expected Close:" : "Fechamento Previsto:"}</strong> ${deal.expected_close_date ?? "A definir"}<br>
        <strong>${isEn ? "Advisor:" : "Assessor:"}</strong> V3 Partners Soluções Ltda · CNPJ 14.219.287/0001-50
      </div>
    </div>
  </div>
  ${pageFooter(footerLeft, 4)}
</div>

<!-- PÁG 5: RISCOS -->
<div class="page">
  ${pageHeader(docLabel, confTag)}
  <div class="page-body">
    <div class="section-label">05 · ${isEn ? "Risks & Mitigations" : "Riscos e Mitigações"}</div>
    ${riscos.length > 0 ? riscosHtml(riscos) : `<p class="body">${isEn ? "Risk matrix to be detailed in the CIS and NDA phase." : "Matriz de riscos a ser detalhada na fase de CIS e NDA."}</p>`}
    <div class="section-label" style="margin-top:3mm;">06 · ${isEn ? "M&A Process" : "Processo M&A"}</div>
    <div class="process-steps">
      ${["NDA", isEn ? "Due Diligence" : "Due Diligence", "LOI", isEn ? "Closing" : "Fechamento"].map((s, i) => `
      <div class="step">
        <div class="step-num">${i + 1}</div>
        <div class="step-title">${s}</div>
      </div>`).join("")}
    </div>
  </div>
  ${pageFooter(footerLeft, 5)}
</div>

<!-- PÁG 6: CONTATO E DISCLAIMER -->
<div class="page">
  ${pageHeader(docLabel, confTag)}
  <div class="page-body">
    <div class="section-label">07 · ${isEn ? "Next Steps" : "Próximos Passos"}</div>
    <div class="highlight-box">
      <div class="hb-label">${isEn ? "Contact V3 Partners" : "Entre em Contato com a V3 Partners"}</div>
      <div class="hb-body">
        <strong>V3 Partners Soluções Ltda</strong><br>
        Rua Visconde de Pirajá, 414, Sala 718 — Ipanema, Rio de Janeiro, RJ<br>
        ${isEn ? "Head of Assets: João Lemos Netto · +55 21 98993-7178" : "Head de Ativos: João Lemos Netto · +55 21 98993-7178"}<br>
        v3partners.com.br · CNPJ 14.219.287/0001-50
      </div>
    </div>
    <div class="disclaimer" style="margin-top:4mm;">
      ${isEn
        ? "This document is strictly confidential and intended exclusively for qualified investors who have signed the appropriate NDA. The information contained herein is provided for informational purposes only and does not constitute an offer or solicitation to invest."
        : "Este documento é estritamente confidencial e destinado exclusivamente a investidores qualificados que assinaram o NDA correspondente. As informações aqui contidas são fornecidas apenas para fins informativos e não constituem oferta ou solicitação de investimento."
      }
    </div>
  </div>
  ${pageFooter(footerLeft, 6)}
</div>

</body>
</html>`;
}

// ── Teaser Cego Builder ───────────────────────────────────────────────────────

function buildTeaserHtml(deal, lang) {
  const isEn = lang === "en";
  const d = deal.asset_data ?? {};
  const metricas = buildMetricas(deal);
  const setor = deal.sector ?? "";
  const localizacao = deal.location ?? "";

  const title = isEn ? "Confidential Asset" : "Ativo Confidencial";
  const processoV3 = d.processo_v3 ?? deal.code ?? "";

  return `<!DOCTYPE html>
<html lang="${isEn ? "en" : "pt-BR"}">
<head>
<meta charset="UTF-8">
<title>${isEn ? "Blind Teaser" : "Teaser Cego"} — V3 Partners</title>
${GOOGLE_FONTS}
<style>
  @page { size: A4 portrait; margin: 0; }
  *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
  ${V3_CSS}
  html, body { width:210mm; min-height:297mm; font-family:'DM Sans',sans-serif; background:var(--base); color:var(--cream); -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  .page { width:210mm; min-height:297mm; background:var(--base); display:flex; flex-direction:column; }
  .top-stripe { height:5px; background:linear-gradient(to right,var(--navy),var(--gold),var(--goldl),var(--gold),var(--navy)); }
  .header { background:var(--navy); padding:5mm 12mm; display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(201,168,76,0.2); }
  .h-left { display:flex; align-items:center; gap:8mm; }
  .h-logo img { height:10mm; width:auto; }
  .h-divider { width:1px; height:8mm; background:rgba(201,168,76,0.25); }
  .h-doc { font-size:7.5px; font-weight:700; letter-spacing:2px; text-transform:uppercase; color:var(--muted); }
  .h-conf { background:rgba(201,168,76,0.08); border:1px solid rgba(201,168,76,0.3); border-radius:2px; padding:2px 8px; font-size:6px; font-weight:700; letter-spacing:2px; text-transform:uppercase; color:var(--gold); }
  .body { flex:1; padding:10mm 12mm; display:flex; flex-direction:column; gap:6mm; }
  .tag { font-size:7px; font-weight:700; letter-spacing:3px; text-transform:uppercase; color:var(--gold); margin-bottom:2mm; }
  h1 { font-size:38px; font-weight:800; color:var(--cream); line-height:1.05; margin-bottom:4mm; }
  h1 span { color:var(--goldl); }
  .sub { font-size:10px; color:var(--muted); line-height:1.65; max-width:160mm; }
  .sub strong { color:var(--cream); }
  .kpi-row { display:flex; gap:4mm; flex-wrap:wrap; }
  .kpi { background:var(--card); border:1px solid var(--mid); border-top:2px solid var(--gold); border-radius:3px; padding:4mm 5mm; min-width:35mm; }
  .kpi-label { font-size:5.5px; font-weight:700; letter-spacing:2px; text-transform:uppercase; color:var(--gold); margin-bottom:2mm; }
  .kpi-value { font-size:16px; font-weight:800; color:var(--goldl); line-height:1; }
  .kpi-sub { font-size:7px; color:var(--muted); margin-top:1mm; }
  .cta-box { background:rgba(201,168,76,0.06); border:1px solid rgba(201,168,76,0.25); border-radius:4px; padding:5mm 6mm; margin-top:auto; }
  .cta-label { font-size:6px; font-weight:700; letter-spacing:3px; text-transform:uppercase; color:var(--gold); margin-bottom:3mm; }
  .cta-text { font-size:9px; color:var(--muted); line-height:1.65; }
  .cta-text strong { color:var(--cream); display:block; font-size:11px; margin-bottom:2mm; }
  .disclaimer { font-size:6.5px; color:var(--muted); line-height:1.6; margin-top:4mm; font-style:italic; }
  .footer { background:var(--navy); border-top:1px solid rgba(201,168,76,0.2); padding:4mm 12mm; display:flex; justify-content:space-between; align-items:center; }
  .f-left { font-size:7.5px; color:var(--muted); }
  .f-right img { height:10mm; width:auto; }
  .bot-stripe { height:3px; background:linear-gradient(to right,var(--navy),var(--gold),var(--navy)); opacity:0.5; }
</style>
</head>
<body>
<div class="page">
  <div class="top-stripe"></div>
  <div class="header">
    <div class="h-left">
      <div class="h-logo"><img src="file:///${LOGO_PATH.replace(/\\/g, "/")}" alt="V3 Partners"></div>
      <div class="h-divider"></div>
      <div class="h-doc">${isEn ? "Blind Teaser" : "Teaser Cego"} · ${processoV3}</div>
    </div>
    <div><span class="h-conf">CONFIDENTIAL</span></div>
  </div>
  <div class="body">
    <div>
      <div class="tag">${setor} · ${localizacao ? localizacao.split("·")[1]?.trim() ?? localizacao : "Brasil"}</div>
      <h1>${title}<br><span>${isEn ? "Under NDA" : "Sob NDA"}</span></h1>
      <p class="sub">${isEn
        ? `<strong>Attractive M&A opportunity</strong> in the ${setor} sector. Deal value and detailed information available after NDA signing.`
        : `<strong>Oportunidade de M&A</strong> no setor de ${setor}. Valor do deal e informações detalhadas disponíveis após assinatura de NDA.`
      }</p>
    </div>
    <div class="kpi-row">
      ${metricas.slice(0, 3).map(m => `
      <div class="kpi">
        <div class="kpi-label">${m.label}</div>
        <div class="kpi-value">${m.value}</div>
        ${m.sub ? `<div class="kpi-sub">${m.sub}</div>` : ""}
      </div>`).join("")}
    </div>
    <div class="cta-box">
      <div class="cta-label">${isEn ? "Interested?" : "Interesse?"}</div>
      <div class="cta-text">
        <strong>${isEn ? "Request the NDA to access the full CIM" : "Solicite o NDA para acesso ao CIM completo"}</strong>
        V3 Partners Soluções Ltda — João Lemos Netto<br>
        +55 21 98993-7178 · v3partners.com.br
      </div>
    </div>
    <p class="disclaimer">${isEn
      ? "Confidential document. Distribution restricted to qualified investors with signed NDA. All information is provided for preliminary purposes only."
      : "Documento confidencial. Distribuição restrita a investidores qualificados com NDA assinado. Todas as informações são fornecidas apenas para fins preliminares."
    }</p>
  </div>
  <div class="footer">
    <div class="f-left">V3 Partners · ${new Date().getFullYear()} · ${processoV3}</div>
    <div class="f-right"><img src="file:///${LOGO_PATH.replace(/\\/g, "/")}" alt="V3 Partners"></div>
  </div>
  <div class="bot-stripe"></div>
</div>
</body>
</html>`;
}

// ── LinkedIn Post Builder ─────────────────────────────────────────────────────

function buildLinkedInPostHtml(deal, lang) {
  const isEn = lang === "en";
  const d = deal.asset_data ?? {};
  const metricas = buildMetricas(deal);
  const nome = deal.target_company ?? deal.title;
  const setor = deal.sector ?? "";
  const processoV3 = d.processo_v3 ?? deal.code ?? "";
  const desc = isEn ? (d.descricao_en ?? d.descricao_ptbr ?? "") : (d.descricao_ptbr ?? "");
  const coverPhoto = deal.cover_photo_url;

  const bgStyle = coverPhoto
    ? `background: url('${coverPhoto}') center/cover no-repeat; opacity: 0.18;`
    : "";

  return `<!DOCTYPE html>
<html lang="${isEn ? "en" : "pt-BR"}">
<head>
<meta charset="UTF-8">
${GOOGLE_FONTS}
<style>
  *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
  ${V3_CSS}
  body { background:#0a0d14; display:flex; align-items:center; justify-content:center; min-height:100vh; padding:20px; font-family:'DM Sans',sans-serif; }
  .canvas { width:540px; height:675px; background:var(--navy); position:relative; overflow:hidden; flex-shrink:0; }
  .top-bar { position:absolute; top:0; left:0; right:0; height:3px; background:linear-gradient(to right,transparent,var(--gold),transparent); opacity:0.7; }
  .bg-photo { position:absolute; inset:0; ${bgStyle} }
  .bg-grad  { position:absolute; inset:0; background:linear-gradient(to bottom,var(--navy) 0%,rgba(9,8,26,0.85) 40%,rgba(9,8,26,0.95) 100%); }
  .content { position:relative; z-index:2; height:100%; padding:28px 32px; display:flex; flex-direction:column; justify-content:space-between; }
  .top-section { display:flex; justify-content:space-between; align-items:flex-start; }
  .v3-tag { font-size:7px; font-weight:700; letter-spacing:3px; text-transform:uppercase; color:var(--gold); background:rgba(201,168,76,0.1); border:1px solid rgba(201,168,76,0.25); padding:4px 10px; border-radius:2px; }
  .process-id { font-size:7px; font-weight:700; color:rgba(201,168,76,0.45); font-family:monospace; letter-spacing:1px; }
  .main-section { flex:1; display:flex; flex-direction:column; justify-content:center; gap:16px; }
  .sector-tag { font-size:8px; font-weight:700; letter-spacing:3px; text-transform:uppercase; color:var(--muted); margin-bottom:6px; }
  h1 { font-size:28px; font-weight:800; color:var(--cream); line-height:1.1; margin-bottom:8px; }
  h1 span { color:var(--goldl); }
  .desc { font-size:10px; color:var(--muted); line-height:1.6; max-width:420px; }
  .desc strong { color:var(--cream); }
  .metrics { display:flex; gap:12px; }
  .metric { background:rgba(22,39,68,0.8); border:1px solid rgba(201,168,76,0.2); border-top:2px solid var(--gold); padding:10px 14px; flex:1; }
  .m-label { font-size:6px; font-weight:700; letter-spacing:2px; text-transform:uppercase; color:var(--muted); margin-bottom:4px; }
  .m-value { font-size:14px; font-weight:800; color:var(--goldl); line-height:1; }
  .bottom { display:flex; justify-content:space-between; align-items:center; padding-top:14px; border-top:1px solid rgba(201,168,76,0.12); }
  .cta { font-size:9px; color:var(--gold); font-weight:700; letter-spacing:1px; }
  .logo-text { font-size:9px; font-weight:800; letter-spacing:3px; text-transform:uppercase; color:rgba(201,168,76,0.5); }
  .bot-bar { position:absolute; bottom:0; left:0; right:0; height:2px; background:linear-gradient(to right,transparent,var(--gold),transparent); opacity:0.4; }
</style>
</head>
<body>
<div class="canvas">
  <div class="top-bar"></div>
  ${bgStyle ? '<div class="bg-photo"></div>' : ""}
  <div class="bg-grad"></div>
  <div class="content">
    <div class="top-section">
      <span class="v3-tag">${setor}</span>
      <span class="process-id">${processoV3}</span>
    </div>
    <div class="main-section">
      <div>
        <div class="sector-tag">${isEn ? "M&A Opportunity · V3 Partners" : "Oportunidade M&A · V3 Partners"}</div>
        <h1>${nome.split(" ").slice(0, 3).join(" ")}<br><span>${nome.split(" ").slice(3).join(" ") || (isEn ? "Investment" : "Investimento")}</span></h1>
        ${desc ? `<p class="desc">${desc.substring(0, 120)}${desc.length > 120 ? "..." : ""}</p>` : ""}
      </div>
      <div class="metrics">
        ${metricas.slice(0, 3).map(m => `
        <div class="metric">
          <div class="m-label">${m.label}</div>
          <div class="m-value">${m.value}</div>
        </div>`).join("")}
      </div>
    </div>
    <div class="bottom">
      <span class="cta">${isEn ? "Contact us → v3partners.com.br" : "Entre em contato → v3partners.com.br"}</span>
      <span class="logo-text">V3 Partners</span>
    </div>
  </div>
  <div class="bot-bar"></div>
</div>
</body>
</html>`;
}

// ── LinkedIn Story Builder ────────────────────────────────────────────────────

function buildLinkedInStoryHtml(deal, lang) {
  const isEn = lang === "en";
  const d = deal.asset_data ?? {};
  const metricas = buildMetricas(deal);
  const nome = deal.target_company ?? deal.title;
  const setor = deal.sector ?? "";
  const processoV3 = d.processo_v3 ?? deal.code ?? "";
  const diferenciais = (d.diferenciais ?? []).slice(0, 3);
  const coverPhoto = deal.cover_photo_url;

  const bgStyle = coverPhoto
    ? `background: url('${coverPhoto}') center/cover no-repeat; opacity: 0.2;`
    : "";

  return `<!DOCTYPE html>
<html lang="${isEn ? "en" : "pt-BR"}">
<head>
<meta charset="UTF-8">
${GOOGLE_FONTS}
<style>
  *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
  ${V3_CSS}
  body { background:#0a0d14; display:flex; align-items:center; justify-content:center; min-height:100vh; padding:20px; font-family:'DM Sans',sans-serif; }
  .canvas { width:540px; height:960px; background:var(--navy); position:relative; overflow:hidden; flex-shrink:0; }
  .top-bar { position:absolute; top:0; left:0; right:0; height:4px; background:linear-gradient(to right,transparent,var(--gold),transparent); }
  .bg-photo { position:absolute; inset:0; ${bgStyle} }
  .bg-grad  { position:absolute; inset:0; background:linear-gradient(to bottom,rgba(9,8,26,0.7) 0%,rgba(9,8,26,0.85) 50%,rgba(9,8,26,0.98) 100%); }
  .content  { position:relative; z-index:2; height:100%; padding:32px 36px; display:flex; flex-direction:column; }
  .top { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:40px; }
  .logo-badge { font-size:8px; font-weight:800; letter-spacing:4px; text-transform:uppercase; color:var(--gold); }
  .conf-tag { font-size:7px; font-weight:700; letter-spacing:2px; text-transform:uppercase; background:rgba(201,168,76,0.1); border:1px solid rgba(201,168,76,0.25); color:var(--gold); padding:4px 10px; border-radius:2px; }
  .hero { flex:1; display:flex; flex-direction:column; justify-content:center; gap:24px; }
  .sector-tag { font-size:8px; font-weight:700; letter-spacing:3px; text-transform:uppercase; color:var(--muted); margin-bottom:8px; }
  h1 { font-size:36px; font-weight:800; color:var(--cream); line-height:1.05; margin-bottom:12px; }
  h1 span { color:var(--goldl); }
  .kpis { display:flex; flex-direction:column; gap:8px; }
  .kpi { display:flex; align-items:center; gap:12px; padding:10px 14px; background:rgba(22,39,68,0.8); border:1px solid rgba(201,168,76,0.15); border-left:3px solid var(--gold); }
  .kpi-label { font-size:7px; font-weight:700; letter-spacing:2px; text-transform:uppercase; color:var(--muted); min-width:60px; }
  .kpi-value { font-size:14px; font-weight:800; color:var(--goldl); }
  .bullets { display:flex; flex-direction:column; gap:6px; }
  .bullet { font-size:9px; color:var(--muted); padding:8px 12px; border-left:2px solid rgba(201,168,76,0.4); line-height:1.5; }
  .bullet strong { color:var(--cream); }
  .cta-section { border-top:1px solid rgba(201,168,76,0.15); padding-top:20px; margin-top:auto; }
  .cta-label { font-size:6px; font-weight:700; letter-spacing:3px; text-transform:uppercase; color:var(--gold); margin-bottom:8px; }
  .cta-text { font-size:10px; color:var(--cream); font-weight:700; margin-bottom:4px; }
  .cta-sub  { font-size:8px; color:var(--muted); }
  .bot-bar { position:absolute; bottom:0; left:0; right:0; height:3px; background:linear-gradient(to right,transparent,var(--gold),transparent); opacity:0.5; }
</style>
</head>
<body>
<div class="canvas">
  <div class="top-bar"></div>
  ${bgStyle ? '<div class="bg-photo"></div>' : ""}
  <div class="bg-grad"></div>
  <div class="content">
    <div class="top">
      <span class="logo-badge">V3 Partners</span>
      <span class="conf-tag">${isEn ? "M&A" : "M&A"}</span>
    </div>
    <div class="hero">
      <div>
        <div class="sector-tag">${setor} · ${isEn ? "Investment Opportunity" : "Oportunidade de Investimento"}</div>
        <h1>${nome.split(" ").slice(0, 3).join(" ")}<br><span>${nome.split(" ").slice(3, 6).join(" ") || (isEn ? "Asset" : "Ativo")}</span></h1>
      </div>
      <div class="kpis">
        ${metricas.slice(0, 3).map(m => `
        <div class="kpi">
          <span class="kpi-label">${m.label}</span>
          <span class="kpi-value">${m.value}</span>
        </div>`).join("")}
      </div>
      ${diferenciais.length > 0 ? `
      <div class="bullets">
        ${diferenciais.map(d => `<div class="bullet"><strong>›</strong> ${d}</div>`).join("")}
      </div>` : ""}
    </div>
    <div class="cta-section">
      <div class="cta-label">${isEn ? "Next Step" : "Próximo Passo"}</div>
      <div class="cta-text">${isEn ? "Request the NDA · Access the full CIM" : "Solicite o NDA · Acesse o CIM completo"}</div>
      <div class="cta-sub">v3partners.com.br · João Lemos Netto · ${processoV3}</div>
    </div>
  </div>
  <div class="bot-bar"></div>
</div>
</body>
</html>`;
}

// ── Kit Generator ─────────────────────────────────────────────────────────────

async function generateKit(deal, jobId, onProgress) {
  const tmpDir = path.join(os.tmpdir(), `v3-creative-${jobId}`);
  fs.mkdirSync(tmpDir, { recursive: true });

  const pieces = [
    { build: () => buildCimHtml(deal, "pt-br"),            filename: "cim-ptbr.html",    fileType: "cim",            language: "pt-br", format: "pdf",  w: 794,  h: 1123 },
    { build: () => buildCimHtml(deal, "en"),               filename: "cim-en.html",      fileType: "cim",            language: "en",    format: "pdf",  w: 794,  h: 1123 },
    { build: () => buildTeaserHtml(deal, "pt-br"),         filename: "teaser-ptbr.html", fileType: "teaser",         language: "pt-br", format: "pdf",  w: 794,  h: 1123 },
    { build: () => buildTeaserHtml(deal, "pt-br"),         filename: "teaser-ptbr.html", fileType: "teaser",         language: "pt-br", format: "png",  w: 794,  h: 1123 },
    { build: () => buildTeaserHtml(deal, "en"),            filename: "teaser-en.html",   fileType: "teaser",         language: "en",    format: "pdf",  w: 794,  h: 1123 },
    { build: () => buildTeaserHtml(deal, "en"),            filename: "teaser-en.html",   fileType: "teaser",         language: "en",    format: "png",  w: 794,  h: 1123 },
    { build: () => buildLinkedInPostHtml(deal, "pt-br"),   filename: "post-ptbr.html",   fileType: "linkedin_post",  language: "pt-br", format: "jpg",  w: 1200, h: 1500, seletor: ".canvas" },
    { build: () => buildLinkedInPostHtml(deal, "en"),      filename: "post-en.html",     fileType: "linkedin_post",  language: "en",    format: "jpg",  w: 1200, h: 1500, seletor: ".canvas" },
    { build: () => buildLinkedInStoryHtml(deal, "pt-br"),  filename: "story-ptbr.html",  fileType: "linkedin_story", language: "pt-br", format: "jpg",  w: 1200, h: 2000, seletor: ".canvas" },
    { build: () => buildLinkedInStoryHtml(deal, "en"),     filename: "story-en.html",    fileType: "linkedin_story", language: "en",    format: "jpg",  w: 1200, h: 2000, seletor: ".canvas" },
  ];

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--allow-file-access-from-files"],
  });

  const results = [];
  let done = 0;

  try {
    // Deduplicate HTML writes (mesmo HTML pode gerar PDF + PNG)
    const htmlCache = {};

    for (const piece of pieces) {
      if (!htmlCache[piece.filename]) {
        const html = piece.build();
        const htmlPath = path.join(tmpDir, piece.filename);
        fs.writeFileSync(htmlPath, html, "utf8");
        htmlCache[piece.filename] = htmlPath;
      }

      const htmlPath = htmlCache[piece.filename];
      const outName = `${piece.fileType}-${piece.language}.${piece.format}`;
      const outPath = path.join(tmpDir, outName);

      const page = await browser.newPage();
      await page.setViewport({ width: piece.w, height: piece.h, deviceScaleFactor: piece.format === "pdf" ? 2 : 1 });
      await page.goto(`file:///${htmlPath.replace(/\\/g, "/")}`, { waitUntil: "networkidle0", timeout: 30000 });
      await page.evaluate(() => document.fonts.ready);
      await new Promise(r => setTimeout(r, 800));

      if (piece.format === "pdf") {
        await page.pdf({ path: outPath, format: "A4", printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
      } else if (piece.seletor) {
        const el = await page.$(piece.seletor);
        if (el) {
          const opts = { path: outPath, type: piece.format === "jpg" ? "jpeg" : piece.format };
          if (piece.format === "jpg") opts.quality = 95;
          await el.screenshot(opts);
        }
      } else {
        await page.screenshot({ path: outPath, type: piece.format === "jpg" ? "jpeg" : piece.format, fullPage: false });
      }
      await page.close();

      const buffer = fs.readFileSync(outPath);
      results.push({
        filename: outName,
        fileType: piece.fileType,
        language: piece.language,
        format: piece.format,
        buffer,
        mimeType: piece.format === "pdf" ? "application/pdf" : piece.format === "png" ? "image/png" : "image/jpeg",
      });

      done++;
      await onProgress(Math.round(10 + (done / pieces.length) * 75));
    }
  } finally {
    await browser.close();
    // Limpar tmp
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  }

  return results;
}

module.exports = { generateKit };
