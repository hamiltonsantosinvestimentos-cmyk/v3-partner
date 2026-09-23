// lib/contract-docx-render.ts
//
// Gera o .docx com a assinatura POSICIONADA (BRIEF "Assinatura Posicionada",
// 11/09/2026), usado como alternativa ao PDF (htmlToPdfBase64) quando o
// contrato vai pro ClickSign via Modelo (lib/esignature/clicksign-provider.ts).
//
// Achado real desta sessão, testado ao vivo contra a API real da ClickSign
// antes de escrever este arquivo: a lib `html-to-docx` gera um .docx que a
// ClickSign REJEITA (422 "Estrutura para um arquivo .docx incorreta") --
// confirmado, não é bug de formatação do envio, é o arquivo em si. A lib
// `docx` (dolanmiu) foi testada e aceita (201, cadeia completa Modelo →
// Documento → Signatário → Requisito rubricate/manuscript com rubric_field
// reconhecido). Por isso este arquivo usa `docx` (API programática, não
// converte HTML pronto) + `node-html-parser` pra andar pela árvore do HTML
// que já geramos.
//
// Conjunto de tags suportado, dimensionado contra as 13 minutas reais
// aprovadas em produção no momento em que isto foi escrito (nenhuma usa
// <em>/<i>, <br> ou <span>; só 2 de 13 usam lista; só 1 usa tabela):
// h1, h2, h3, p, strong/b, ul/ol/li, table/tr/td/th. Qualquer tag não
// mapeada cai no fallback (texto puro, nunca lança exceção) -- uma minuta
// nova com uma tag não prevista degrada pra texto simples em vez de quebrar
// o envio inteiro.
import { parse, HTMLElement, Node, NodeType } from "node-html-parser";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  Header,
  ImageRun,
  HorizontalPositionRelativeFrom,
  VerticalPositionRelativeFrom,
  TextWrappingType,
  TextWrappingSide,
  LineRuleType,
} from "docx";
import { signatureRoleLabel, type ContractParty } from "./contract-render";

const GOLD = "C9A84C";
const CREAM = "1A1A1A"; // corpo do .docx é sempre texto escuro sobre fundo branco -- documento pra assinatura, nunca segue a paleta navy/ouro de tela (regra de identidade visual V3 é pra peça de marca, não pra instrumento jurídico que o signatário assina)

// Calibração 23/09/2026 (novo padrão, a partir do documento revisado pelo Dr.
// Athaydes -- V3C-NDA-2026-0039, comparado byte a byte contra o que o
// ClickSign de fato entrega): fonte Arial (era Calibri), tamanho 24
// half-points = 12pt. BODY_SIZE agora é passado EXPLICITAMENTE em cada
// TextRun (não só como default do documento) -- achado real da mesma
// auditoria: o processamento de Modelo do ClickSign reseta o tamanho de
// fonte do PADRÃO do documento (docDefaults) e também apaga a justificação
// de parágrafo, mas preserva propriedades explícitas de cada `run` (cor,
// negrito já sobreviviam) -- aposta calibrada em cima disso, precisa
// reconfirmar testando um envio real de novo antes de virar padrão.
const BODY_FONT = "Arial";
const BODY_SIZE = 24;

// Achado real 22/09/2026 (conferido só depois de converter o .docx pra PDF e
// olhar página por página -- nunca visível na extração de texto do XML):
// TextNode.rawText do node-html-parser devolve o texto CRU entre as tags,
// sem decodificar entidade nenhuma. O "&nbsp;" que applyClauseHangingIndent
// (lib/contract-render.ts) injeta entre o número da cláusula e o texto (pra
// o espaço nunca esticar no justificado) saía LITERAL na tela -- "1.&nbsp;DAS
// PARTES" em vez de "1. DAS PARTES". Cobre só as entidades que este motor de
// fato produz (não é um decoder HTML genérico) -- nunca puxar a dependência
// inteira `entities` só pra isso.
function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function textRunsFromInline(node: Node, bold = false): TextRun[] {
  if (node.nodeType === NodeType.TEXT_NODE) {
    // Ordem importa: colapsar \s+ ANTES de decodificar "&nbsp;" -- \s em
    // regex JS também casa   (nbsp já decodificado), então decodificar
    // primeiro faria o próprio replace de espaços engolir de volta o nbsp
    // que a entidade devia proteger (o objetivo inteiro do &nbsp; aqui é
    // nunca ser tratado como espaço comum).
    const text = decodeHtmlEntities(node.rawText.replace(/\s+/g, " "));
    if (!text.trim()) return [];
    return [new TextRun({ text, bold, color: CREAM, font: BODY_FONT, size: BODY_SIZE })];
  }
  if (node.nodeType !== NodeType.ELEMENT_NODE) return [];
  const el = node as HTMLElement;
  const tag = el.tagName?.toLowerCase();
  const isBold = bold || tag === "strong" || tag === "b";
  const runs: TextRun[] = [];
  for (const child of el.childNodes) runs.push(...textRunsFromInline(child, isBold));
  return runs;
}

function paragraphFromBlock(el: HTMLElement): Paragraph {
  const tag = el.tagName?.toLowerCase();
  const runs = textRunsFromInline(el);
  // Justificado (23/09/2026, decisão de João): documento de referência do
  // Dr. Athaydes (Mandato Phocus, mesmo timbre) usa o estilo "Corpodetexto"
  // com jc="both" (justificado) pra todo parágrafo de corpo real -- o
  // gerador nunca tinha sido configurado pra bater com isso (saía sem
  // alinhamento explícito, ou seja, à esquerda por padrão do Word). h1 abaixo
  // sobrescreve para CENTER; h2/h3 herdam JUSTIFIED daqui (heading curta de
  // uma linha só não muda visualmente com justificado).
  //
  // Espaçamento 240 (era 160) e entrelinha 276/auto = 1,15x (23/09/2026,
  // 2ª calibração): valores exatos que o Dr. Athaydes aplicou na revisão de
  // V3C-NDA-2026-0039 (comparado byte a byte contra o .docx que ele devolveu).
  // Justificação sozinha (sem esses dois) é o que o ClickSign resetava; teste
  // real de novo antes de virar padrão definitivo, ver comentário de BODY_SIZE.
  const base: ConstructorParameters<typeof Paragraph>[0] = {
    children: runs.length ? runs : [new TextRun("")],
    spacing: { after: 240, line: 276, lineRule: LineRuleType.AUTO },
    alignment: AlignmentType.JUSTIFIED,
  };
  if (tag === "h1") return new Paragraph({ ...base, heading: HeadingLevel.HEADING_1, alignment: AlignmentType.CENTER });
  if (tag === "h2") return new Paragraph({ ...base, heading: HeadingLevel.HEADING_2 });
  if (tag === "h3") return new Paragraph({ ...base, heading: HeadingLevel.HEADING_3 });
  return new Paragraph(base);
}

function listItemParagraph(el: HTMLElement, ordered: boolean, index: number): Paragraph {
  const runs = textRunsFromInline(el);
  const bullet = ordered ? `${index}. ` : "• ";
  return new Paragraph({
    children: [new TextRun({ text: bullet, color: CREAM, font: BODY_FONT, size: BODY_SIZE }), ...runs],
    spacing: { after: 120 },
    indent: { left: 360 },
  });
}

function tableCell(el: HTMLElement | null): TableCell {
  const runs = el ? textRunsFromInline(el) : [];
  return new TableCell({
    children: [new Paragraph({ children: runs.length ? runs : [new TextRun("")] })],
    borders: {
      top: { style: BorderStyle.SINGLE, size: 2, color: "9BAFC5" },
      bottom: { style: BorderStyle.SINGLE, size: 2, color: "9BAFC5" },
      left: { style: BorderStyle.SINGLE, size: 2, color: "9BAFC5" },
      right: { style: BorderStyle.SINGLE, size: 2, color: "9BAFC5" },
    },
  });
}

function tableFromElement(el: HTMLElement): Table {
  const rows = el.querySelectorAll("tr").map((tr) => {
    const cells = tr.querySelectorAll("td, th").map((c) => tableCell(c));
    return new TableRow({ children: cells });
  });
  return new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } });
}

// Anda pelos filhos diretos de `root` (nível de bloco). Não é um parser HTML
// genérico -- cobre exatamente a estrutura real que resolveContractVariables()
// produz (parágrafos e títulos soltos, sem aninhamento profundo fora de
// listas/tabela).
function blocksFromRoot(root: HTMLElement): (Paragraph | Table)[] {
  const out: (Paragraph | Table)[] = [];
  let listCounter = 0;

  for (const node of root.childNodes) {
    if (node.nodeType !== NodeType.ELEMENT_NODE) continue;
    const el = node as HTMLElement;
    const tag = el.tagName?.toLowerCase();

    if (tag === "ul" || tag === "ol") {
      listCounter = 0;
      for (const li of el.querySelectorAll("li")) {
        listCounter++;
        out.push(listItemParagraph(li, tag === "ol", listCounter));
      }
      continue;
    }
    if (tag === "table") {
      out.push(tableFromElement(el));
      continue;
    }
    if (tag === "div" || tag === "section") {
      // divs de layout (ex: .header da Fase de manual-intake) -- desce um
      // nível em vez de tratar como bloco de texto próprio.
      out.push(...blocksFromRoot(el));
      continue;
    }
    // Fallback: qualquer tag não mapeada (span, em, br soltos na raiz, etc.)
    // vira parágrafo simples, nunca lança exceção.
    out.push(paragraphFromBlock(el));
  }
  return out;
}

function renderPartiesBlockDocx(parties?: ContractParty[]): (Paragraph)[] {
  if (!parties || parties.length === 0) return [];
  const out: Paragraph[] = [
    new Paragraph({ text: "", spacing: { before: 480 } }),
  ];
  parties.forEach((p, i) => {
    out.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 480, after: 40 },
        // Tag de posicionamento (BRIEF "Assinatura Posicionada"): a ClickSign
        // localiza este texto literal no .docx convertido e desenha a área
        // de assinatura manuscrita exatamente aqui, vinculada ao requisito
        // rubricate/manuscript com o mesmo rubric_field.
        //
        // CAUSA RAIZ do bug real de 11/09/2026 (rev.123, feature desativada
        // no mesmo dia após travar a tela de um signatário real): a versão
        // original desta linha tinha `color: "FFFFFF", size: 2` (tentativa
        // de deixar a tag invisível caso não fosse reconhecida). Isso
        // quebrava o reconhecimento -- confirmado isolando 4 variantes
        // contra a API real e checando `metadata.position_sign_fields` do
        // documento (não só o 201 da chamada, que não garante reconhecimento
        // nenhum): TextRun com `color`/`size` sempre dava campo vazio ([]);
        // TextRun sem nenhuma formatação de rPr sempre reconhecia a tag
        // corretamente. Nunca mais aplicar cor/tamanho custom neste TextRun
        // específico -- a ClickSign, ao reconhecer a tag de verdade,
        // substitui o texto por uma área de assinatura real na tela, não
        // precisa (e não deve) ser escondido por nós.
        children: [new TextRun(`{{~position_sign_${i + 1}}}`)],
      }),
      // Nome em CAIXA ALTA (BRIEF NCNDA formatação, 22/09/2026, regra 2.1 do QA
      // de governança). Paragrafo SEPARADO do da tag acima -- não mexe no
      // TextRun da tag em si, mantém o reconhecimento intacto.
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 20 }, children: [new TextRun({ text: p.name.toUpperCase(), bold: true, color: CREAM, font: BODY_FONT })] })
    );
    if (p.doc) {
      out.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: p.doc, color: CREAM, size: 18, font: BODY_FONT })] }));
    }
    // Papel da parte (BRIEF NCNDA formatação: "ESTRUTURADORA, HEAD V3 PARTNERS,
    // MANDATÁRIO"), mesmo rótulo do bloco de assinaturas em tela/PDF.
    //
    // BUG real corrigido 22/09/2026 (auditoria de diagramação, achado A):
    // este caminho (.docx, o canal REAL de assinatura via ClickSign, ver
    // comentário acima de renderPartiesBlockDocx) ainda chamava
    // signatureRoleLabel(p.role) direto, a mesma causa raiz já corrigida no
    // caminho HTML/PDF (lib/contract-render.ts) -- o rótulo renumerado
    // (display_label) nunca era lido aqui, então o .docx enviado pra
    // assinatura real continuaria divergindo do preâmbulo mesmo depois do
    // fix anterior, que só cobriu o fallback.
    out.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 40 }, children: [new TextRun({ text: (p.display_label ?? signatureRoleLabel(p.role)).toUpperCase(), color: GOLD, size: 16, bold: true, font: BODY_FONT })] }));
  });
  // Fechamento anti-fraude (22/09/2026, mesmo motivo do caminho HTML/PDF):
  // espaço em branco depois da última assinatura é margem para inserção de
  // texto após a assinatura. Fórmula notarial padrão declara sem ambiguidade
  // onde o instrumento termina.
  out.push(
    new Paragraph({ spacing: { before: 360 }, border: { top: { style: BorderStyle.DASHED, size: 4, color: GOLD } } }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 120 },
      children: [
        new TextRun({
          text: "Nada mais havendo a tratar, encerra-se o presente instrumento neste ponto. Nenhum texto, cláusula ou acréscimo posterior a esta linha integra ou vincula as Partes.",
          italics: true,
          size: 16,
          color: CREAM,
          font: BODY_FONT,
        }),
      ],
    }),
  );
  return out;
}

// Papel timbrado oficial em todas as páginas (22/09/2026, arquivos aprovados
// por João, únicos autorizados como padrão de TODO documento deste motor --
// nunca recriar logo/rodapé com formas/texto). ImageRun não aceita URL, só
// bytes: busca as 2 imagens públicas uma vez por documento gerado (arquivos
// pequenos, poucos KB, sem custo relevante). `floating` com `relative: PAGE`
// ancora pela página inteira, não pelo parágrafo -- por isso as 2 imagens
// cabem dentro do MESMO Header mesmo a segunda estando fisicamente no rodapé
// da folha (26,61cm), sem precisar de um Footer separado. Coordenadas em EMU
// (1cm = 360000 EMU), idênticas em cm ao que João mediu no Word (canto
// superior esquerdo da página física). Falha de rede num logo nunca derruba
// a geração do .docx inteiro -- aquela imagem simplesmente não entra.
async function fetchImageBuffer(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

const CM = 360000; // EMU por centímetro

async function buildLetterheadHeader(): Promise<Header> {
  const [logo, rodape] = await Promise.all([
    fetchImageBuffer("https://app.v3partners.com.br/contratos/timbrado-logo.jpg"),
    fetchImageBuffer("https://app.v3partners.com.br/contratos/timbrado-rodape.jpg"),
  ]);
  const images: ImageRun[] = [];
  if (logo) {
    images.push(
      new ImageRun({
        data: logo,
        type: "jpg",
        transformation: { width: 4.89 * 96 / 2.54, height: 2.33 * 96 / 2.54 },
        floating: {
          horizontalPosition: { relative: HorizontalPositionRelativeFrom.PAGE, offset: 8.06 * CM },
          verticalPosition: { relative: VerticalPositionRelativeFrom.PAGE, offset: 1.25 * CM },
          // TOP_AND_BOTTOM (achado real 22/09/2026, conferido convertendo o
          // .docx pra PDF via Word e olhando página por página): NONE deixa
          // o texto correr POR CIMA da imagem em vez de desviar -- é isso
          // que causava "V3 PARTNERS" com linha de cláusula atravessada por
          // cima na página 2. Nunca detectável só lendo o XML/texto extraído
          // (conferido em sessão anterior), só abrindo o documento renderizado.
          wrap: { type: TextWrappingType.TOP_AND_BOTTOM },
        },
      }),
    );
  }
  if (rodape) {
    images.push(
      new ImageRun({
        data: rodape,
        type: "jpg",
        transformation: { width: 15.98 * 96 / 2.54, height: 2.01 * 96 / 2.54 },
        floating: {
          horizontalPosition: { relative: HorizontalPositionRelativeFrom.PAGE, offset: 2.85 * CM },
          verticalPosition: { relative: VerticalPositionRelativeFrom.PAGE, offset: 26.61 * CM },
          wrap: { type: TextWrappingType.TOP_AND_BOTTOM },
        },
      }),
    );
  }
  return new Header({ children: [new Paragraph({ children: images })] });
}

// Recebe o `rendered_html` COMPLETO (a mesma string que operation_contracts
// guarda e que htmlToPdfBase64 usa pro caminho PDF de hoje -- fonte única,
// nunca duas versões do texto do contrato podendo divergir). O documento
// completo vem de wrapContractInV3Html(title, body, parties): <div
// class="header"> + corpo real + <div class="parties"> (linha "___" antiga,
// só serve pro PDF) + <div class="footer">. Aqui pulamos .header e .parties
// -- o título vem do <h1> dentro do header, e o bloco de assinatura é
// reconstruído do zero com as tags posicionadas em vez da linha.
export async function renderContractDocx(fullHtml: string, parties?: ContractParty[], contractCode?: string | null): Promise<Buffer> {
  const root = parse(fullHtml);
  const body = root.querySelector("body") ?? root;
  // 21/09/2026 (BRIEF NCNDA): só existe <h1> no .header quando o corpo da minuta
  // NÃO traz o próprio (ver wrapContractInV3Html). Quando o corpo abre com o
  // título jurídico, ele é renderizado por blocksFromRoot() e NENHUM título é
  // injetado aqui, senão o nome interno do modelo (ou um título duplicado)
  // apareceria acima do instrumento no .docx que vai para a assinatura.
  const headerTitleEl = body.querySelector(".header h1");
  const title = headerTitleEl?.text?.trim() || null;

  const contentBlocks: HTMLElement[] = [];
  for (const node of body.childNodes) {
    if (node.nodeType !== NodeType.ELEMENT_NODE) continue;
    const el = node as HTMLElement;
    const cls = el.getAttribute("class") ?? "";
    if (cls.includes("header") || cls.includes("parties") || cls.includes("footer")) continue;
    contentBlocks.push(el);
  }
  // Wrapper temporário só pra reaproveitar blocksFromRoot() com os blocos
  // de conteúdo real já filtrados (sem header/parties/footer).
  const contentRoot = parse(`<div>${contentBlocks.map((b) => b.toString()).join("")}</div>`).querySelector("div")!;

  const children: (Paragraph | Table)[] = [
    ...(title ? [new Paragraph({ text: title, heading: HeadingLevel.HEADING_1, alignment: AlignmentType.CENTER, spacing: { after: 240 } })] : []),
    ...blocksFromRoot(contentRoot),
    ...renderPartiesBlockDocx(parties),
  ];

  // contractCode reservado pra uso futuro (o timbre oficial hoje é só imagem
  // estática, sem texto dinâmico -- ver comentário de buildLetterheadHeader).
  void contractCode;
  const header = await buildLetterheadHeader();

  const doc = new Document({
    // Margens reais de página (achado real 22/09/2026, mesma auditoria do
    // wrap acima): sem isso a seção usava o padrão do Word (~2,54cm), MENOR
    // que o espaço ocupado pela logo (1,25cm a 3,58cm do topo) e pelo rodapé
    // (26,61cm a 28,62cm, página A4 = 29,7cm) -- corpo do texto nascia raso
    // o bastante pra entrar na área das duas imagens em toda página sem
    // título grande acima (a primeira página escapava por ter o <h1> e o
    // "1.1 PARTES" ocupando a folga).
    //
    // Valores exatos (23/09/2026, achado de João): extraídos byte a byte do
    // <w:pgMar> de um .docx de referência real (mandato Phocus, papel
    // timbrado da mesma logo/rodapé) que João confirmou sem sobreposição
    // nenhuma -- não são um cálculo teórico daqui, são a configuração já
    // validada visualmente pela V3. As posições das duas imagens (8,06cm/
    // 1,25cm e 2,85cm/26,61cm, ver buildLetterheadHeader acima) já batiam
    // exatamente com esse mesmo arquivo antes desta mudança; só a margem
    // estava divergente. Valores em twips (1cm ≈ 566,93 twips): top 2020
    // (3,56cm), right 708 (1,25cm), bottom 1760 (3,10cm), left 425 (0,75cm),
    // header 709 (1,25cm), footer 1573 (2,77cm) -- os dois últimos são a
    // distância do topo/base física da página até a área de cabeçalho/
    // rodapé, mesmo conceito que os rótulos "1,3cm"/"2,78cm" que João usa
    // pra descrever essa mesma configuração no Word.
    sections: [{
      headers: { default: header },
      properties: {
        page: {
          // Tamanho travado explicitamente em A4 (23/09/2026, pedido de
          // João) -- mesmos w:w/w:h do <w:pgSz> do arquivo de referência
          // (11910×16840 twips ≈ 21,0×29,7cm), em vez de depender do padrão
          // da lib docx (que já é A4 hoje, mas sem garantia contra mudança
          // futura da dependência).
          size: { width: 11910, height: 16840 },
          margin: { top: 2020, right: 708, bottom: 1760, left: 425, header: 709, footer: 1573, gutter: 0 },
        },
      },
      children,
    }],
    styles: {
      default: {
        // Fonte Arial + 12pt (23/09/2026, 2ª calibração, byte a byte contra
        // V3C-NDA-2026-0039 revisado pelo Dr. Athaydes): antes Calibri/22
        // (11pt), nunca validado contra padrão real do jurídico. Isto aqui é
        // só o FALLBACK do documento -- o corpo real já leva font/size
        // explícitos em cada run (textRunsFromInline), porque o processamento
        // de Modelo do ClickSign reseta justamente este default, ver
        // BODY_FONT/BODY_SIZE acima.
        document: { run: { font: BODY_FONT, size: BODY_SIZE, color: CREAM } },
        heading1: { run: { font: BODY_FONT, size: 32, bold: true, color: GOLD } },
        heading2: { run: { font: BODY_FONT, size: 26, bold: true, color: GOLD } },
        heading3: { run: { font: BODY_FONT, size: 24, bold: true, color: GOLD } },
      },
    },
  });

  return Packer.toBuffer(doc);
}
