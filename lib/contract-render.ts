import { CONCRETE_VERTICALS } from "@/lib/contract-verticals";
import { ROLE_LABELS } from "@/lib/qualification-roles";

// NDA Multi-Vertical (11/09/2026, pedido de João): uma minuta "multi_vertical"
// tem trechos que só entram no contrato final conforme a vertical ESCOLHIDA
// NA HORA DE GERAR (nunca a vertical fixa do template, que nesse caso é só
// o rótulo genérico "multi_vertical"). Sintaxe no corpo da minuta, digitada
// no mesmo textarea de sempre: {{v:credito}}texto só do crédito{{/v}}.
// Texto fora de qualquer tag é comum a todas as verticais.
//
// SEMPRE rodar ANTES de resolveContractVariables() -- essa função trata
// qualquer {{...}} como variável, e substituiria {{v:credito}}/{{/v}} por
// "[v:credito]"/"[/v]" achando que são placeholders desconhecidos, corrompendo
// a tag antes dela ser resolvida.
export function resolveVerticalBlocks(template: string, vertical: string): string {
  return template.replace(/\{\{v:([a-z_]+)\}\}([\s\S]*?)\{\{\/v\}\}/g, (_match, v: string, inner: string) =>
    v === vertical ? inner : ""
  );
}

// Validação ao SALVAR a minuta (nunca ao gerar contrato -- por então já é
// tarde demais, o texto malformado iria pro documento assinado). Tag aberta
// sem fechar, fechamento solto, aninhamento (não suportado) ou vertical
// desconhecida em {{v:X}} tudo vira 422 explícito, mesmo espírito dos outros
// gates deste arquivo/rota (nunca deixar erro de formatação virar texto
// literal quebrado dentro do documento gerado).
export function validateVerticalBlocks(template: string): { valid: true } | { valid: false; error: string } {
  const tokenRe = /\{\{v:([a-z_]+)\}\}|\{\{\/v\}\}/g;
  let openTag: string | null = null;
  let match: RegExpExecArray | null;
  while ((match = tokenRe.exec(template))) {
    const isOpen = match[1] !== undefined;
    if (isOpen) {
      if (openTag) {
        return { valid: false, error: `Tag {{v:${match[1]}}} aberta antes de fechar {{v:${openTag}}} com {{/v}} (aninhamento de {{v:...}} não é suportado).` };
      }
      if (!CONCRETE_VERTICALS.includes(match[1])) {
        return { valid: false, error: `Vertical desconhecida em {{v:${match[1]}}}. Use uma de: ${CONCRETE_VERTICALS.join(", ")}.` };
      }
      openTag = match[1];
    } else {
      if (!openTag) return { valid: false, error: "{{/v}} encontrado sem nenhuma {{v:...}} aberta antes." };
      openTag = null;
    }
  }
  if (openTag) return { valid: false, error: `{{v:${openTag}}} nunca foi fechada com {{/v}}.` };
  return { valid: true };
}

// Extrai as chaves {{variavel}} de um corpo de minuta, ignorando as tags de
// bloco por vertical ({{v:X}}/{{/v}}) -- essas não são variáveis de
// substituição, são estrutura de texto condicional (ver
// resolveVerticalBlocks acima). Fonte única usada tanto no detectedVars da
// tela (contract-templates-client.tsx) quanto no variables_map salvo pelas
// rotas de template, pra nunca mostrar "v:credito"/"/v" como se fossem
// variável de verdade.
export function extractPlainVariables(text: string): string[] {
  return (text.match(/\{\{([^}]+)\}\}/g) || [])
    .map((v) => v.replace(/\{\{|\}\}/g, "").trim())
    .filter((v) => v !== "/v" && !v.startsWith("v:"));
}

export function resolveContractVariables(template: string, data: Record<string, any>): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
    const trimmed = key.trim();
    const value = data[trimmed];
    if (value === null || value === undefined) return `[${trimmed}]`;
    if (typeof value === "number") {
      return value.toLocaleString("pt-BR", { minimumFractionDigits: 2 });
    }
    return String(value);
  });
}

export interface ContractParty {
  role: string;
  name: string;
  doc?: string | null;
  // Rótulo renumerado (achado real 22/09/2026, auditoria de diagramação):
  // buildPartyDisplayLabels() renumera intermediários numerados de 1 a N só
  // NA PROSA do preâmbulo (party_qualifications_block, app/api/contracts/
  // generate/route.ts) -- o bloco de ASSINATURAS nunca recebia esse rótulo,
  // e derivava o número de novo a partir do role_in_document original
  // (ex: "intermediario_3" -- que pode não ser o 3º do lote, se algum
  // intermediário anterior foi excluído). Resultado real: preâmbulo dizia
  // "INTERMEDIÁRIO 2" pra uma pessoa que assinava como "INTERMEDIÁRIO 3".
  // Quando presente, este campo é a fonte da verdade do rótulo exibido --
  // signatureRoleLabel(role) só serve de fallback quando ausente.
  display_label?: string;
}

// Rótulo do papel no bloco de assinaturas (BRIEF NCNDA formatação, 22/09/2026):
// reaproveita ROLE_LABELS (mesmo dicionário da tela de qualificação), com
// 2 papéis extras que só existem como ContractParty.role sintético, nunca
// como cm_party_qualifications.role_in_document -- "v3_partners" (a própria
// V3, sempre a Estruturadora do instrumento) e "cedente" (fluxo de NDA de
// cliente único, sem lote de qualificação). Mapa local para não alterar
// ROLE_LABELS (usado também no dropdown de "Adicionar Envolvido").
const SIGNATURE_ROLE_LABEL_OVERRIDES: Record<string, string> = {
  v3_partners: "Estruturadora",
  cedente: "Cedente",
};

export function signatureRoleLabel(role: string): string {
  return (SIGNATURE_ROLE_LABEL_OVERRIDES[role] ?? ROLE_LABELS[role] ?? role).toUpperCase();
}

// Numeração progressiva do corpo (BRIEF NCNDA formatação, 22/09/2026, decisão
// de João: motor de renderização, não recálculo -- os números continuam
// digitados pelo Dr. Luis/agente estruturador, nunca recalculados aqui).
// Marca com uma classe o número já digitado no início de cada parágrafo/
// título ("7.1. ", "12.3. ", "a) ", "a.1) ") para o CSS aplicar o recuo de
// primeira linha negativo (número solto à esquerda, texto revertido alinhado
// à margem), do jeito que o Word desenha uma lista numerada -- medido byte a
// byte no numbering.xml do modelo do Dr. Luis (recuo real: 1,27cm no nível
// 1, 1,52cm no nível 2, nunca um valor fixo único). Nunca reescreve o número
// em si, só envolve o texto já existente -- reversível, e uma minuta sem
// nenhum parágrafo numerado (ex: cláusula em prosa livre) passa intacta.
//
// "\d+\)" (achado real 22/09/2026, auditoria de diagramação): a lista de
// partes qualificadas (party_qualifications_block, gerada dinamicamente em
// app/api/contracts/generate/route.ts, nunca digitada à mão) usa marcador
// "1) ", "2) " -- não é uma cláusula do corpo digitada pelo Dr. Luis, mas
// precisa do mesmo recuo francês e da mesma numeração sequencial visível
// para "garantir integridade referencial" entre os nomes das partes.
// Reaproveita o motor em vez de duplicar a lógica de recuo.
const CLAUSE_MARKER_RE = /^(\d+(?:\.\d+){0,3}\.|\d+\)|[a-z]\.\d+\)|[a-z]\))\s+/i;

function applyClauseHangingIndent(body: string): string {
  return body.replace(/<(p|h2|h3)([^>]*)>([\s\S]*?)<\/\1>/gi, (full, tag, attrs, inner) => {
    const m = inner.match(CLAUSE_MARKER_RE);
    if (!m) return full;
    const marker = m[0].trimEnd();
    const rest = inner.slice(m[0].length);
    // Nível 2 (ex: "1.1.2.", "a.1)") recebe recuo maior, igual ao numbering.xml original.
    const level2 = /^\d+(?:\.\d+){2,}\.$/.test(marker) || /^[a-z]\.\d+\)$/i.test(marker);
    const cls = `clause-item${level2 ? " clause-item-2" : ""}`;
    const existingClass = /class="([^"]*)"/.exec(attrs);
    const newAttrs = existingClass
      ? attrs.replace(/class="([^"]*)"/, `class="$1 ${cls}"`)
      : `${attrs} class="${cls}"`;
    // "&nbsp;" em vez de espaço literal (achado real da auditoria de
    // diagramação, página com cláusulas 2.4/3.1-4.6: texto justificado
    // (text-align:justify) trata qualquer espaço da linha como esticável,
    // inclusive este -- o vão entre o número e a primeira palavra variava de
    // cláusula pra cláusula porque o justify espichava esse espaço junto com
    // os das palavras normais da linha. Espaço fixo nunca estica.
    return `<${tag}${newAttrs}><span class="clause-num">${marker}</span>&nbsp;${rest}</${tag}>`;
  });
}

// Bloco de assinatura estilo manuscrito: uma linha por parte, com nome e
// CPF/CNPJ embaixo, igual a um contrato físico impresso. Reaproveita CSS
// (.parties/.party/.line) que já existia mas nunca era populado por nenhum
// HTML real. Continua sendo o caminho usado pelo PDF direto (htmlToPdfBase64)
// -- ainda é o fallback quando o .docx posicionado (abaixo) falha ou não se
// aplica. PRECISA receber `parties` preenchido em toda chamada de
// wrapContractInV3Html que gera documento destinado a assinatura — bug real
// encontrado e corrigido em 12/08/2026: 6 rotas chamavam wrapContractInV3Html
// sem o 3o argumento, e o PDF que o ClickSign buscava saía sem este bloco.
//
// CORREÇÃO de 11/09/2026 (BRIEF "Assinatura Posicionada"): a pesquisa de
// 12/08/2026 abaixo (mantida riscada, não apagada, pra não repetir o erro)
// concluiu que a API v3 não tinha NENHUM mecanismo de posicionamento. Isso
// estava incompleto -- não errado sobre o upload direto de PDF (esse de fato
// não tem posicionamento), mas a pesquisa não achou a API de Modelos/.docx
// (POST /api/v3/templates + tag {{~position_sign_ID}} no arquivo + requisito
// rubricate/manuscript com rubric_field), confirmada ao vivo em 11/09/2026
// contra a doc oficial (developers.clicksign.com/docs/copy-of-23-automação-
// com-modelos) e testada de ponta a ponta contra produção real (Modelo →
// Documento-do-Modelo → Signatário → Requisito rubricate aceito, e o texto
// acentuado íntegro conferido byte a byte no .docx convertido baixado de
// volta). Ver lib/contract-docx-render.ts e o branch `usePositioned` em
// lib/esignature/clicksign-provider.ts -- esse é o caminho novo (padrão),
// este bloco de linha/PDF é o fallback caso a geração do .docx falhe.
//
// Pesquisa original de 12/08/2026 (incompleta, ver correção acima): a API v3
// (envelopes) não tem NENHUM mecanismo programático de posicionamento de
// assinatura via upload direto de PDF, nem parâmetro de coordenada no
// payload de requirements/documents nesse caminho. O posicionamento manual
// ("Posicionar assinatura ou rubrica") na tela web do ClickSign também não
// se aplica aqui (esta integração ativa o envelope via API, nunca passa pela
// tela de envio manual).
// Bloco de assinaturas redesenhado (BRIEF NCNDA formatação, 22/09/2026,
// achado real no modelo do Dr. Luis: nenhuma linha "___" no .docx de
// referência, e o pedido de João é explícito -- "expressamente proibido o
// uso de linhas mecânicas"). Página dividida em 2 colunas por parte: dados
// (nome em CAIXA ALTA, CPF/CNPJ, papel) à esquerda, espaço reservado para a
// assinatura à direita. Sem tabulação manual do Word (o próprio modelo tinha
// tabs inconsistentes -- às vezes nome+CPF na mesma linha, às vezes em linhas
// separadas): aqui a estrutura é sempre a mesma para toda parte.
function renderPartiesBlock(parties?: ContractParty[]): string {
  if (!parties || parties.length === 0) return "";
  const rows = parties
    .map(
      (p) => `<div class="party">
<div class="party-info">
<div class="party-name">${p.name.toUpperCase()}</div>
${p.doc ? `<div class="party-doc">${p.doc}</div>` : ""}
<div class="party-role">${(p.display_label ?? signatureRoleLabel(p.role)).toUpperCase()}</div>
</div>
<div class="party-sig">Assinatura eletrônica</div>
</div>`
    )
    .join("");
  // Fórmula de encerramento (achado real 22/09/2026, pedido de João: espaço
  // em branco depois da última assinatura é vetor clássico de fraude,
  // margem para inserir cláusula/texto depois de assinado). Prática notarial
  // brasileira padrão pra isso é o fechamento explícito ("nada mais havendo
  // a tratar"), que declara sem ambiguidade onde o instrumento termina --
  // qualquer coisa impressa depois desta linha é, por definição, estranha
  // ao documento assinado. break-inside/page-break-before:avoid tenta manter
  // colada à última assinatura; se não couber, vira sozinha a única linha da
  // página seguinte, o que também fecha o documento sem ambiguidade.
  const closing = `<div class="doc-closing">Nada mais havendo a tratar, encerra-se o presente instrumento neste ponto. Nenhum texto, cláusula ou acréscimo posterior a esta linha integra ou vincula as Partes.</div>`;
  return `<div class="parties">${rows}${closing}</div>`;
}

// Título impresso do instrumento (21/09/2026, BRIEF NCNDA, problema 2).
// wrapContractInV3Html recebia template.template_name (rótulo interno de
// gestão, ex: "NCNDA V3 PARTNERS MODELO 2026 09 03") e o imprimia no <title> e
// num <h1> de cabeçalho, ACIMA do <h1> jurídico que o corpo da minuta já traz
// ("INSTRUMENTO PARTICULAR DE CONFIDENCIALIDADE..."). Regra: quando o corpo
// abre com o próprio <h1>, ele É o título do instrumento e o nome interno não
// é impresso em lugar nenhum. Sem <h1> no corpo (8 minutas ativas hoje),
// nada muda: continua valendo o título recebido.
function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

/** Título do instrumento quando o corpo abre com o próprio <h1>; senão null. */
export function extractBodyTitle(body: string): string | null {
  const m = body.match(/^\s*<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const text = m ? stripTags(m[1]) : "";
  return text || null;
}

/**
 * Título impresso a partir de um rendered_html COMPLETO já gravado: o primeiro
 * <h1> fora do <div class="header">. Devolve null quando o único <h1> é o do
 * cabeçalho (minuta sem título no corpo). Usado por send/route.ts.
 */
export function extractPrintedTitle(fullHtml: string): string | null {
  const withoutHeader = fullHtml.replace(/<div class="header">[\s\S]*?<\/div>/i, "");
  const m = withoutHeader.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const text = m ? stripTags(m[1]) : "";
  return text || null;
}

export function wrapContractInV3Html(title: string, body: string, parties?: ContractParty[], contractCode?: string | null): string {
  const bodyTitle = extractBodyTitle(body);
  const printedTitle = bodyTitle ?? title;
  const headerTitle = bodyTitle ? "" : `\n<h1>${title}</h1>`;
  const bodyWithIndent = applyClauseHangingIndent(body);
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>${printedTitle} · V3 Partners</title>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
/* Instrumento jurídico (22/09/2026, pedido explícito de João): documento pra
   assinatura NUNCA tem fundo colorido -- regra V3 de fundo navy é pra peça
   de marca/tela, não pra contrato impresso. Fundo branco, texto em tom navy
   (a cor pode ser navy, o FUNDO nunca). Mesma paleta de texto escuro sobre
   branco que o .docx do ClickSign já usava desde sempre (ver CREAM/GOLD em
   lib/contract-docx-render.ts) -- os dois caminhos saem visualmente iguais.
   */
body{font-family:'DM Sans',sans-serif;background:#FFFFFF;color:#13223A;padding:145px 60px 135px;line-height:1.8;font-size:13px;position:relative}
/* Papel timbrado oficial (22/09/2026, arquivos aprovados por João, únicos
   autorizados como padrão de TODO documento gerado por este motor -- nunca
   recriar logo/rodapé com CSS/texto). Coordenada em cm a partir do canto
   superior esquerdo da PÁGINA física (mesma referência do Word). Tamanho
   físico de cada imagem = o embutido no próprio arquivo (DPI real, nunca
   redimensionado à mão): logo 4,89cm × 2,33cm, rodapé 15,98cm × 2,01cm.

   ACHADO REAL (2 tentativas, medidas byte a byte no PDF gerado, não só
   visual): position:fixed FUNCIONA pra tela, mas no PDF paginado (Puppeteer)
   o padding do body só reserva espaço no início/fim do documento inteiro,
   nunca em cada quebra de página -- conferido texto real de cláusula saindo
   POR BAIXO do timbre no meio do documento. A solução que reserva espaço de
   verdade EM TODA página é o headerTemplate/footerTemplate do próprio
   Puppeteer (ver htmlToPdfBase64), não CSS. Por isso as imagens abaixo são
   só pra VISUALIZAÇÃO EM TELA (envolvidas em @media screen); no PDF elas
   nunca aparecem (a diretiva !print logo abaixo esconde), quem desenha o
   timbre ali é o Puppeteer, com as MESMAS 2 imagens e as MESMAS coordenadas
   (compensação de ~0,5cm por conta do wrapper interno do template do
   Chromium, documentada e testada em htmlToPdfBase64). */
@media screen{
.timbrado-logo{position:fixed;left:8.06cm;top:1.25cm;width:4.89cm;height:2.33cm;z-index:2}
.timbrado-rodape{position:fixed;left:2.85cm;top:26.61cm;width:15.98cm;height:2.01cm;z-index:2}
}
@media print{.timbrado-logo,.timbrado-rodape{display:none}}
.header,h1,h2,h3,p,.parties,.footer{position:relative;z-index:1}
h1{font-size:20px;font-weight:700;color:#13223A;text-align:center;margin-bottom:8px}
h2,h3{font-size:14px;font-weight:700;color:#13223A;margin:24px 0 8px;text-transform:uppercase;letter-spacing:.5px;text-align:justify}
p{margin-bottom:12px;text-align:justify}
/* Recuo de cláusula (BRIEF NCNDA, medido no modelo do Dr. Luis: 1,27cm nível
   1, 1,52cm nível 2) -- número solto à esquerda, texto revertido alinhado. */
.clause-item{padding-left:1.27cm;text-indent:-1.27cm}
.clause-item-2{padding-left:1.52cm;text-indent:-1.52cm}
.clause-num{display:inline-block}
.header{text-align:center;margin-bottom:32px}
.header p{font-size:11px;color:#5B6B82}
/* Bloco de assinaturas: linha vertical de referência EXATAMENTE no meio da
   página (50%/50%, nunca 55/45), regra fixa independente da quantidade de
   partes (23/09/2026, pedido explícito de João, confirmado contra o mockup
   https://claude.ai/artifact/CiHWQw3mVxcnpJmaxgGBg5 antes de implementar).
   Bloco A (dados) à esquerda da linha, Bloco B (assinatura) começando
   exatamente nela, sem traço/linha mecânica (proibido pelo BRIEF).
   CORREÇÃO 22/09/2026 (auditoria de diagramação, item 4): o
   "justify-content:space-between" antigo esticava as 2 colunas até as
   extremidades da linha inteira, empurrando "Assinatura eletrônica" pra
   margem direita da página. Largura fixa em flex-basis (50%/50%) mantém a
   assinatura exatamente na linha central, nunca na borda da página. */
/* Espaçamento de 3 linhas entre assinaturas (23/09/2026, mesmo pedido): 1
   linha de corpo = font-size 13px × line-height 1.8 ≈ 23,4px; 3 linhas ≈
   70px, dividido entre a margem inferior de cada linha e a superior da
   próxima (a borda fina entre elas soma espessura desprezível). Substitui a
   densidade de 8px testada em 22/09/2026 -- espaço é regra fixa agora, não
   mais otimizado pra caber o máximo de assinaturas numa página só. */
.parties{margin-top:32px;padding-top:16px;border-top:1px solid #C9C9C9}
.party{display:flex;align-items:flex-end;gap:24px;padding:10px 0 60px;border-bottom:1px solid #E5E5E5}
.party-info{flex:0 0 50%;text-align:left}
.party-name{font-weight:700;color:#13223A;font-size:12px}
.party-doc{font-size:10px;color:#5B6B82;margin-top:2px}
.party-role{font-size:9px;color:#8C6D1F;text-transform:uppercase;letter-spacing:.06em;margin-top:4px}
.party-sig{flex:0 0 50%;text-align:left;font-size:9px;color:#5B6B82;font-style:italic}
/* Fechamento anti-fraude (22/09/2026): linha final explícita logo após a
   última assinatura, para nenhum espaço em branco no fim do documento
   parecer "margem" para inserção posterior de texto. */
.doc-closing{margin-top:16px;padding-top:12px;border-top:1px dashed #C9A84C;text-align:center;font-size:10px;font-style:italic;color:#5B6B82;text-transform:uppercase;letter-spacing:.04em}
.footer{text-align:center;margin-top:48px;font-size:10px;color:#5B6B82}
h2,h3{break-after:avoid;page-break-after:avoid}
p{orphans:3;widows:3}
/* CORREÇÃO 22/09/2026 (auditoria de diagramação, item 3): "break-inside:avoid"
   no CONTAINER inteiro (.parties, 8 linhas) forçava o bloco INTEIRO pra
   próxima página sempre que não coubesse inteiro no espaço restante depois
   da data -- é isso que deixava o vão vazio enorme na página 9, com o bloco
   de assinaturas inteiro isolado na página 10. Removido: o bloco agora pode
   começar imediatamente após a data, na mesma página; break-inside:avoid
   continua só em CADA LINHA (.party) para nenhuma firma isolada ser cortada
   ao meio entre duas páginas. */
.party{break-inside:avoid;page-break-inside:avoid}
.doc-closing{break-inside:avoid;page-break-inside:avoid;break-before:avoid;page-break-before:avoid}
.footer{break-inside:avoid;page-break-inside:avoid}
/* Sem @page{margin:...} de propósito: margem de impressão quem controla é o
   Puppeteer (page.pdf({margin}), ver htmlToPdfBase64) -- uma regra @page
   aqui competiria com essa opção e já demonstrou (nesta sessão) sobrepor o
   valor passado pela API, quebrando o espaço reservado pro header/footer. */
@media print{@page{size:A4}body{background:#FFFFFF!important;-webkit-print-color-adjust:exact!important}}
</style>
</head>
<body>
<img class="timbrado-logo" src="https://app.v3partners.com.br/contratos/timbrado-logo.jpg" alt="V3 Partners">
<img class="timbrado-rodape" src="https://app.v3partners.com.br/contratos/timbrado-rodape.jpg" alt="V3 Partners Soluções Ltda">
<div class="header">${headerTitle}
${contractCode ? `<p>${contractCode}</p>` : ""}
</div>
${bodyWithIndent}
${renderPartiesBlock(parties)}
<div class="footer">
<p>Documento gerado automaticamente pela plataforma V3 Partners em ${new Date().toLocaleDateString("pt-BR")}.</p>
<p>Este documento requer assinatura eletrônica para validade jurídica.</p>
<p>Em caso de dúvida ou necessidade de ajuste em qualquer cláusula antes da assinatura, entre em contato: WhatsApp +55 11 93763-9475 ou e-mail juridico@v3partners.com.br.</p>
</div>
</body>
</html>`;
}
