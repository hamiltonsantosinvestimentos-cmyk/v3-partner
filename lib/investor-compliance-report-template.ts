// Template HTML/PDF do Dossiê de Due Diligence Inicial (KYC) de possíveis
// investidores da Mesa M&A. Reaproveita, campo a campo, o padrão de impressão
// já homologado em lib/credit-report-template.ts (medido no Chrome real em
// 03/08/2026): margem lateral zero no @page (a área de margem sai branca no
// Chrome mesmo com fundo no html), faixas de cabeçalho/rodapé pintadas de navy
// para dar o respiro vertical e carregar a numeração de página, que o CSS
// sozinho não produz. Ver skill v3-credit-report-layout.
//
// Ver Feature Spec 06_Operacional/SOPs/2026-09-16_Operacional_FeatureSpec-KYC-
// DueDiligence-Investidores-MesaMA_v1.html.

export const REPORT_VALIDITY_DAYS = 7;

export interface InvestorComplianceReportData {
  checkId: string;
  entityName: string;
  entityDoc: string; // CPF já mascarado para exibição
  ddLevel: string;
  emittedAt: string; // já formatado dd/mm/aaaa HH:mm
  validUntil: string; // já formatado dd/mm/aaaa
  score: number | null;
  riskLabel: string | null;
  verdict: string | null;
  escavador: {
    consultado: boolean;
    totalProcessos: number | null;
    processos: {
      numeroCnj: string;
      poloAtivo: string | null;
      poloPassivo: string | null;
      tribunal: string | null;
      status: string | null;
      valorCausa: number | null;
    }[];
    erro: string | null;
  };
  checktudo: {
    consultado: boolean;
    scr: {
      quantidadeOperacoes: number | null;
      quantidadeInstituicoes: number | null;
      coobrigacaoAssumida: number | null;
      coobrigacaoRecebida: number | null;
    } | null;
    dossie: {
      totalProcessos: number | null;
      poloPassivoQuantidade: number | null;
      poloPassivoValor: number | null;
      poloAtivoQuantidade: number | null;
      poloAtivoValor: number | null;
    } | null;
    erro: string | null;
  };
  blacklistMatch: { name: string; type: string; notes: string | null } | null;
  socialSummary: string | null; // já inclui o aviso de pesquisa aberta, se presente
  socialSources: string[];
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function v(s: string | number | null | undefined, fallback = "Não informado"): string {
  if (s === null || s === undefined || s === "") return `<span class="na">${fallback}</span>`;
  return esc(String(s));
}

function brl(n: number | null | undefined): string {
  if (n === null || n === undefined) return `<span class="na">Não informado</span>`;
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export const REPORT_STYLE = `
:root {
  --nd: #09081A; --nb: #13223A; --nc: #162744; --nm: #243A66;
  --go: #C9A84C; --gl: #E8C97A; --cr: #F5F1E8; --mu: #9BAFC5; --red: #E58A8A;
}
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
@page { size: A4 portrait; }
body {
  font-family: 'DM Sans', sans-serif; background: var(--nd); color: var(--cr);
  font-size: 14px; line-height: 1.6;
  -webkit-print-color-adjust: exact; print-color-adjust: exact;
}
.na { color: var(--mu); font-style: italic; }
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
.subject-field-label { font-size: 9.5px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--gl); margin-bottom: 4px; }
.subject-field-value { font-size: 14px; font-weight: 600; color: var(--cr); }
h3.sec { font-size: 14px; font-weight: 700; color: var(--cr); margin: 26px 0 12px; padding-top: 18px; border-top: 1px solid var(--nm); }
.verdict-block { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 18px; margin: 20px 0; }
.verdict-card { background: var(--nc); border: 1px solid var(--nm); border-radius: 8px; padding: 16px 18px; text-align: center; }
.verdict-card .label { font-size: 9.5px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--gl); margin-bottom: 8px; }
.verdict-card .value { font-size: 20px; font-weight: 800; }
.risk-baixo { color: #7FB88A; } .risk-medio { color: #E0B04C; } .risk-alto { color: #E58A8A; }
.proc { background: var(--nc); border: 1px solid var(--nm); border-radius: 8px; padding: 14px 18px; margin: 10px 0; break-inside: avoid; }
.proc .cnj { font-size: 11.5px; color: var(--gl); font-weight: 700; margin-bottom: 6px; }
.proc .linha { font-size: 12.5px; color: var(--mu); margin: 2px 0; }
.proc .linha strong { color: var(--cr); }
.kv { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px 22px; margin: 12px 0; }
.kv .item { font-size: 12.5px; color: var(--mu); }
.kv .item strong { color: var(--cr); display: block; font-size: 15px; }
.gap-box { border-left: 4px solid var(--mu); background: rgba(155,175,197,0.06); border-radius: 0 6px 6px 0; padding: 12px 16px; margin: 10px 0; font-size: 12.5px; color: var(--mu); }
.flag-box { border-left: 4px solid var(--go); background: rgba(201,168,76,0.06); border-radius: 0 6px 6px 0; padding: 12px 16px; margin: 10px 0; font-size: 12.5px; color: var(--cr); }
.err-box { border-left: 4px solid var(--red); background: rgba(229,138,138,0.06); border-radius: 0 6px 6px 0; padding: 12px 16px; margin: 10px 0; font-size: 12.5px; color: var(--cr); }
.social-box { border-left: 4px solid var(--mu); background: var(--nc); border-radius: 0 6px 6px 0; padding: 16px 18px; margin: 12px 0; font-size: 12.5px; color: var(--cr); }
.social-disclaimer { font-size: 10.5px; color: var(--mu); font-style: italic; margin-top: 10px; }
.sources ul { margin: 8px 0 0 18px; }
.sources li { font-size: 11px; color: var(--mu); word-break: break-all; }

@media print {
  .doc-body { max-width: none; padding: 0 14mm; margin: 0; }
  .proc, .verdict-card { break-inside: avoid; }
  h3.sec { break-after: avoid; }
}
`;

const PDF_BAND = (inner: string, opts: { align: string; pad: string; borda: string }) =>
  `<div style="width:100%;height:100%;margin:0;padding:${opts.pad};background:#09081A;` +
  `-webkit-print-color-adjust:exact;print-color-adjust:exact;box-sizing:border-box;` +
  `display:flex;align-items:${opts.align};` +
  `font-family:'DM Sans',Helvetica,sans-serif;font-size:7.5px;letter-spacing:0.07em;` +
  `text-transform:uppercase;color:#E8C97A">` +
  `<div style="width:100%;display:flex;justify-content:space-between;align-items:baseline;${opts.borda}">${inner}</div>` +
  `</div>`;

/** Mesmo padrão de faixas navy medidas em 03/08/2026 (ver credit-report-template.ts). */
export function investorComplianceReportPdfOptions(data: InvestorComplianceReportData) {
  const protocolo = esc(data.checkId.slice(0, 8).toUpperCase());
  const emitido = esc(data.emittedAt);

  const header = PDF_BAND(
    `<span style="font-weight:700;color:#E8C97A">V3 Partners · Due Diligence Inicial de Investidor</span>` +
      `<span style="color:#9BAFC5">Protocolo ${protocolo} · Emitido em ${emitido}</span>`,
    { align: "flex-start", pad: "7mm 14mm 0", borda: "border-bottom:0.5px solid rgba(36,58,102,0.9);padding-bottom:3mm" }
  );

  const footer = PDF_BAND(
    `<span style="color:#9BAFC5">V3 Partners Soluções Ltda · CNPJ 14.219.287/0001-50</span>` +
      `<span style="color:#9BAFC5">Confidencial · uso exclusivo do destinatário</span>` +
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

function riskClass(label: string | null): string {
  if (label === "BAIXO RISCO") return "risk-baixo";
  if (label === "RISCO MÉDIO") return "risk-medio";
  if (label === "ALTO RISCO") return "risk-alto";
  return "";
}

function processosBlock(data: InvestorComplianceReportData): string {
  const esc1 = data.escavador;
  const ck = data.checktudo;

  const escavadorItems = esc1.consultado
    ? esc1.erro
      ? `<div class="err-box"><strong>Escavador:</strong> consulta falhou (${esc(esc1.erro)}). Não tratar como "sem processo", e sim como fonte não consultada com sucesso.</div>`
      : esc1.processos.length === 0
        ? `<div class="flag-box">Escavador: nenhum processo localizado para o documento informado.</div>`
        : esc1.processos
            .map(
              (p) => `<div class="proc">
          <div class="cnj">${v(p.numeroCnj)} · ${v(p.tribunal)}</div>
          <div class="linha"><strong>Polo ativo:</strong> ${v(p.poloAtivo)}</div>
          <div class="linha"><strong>Polo passivo:</strong> ${v(p.poloPassivo)}</div>
          <div class="linha"><strong>Status:</strong> ${v(p.status)} · <strong>Valor da causa:</strong> ${brl(p.valorCausa)}</div>
        </div>`
            )
            .join("")
    : `<div class="gap-box">Escavador não consultado nesta checagem.</div>`;

  const dossieBlock = ck.consultado
    ? ck.erro
      ? `<div class="err-box"><strong>Checktudo (Dossiê Jurídico Resumido):</strong> consulta falhou (${esc(ck.erro)}).</div>`
      : ck.dossie
        ? `<div class="kv">
        <div class="item"><strong>${v(ck.dossie.totalProcessos, "0")}</strong>Total de processos localizados (Checktudo)</div>
        <div class="item"><strong>${v(ck.dossie.poloPassivoQuantidade, "0")}</strong>Como réu (polo passivo) · ${brl(ck.dossie.poloPassivoValor)}</div>
        <div class="item"><strong>${v(ck.dossie.poloAtivoQuantidade, "0")}</strong>Como autor (polo ativo) · ${brl(ck.dossie.poloAtivoValor)}</div>
      </div>`
        : ""
    : `<div class="gap-box">Checktudo (Dossiê Jurídico Resumido) não consultado nesta checagem.</div>`;

  return `<h3 class="sec">Processos Judiciais (Polo Ativo / Passivo)</h3>
    <p style="font-size:12px;color:var(--mu);margin-bottom:10px">Cruzamento de duas fontes independentes: Escavador (detalhe por processo) e Checktudo Dossiê Jurídico Resumido (contagem e valor por posição processual).</p>
    ${dossieBlock}
    ${escavadorItems}`;
}

function creditoBlock(data: InvestorComplianceReportData): string {
  const scr = data.checktudo.scr;
  if (!data.checktudo.consultado) {
    return `<h3 class="sec">Crédito Simplificado (SCR / BACEN)</h3><div class="gap-box">Checktudo (SCR) não consultado nesta checagem.</div>`;
  }
  if (data.checktudo.erro) {
    return `<h3 class="sec">Crédito Simplificado (SCR / BACEN)</h3><div class="err-box">Consulta ao SCR falhou (${esc(data.checktudo.erro)}).</div>`;
  }
  return `<h3 class="sec">Crédito Simplificado (SCR / BACEN)</h3>
    <p style="font-size:12px;color:var(--mu);margin-bottom:10px">Sistema de Informações de Crédito do Banco Central. Mostra exposição de crédito (quantidade de operações e instituições), não é pontuação de score nem indicador de patrimônio.</p>
    <div class="kv">
      <div class="item"><strong>${v(scr?.quantidadeOperacoes, "0")}</strong>Operações de crédito ativas</div>
      <div class="item"><strong>${v(scr?.quantidadeInstituicoes, "0")}</strong>Instituições financeiras</div>
      <div class="item"><strong>${v(scr?.coobrigacaoAssumida, "0")}</strong>Coobrigação assumida</div>
      <div class="item"><strong>${v(scr?.coobrigacaoRecebida, "0")}</strong>Coobrigação recebida</div>
    </div>`;
}

function gapsBlock(): string {
  return `<h3 class="sec">Patrimônio e Participação em Empresas</h3>
    <div class="gap-box"><strong style="color:var(--cr)">Patrimônio (imóveis/veículos):</strong> não disponível nesta fase. Nenhuma fonte homologada no projeto cobre este dado hoje.</div>
    <div class="gap-box"><strong style="color:var(--cr)">Participação em empresas (sócio):</strong> não disponível nesta fase. Nenhuma fonte homologada no projeto cobre este dado hoje.</div>`;
}

function blacklistBlock(data: InvestorComplianceReportData): string {
  if (!data.blacklistMatch) {
    return `<h3 class="sec">Black List V3</h3><div class="flag-box">Nenhuma correspondência na lista interna V3 (INTERPOL/OFAC/PEP/V3).</div>`;
  }
  const b = data.blacklistMatch;
  return `<h3 class="sec">Black List V3</h3>
    <div class="err-box"><strong>Correspondência encontrada:</strong> ${v(b.name)} (${v(b.type)}). ${v(b.notes, "Sem observação adicional")}</div>`;
}

function socialBlock(data: InvestorComplianceReportData): string {
  if (!data.socialSummary) {
    return `<h3 class="sec">Perfil de Redes Sociais / LinkedIn</h3><div class="gap-box">Pesquisa de redes sociais não realizada nesta checagem.</div>`;
  }
  const sources =
    data.socialSources.length > 0
      ? `<div class="sources"><strong style="color:var(--cr);font-size:11.5px">Fontes retornadas pela busca:</strong><ul>${data.socialSources
          .map((s) => `<li>${esc(s)}</li>`)
          .join("")}</ul></div>`
      : "";
  return `<h3 class="sec">Perfil de Redes Sociais / LinkedIn</h3>
    <div class="social-box">
      <div>${esc(data.socialSummary).replace(/\n/g, "<br>")}</div>
      ${sources}
      <div class="social-disclaimer">Pesquisa aberta, não é fonte oficial de compliance e não há garantia de correspondência exata com a pessoa identificada.</div>
    </div>`;
}

function buildBodyHtml(data: InvestorComplianceReportData): string {
  const LOGO_URL = "https://app.v3partners.com.br/v3-logo-flat-gold-alpha.png";
  const rc = riskClass(data.riskLabel);

  return `
<div class="gold-stripe"></div>
<div class="doc-body">
  <div class="report-header">
    <div>
      <img src="${LOGO_URL}" alt="V3 Partners">
      <div class="report-eyebrow">Mesa M&amp;A · Compliance</div>
      <div class="report-title">Due Diligence Inicial de Investidor</div>
      <div class="confidential-badge">Confidencial</div>
    </div>
    <div class="report-meta">
      <div><strong>Emitido em</strong> ${v(data.emittedAt)}</div>
      <div><strong>Válido até</strong> ${v(data.validUntil)}</div>
      <div><strong>Nível de DD</strong> ${v(data.ddLevel)}</div>
    </div>
  </div>

  <div class="subject-block">
    <div>
      <div class="subject-field-label">Nome</div>
      <div class="subject-field-value">${v(data.entityName)}</div>
    </div>
    <div>
      <div class="subject-field-label">CPF</div>
      <div class="subject-field-value">${v(data.entityDoc)}</div>
    </div>
    <div>
      <div class="subject-field-label">Protocolo</div>
      <div class="subject-field-value">${esc(data.checkId.slice(0, 8).toUpperCase())}</div>
    </div>
  </div>

  <div class="verdict-block">
    <div class="verdict-card">
      <div class="label">Score</div>
      <div class="value">${v(data.score, "N/D")}</div>
    </div>
    <div class="verdict-card">
      <div class="label">Risco</div>
      <div class="value ${rc}">${v(data.riskLabel, "N/D")}</div>
    </div>
    <div class="verdict-card">
      <div class="label">Veredito</div>
      <div class="value">${v(data.verdict, "N/D")}</div>
    </div>
  </div>

  ${processosBlock(data)}
  ${creditoBlock(data)}
  ${gapsBlock()}
  ${blacklistBlock(data)}
  ${socialBlock(data)}

  <h3 class="sec">Validade e Fontes</h3>
  <p style="font-size:11.5px;color:var(--mu)">
    Este documento reflete consultas realizadas na data de emissão, válidas por ${REPORT_VALIDITY_DAYS} dias.
    Fontes consultadas: Escavador (processos judiciais), Checktudo (SCR/BACEN e Dossiê Jurídico Resumido),
    Black List V3 interna${data.socialSummary ? ", e pesquisa aberta de redes sociais" : ""}.
    Este relatório não constitui parecer jurídico ou de crédito e não substitui a análise de compliance formal
    da V3 Partners.
  </p>
</div>`;
}

export function buildInvestorComplianceReportFullHtml(data: InvestorComplianceReportData): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>V3 Partners · Due Diligence Inicial de Investidor</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,400&display=swap" rel="stylesheet">
<style>${REPORT_STYLE}</style>
</head>
<body>
${buildBodyHtml(data)}
</body>
</html>`;
}
