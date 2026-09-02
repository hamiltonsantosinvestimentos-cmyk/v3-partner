import type { CreditReportData, CreditReportProcesso } from "./credit-report-data";
import { REPORT_VALIDITY_DAYS } from "./credit-report-data";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function v(s: string | number | null | undefined, fallback = "Não informado"): string {
  if (s === null || s === undefined || s === "") return `<span class="na">${fallback}</span>`;
  return esc(String(s));
}

export const CREDIT_REPORT_STYLE = `
:root {
  --nd: #09081A; --nb: #13223A; --nc: #162744; --nm: #243A66;
  --go: #C9A84C; --gl: #E8C97A; --cr: #F5F1E8; --mu: #9BAFC5; --red: #E58A8A;
}
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
/* Sem margin aqui de proposito. Quem define a margem e o page.pdf() em
   creditReportPdfOptions, com preferCSSPageSize:false. Declarar margin:0 neste
   @page fazia o conteudo ocupar a folha inteira e as faixas de cabecalho e
   rodape eram desenhadas POR CIMA do texto (verificado em 03/08/2026). */
@page { size: A4 portrait; }
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
.subject-field-label { font-size: 9.5px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--gl); margin-bottom: 4px; }
.subject-field-value { font-size: 14px; font-weight: 600; color: var(--cr); }
.na { color: var(--mu); font-style: italic; font-weight: 400; }
.hl { border-radius: 8px; padding: 16px 20px; margin: 20px 0; font-size: 12.5px; line-height: 1.6; color: var(--cr); }
.hl-gold { background: rgba(201,168,76,0.08); border: 1px solid var(--go); border-left: 4px solid var(--go); }
.hl-red { background: rgba(190,72,72,0.10); border: 1px solid rgba(190,72,72,0.5); border-left: 4px solid #BE4848; }
.hl-green { background: rgba(74,158,110,0.09); border: 1px solid rgba(74,158,110,0.45); border-left: 4px solid #4A9E6E; }
.hl strong { color: var(--go); }
.hl-red strong { color: var(--cr); }
h3.sec { font-size: 14px; font-weight: 700; color: var(--cr); margin: 26px 0 12px; padding-top: 18px; border-top: 1px solid var(--nm); }
p.note { font-size: 11.5px; color: var(--mu); line-height: 1.6; margin-bottom: 10px; }
.tbl-wrap { overflow-x: auto; margin: 16px 0; border-radius: 8px; }
table { width: 100%; border-collapse: collapse; font-size: 12px; }
thead th { background: var(--nm); color: var(--gl); font-weight: 700; font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; padding: 8px 12px; text-align: left; border-bottom: 1px solid var(--go); }
tbody tr:nth-child(even) { background: var(--nc); }
tbody tr:nth-child(odd) { background: var(--nb); }
tbody td { padding: 8px 12px; color: var(--mu); border-bottom: 1px solid rgba(36,58,102,0.5); vertical-align: top; }
tbody td strong { color: var(--cr); }
.tier-block { display: grid; grid-template-columns: 1.1fr 2fr; gap: 18px; margin: 20px 0; }
.tier-card { background: var(--nc); border: 1px solid var(--go); border-radius: 8px; padding: 20px 22px; text-align: center; }
.tier-card .tier-v { font-size: 42px; font-weight: 800; color: var(--go); line-height: 1; }
.tier-card .tier-l { font-size: 10px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--gl); margin-top: 8px; }
.tier-card .tier-s { font-size: 20px; font-weight: 700; color: var(--cr); margin-top: 12px; }
.tier-card .tier-sp { font-size: 11.5px; color: var(--mu); margin-top: 6px; }
.dims { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 18px; align-content: center; }
.dim { }
.dim-top { display: flex; justify-content: space-between; font-size: 11.5px; margin-bottom: 3px; }
.dim-top span:first-child { color: var(--mu); }
.dim-top span:last-child { color: var(--cr); font-weight: 700; }
.bar { height: 5px; background: var(--nm); border-radius: 3px; overflow: hidden; }
.bar > i { display: block; height: 100%; background: var(--go); }
.bar > i.low { background: #BE4848; }
.bar > i.mid { background: var(--gl); }
.kv { display: grid; grid-template-columns: repeat(2, 1fr); gap: 0 22px; margin: 12px 0; }
.kv-row { display: flex; justify-content: space-between; gap: 12px; padding: 7px 0; border-bottom: 1px solid rgba(36,58,102,0.4); font-size: 12.5px; }
.kv-row span:first-child { color: var(--mu); }
.kv-row span:last-child { color: var(--cr); font-weight: 600; text-align: right; }
.bacen-card { background: var(--nc); border: 1px solid var(--nm); border-left: 4px solid var(--go); border-radius: 0 8px 8px 0; padding: 18px 20px; margin: 16px 0; }
.bacen-row { display: flex; justify-content: space-between; padding: 7px 0; border-bottom: 1px solid rgba(36,58,102,0.35); font-size: 12.5px; }
.bacen-row:last-child { border-bottom: none; }
.bacen-row span:first-child { color: var(--mu); }
.bacen-row span:last-child { color: var(--cr); font-weight: 600; }
.flag-box { border-left: 4px solid var(--go); background: rgba(201,168,76,0.06); border-radius: 0 6px 6px 0; padding: 12px 16px; margin: 10px 0; font-size: 12.5px; color: var(--cr); }
.flag-box.bad { border-color: #BE4848; background: rgba(190,72,72,0.10); }
.flag-box.good { border-color: #4A9E6E; background: rgba(74,158,110,0.07); }
.flag-box strong { display: block; margin-bottom: 2px; color: var(--cr); }
.proc { background: var(--nc); border: 1px solid var(--nm); border-radius: 8px; padding: 14px 18px; margin: 10px 0; break-inside: avoid; }
.proc.passivo { border-left: 4px solid #BE4848; }
.proc.ativo { border-left: 4px solid #4A9E6E; }
.proc-head { display: flex; justify-content: space-between; gap: 14px; align-items: baseline; margin-bottom: 8px; flex-wrap: wrap; }
.proc-num { font-size: 13px; font-weight: 700; color: var(--cr); font-variant-numeric: tabular-nums; letter-spacing: 0.02em; }
.proc-val { font-size: 13px; font-weight: 700; color: var(--go); white-space: nowrap; }
.proc-meta { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 8px; }
.pill { font-size: 9px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; padding: 2px 7px; border-radius: 3px; border: 1px solid var(--nm); color: var(--gl); background: var(--nb); }
.pill.p-passivo { border-color: rgba(190,72,72,0.6); color: var(--gl); }
.pill.p-ativo { border-color: rgba(74,158,110,0.6); color: var(--gl); }
.pill.p-arq { color: var(--mu); }
.proc-parts { font-size: 11.5px; color: var(--mu); line-height: 1.7; }
.proc-parts b { color: var(--cr); font-weight: 600; }
.cov { display: flex; align-items: center; gap: 14px; margin: 14px 0; }
.cov-bar { flex: 1; height: 8px; background: var(--nm); border-radius: 4px; overflow: hidden; }
.cov-bar > i { display: block; height: 100%; background: var(--go); }
.cov-n { font-size: 13px; font-weight: 700; color: var(--go); white-space: nowrap; }
.keep { }
.doc-footer { border-top: 1px solid var(--nm); margin-top: 40px; padding: 20px 0 14px; text-align: center; font-size: 10px; color: var(--mu); }
.doc-footer strong { color: var(--gl); }
.doc-footer img { height: 28px; opacity: 0.45; margin-bottom: 8px; }
@media print {
  html, body { background: #09081A !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  /* Controle de viuvas e orfas: evita linha solta no pe ou no topo da pagina */
  p, li, td { orphans: 3; widows: 3; }
  /* Secao curta viaja inteira para a proxima pagina em vez de ser fatiada */
  .keep { break-inside: avoid; }
  /* O rodape nunca comeca pagina sozinho, que era o efeito de pagina 6 orfa */
  .doc-footer { break-before: avoid; break-inside: avoid; margin-top: 22px; }
  .doc-body > .hl:last-of-type { break-after: avoid; }
  /* Tabela mais compacta na impressao: 5 colunas em 673px apertavam o nome do socio */
  table { font-size: 11px; }
  thead th, tbody td { padding: 6px 8px; }
  /* Recuo lateral repetido em TODAS as paginas. A margem do @page e zero de proposito:
     a area de margem do @page sai BRANCA no Chrome, medido em 03/08/2026. */
  .doc-body { max-width: none; padding: 0 14mm; margin: 0; }
  .report-header { padding: 16px 0 22px; }
  /* Minimos de logo IMPRESSO do brandbook: 15mm no header, 10mm no rodape.
     Em tela 42px e 28px cumprem o minimo digital, mas no PDF viram 11,1mm e 7,4mm. */
  .report-header img { height: 15mm; margin-bottom: 4mm; }
  .doc-footer img { height: 10mm; }
  /* overflow-x auto clipa conteudo de tabela silenciosamente na impressao */
  .tbl-wrap { overflow: visible; }
  thead { display: table-header-group; }
  tr { break-inside: avoid; }
  .proc, .tier-block, .hl, table, .subject-block, .kv, .flag-box, .cov, .bacen-card { break-inside: avoid; }
  h3.sec { break-after: avoid; }
  .doc-body { padding-bottom: 0; }
  /* Rodape institucional passou para a faixa fixa do PDF (creditReportPdfOptions),
     que ancora no pe de toda pagina. No fluxo do HTML ele parava logo apos o texto
     e deixava meia pagina vazia embaixo na ultima folha. */
  .doc-footer { display: none; }
  /* Respiro extra no topo de bloco que inicia pagina: o padding do h3.sec e
     truncado pelo Chrome na quebra, entao a margem do @page sozinha nao bastava. */
  h3.sec { padding-top: 18px; }
  .keep > h3.sec:first-child { margin-top: 0; }
}
`;

const LOGO_URL = "https://app.v3partners.com.br/v3-logo-flat-gold-alpha.png";

/**
 * Opções de PDF do dossiê. Fonte única, usada pela rota do portal e por qualquer
 * script de geração, para o documento sair idêntico nos dois caminhos.
 *
 * Por que assim, verificado empiricamente em 03/08/2026 medindo o PDF gerado:
 * o Chrome NÃO pinta a área de margem do @page com o fundo do documento, nem
 * quando o fundo está só no html. Com margem lateral de 14mm o PDF saía com uma
 * moldura BRANCA de 14mm em volta de tudo, o que contraria a regra de impressão
 * V3 (fundo navy) e deixava o conteúdo colado no topo nas páginas de continuação.
 *
 * Solução: margem lateral zero (o recuo horizontal vem do padding do .doc-body,
 * que se repete em todas as páginas) e margens vertical ocupadas por faixas de
 * cabeçalho e rodapé pintadas de navy. Essas faixas dão o respiro no topo de
 * cada página, já dentro da área impressa, e carregam a numeração, que o CSS
 * sozinho não consegue produzir no Chrome.
 */
/**
 * Faixa de margem pintada de navy. O texto é ancorado na borda EXTERNA da faixa
 * (topo, no cabeçalho; base, no rodapé) e o restante da faixa fica como respiro
 * navy limpo antes do conteúdo começar. Sem isso o texto ficava colado no bloco
 * seguinte e a página não tinha a sensação de recomeço.
 */
const PDF_BAND = (inner: string, opts: { align: string; pad: string; borda: string }) =>
  `<div style="width:100%;height:100%;margin:0;padding:${opts.pad};background:#09081A;` +
  `-webkit-print-color-adjust:exact;print-color-adjust:exact;box-sizing:border-box;` +
  `display:flex;align-items:${opts.align};` +
  `font-family:'DM Sans',Helvetica,sans-serif;font-size:7.5px;letter-spacing:0.07em;` +
  `text-transform:uppercase;color:#E8C97A">` +
  `<div style="width:100%;display:flex;justify-content:space-between;align-items:baseline;${opts.borda}">${inner}</div>` +
  `</div>`;

/**
 * Monta as opções de PDF do dossiê a partir dos dados do relatório.
 * É função, e não constante, porque o cabeçalho e o rodapé carregam protocolo e
 * data, que mudam por documento.
 *
 * O cabeçalho e o rodapé do PDF resolvem três coisas que o CSS sozinho não resolve
 * no Chrome, todas verificadas medindo o PDF gerado em 03/08/2026:
 *  1. A área de margem do @page sai BRANCA, mesmo com o fundo no html. Por isso a
 *     margem lateral é zero (o recuo vem do padding do .doc-body, que se repete em
 *     toda página) e as margens vertical viram faixas pintadas de navy.
 *  2. Não existe contador de página em CSS suportado pelo Chrome. A numeração só é
 *     possível por estes templates.
 *  3. O rodapé institucional aqui fica ancorado no pé de TODA página, inclusive a
 *     última. Quando ele vivia no fluxo do HTML, na última página ele parava logo
 *     após o texto e deixava meia página vazia embaixo.
 */
export function creditReportPdfOptions(data: CreditReportData) {
  const protocolo = esc(data.code);
  const emitido = esc(data.emittedAt);

  // Faixa de 26mm no topo: identificação ocupa os 7mm iniciais, filete de separação
  // logo abaixo, e sobram cerca de 13mm de navy limpo antes do conteúdo. Bem acima
  // do mínimo de 10mm de respiro por quebra de página definido com João em 03/08.
  const header = PDF_BAND(
    `<span style="font-weight:700;color:#E8C97A">V3 Partners · Dossiê de Análise de Crédito</span>` +
      `<span style="color:#9BAFC5">Protocolo ${protocolo} · Emitido em ${emitido}</span>`,
    {
      align: "flex-start",
      pad: "7mm 14mm 0",
      borda: "border-bottom:0.5px solid rgba(36,58,102,0.9);padding-bottom:3mm",
    }
  );

  // Faixa de 20mm na base: filete, identificação institucional e numeração ancorados
  // no pé, com respiro navy entre o fim do conteúdo e o filete.
  const footer = PDF_BAND(
    `<span style="color:#9BAFC5">V3 Partners Soluções Ltda · CNPJ 14.219.287/0001-50</span>` +
      `<span style="color:#9BAFC5">Confidencial · uso exclusivo do destinatário</span>` +
      `<span style="font-weight:700;color:#E8C97A">Página <span class="pageNumber"></span> de <span class="totalPages"></span></span>`,
    {
      align: "flex-end",
      pad: "0 14mm 7mm",
      borda: "border-top:0.5px solid rgba(36,58,102,0.9);padding-top:3mm",
    }
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

/** @deprecated Usar creditReportPdfOptions(data), que preenche protocolo e data. */
export const CREDIT_REPORT_PDF_OPTIONS = {
  format: "A4" as const,
  printBackground: true,
  preferCSSPageSize: false,
  displayHeaderFooter: true,
  headerTemplate: PDF_BAND("", { align: "flex-start", pad: "7mm 14mm 0", borda: "" }),
  footerTemplate: PDF_BAND(
    `<span>Página <span class="pageNumber"></span> de <span class="totalPages"></span></span>`,
    { align: "flex-end", pad: "0 14mm 7mm", borda: "" }
  ),
  margin: { top: "26mm", bottom: "20mm", left: "0", right: "0" },
};

function barClass(n: number): string {
  if (n < 50) return "low";
  if (n < 75) return "mid";
  return "";
}

function dim(label: string, val: number | null): string {
  if (val === null) return "";
  return `<div class="dim">
    <div class="dim-top"><span>${esc(label)}</span><span>${val}</span></div>
    <div class="bar"><i class="${barClass(val)}" style="width:${Math.max(0, Math.min(100, val))}%"></i></div>
  </div>`;
}

function procCard(p: CreditReportProcesso): string {
  const polo = p.polo === "passivo" ? "passivo" : p.polo === "ativo" ? "ativo" : "";
  return `<div class="proc ${polo}">
    <div class="proc-head">
      <span class="proc-num">${esc(p.numeroCnj)}</span>
      <span class="proc-val">${p.valorCausa ?? "Valor não informado"}</span>
    </div>
    <div class="proc-meta">
      ${p.polo ? `<span class="pill p-${polo}">Polo ${esc(p.polo)}</span>` : ""}
      ${p.tribunal ? `<span class="pill">${esc(p.tribunal)}</span>` : ""}
      ${p.area ? `<span class="pill">${esc(p.area)}</span>` : ""}
      ${p.estado ? `<span class="pill">${esc(p.estado)}</span>` : ""}
      <span class="pill p-arq">${p.arquivado ? "Arquivado" : "Em andamento"}</span>
    </div>
    <div class="proc-parts">
      ${p.classe ? `<div><b>Classe:</b> ${esc(p.classe)}${p.assunto ? ` · <b>Assunto:</b> ${esc(p.assunto)}` : ""}</div>` : ""}
      ${p.poloAtivo ? `<div><b>Polo ativo:</b> ${esc(p.poloAtivo)}</div>` : ""}
      ${p.poloPassivo ? `<div><b>Polo passivo:</b> ${esc(p.poloPassivo)}</div>` : ""}
      ${p.orgaoJulgador ? `<div><b>Órgão julgador:</b> ${esc(p.orgaoJulgador)}</div>` : ""}
      <div>
        ${p.dataDistribuicao ? `<b>Distribuído em:</b> ${esc(p.dataDistribuicao)}` : ""}
        ${p.ultimaMovimentacao ? ` · <b>Última movimentação:</b> ${esc(p.ultimaMovimentacao)}` : ""}
        ${p.movimentacoes ? ` · <b>${p.movimentacoes}</b> movimentações` : ""}
      </div>
    </div>
  </div>`;
}

/** Fragmento (sem <html>/<head>/<body>), usado na página pública via dangerouslySetInnerHTML. */
export function buildExternalReportBodyHtml(data: CreditReportData): string {
  const s = data.scores;
  const ser = data.serasa;
  const cad = data.cadastro;
  const proc = data.processos;
  const isPJ = data.subjectType === "PJ";

  // ----- Cabeçalho e identificação -----
  const header = `<div class="gold-stripe"></div>
<div class="doc-body">
  <div class="report-header">
    <div>
      <img src="${LOGO_URL}" alt="V3 Partners">
      <div class="report-eyebrow">Mesa de Crédito · Motor de Análise V3</div>
      <div class="report-title">Dossiê de Análise de Crédito</div>
      <div class="confidential-badge">Confidencial</div>
    </div>
    <div class="report-meta">
      Protocolo <strong>${esc(data.code)}</strong><br>
      Emitido em <strong>${esc(data.emittedAt)}</strong><br>
      Válido até <strong>${esc(data.validUntil)}</strong>
    </div>
  </div>

  <div class="subject-block">
    <div>
      <div class="subject-field-label">${isPJ ? "Razão social" : "Nome"}</div>
      <div class="subject-field-value">${esc(cad.razaoSocial ?? data.subjectName)}</div>
    </div>
    <div>
      <div class="subject-field-label">${isPJ ? "CNPJ" : "CPF"}</div>
      <div class="subject-field-value">${esc(data.subjectCpfCnpj)}</div>
    </div>
    <div>
      <div class="subject-field-label">Natureza</div>
      <div class="subject-field-value">${isPJ ? "Pessoa Jurídica" : "Pessoa Física"}</div>
    </div>
  </div>`;

  // ----- Classificação -----
  const classificacao = `<h3 class="sec">Classificação de risco</h3>
  <div class="tier-block">
    <div class="tier-card">
      <div class="tier-v">${esc(s.tier ?? "?")}</div>
      <div class="tier-l">${esc(s.tierLabel)}</div>
      <div class="tier-s">${s.total ?? "?"} <span style="font-size:13px;color:var(--mu);font-weight:400">/ 1000</span></div>
      <div class="tier-sp">${
        s.spreadMin !== null && s.spreadMax !== null
          ? `Spread sugerido CDI + ${s.spreadMin}% a ${s.spreadMax}%`
          : "Spread não calculado"
      }</div>
    </div>
    <div class="dims">
      ${dim("Identidade", s.identidade)}
      ${dim("Crédito", s.credito)}
      ${dim("Judicial", s.judicial)}
      ${dim("Patrimonial", s.patrimonial)}
      ${dim("Comportamental", s.comportamental)}
      ${dim("Setorial", s.setorial)}
    </div>
  </div>`;

  // ----- Cadastro -----
  const cadastroBlock = cad.hasData
    ? `<h3 class="sec">Situação cadastral${isPJ ? " (Receita Federal)" : ""}</h3>
  <div class="kv">
    <div>
      <div class="kv-row"><span>Situação</span><span>${v(cad.situacao)}</span></div>
      <div class="kv-row"><span>Abertura</span><span>${v(cad.dataAbertura)}</span></div>
      <div class="kv-row"><span>Capital social</span><span>${v(cad.capitalSocial)}</span></div>
      <div class="kv-row"><span>Porte</span><span>${v(cad.porte)}</span></div>
    </div>
    <div>
      <div class="kv-row"><span>Natureza jurídica</span><span>${v(cad.naturezaJuridica)}</span></div>
      <div class="kv-row"><span>Nome fantasia</span><span>${v(cad.nomeFantasia, "Não possui")}</span></div>
      <div class="kv-row"><span>Regime tributário</span><span>${v(cad.regimeTributario)}</span></div>
      <div class="kv-row"><span>CNAE principal</span><span>${v(cad.cnaePrincipal)}</span></div>
    </div>
  </div>
  ${cad.endereco ? `<p class="note"><strong style="color:var(--cr)">Endereço:</strong> ${esc(cad.endereco)}</p>` : ""}`
    : `<h3 class="sec">Situação cadastral</h3>
  <p class="note">Cadastro da Receita Federal não consultado ou não disponível para este sujeito.</p>`;

  // ----- Quadro societário -----
  const sociosBlock =
    cad.socios.length > 0
      ? `<h3 class="sec">Quadro societário</h3>
  <p class="note">Sócios extraídos do cadastro da Receita Federal. O CPF é divulgado parcialmente mascarado pela própria Receita. Cada sócio pode ser analisado individualmente pelo motor.</p>
  <div class="tbl-wrap"><table>
    <thead><tr><th>Sócio</th><th>Qualificação</th><th>CPF (mascarado)</th><th>Entrada</th><th>Faixa etária</th></tr></thead>
    <tbody>
      ${cad.socios
        .map(
          (so) => `<tr>
        <td><strong>${esc(so.nome)}</strong></td>
        <td>${v(so.qualificacao)}</td>
        <td>${v(so.cpfMascarado)}</td>
        <td>${v(so.entrada)}</td>
        <td>${v(so.faixaEtaria)}</td>
      </tr>`
        )
        .join("")}
    </tbody>
  </table></div>`
      : "";

  // ----- Serasa -----
  const serasaBlock = ser.consultado
    ? `<h3 class="sec">Serasa Experian</h3>
  <div class="kv">
    <div>
      <div class="kv-row"><span>Score Serasa</span><span>${ser.score !== null ? `${ser.score} / 1000` : "<span class='na'>Não calculado</span>"}</span></div>
      <div class="kv-row"><span>Protestos</span><span>${ser.protestoCount}${ser.protestoValor ? ` · ${ser.protestoValor}` : ""}</span></div>
      <div class="kv-row"><span>Pefin</span><span>${ser.pefinCount}${ser.pefinValor ? ` · ${ser.pefinValor}` : ""}</span></div>
      <div class="kv-row"><span>Refin</span><span>${ser.refinCount}${ser.refinValor ? ` · ${ser.refinValor}` : ""}</span></div>
    </div>
    <div>
      <div class="kv-row"><span>Dívidas vencidas</span><span>${ser.dividaVencidaCount}${ser.dividaVencidaValor ? ` · ${ser.dividaVencidaValor}` : ""}</span></div>
      <div class="kv-row"><span>Cheques sem fundo</span><span>${ser.chequeSemFundoCount}</span></div>
      <div class="kv-row"><span>Ações judiciais</span><span>${ser.acaoJudicialCount}</span></div>
      <div class="kv-row"><span>Falência / recuperação</span><span>${ser.falenciaCount}</span></div>
    </div>
  </div>
  ${ser.scoreMensagem ? `<p class="note"><strong style="color:var(--cr)">Leitura do bureau:</strong> ${esc(ser.scoreMensagem)}</p>` : ""}
  <p class="note">Relatório ${v(ser.reportUsed)}${
    ser.ambiente
      ? ` · ambiente de ${ser.ambiente === "producao" ? "produção" : ser.ambiente === "uat" ? "homologação" : esc(ser.ambiente)}`
      : ""
  }.</p>
  ${
    ser.temRestricao
      ? `<div class="hl hl-red"><strong>Restrições financeiras localizadas.</strong> O sujeito possui apontamentos ativos nos bureaus consultados. Os valores acima refletem o somatório informado pela Serasa na data da consulta.</div>`
      : `<div class="hl hl-green"><strong>Nenhuma restrição financeira localizada</strong> nos apontamentos da Serasa na data da consulta.</div>`
  }`
    : `<h3 class="sec">Serasa Experian</h3>
  <p class="note">Fonte não consultada nesta análise. O score de crédito foi calculado sem informação de bureau.</p>`;

  // ----- Restrições consolidadas -----
  const restricoesBlock =
    data.restricoes.length > 0
      ? `<h3 class="sec">Restrições consolidadas</h3>
  <div class="tbl-wrap"><table>
    <thead><tr><th>Tipo</th><th>Descrição</th><th>Fonte</th><th>Impacto no score</th></tr></thead>
    <tbody>
      ${data.restricoes
        .map(
          (r) => `<tr>
        <td><strong>${esc(r.tipo)}</strong></td>
        <td>${v(r.descricao, "Sem descrição adicional")}</td>
        <td>${v(r.fonte)}</td>
        <td>${r.impacto !== null ? `${r.impacto} pontos` : "<span class='na'>Não quantificado</span>"}</td>
      </tr>`
        )
        .join("")}
    </tbody>
  </table></div>`
      : "";

  // ----- Processos judiciais -----
  const judicialBlock = proc.hasData
    ? `<h3 class="sec">Processos judiciais</h3>
  <div class="kv">
    <div>
      <div class="kv-row"><span>Total localizado</span><span>${proc.total}</span></div>
      <div class="kv-row"><span>No polo passivo</span><span>${proc.totalPassivo}</span></div>
    </div>
    <div>
      <div class="kv-row"><span>Valor somado no polo passivo</span><span>${v(proc.valorTotalPassivo, "Não informado")}</span></div>
      <div class="kv-row"><span>Cobertura</span><span>Nacional (Escavador)</span></div>
    </div>
  </div>
  ${
    proc.totalPassivo > 0
      ? `<div class="hl hl-red"><strong>${proc.totalPassivo} processo(s) com o sujeito no polo passivo.</strong> Recomenda-se análise jurídica do passivo contingente antes da decisão de crédito.</div>`
      : `<div class="hl hl-gold"><strong>Nenhum processo com o sujeito no polo passivo.</strong> As ocorrências localizadas colocam o sujeito no polo ativo.</div>`
  }
  ${proc.items.map(procCard).join("")}`
    : `<h3 class="sec">Processos judiciais</h3>
  <p class="note">Nenhum processo judicial localizado nas bases consultadas na data desta análise.</p>`;

  // ----- Sanções -----
  // Nunca afirmar ausência de sanção numa base que não foi consultada. O dossiê
  // chegou a declarar "nenhuma sanção localizada" e, na mesma página, "CEIS não
  // consultada", contradição pega na auditoria de marca de 03/08.
  const ceisBlock = `<h3 class="sec">Sanções administrativas</h3>
  ${
    !data.ceis.consultado
      ? `<p class="note">CEIS não consultado para este sujeito nesta análise. A ausência de sanções administrativas não pode ser afirmada com base neste dossiê.</p>`
      : data.ceis.hasMatch
        ? `<div class="flag-box bad"><strong>Sanção localizada no CEIS</strong>Há registro de impedimento ou sanção administrativa vinculado a este documento no Portal da Transparência.</div>`
        : `<div class="flag-box good"><strong>Nenhuma sanção localizada</strong>Não há registro no Cadastro de Empresas Inidôneas e Suspensas (CEIS) para este documento.</div>`
  }`;

  // ----- BACEN (SCR via CheckTudo, consulta automática desde 01/09/2026) -----
  // Canal novo, distinto do Registrato manual abaixo (upload de PDF pelo
  // titular). Prioridade: se a consulta automática rodou, mostra ela (mais
  // recente e mais confiável que depender do titular enviar o PDF); senão
  // cai no bloco legado; senão, mensagem única de "não disponível".
  const bs = data.bacenScr;
  const bacenScrOpsList = (ops: typeof bs.creditoVencidoOperacoes) =>
    ops.length
      ? `<ul style="margin:6px 0 0 18px;padding:0">${ops
          .map(
            (o) =>
              `<li style="font-size:12px;color:var(--mu);margin-bottom:3px">${v(o.descricao, "Operação")} — ${v(o.valor)}${
                o.qtdMeses ? ` (${esc(String(o.qtdMeses))} meses em atraso)` : ""
              }</li>`
          )
          .join("")}</ul>`
      : "";
  const bacenScrBlock = bs.consultado
    ? `<div class="keep"><h3 class="sec">Endividamento bancário (SCR · consulta automática)</h3>
  <p class="note">Sistema de Informações de Crédito do Banco Central, consultado automaticamente na data de emissão${
    bs.consultadoEm ? ` (${esc(bs.consultadoEm)})` : ""
  }.</p>
  ${
    bs.scorePontuacao
      ? `<div class="kv"><div><div class="kv-row"><span>Score SCR</span><span>${v(bs.scorePontuacao)}${
          bs.scoreFaixa ? ` (${esc(bs.scoreFaixa)})` : ""
        }</span></div></div></div>`
      : ""
  }
  ${
    bs.creditoVencidoOperacoes.length > 0
      ? `<div class="hl hl-red"><strong>Crédito vencido no SCR: ${v(bs.creditoVencidoValor)}.</strong> Operação vencida há mais de 14 dias, conforme critério do Banco Central.${bacenScrOpsList(
          bs.creditoVencidoOperacoes
        )}</div>`
      : `<div class="hl hl-green"><strong>Nenhum crédito vencido no SCR.</strong> Não há operação vencida há mais de 14 dias registrada no Banco Central.</div>`
  }
  ${
    bs.prejuizoOperacoes.length > 0
      ? `<div class="hl hl-red"><strong>Prejuízo registrado no SCR: ${v(bs.prejuizoValor)}.</strong> Operação em atraso há mais de 180 dias.${bacenScrOpsList(
          bs.prejuizoOperacoes
        )}</div>`
      : ""
  }</div>`
    : null;

  // ----- Registrato BACEN (upload manual pelo titular, canal legado) -----
  const bc = data.bacen;
  const bacenBlock = bacenScrBlock !== null
    ? bacenScrBlock
    : bc.hasData
    ? `<div class="keep"><h3 class="sec">Endividamento bancário (SCR · Registrato BACEN)</h3>
  <p class="note">Extrato oficial do Sistema de Informações de Crédito do Banco Central, apresentado pelo titular. Período ${v(bc.periodo)}${
        bc.emitidoEm ? ` · emitido em ${esc(bc.emitidoEm)}` : ""
      }${bc.codigoAutenticidade ? ` · código de autenticidade ${esc(bc.codigoAutenticidade)}` : ""}.</p>
  <div class="kv">
    <div>
      <div class="kv-row"><span>Dívida em dia</span><span>${v(bc.totalEmDia)}</span></div>
      <div class="kv-row"><span>Dívida vencida</span><span>${v(bc.totalVencido)}</span></div>
      <div class="kv-row"><span>Instituições ativas</span><span>${v(bc.instituicoesAtivas)}</span></div>
    </div>
    <div>
      <div class="kv-row"><span>Limites de crédito não utilizados</span><span>${v(bc.limitesCredito)}</span></div>
      <div class="kv-row"><span>Crédito a liberar</span><span>${v(bc.creditoALiberar)}</span></div>
      <div class="kv-row"><span>Coobrigações</span><span>${v(bc.coobrigacoes)}</span></div>
    </div>
  </div>
  ${
    bc.temVencido
      ? `<div class="hl hl-red"><strong>Há dívida vencida registrada no SCR.</strong> Operação vencida há mais de 14 dias, conforme critério do Banco Central.</div>`
      : `<div class="hl hl-green"><strong>Nenhuma dívida vencida no SCR.</strong> Todo o endividamento registrado no Banco Central está em dia, sem operação vencida há mais de 14 dias.</div>`
  }</div>
  ${
    bc.instituicoes.length > 0
      ? `<div class="tbl-wrap"><table>
    <thead><tr><th>Instituição</th><th>Em dia</th><th>Vencida</th><th>Limites</th><th>Modalidades</th></tr></thead>
    <tbody>
      ${bc.instituicoes
        .map(
          (i) => `<tr>
        <td><strong>${esc(i.nome)}</strong></td>
        <td>${i.emDia ?? "<span class='na'>·</span>"}</td>
        <td>${i.vencida ?? "<span class='na'>·</span>"}</td>
        <td>${i.limites ?? "<span class='na'>·</span>"}</td>
        <td>${
          i.modalidades.length
            ? i.modalidades
                .map((m) => `${esc(m.tipo)}${m.valor ? ` · ${m.valor}` : ""}`)
                .join("<br>")
            : "<span class='na'>Não detalhado</span>"
        }</td>
      </tr>`
        )
        .join("")}
    </tbody>
  </table></div>`
      : ""
  }
  ${
    !bc.detalhamentoConfiavel && bc.notaDetalhamento
      ? `<div class="hl hl-gold"><strong>Ressalva sobre o detalhamento.</strong> ${esc(bc.notaDetalhamento)}</div>`
      : ""
  }`
    : `<h3 class="sec">Endividamento bancário (SCR · Registrato BACEN)</h3>
  <p class="note">Não disponível. Nem a consulta automática ao SCR nem o extrato do Registrato enviado pelo titular estavam presentes até a emissão deste dossiê.</p>`;

  // ----- Fontes e cobertura -----
  const fontesBlock = `<h3 class="sec">Fontes consultadas e cobertura</h3>
  <div class="cov">
    <div class="cov-bar"><i style="width:${data.diagnostico.cobertura}%"></i></div>
    <div class="cov-n">${data.diagnostico.fontesConsultadas} de ${data.diagnostico.fontesTotais} fontes</div>
  </div>
  <div class="tbl-wrap"><table>
    <thead><tr><th>Fonte</th><th>Escopo</th><th>Status</th></tr></thead>
    <tbody>
      ${data.sources
        .map(
          (f) => `<tr>
        <td><strong>${esc(f.label)}</strong></td>
        <td>${esc(f.scope)}</td>
        <td>${f.consulted ? "Consultada" : "<span class='na'>Não consultada</span>"}</td>
      </tr>`
        )
        .join("")}
    </tbody>
  </table></div>
  ${
    data.diagnostico.alertas.length > 0
      ? `<div class="hl hl-gold"><strong>Limitações desta análise.</strong><ul style="margin:8px 0 0 18px">${data.diagnostico.alertas
          .map((a) => `<li style="margin-bottom:4px">${esc(a)}</li>`)
          .join("")}</ul></div>`
      : ""
  }`;

  const footer = `<div class="keep"><div class="hl hl-gold">
    <strong>Validade deste dossiê: ${REPORT_VALIDITY_DAYS} dias, até ${esc(data.validUntil)}.</strong>
    A validade é estimada, e não uma garantia de que o quadro permanecerá inalterado no período. Não é possível controlar quando uma nova anotação será registrada, porque cada empresa comunica os bureaus de crédito na sua própria data de corte, e uma restrição pode ser incluída no dia seguinte ao da emissão. Já as informações do Banco Central (SCR) têm ciclo conhecido: são atualizadas no dia 28 de cada mês. Para decisão de crédito próxima ao fim da validade, ou após o dia 28, recomenda-se emitir um dossiê novo.
  </div>

  <div class="hl hl-gold">
    <strong>Natureza deste documento.</strong> Este dossiê consolida informações obtidas em bases públicas e em bureaus de crédito contratados, na data de emissão. Não constitui recomendação de concessão, aprovação ou negativa de crédito, nem parecer jurídico. A decisão de crédito é da instituição financiadora, com base em sua própria política.
  </div></div>

  <div class="doc-footer">
    <img src="${LOGO_URL}" alt="V3 Partners">
    <div><strong>V3 Partners Soluções Ltda</strong> · CNPJ 14.219.287/0001-50</div>
    <div>Documento confidencial · uso exclusivo do destinatário · protocolo ${esc(data.code)}</div>
  </div>
</div>`;

  return [
    header,
    classificacao,
    cadastroBlock,
    sociosBlock,
    serasaBlock,
    restricoesBlock,
    judicialBlock,
    ceisBlock,
    bacenBlock,
    fontesBlock,
    footer,
  ].join("\n");
}

/** Documento HTML completo, usado pelo gerador de PDF (Puppeteer). */
export function buildExternalReportFullHtml(data: CreditReportData): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>V3 Partners · Dossiê de Análise de Crédito</title>
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
