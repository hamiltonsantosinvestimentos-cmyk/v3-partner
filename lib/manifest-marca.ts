// App instalado (PWA) com a marca do Enterprise no domínio dele: regras puras e testáveis.
// BRIEF docs/briefs/2026-11-26_app-instalado-marca-enterprise.md
import { createHash } from "node:crypto";

export const TAMANHOS = ["180", "192", "512", "512m"] as const;
export type TamanhoIcone = (typeof TAMANHOS)[number];
export const URL_RESOLUCAO = "/api/public/app-icone?t=512";
export const COR_PRINCIPAL_PADRAO = "#09081A";
export const COR_ACENTO_PADRAO = "#C9A84C";

export function corSegura(c: unknown, padrao: string): string {
  return typeof c === "string" && /^#[0-9a-fA-F]{6}$/.test(c) ? c.toUpperCase() : padrao;
}

export function nomeSeguro(nome: unknown): string {
  const n = String(nome ?? "").replace(/[<>"]/g, "").replace(/\s+/g, " ").trim().slice(0, 45).trim();
  return n || "Plataforma";
}

/** Até 12 caracteres, cortando na última palavra inteira (palavra única longa é cortada). */
export function shortName(nome: string): string {
  if (nome.length <= 12) return nome;
  const palavras = nome.split(" ");
  let out = "";
  for (const p of palavras) {
    const prox = out ? `${out} ${p}` : p;
    if (prox.length > 12) break;
    out = prox;
  }
  return out || nome.slice(0, 12);
}

export function versaoMarca(o: { iconeUrl: string | null; corPrincipal: string; corAcento: string; nome: string }): string {
  return createHash("sha256").update(`${o.iconeUrl ?? ""}|${o.corPrincipal}|${o.corAcento}|${o.nome}`).digest("hex").slice(0, 8);
}

export function urlIcone(t: TamanhoIcone, v: string): string {
  return `/api/public/app-icone?t=${t}&v=${v}`;
}

export type FormaIcone =
  | { estado: "canonica"; t: TamanhoIcone; v: string }
  | { estado: "resolucao" }
  | { estado: "invalida"; redirect: typeof URL_RESOLUCAO };

/**
 * canônica: chaves exatamente {t, v}, cada uma 1 vez, t em TAMANHOS e v com 8 hex.
 * resolução: exatamente ?t=512 (destino terminal, consulta a versão atual).
 * inválida: todo o resto vai para a resolução, sem banco. Nota: ?t=192 sem v vira 512 depois
 * da resolução; só URLs montadas fora do sistema caem aí.
 */
export function formaCanonicaIcone(q: URLSearchParams): FormaIcone {
  const chaves = [...q.keys()];
  const invalida = { estado: "invalida", redirect: URL_RESOLUCAO } as const;
  if (chaves.length === 1 && chaves[0] === "t" && q.get("t") === "512") return { estado: "resolucao" };
  if (chaves.length !== 2 || q.getAll("t").length !== 1 || q.getAll("v").length !== 1) return invalida;
  const t = q.get("t") ?? "";
  const v = q.get("v") ?? "";
  if (!(TAMANHOS as readonly string[]).includes(t) || !/^[0-9a-f]{8}$/.test(v)) return invalida;
  return { estado: "canonica", t: t as TamanhoIcone, v };
}

export function manifestoV3() {
  return {
    name: "V3 PARTNERS — Plataforma Financeira",
    short_name: "V3 Partners",
    description: "Plataforma de gestão para parceiros e operações financeiras",
    start_url: "/",
    display: "standalone",
    background_color: "#09081A",
    theme_color: "#C9A84C",
    orientation: "portrait-primary",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any maskable" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
    ],
  };
}

export function manifestoDaMarca(m: { nome: string; corPrincipal: string; versao: string }) {
  return {
    id: "/",
    name: m.nome,
    short_name: shortName(m.nome),
    description: `Plataforma ${m.nome}`,
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: m.corPrincipal,
    theme_color: m.corPrincipal,
    icons: [
      { src: urlIcone("192", m.versao), sizes: "192x192", type: "image/png", purpose: "any" },
      { src: urlIcone("512", m.versao), sizes: "512x512", type: "image/png", purpose: "any" },
      { src: urlIcone("512m", m.versao), sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
