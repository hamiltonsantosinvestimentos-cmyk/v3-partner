/**
 * Remove menções a spread/margem/lucro da V3 de textos que alimentam prompts de
 * IA para deals do tipo "matching" (compra + revenda com spread), sem apagar o
 * restante do conteúdo. Cobre 3 formatos observados nos dados reais:
 * - texto contínuo sem quebra de linha, com trecho "Spread...14,05%" embutido
 *   no meio de uma tabela colada (ex: ma_deals.notes)
 * - campos compostos separados por "|" (ex: breakdown_receita do FORJA)
 * - texto com quebras de linha normais, uma métrica por linha
 */
export function redactMarginText(text: string): string {
  return text
    // trechos "Spread ... %" ou "Margem ... %" embutidos em texto contínuo
    .replace(/Spread[^%]{0,60}%/gi, "")
    .replace(/Margem[^%]{0,60}%/gi, "")
    // segmentos separados por "|" mencionando spread/intermediação
    .split("\n")
    .map(line =>
      line.includes("|")
        ? line.split("|").filter(seg => !/spread|intermedia/i.test(seg)).join("|")
        : line
    )
    // linhas inteiras que ainda mencionem spread/margem da V3/intermediação
    .filter(line => !/spread|margem.{0,20}(v3|intermedia)/i.test(line))
    .join("\n")
    .trim();
}
