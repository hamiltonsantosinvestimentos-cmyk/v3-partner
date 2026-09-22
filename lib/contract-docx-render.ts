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
} from "docx";
import { signatureRoleLabel, type ContractParty } from "./contract-render";

const GOLD = "C9A84C";
const CREAM = "1A1A1A"; // corpo do .docx é sempre texto escuro sobre fundo branco -- documento pra assinatura, nunca segue a paleta navy/ouro de tela (regra de identidade visual V3 é pra peça de marca, não pra instrumento jurídico que o signatário assina)

function textRunsFromInline(node: Node, bold = false): TextRun[] {
  if (node.nodeType === NodeType.TEXT_NODE) {
    const text = node.rawText.replace(/\s+/g, " ");
    if (!text.trim()) return [];
    return [new TextRun({ text, bold, color: CREAM })];
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
  const base: ConstructorParameters<typeof Paragraph>[0] = { children: runs.length ? runs : [new TextRun("")], spacing: { after: 160 } };
  if (tag === "h1") return new Paragraph({ ...base, heading: HeadingLevel.HEADING_1, alignment: AlignmentType.CENTER });
  if (tag === "h2") return new Paragraph({ ...base, heading: HeadingLevel.HEADING_2 });
  if (tag === "h3") return new Paragraph({ ...base, heading: HeadingLevel.HEADING_3 });
  return new Paragraph(base);
}

function listItemParagraph(el: HTMLElement, ordered: boolean, index: number): Paragraph {
  const runs = textRunsFromInline(el);
  const bullet = ordered ? `${index}. ` : "• ";
  return new Paragraph({
    children: [new TextRun({ text: bullet, color: CREAM }), ...runs],
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
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 20 }, children: [new TextRun({ text: p.name.toUpperCase(), bold: true, color: CREAM })] })
    );
    if (p.doc) {
      out.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: p.doc, color: CREAM, size: 18 })] }));
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
    out.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 40 }, children: [new TextRun({ text: (p.display_label ?? signatureRoleLabel(p.role)).toUpperCase(), color: GOLD, size: 16, bold: true })] }));
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
          wrap: { type: TextWrappingType.NONE },
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
          wrap: { type: TextWrappingType.NONE },
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
    sections: [{ headers: { default: header }, children }],
    styles: {
      default: {
        document: { run: { font: "Calibri", size: 22, color: CREAM } },
        heading1: { run: { font: "Calibri", size: 32, bold: true, color: GOLD } },
        heading2: { run: { font: "Calibri", size: 26, bold: true, color: GOLD } },
        heading3: { run: { font: "Calibri", size: 24, bold: true, color: GOLD } },
      },
    },
  });

  return Packer.toBuffer(doc);
}
