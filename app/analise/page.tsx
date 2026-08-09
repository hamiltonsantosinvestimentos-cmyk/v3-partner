import { redirect } from "next/navigation";

/**
 * Teste A/B da página de venda direta da Análise de Crédito encerrado em
 * 03/08/2026: a página escolhida foi a B (metáfora da bússola), em /analise-v2.
 *
 * Esta rota NÃO foi apagada de propósito. Partners já compartilharam links
 * apontando para cá, e apagar quebraria a atribuição de comissão deles. O
 * redirect preserva a query string inteira, então `?ref=` e as UTMs continuam
 * chegando em /analise-v2 e sendo gravadas normalmente.
 *
 * Atenção: o checkout compartilhado vive em /analise/checkout, que é rota filha
 * e NÃO é afetada por este redirect. Nunca transformar isto num redirect de
 * prefixo, sob risco de derrubar o checkout das duas páginas.
 */

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AnaliseRedirectPage({ searchParams }: Props) {
  const params = await searchParams;

  const qs = new URLSearchParams();
  for (const [chave, valor] of Object.entries(params)) {
    if (valor === undefined) continue;
    if (Array.isArray(valor)) valor.forEach((v) => qs.append(chave, v));
    else qs.append(chave, valor);
  }

  const query = qs.toString();
  redirect(query ? `/analise-v2?${query}` : "/analise-v2");
}
