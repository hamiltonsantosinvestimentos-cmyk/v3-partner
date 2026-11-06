// Chaves da API de Propostas (BRIEF 2026-11-06). A chave só existe em texto no momento da
// criação; o banco guarda o hash SHA-256 e um prefixo para o partner reconhecer a chave.
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { BlockList, isIP } from "node:net";

export const PREFIXO_CHAVE = "v3_live_";
export const PLANOS_COM_API = ["PARTNER_PRO", "GOLD", "DIAMANTE", "ENTERPRISE"] as const;
export const ESCOPOS = ["propostas:criar", "propostas:ler"] as const;
export type Escopo = (typeof ESCOPOS)[number];

export const VALIDADE_DIAS = 365;
export const MAX_IPS = 10;
export const TENTATIVAS_ANTES_DO_BLOQUEIO = 10;
export const JANELA_TENTATIVAS_MS = 10 * 60_000;
export const BLOQUEIO_MS = 60 * 60_000;
export const CODIGO_VALIDADE_MS = 10 * 60_000;
export const CODIGO_MAX_TENTATIVAS = 5;

const ALFABETO = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

/** Gera a chave em texto (mostrada uma vez), o prefixo visível e o hash que vai ao banco. */
export function gerarChave(): { chave: string; prefixo: string; hash: string } {
  const bytes = randomBytes(40);
  let corpo = "";
  for (const b of bytes) corpo += ALFABETO[b % ALFABETO.length];
  const chave = PREFIXO_CHAVE + corpo;
  return { chave, prefixo: chave.slice(0, PREFIXO_CHAVE.length + 4), hash: hashChave(chave) };
}

export function hashChave(chave: string): string {
  return createHash("sha256").update(chave, "utf8").digest("hex");
}

export function hashIgual(a: string, b: string): boolean {
  const ba = Buffer.from(a, "hex"), bb = Buffer.from(b, "hex");
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

/** Lê "Authorization: Bearer v3_live_..." e devolve a chave ou null se o formato não bate. */
export function lerBearer(header: string | null): string | null {
  if (!header) return null;
  const m = /^Bearer\s+(\S+)$/i.exec(header.trim());
  if (!m) return null;
  const chave = m[1];
  if (!chave.startsWith(PREFIXO_CHAVE) || chave.length < PREFIXO_CHAVE.length + 20 || chave.length > 120) return null;
  return chave;
}

/** IPv4-mapeado em IPv6 (::ffff:1.2.3.4) vira 1.2.3.4. */
export function normalizarIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  const t = ip.trim().replace(/^::ffff:/i, "");
  return isIP(t) ? t : null;
}

/** Valida e normaliza uma entrada de IP ou faixa (CIDR). Devolve null se inválida. */
export function normalizarFaixa(entrada: string): string | null {
  const t = entrada.trim();
  const [ip, bits] = t.split("/");
  const tipo = isIP(ip);
  if (!tipo) return null;
  const max = tipo === 4 ? 32 : 128;
  if (bits === undefined) return `${ip}/${max}`;
  if (!/^\d{1,3}$/.test(bits)) return null;
  const n = Number(bits);
  // Faixas muito largas anulam a proteção: exige ao menos /16 (IPv4) e /48 (IPv6).
  const minimo = tipo === 4 ? 16 : 48;
  if (n < minimo || n > max) return null;
  return `${ip}/${n}`;
}

export function ipPermitido(ip: string | null | undefined, faixas: string[]): boolean {
  const alvo = normalizarIp(ip);
  if (!alvo) return false;
  const lista = new BlockList();
  for (const f of faixas) {
    const [rede, bits] = String(f).split("/");
    const tipo = isIP(rede);
    if (!tipo) continue;
    lista.addSubnet(rede, Number(bits ?? (tipo === 4 ? 32 : 128)), tipo === 4 ? "ipv4" : "ipv6");
  }
  return lista.check(alvo, isIP(alvo) === 4 ? "ipv4" : "ipv6");
}

export function planoTemApi(role: string | null | undefined): boolean {
  return (PLANOS_COM_API as readonly string[]).includes(role ?? "");
}

/** Código de 6 dígitos para confirmar a criação da chave por e-mail. */
export function gerarCodigoEmail(): { codigo: string; hash: string } {
  const n = randomBytes(4).readUInt32BE(0) % 1_000_000;
  const codigo = String(n).padStart(6, "0");
  return { codigo, hash: hashChave(`codigo:${codigo}`) };
}

export function hashCodigo(codigo: string): string {
  return hashChave(`codigo:${codigo.trim()}`);
}

export function hashTexto(texto: string): string {
  return createHash("sha256").update(texto, "utf8").digest("hex");
}

/** Termo com lacunas ("[...]") não pode ser publicado nem aceito. */
export function termoTemLacuna(texto: string): boolean {
  return /\[[^\]]*\]/.test(texto.replace(/^\[ \]/gm, ""));
}

export type SituacaoChave = "ativa" | "vencida" | "revogada";
export function situacaoDaChave(k: { revogada_em: string | null; expira_em: string }, agora = Date.now()): SituacaoChave {
  if (k.revogada_em) return "revogada";
  if (new Date(k.expira_em).getTime() <= agora) return "vencida";
  return "ativa";
}

/** Ordem da tela do partner: ativas, depois vencidas, depois revogadas; dentro do grupo, a mais recente primeiro. */
export function ordenarChaves<T extends { revogada_em: string | null; expira_em: string; created_at: string }>(lista: T[], agora = Date.now()): T[] {
  const peso: Record<SituacaoChave, number> = { ativa: 0, vencida: 1, revogada: 2 };
  return [...lista].sort((a, b) =>
    peso[situacaoDaChave(a, agora)] - peso[situacaoDaChave(b, agora)] ||
    b.created_at.localeCompare(a.created_at));
}
