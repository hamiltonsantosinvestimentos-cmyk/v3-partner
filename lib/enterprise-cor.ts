/**
 * Cor da tarja do Enterprise nas mesas da V3 (BRIEF docs/briefs/2026-11-21_tarja-enterprise-nas-mesas-v3.md).
 * Módulo puro (usável no navegador). Sem tema: Navy Médio da V3 com texto Cream.
 */
import { contraste } from "@/lib/enterprise-tema";

export const TARJA_NEUTRA = "#243A66"; // Navy Médio (paleta V3)
const CREAM = "#F0ECE4";
const NAVY = "#09081A";

export interface CorTarja { cor: string; corTexto: string; corFaixa: string }

/**
 * Faixa sempre na cor do Enterprise (ou neutra). O selo usa a cor do Enterprise com texto Cream ou
 * Navy, o de maior contraste; se nenhum chega a 4,5:1, o selo cai no Navy Médio com Cream (a cor do
 * cliente fica só na faixa fina, sem texto sobre ela).
 */
export function corDaTarja(corPrincipal: string | null | undefined): CorTarja {
  if (!corPrincipal || !/^#[0-9a-fA-F]{6}$/.test(corPrincipal)) return { cor: TARJA_NEUTRA, corTexto: CREAM, corFaixa: TARJA_NEUTRA };
  const cCream = contraste(CREAM, corPrincipal);
  const cNavy = contraste(NAVY, corPrincipal);
  const melhor = cCream >= cNavy ? { texto: CREAM, razao: cCream } : { texto: NAVY, razao: cNavy };
  if (melhor.razao < 4.5) return { cor: TARJA_NEUTRA, corTexto: CREAM, corFaixa: corPrincipal.toUpperCase() };
  return { cor: corPrincipal.toUpperCase(), corTexto: melhor.texto, corFaixa: corPrincipal.toUpperCase() };
}
