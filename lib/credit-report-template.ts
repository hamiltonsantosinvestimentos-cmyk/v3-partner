import type { CreditReportData } from "./credit-report-data";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export const CREDIT_REPORT_STYLE = `
:root {
  --nd: #09081A; --nb: #13223A; --nc: #162744; --nm: #243A66;
  --go: #C9A84C; --gl: #E8C97A; --cr: #F5F1E8; --mu: #9BAFC5; --green: #4ade80;
}
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
@page { size: A4; margin: 13mm 14mm; }
body {
  font-family: 'DM Sans', sans-serif; background: var(--nd); color: var(--cr);
  font-size: 14px; line-height: 1.6;
  -webkit-print-color-adjust: exact; print-color-adjust: exact;
}
.gold-stripe { height: 4px; background: linear-gradient(to right, #09081A, #C9A84C, #E8C97A, #C9A84C, #09081A); }
.doc-body { max-width: 820px; margin: 0 auto; padding: 0 48px 60px; }
.report-header { display: flex; justify-content: space-between; align-items: flex-start; padding: 40px 0 28px; border-bottom: 1px solid var(--nm); }
.report-header img { height: 42px; margin-bottom: 16px; }
.report-eyebrow { font-size: 10.5px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--gl); margin-bottom: 6px; }
.report-title { font-size: 22px; font-weight: 800; color: var(--cr); }
.report-meta { text-align: right; font-size: 11.5px; color: var(--mu); line-height: 1.8; }
.report-meta strong { color: var(--cr); }
.confidential-badge { display: inline-block; background: rgba(201,168,76,0.12); border: 1px solid var(--go); color: var(--gl); font-size: 9.5px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; padding: 3px 9px; border-radius: 3px; margin-top: 6px; }
.subject-block { background: var(--nc); border: 1px solid var(--nm); border-radius: 8px; padding: 22px 26px; margin: 28px 0; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; }
.subject-field-label { font-size: 9.5px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--mu); margin-bottom: 4px; }
.subject-field-value { font-size: 14px; font-weight: 600; color: var(--cr); }
.hl { border-radius: 8px; padding: 16px 20px; margin: 20px 0; font-size: 12.5px; line-height: 1.6; color: var(--cr); }
.hl-gold { background: rgba(201,168,76,0.08); border: 1px solid var(--go); border-left: 4px solid var(--go); }
.hl strong { color: var(--go); }
h3.sec { font-size: 14px; font-weight: 700; color: var(--cr); margin: 26px 0 12px; padding-top: 18px; border-top: 1px solid var(--nm); }
p.note { font-size: 11.5px; color: var(--mu); line-height: 1.6; margin-bottom: 10px; }
.tbl-wrap { overflow-x: auto; margin: 16px 0; border-radius: 8px; }
table { width: 100%; border-collapse: collapse; font-size: 12px; }
thead th { background: var(--nm); color: var(--gl); font-weight: 700; font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; padding: 8px 12px; text-align: left; border-bottom: 1px solid var(--go); }
tbody tr:nth-child(even) { background: var(--nc); }
tbody tr:nth-child(odd) { background: var(--nb); }
tbody td { padding: 8px 12px; color: var(--mu); border-bottom: 1px solid rgba(36,58,102,0.5); vertical-align: top; }
tbody td strong { color: var(--cr); }
.bacen-card { background: var(--nc); border: 1px solid var(--nm); border-left: 4px solid var(--go); border-radius: 0 8px 8px 0; padding: 18px 20px; margin: 16px 0; }
.bacen-row { display: flex; justify-content: space-between; padding: 7px 0; border-bottom: 1px solid rgba(36,58,102,0.35); font-size: 12.5px; }
.bacen-row:last-child { border-bottom: none; }
.bacen-row span:first-child { color: var(--mu); }
.bacen-row span:last-child { color: var(--cr); font-weight: 600; }
.flag-box { border-left: 4px solid var(--go); background: rgba(201,168,76,0.06); border-radius: 0 6px 6px 0; padding: 12px 16px; margin: 10px 0; font-size: 12.5px; color: var(--cr); }
.flag-box.bad { border-color: #f87171; background: rgba(248,113,113,0.08); }
.flag-box strong { display: block; margin-bottom: 2px; color: var(--cr); }
.doc-footer { border-top: 1px solid var(--nm); margin-top: 40px; padding: 20px 0 14px; text-align: center; font-size: 10px; color: var(--mu); }
.doc-footer strong { color: var(--gl); }
.doc-footer img { height: 28px; opacity: 0.45; margin-bottom: 8px; }
@media print {
  html, body { background: #09081A !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
}
`;

const LOGO_URL = "https://app.v3partners.com.br/v3-logo-flat-gold-alpha.png";

/** Fragmento (sem <html>/<head>/<body>), usado na página pública via dangerouslySetInnerHTML. */
export function buildExternalReportBodyHtml(data: CreditReportData): string {
  const sourcesRows = data.sources
    .map(
      (s) => `
        <tr>
          <td><strong>${esc(s.label)}</strong></td>
          <td>${esc(s.scope)}</td>
          <td>${s.consulted ? '<span style="color:var(--green)">Consultada</span>' : "Não consultada"}</td>
        </tr>`
    )
    .join("");

  const judicialSection = data.judicial.hasDetailedData
    ? `
      <h3 class="sec">Processos Judiciais Localizados</h3>
      <div class="tbl-wrap"><table>
        <thead><tr><th>Número</th><th>Classe</th><th>Tribunal</th><th>Polo</th><th>Valor da Causa</th></tr></thead>
        <tbody>${data.judicial.items
          .map(
            (p) => `<tr><td><strong>${esc(p.numero)}</strong></td><td>${esc(p.classe)}</td><td>${esc(p.tribunal)}</td><td>${esc(p.polo)}</td><td>${esc(p.valorCausa)}</td></tr>`
          )
          .join("")}</tbody>
      </table></div>`
    : `
      <h3 class="sec">Processos Judiciais</h3>
      <p class="note">${
        data.judicial.totalCount === null
          ? "Fonte não consultada nesta análise."
          : data.judicial.totalCount === 0
          ? "Nenhum processo localizado na base pública CNJ DataJud na data-base da coleta."
          : `${data.judicial.totalCount} processo(s) localizado(s) na base pública CNJ DataJud. Detalhamento por processo ainda não disponível nesta análise.`
      }</p>`;

  const bacenSection = data.bacen.hasData
    ? `
      <h3 class="sec">Relacionamento Bancário · Registrato BACEN</h3>
      <div class="bacen-card">
        ${data.bacen.instituicoesAtivas !== null ? `<div class="bacen-row"><span>Instituições com relacionamento ativo</span><span>${data.bacen.instituicoesAtivas}</span></div>` : ""}
        ${data.bacen.operacoesAbertas !== null ? `<div class="bacen-row"><span>Operações de crédito em aberto</span><span>${data.bacen.operacoesAbertas}</span></div>` : ""}
        ${data.bacen.atraso30 !== null ? `<div class="bacen-row"><span>Operações em atraso (&gt; 30 dias)</span><span>${data.bacen.atraso30}</span></div>` : ""}
        ${data.bacen.atraso60 !== null ? `<div class="bacen-row"><span>Operações em atraso (&gt; 60 dias)</span><span>${data.bacen.atraso60}</span></div>` : ""}
        ${data.bacen.atraso90 !== null ? `<div class="bacen-row"><span>Operações em atraso (&gt; 90 dias)</span><span>${data.bacen.atraso90}</span></div>` : ""}
        ${data.bacen.valorTotalAtraso ? `<div class="bacen-row"><span>Valor total em atraso</span><span>${esc(data.bacen.valorTotalAtraso)}</span></div>` : ""}
        ${data.bacen.concentracaoBancaria ? `<div class="bacen-row"><span>Concentração bancária</span><span>${esc(data.bacen.concentracaoBancaria)}</span></div>` : ""}
      </div>`
    : `
      <h3 class="sec">Relacionamento Bancário · Registrato BACEN</h3>
      <p class="note">Fonte não consultada nesta análise. O detalhamento Registrato BACEN depende do consentimento e envio do extrato pelo titular.</p>`;

  const ceisSection = data.ceis.hasMatch
    ? `<div class="flag-box bad"><strong>Sanção localizada no CEIS</strong>Foi identificada sanção administrativa ou impedimento de contratar com a administração pública para o titular. Consultar a instituição para o detalhamento completo.</div>`
    : `<div class="flag-box"><strong>Sem ocorrência no CEIS</strong>Nenhuma sanção administrativa ou impedimento de contratar localizado no CEIS para o titular na data-base da coleta.</div>`;

  const escavadorSection = data.escavador.hasData
    ? data.escavador.totalProcessos && data.escavador.totalProcessos > 0
      ? `
      <h3 class="sec">Processos Judiciais Localizados · Escavador</h3>
      <p class="note">${data.escavador.totalProcessos} processo(s) localizado(s) na base do Escavador. ${
          data.escavador.processos.length < data.escavador.totalProcessos
            ? `Exibindo os ${data.escavador.processos.length} mais recentes.`
            : ""
        }</p>
      <div class="tbl-wrap"><table>
        <thead><tr><th>Número CNJ</th><th>Polo Ativo</th><th>Polo Passivo</th><th>Tribunal</th><th>Status</th></tr></thead>
        <tbody>${data.escavador.processos
          .map(
            (p) => `<tr><td><strong>${esc(p.numeroCnj)}</strong></td><td>${esc(p.poloAtivo ?? "Não informado")}</td><td>${esc(p.poloPassivo ?? "Não informado")}</td><td>${esc(p.tribunal ?? "Não informado")}</td><td>${esc(p.status ?? "Não informado")}</td></tr>`
          )
          .join("")}</tbody>
      </table></div>`
      : `
      <h3 class="sec">Processos Judiciais · Escavador</h3>
      <p class="note">Nenhum processo localizado na base do Escavador para o titular na data-base da coleta.</p>`
    : `
      <h3 class="sec">Processos Judiciais · Escavador</h3>
      <p class="note">Fonte não consultada nesta análise.</p>`;

  return `
<div class="gold-stripe"></div>
<div class="doc-body">
  <div class="report-header">
    <div>
      <img src="${LOGO_URL}" alt="V3 Partners">
      <div class="report-eyebrow">Dossiê de Informações Cadastrais</div>
      <div class="report-title">Compilação de Dados · Fontes Públicas e Consentidas</div>
      <div class="confidential-badge">Confidencial</div>
    </div>
    <div class="report-meta">
      <div><strong>Código:</strong> V3-CE-${esc(data.code)}</div>
      <div><strong>Emitido em:</strong> ${esc(data.emittedAt)}</div>
      <div><strong>Válido até:</strong> ${esc(data.validUntil)}</div>
      <div><strong>Emitido por:</strong> V3 Partners</div>
    </div>
  </div>

  <div class="subject-block">
    <div><div class="subject-field-label">Titular</div><div class="subject-field-value">${esc(data.subjectName)}</div></div>
    <div><div class="subject-field-label">CNPJ/CPF</div><div class="subject-field-value">${esc(data.subjectCpfCnpj)}</div></div>
    <div><div class="subject-field-label">Data-base da coleta</div><div class="subject-field-value">${esc(data.emittedAt)}</div></div>
  </div>

  <div class="hl hl-gold">
    <strong>Natureza deste documento:</strong> compilação factual dos dados coletados nas fontes abaixo, sem julgamento de risco, score ou recomendação de crédito por parte da V3. A análise de risco e a decisão de alocação são de responsabilidade exclusiva da instituição destinatária.
  </div>

  <h3 class="sec">Fontes Consultadas Nesta Coleta</h3>
  <div class="tbl-wrap"><table>
    <thead><tr><th>Fonte</th><th>Escopo</th><th>Status</th></tr></thead>
    <tbody>${sourcesRows}</tbody>
  </table></div>

  ${judicialSection}
  ${bacenSection}

  <h3 class="sec">Sanções e Impedimentos (CEIS)</h3>
  ${ceisSection}

  ${escavadorSection}

  <h3 class="sec">Nota Metodológica</h3>
  <p class="note">Este dossiê é uma compilação factual produzida pela V3 Partners a partir de fontes públicas e, quando aplicável, de documentos fornecidos pelo titular mediante consentimento expresso (LGPD Art. 7º, inciso V). Não contém score, classificação de risco ou recomendação de crédito. A avaliação de risco e a decisão de alocação são de responsabilidade exclusiva da instituição destinatária. Validade de 30 dias a partir da data de emissão.</p>

  <div class="doc-footer">
    <img src="${LOGO_URL}" alt="V3 Partners">
    <div><strong>V3 Partners Soluções Ltda</strong> · CNPJ 14.219.287/0001-50</div>
    <div>Documento confidencial · uso exclusivo do destinatário</div>
  </div>
</div>`;
}

/** Documento HTML completo, usado pelo gerador de PDF (Puppeteer). */
export function buildExternalReportFullHtml(data: CreditReportData): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>V3 Partners · Dossiê de Informações Cadastrais</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,400&display=swap" rel="stylesheet">
<style>${CREDIT_REPORT_STYLE}</style>
</head>
<body>
${buildExternalReportBodyHtml(data)}
</body>
</html>`;
}
