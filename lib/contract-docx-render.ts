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
} from "docx";
import type { ContractParty } from "./contract-render";

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
        // rubricate/manuscript com o mesmo rubric_field. Confirmado ao vivo
        // nesta sessão (Modelo criado, Documento a partir do Modelo,
        // Requisito aceito com o campo ecoado de volta).
        children: [new TextRun({ text: `{{~position_sign_${i + 1}}}`, color: "FFFFFF", size: 2 })],
      }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 20 }, children: [new TextRun({ text: p.name, bold: true, color: CREAM })] })
    );
    if (p.doc) {
      out.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: p.doc, color: CREAM, size: 18 })] }));
    }
  });
  return out;
}

// Recebe o `rendered_html` COMPLETO (a mesma string que operation_contracts
// guarda e que htmlToPdfBase64 usa pro caminho PDF de hoje -- fonte única,
// nunca duas versões do texto do contrato podendo divergir). O documento
// completo vem de wrapContractInV3Html(title, body, parties): <div
// class="header"> + corpo real + <div class="parties"> (linha "___" antiga,
// só serve pro PDF) + <div class="footer">. Aqui pulamos .header e .parties
// -- o título vem do <h1> dentro do header, e o bloco de assinatura é
// reconstruído do zero com as tags posicionadas em vez da linha.
export async function renderContractDocx(fullHtml: string, parties?: ContractParty[]): Promise<Buffer> {
  const root = parse(fullHtml);
  const body = root.querySelector("body") ?? root;
  const titleEl = body.querySelector(".header h1") ?? root.querySelector("h1");
  const title = titleEl?.text?.trim() || "Contrato V3 Partners";

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
    new Paragraph({ text: title, heading: HeadingLevel.HEADING_1, alignment: AlignmentType.CENTER, spacing: { after: 240 } }),
    ...blocksFromRoot(contentRoot),
    ...renderPartiesBlockDocx(parties),
  ];

  const doc = new Document({
    sections: [{ children }],
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
