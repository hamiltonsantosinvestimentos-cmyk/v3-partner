// Topo e rodapé dos PDFs dos simuladores para o Enterprise (BRIEF 2026-11-23 identidade fase 1).
// Decisão do Hamilton (23/11): logo e dados do Enterprise em cima; no fim, em letra pequena,
// "Simulação técnica fornecida pela V3 Partners." — a única menção à V3. Tudo escapado antes do HTML.
import { escapeHtml } from "@/lib/html-escape";
import { linhaJuridica, type IdentidadeEnterprise } from "@/lib/enterprise-identidade";

export const LINHA_TECNICA_V3 = "Simulação técnica fornecida pela V3 Partners.";

/** CSS das peças do Enterprise (entra no <style> do documento). */
export const CSS_IDENTIDADE =
  ".wl-head{display:flex;align-items:center;gap:14px;padding-bottom:14px;margin-bottom:18px;border-bottom:1px solid #ece8e0}" +
  ".wl-head img{max-height:48px;max-width:190px;object-fit:contain}.wl-nome{font-size:18px;font-weight:800;color:#09081a}" +
  ".wl-dados{font-size:10px;color:#555;line-height:1.5}.wl-tec{margin-top:14px;font-size:8px;color:#9a9a9a;text-align:center}";

/** Título da aba/arquivo: "Simulação {linha} · {marca}". */
export function tituloSimulacao(linha: string, id: IdentidadeEnterprise): string {
  return escapeHtml(`Simulação ${linha} · ${id.nome}`);
}

/** Topo: logo para fundo claro (o PDF é branco) ou o nome em texto, com razão social, CNPJ e site. */
export function cabecalhoEnterprise(id: IdentidadeEnterprise): string {
  const logo = id.logoClaroUrl
    ? `<img src="${escapeHtml(id.logoClaroUrl)}" alt="${escapeHtml(id.nome)}">`
    : `<div class="wl-nome">${escapeHtml(id.nome)}</div>`;
  const dados = [id.razaoSocial, id.cnpj ? `CNPJ ${id.cnpj}` : null, id.site].filter(Boolean).map((v) => escapeHtml(v as string));
  return `<div class="wl-head">${logo}${dados.length ? `<div class="wl-dados">${dados.join("<br>")}</div>` : ""}</div>`;
}

/** Primeira linha do rodapé: dados do Enterprise e "gerada pela plataforma {marca}". */
export function rodapeEnterprise(id: IdentidadeEnterprise): string {
  return `${escapeHtml(linhaJuridica(id))}<br>Esta simulação foi gerada pela plataforma ${escapeHtml(id.nome)}.`;
}

/** Linha final, em letra pequena. */
export function linhaTecnicaV3(): string {
  return `<p class="wl-tec">${LINHA_TECNICA_V3}</p>`;
}
