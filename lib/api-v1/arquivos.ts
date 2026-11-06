// Envio de documentos pela API: identificador de envio assinado, tipo real pelos bytes e
// recusa de PDF com senha ou com JavaScript embutido (BRIEF 2026-11-06).
import { createHmac, timingSafeEqual } from "node:crypto";

export const MAX_BYTES = 25 * 1024 * 1024;
export const VALIDADE_UPLOAD_MS = 2 * 3600_000;
export const BUCKET = "credit-documents";

export const EXTENSOES: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  doc: "application/msword",
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

function segredo(): string {
  const s = process.env.API_V1_UPLOAD_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!s) throw new Error("Segredo de assinatura do envio ausente");
  return s;
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
