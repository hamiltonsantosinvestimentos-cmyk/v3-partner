import { CREDIT_REPORT_STYLE } from "./credit-report-template";
import type { ComplianceDossierData } from "./compliance-dossier-data";

// Dossiê de Risco (Cockpit de Compliance, Fase 4, 10/09/2026). Reaproveita
// 100% o CSS já certificado no Chrome do Dossiê de Crédito (faixas navy de
// margem via PDF_BAND, numeração via displayHeaderFooter, mesma paleta e
// classes -- ver v3-credit-report-layout) em vez de desenhar um padrão de
// impressão novo do zero. Estrutura de conteúdo segue as 5 seções do BRIEF
// original (06_Operacional/SOPs/2026-08-22_..._Cockpit-Compliance..., Fase 4).

const LOGO_URL = "https://app.v3partners.com.br/v3-logo-flat-gold-alpha.png";

function esc(s: string): string {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function v(s: string | number | null | undefined, fallback = "Não informado"): string {
  if (s === null || s === undefined || s === "") return `<span class="na">${fallback}</span>`;
  return esc(String(s));
}

// Mesmo helper PDF_BAND de credit-report-template.ts (privado lá, recriado
// aqui pequeno de propósito em vez de exportar de um módulo já certificado
// -- risco desnecessário mexer no arquivo do Dossiê de Crédito por isso).
const PDF_BAND = (inner: string, opts: { align: string; pad: string; borda: string }) =>
  `<div style="width:100%;height:100%;margin:0;padding:${opts.pad};background:#09081A;` +
  `-webkit-print-color-adjust:exact;print-color-adjust:exact;box-sizing:border-box;` +
  `display:flex;align-items:${opts.align};` +
  `font-family:'DM Sans',Helvetica,sans-serif;font-size:7.5px;letter-spacing:0.07em;` +
  `text-transform:uppercase;color:#E8C97A">` +
  `<div style="width:100%;display:flex;justify-content:space-between;align-items:baseline;${opts.borda}">${inner}</div>` +
  `</div>`;

export function complianceDossierPdfOptions(data: ComplianceDossierData) {
  const header = PDF_BAND(
    `<span style="font-weight:700;color:#E8C97A">V3 Partners · Dossiê de Risco (Cockpit de Compliance)</span>` +
      `<span style="color:#9BAFC5">Ref. ${esc(data.code)} · Emitido em ${esc(data.emittedAt)}</span>`,
    { align: "flex-start", pad: "7mm 14mm 0", borda: "border-bottom:0.5px solid rgba(36,58,102,0.9);padding-bottom:3mm" }
  );
  const footer = PDF_BAND(
    `<span style="color:#9BAFC5">V3 Partners Soluções Ltda · CNPJ 14.219.287/0001-50</span>` +
      `<span style="color:#9BAFC5">Confidencial · uso interno da Mesa e da Governança</span>` +
      `<span style="font-weight:700;color:#E8C97A">Página <span class="pageNumber"></span> de <span class="totalPages"></span></span>`,
    { align: "flex-end", pad: "0 14mm 7mm", borda: "border-top:0.5px solid rgba(36,58,102,0.9);padding-top:3mm" }
  );
  return {
    format: "A4" as const,
    printBackground: true,
    preferCSSPageSize: false,
    displayHeaderFooter: true,
    headerTemplate: header,
    footerTemplate: footer,
    margin: { top: "26mm", bottom: "20mm", left: "0", right: "0" },
  };
}

function docConfiabilidadeRow(d: ComplianceDossierData["docs"][number]) {
  const pct = d.confiabilidade;
  return `<div class="kv-row">
    <span>${esc(d.original_filename ?? d.document_type)}</span>
    <span>${pct !== null ? `${pct}% confiável` : "Sem OCR processado"} · ${esc(d.validation_status ?? "n/d")}</span>
  </div>`;
}

function ddRow(r: ComplianceDossierData["ddRecords"][number]) {
  return `<div class="flag-box">
    <strong>${esc(r.tool)} · ${esc(r.query_type)} "${esc(r.query_value)}"</strong>
    ${r.totalProcessos !== null ? `${r.totalProcessos} processo(s) encontrado(s)` : "Sem contagem de processos no resultado"}
    · consultado em ${new Date(r.created_at).toLocaleDateString("pt-BR")}
  </div>`;
}

function checktudoRow(r: ComplianceDossierData["checktudoRecords"][number]) {
  const label = r.querycode === 3090 ? "SCR (BACEN)" : r.querycode === 200 ? "Dossiê Jurídico Resumido" : `Querycode ${r.querycode}`;
  const flags = Object.entries(r.risk_flags ?? {})
    .map(([k, val]) => `${esc(k)}: ${val === null || val === undefined ? "não disponível" : esc(String(val))}`)
    .join(" · ");
  return `<div class="flag-box">
    <strong>${label}</strong>
    ${flags || "Sem sinalizadores de risco retornados"}
    · consultado em ${new Date(r.created_at).toLocaleDateString("pt-BR")}
  </div>`;
}

function intermediaryRow(p: ComplianceDossierData["intermediaries"][number]) {
  return `<div class="kv-row">
    <span>${esc(p.full_name)} (${esc(p.role_in_document)})</span>
    <span>${p.checked ? "Antecedentes checados" : "Antecedentes pendentes"}</span>
  </div>`;
}

function signoffBlock(data: ComplianceDossierData) {
  const socio = data.signoffs.find((s) => s.signer_role === "socio_admin");
  const juridico = data.signoffs.find((s) => s.signer_role === "juridico");
  const closed = !!socio && !!juridico;
  return `<h3 class="sec">Quórum de fechamento</h3>
  <div class="hl ${closed ? "hl-green" : "hl-gold"}">
    <strong>${closed ? "Quórum fechado." : "Aguardando quórum."}</strong>
    Exige 1 assinatura de Sócio ADMIN + 1 do Jurídico (Dr. Luis Athaydes), regra confirmada em 22/08/2026.
  </div>
  <div class="kv">
    <div class="kv-row"><span>Sócio ADMIN</span><span>${socio ? `${esc(socio.signer_name)} · ${new Date(socio.signed_at).toLocaleDateString("pt-BR")}` : "Pendente"}</span></div>
    <div class="kv-row"><span>Jurídico</span><span>${juridico ? `${esc(juridico.signer_name)} · ${new Date(juridico.signed_at).toLocaleDateString("pt-BR")}` : "Pendente"}</span></div>
  </div>`;
}

export function buildComplianceDossierBodyHtml(data: ComplianceDossierData): string {
  const parecer = data.riskDossierText
    ? data.riskDossierText.split("\n").filter(Boolean).map((p) => `<p class="note" style="color:var(--cr);font-size:12.5px;margin-bottom:10px">${esc(p)}</p>`).join("")
    : `<p class="note">Parecer ainda não compilado. Clique em "Compilar Tese &amp; Dossiê" no Cockpit antes de fechar o quórum.</p>`;

  return `<div class="gold-stripe"></div>
<div class="doc-body">
  <div class="report-header">
    <div>
      <img src="${LOGO_URL}" alt="V3 Partners">
      <div class="report-eyebrow">Bolsa de Ativos · Cockpit de Due Diligence &amp; Compliance</div>
      <div class="report-title">Dossiê de Risco</div>
      <div class="confidential-badge">Confidencial</div>
    </div>
    <div class="report-meta">
      Referência <strong>${esc(data.code)}</strong><br>
      Emitido em <strong>${esc(data.emittedAt)}</strong>
    </div>
  </div>

  <div class="subject-block">
    <div><div class="subject-field-label">Ativo</div><div class="subject-field-value">${v(data.anonymousId)}</div></div>
    <div><div class="subject-field-label">Cedente</div><div class="subject-field-value">${v(data.sellerName)}</div></div>
    <div><div class="subject-field-label">CPF/CNPJ</div><div class="subject-field-value">${v(data.sellerCpfCnpj)}</div></div>
  </div>

  <h3 class="sec">1. Sumário executivo</h3>
  ${parecer}

  <h3 class="sec">2. Quadro de confiabilidade da extração</h3>
  <div class="kv">
    ${data.docs.length > 0 ? data.docs.map(docConfiabilidadeRow).join("") : `<p class="note">Nenhum documento anexado ainda.</p>`}
  </div>

  <h3 class="sec">3. Due diligence e higidez processual</h3>
  ${data.ddRecords.length > 0 ? data.ddRecords.map(ddRow).join("") : `<p class="note">Nenhuma consulta de due diligence realizada ainda.</p>`}
  ${data.checktudoRecords.length > 0 ? data.checktudoRecords.map(checktudoRow).join("") : `<p class="note">Nenhuma varredura Checktudo realizada ainda.</p>`}
  ${data.intermediaries.length > 0 ? `<div class="kv" style="margin-top:12px">${data.intermediaries.map(intermediaryRow).join("")}</div>` : ""}

  <h3 class="sec">4. Matriz de riscos e mitigantes</h3>
  <p class="note">Riscos identificados nas fontes acima estão descritos no parecer (Seção 1). Nenhum risco é inferido além do que as fontes analisadas confirmam -- ausência de dado é reportada como tal, nunca como ausência de risco.</p>

  <h3 class="sec">5. Parecer final</h3>
  <p class="note">A recomendação preliminar consta no parecer (Seção 1). O fechamento formal deste dossiê depende do quórum de assinatura abaixo.</p>

  ${signoffBlock(data)}
</div>`;
}

export function buildComplianceDossierFullHtml(data: ComplianceDossierData): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>V3 Partners · Dossiê de Risco · ${esc(data.anonymousId)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,400&display=swap" rel="stylesheet">
<style>${CREDIT_REPORT_STYLE}</style>
</head>
<body>
${buildComplianceDossierBodyHtml(data)}
</body>
</html>`;
}
