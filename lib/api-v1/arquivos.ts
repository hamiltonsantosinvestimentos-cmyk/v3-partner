// Envio de documentos pela API: identificador de envio assinado, tipo real pelos bytes e
// recusa de PDF com senha ou com JavaScript embutido (BRIEF 2026-11-06).
import { createHmac, timingSafeEqual } from "node:crypto";
import { PDFArray, PDFDict, PDFDocument, PDFName, PDFStream, type PDFObject } from "pdf-lib";

export const MAX_BYTES = 25 * 1024 * 1024;
export const VALIDADE_UPLOAD_MS = 2 * 3600_000;
export const BUCKET = "credit-documents";
export const MAX_PENDENTES = 50;

export const EXTENSOES: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  // .doc (formato antigo) não é aceito: pode trazer macro (BRIEF ajustes de segurança, 06/11/2026).
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

export function tipoPelaExtensao(nome: string): string | null {
  const ext = nome.split(".").pop()?.toLowerCase() ?? "";
  return EXTENSOES[ext] ?? null;
}

export function nomeSeguro(nome: string): string {
  return nome.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9._-]/g, "_").replace(/_{2,}/g, "_").slice(0, 80);
}

/** Tipo real do arquivo pelos primeiros bytes. */
export function tipoPelosBytes(b: Uint8Array): string | null {
  const s = (i: number, ...v: number[]) => v.every((x, j) => b[i + j] === x);
  if (s(0, 0x25, 0x50, 0x44, 0x46, 0x2d)) return "application/pdf";
  if (s(0, 0xff, 0xd8, 0xff)) return "image/jpeg";
  if (s(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "image/png";
  if (s(0, 0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1)) return "application/msword";
  if (s(0, 0x50, 0x4b, 0x03, 0x04)) {
    // DOCX é um zip com a pasta word/.
    const txt = Buffer.from(b.subarray(0, Math.min(b.length, 64 * 1024))).toString("latin1");
    return txt.includes("word/") ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" : null;
  }
  return null;
}

/** Tipos equivalentes (jpg e jpeg). */
export function mesmoTipo(a: string | null, b: string | null): boolean {
  const n = (x: string | null) => (x === "image/jpg" ? "image/jpeg" : x);
  return !!a && n(a) === n(b);
}

/** Problema de segurança no PDF (senha ou script), ou null. */
export function problemaNoPdf(b: Uint8Array): string | null {
  const txt = Buffer.from(b).toString("latin1");
  if (/\/Encrypt\b/.test(txt)) return "PDF protegido por senha não é aceito.";
  if (/\/JavaScript\b|\/JS\s*[(<]|\/Launch\b/.test(txt)) return "PDF com script embutido não é aceito.";
  return null;
}

// Segredo próprio e obrigatório (BRIEF ajustes de segurança): sem ele, nenhum envio é assinado nem aceito.
function segredo(): string {
  const s = process.env.API_V1_UPLOAD_SECRET;
  if (!s || s.length < 32) throw new Error("API_V1_UPLOAD_SECRET ausente ou curto demais");
  return s;
}

const CHAVES_PERIGOSAS = new Set(["JS", "JavaScript", "Launch", "EmbeddedFile", "EmbeddedFiles", "RichMedia", "XFA", "AA", "SubmitForm", "ImportData", "GoToR", "GoToE"]);
const ACOES_PERIGOSAS = new Set(["JavaScript", "Launch", "SubmitForm", "ImportData", "GoToR", "GoToE", "Rendition", "RichMediaExecute"]);
// "URI" (link comum, presente em extratos e boletos) não entra: recusaria documento legítimo demais.

/**
 * Abre o PDF (inclusive partes compactadas) e procura script, anexo, formulário XFA, ação
 * automática ou ação externa. Devolve o motivo da recusa, ou null se o PDF está limpo.
 * PDF que não abre é recusado: nunca aceito sem análise.
 */
export async function analisarPdf(b: Uint8Array): Promise<string | null> {
  const rapido = problemaNoPdf(b);
  if (rapido) return rapido;
  let doc: PDFDocument;
  try {
    doc = await PDFDocument.load(b, { updateMetadata: false });
  } catch (e) {
    return /encrypt/i.test(String(e)) ? "PDF protegido por senha não é aceito." : "Não foi possível analisar o PDF. Gere o arquivo de novo (por exemplo, imprimindo como PDF).";
  }
  if (doc.isEncrypted) return "PDF protegido por senha não é aceito.";
  // O pdf-lib é tolerante: arquivo sem estrutura abre como documento vazio. PDF sem página é recusado.
  let paginas = 0;
  try { paginas = doc.getPageCount(); } catch { paginas = 0; }
  if (paginas < 1) return "Não foi possível analisar o PDF. Gere o arquivo de novo (por exemplo, imprimindo como PDF).";

  let achado: string | null = null;
  const vistos = new Set<PDFObject>();
  const visitar = (o: PDFObject | undefined, nivel: number): void => {
    if (!o || achado || nivel > 40 || vistos.has(o)) return;
    vistos.add(o);
    const dict = o instanceof PDFDict ? o : o instanceof PDFStream ? o.dict : null;
    if (dict) {
      for (const [k, v] of dict.entries()) {
        const nome = k.asString().slice(1);
        if (CHAVES_PERIGOSAS.has(nome)) { achado = `/${nome}`; return; }
        if (nome === "S" && v instanceof PDFName && ACOES_PERIGOSAS.has(v.asString().slice(1))) { achado = `ação ${v.asString()}`; return; }
        if (nome === "OpenAction" && v instanceof PDFDict) {
          const s = v.get(PDFName.of("S"));
          if (!(s instanceof PDFName) || s.asString() !== "/GoTo") { achado = "/OpenAction"; return; }
        }
        visitar(v, nivel + 1);
      }
      return;
    }
    if (o instanceof PDFArray) for (const item of o.asArray()) visitar(item, nivel + 1);
  };
  for (const [, obj] of doc.context.enumerateIndirectObjects()) {
    visitar(obj, 0);
    if (achado) break;
  }
  return achado ? `PDF com conteúdo ativo não é aceito (${achado}). Gere o arquivo de novo imprimindo como PDF.` : null;
}

/** DOCX com macro (vbaProject.bin) é recusado. */
export function docxComMacro(b: Uint8Array): boolean {
  const txt = Buffer.from(b).toString("latin1");
  return /vbaProject\.bin|vbaData\.xml|macroEnabled/i.test(txt);
}

/** Análise completa por tipo real. Devolve o motivo da recusa, ou null. */
export async function analisarArquivo(b: Uint8Array, tipoReal: string): Promise<string | null> {
  if (tipoReal === "application/pdf") return analisarPdf(b);
  if (tipoReal === "application/msword") return "Arquivo .doc não é aceito. Envie PDF ou DOCX sem macro.";
  if (tipoReal === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" && docxComMacro(b)) return "DOCX com macro não é aceito.";
  return null;
}

export type DadosUpload = { p: string; k: string; d: string; n: string; c: string; path: string; t: number; exp: number };

/** upload_id = dados em base64url + "." + HMAC. O servidor não guarda estado entre os dois passos. */
export function assinarUpload(dados: DadosUpload): string {
  const corpo = Buffer.from(JSON.stringify(dados)).toString("base64url");
  const mac = createHmac("sha256", segredo()).update(corpo).digest("base64url");
  return `up_${corpo}.${mac}`;
}

export function lerUpload(uploadId: string, agora = Date.now()): DadosUpload | null {
  if (typeof uploadId !== "string" || !uploadId.startsWith("up_")) return null;
  const [corpo, mac] = uploadId.slice(3).split(".");
  if (!corpo || !mac) return null;
  const esperado = createHmac("sha256", segredo()).update(corpo).digest("base64url");
  const a = Buffer.from(mac), b = Buffer.from(esperado);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const d = JSON.parse(Buffer.from(corpo, "base64url").toString("utf8")) as DadosUpload;
    // Confirmação aceita até 24 horas depois de pedir o link (o link em si vale 2 horas).
    if (typeof d.exp !== "number" || agora > d.exp + 22 * 3600_000) return null;
    return d;
  } catch {
    return null;
  }
}
