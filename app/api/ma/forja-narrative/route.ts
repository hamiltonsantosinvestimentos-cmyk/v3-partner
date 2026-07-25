import { NextRequest, NextResponse } from "next/server";
import { auditText } from "@/lib/brand-guardian-gate";
import { redactMarginText } from "@/lib/matching-redaction";

export const maxDuration = 300;

/**
 * POST /api/ma/forja-narrative
 *
 * Fase 2 do FORJA: gera narrative_pt, narrative_en e tese_investimento
 * a partir dos campos validated do deal já processado.
 * Chamada pelo ForjaPanel após forja-validate retornar (two-phase approach).
 *
 * Body: {
 *   deal: { sector, location, deal_value, notes },
 *   validated: ValidatedField[],
 *   missing: MissingField[],
 *   recommendation: string,
 *   score: number
 * }
 */
export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY não configurada" }, { status: 500 });
  }

  const body = await req.json() as {
    deal: {
      sector?: string; location?: string; deal_value?: number; notes?: string;
      contexto_forja?: string; code?: string; tipo_operacao_v3?: string;
      tem_pendencias?: boolean; referencia_mercado?: string; [key: string]: unknown;
    };
    validated: { field: string; value: string; note?: string }[];
    missing:   { field: string; impact: string; priority: string }[];
    recommendation: string;
    score: number;
  };

  const { deal, validated = [], missing = [], recommendation, score } = body;
  const isMatching = deal.tipo_operacao_v3 === "matching";

  // Resumo compacto dos campos validados para a narrativa
  const validatedSummaryRaw = validated
    .slice(0, 12)
    .map(v => `${v.field}: ${v.value}`)
    .join("\n");
  const validatedSummary = isMatching ? redactMarginText(validatedSummaryRaw) : validatedSummaryRaw;

  const missingSummary = missing
    .filter(m => m.priority === "ALTA")
    .slice(0, 5)
    .map(m => `- ${m.field}: ${m.impact}`)
    .join("\n");

  const contextoBloco = deal.contexto_forja?.trim()
    ? deal.contexto_forja
    : deal.notes?.trim()
    ? deal.notes
    : "";
  const contextoFinal = isMatching ? redactMarginText(contextoBloco) : contextoBloco;

  const matchingRules = isMatching
    ? `\n\nATENÇÃO: esta é uma operação de MATCHING, não uma aquisição de empresa operacional. ` +
      `É uma TRANSAÇÃO ÚNICA DE COMPRA E REVENDA DE UM LOTE DE ATIVOS FÍSICOS (ex: embarcações, insumos, commodities). ` +
      `A V3 estrutura a aquisição junto a um vendedor e a colocação junto a um comprador. Não existe negócio em andamento, não existe receita recorrente, não existe portfólio a ser gerido. ` +
      `PROIBIDO qualquer linguagem de tese de M&A corporativo ou private equity: nada de "modelo de negócio", "fluxos de receita", "escalabilidade", "asset-light", "pilares de geração de valor", "exit scenario", "holding period", "consolidação em plataforma", "reposicionamento de ativos", "vendedor secundário". ` +
      `O histórico/ano de fundação do VENDEDOR (contraparte que originou o lote) não é o histórico da transação em si, não use como se fosse track record do ativo ou garantia de qualidade da operação. ` +
      `Trate o percentual informado como ESTRUTURA DE CUSTO de uma transação única, nunca como linhas de receita de um negócio. ` +
      `PROIBIDO usar as palavras "intermediação" ou "intermediário" em qualquer forma, use sempre "estruturação"/"estrutura"/"estruturar". ` +
      `PROIBIDO mencionar qualquer percentual ou valor de margem, spread ou lucro da V3 no texto. ` +
      `Se o preço for cotado por unidade de peso/volume (ex: R$/kg), NUNCA trate como múltiplo de valuation ou EV/EBITDA, é preço de mercado do insumo, não métrica de M&A corporativo. ` +
      `Foque a tese em: especificidade do lote (o que é, volume, origem, destino), verificação documental do ativo, e execução logística/operacional da estruturação, não em "oportunidade de investimento em negócio".` +
      (deal.referencia_mercado?.trim()
        ? ` Use a referência de mercado internacional fornecida no contexto em pelo menos um bullet da tese, comparando o preço da operação com a referência, usando exatamente os valores fornecidos, sem recalcular nem converter câmbio por conta própria.`
        : "") +
      (deal.tem_pendencias === true
        ? `\nATENÇÃO: o vendedor tem pendências jurídicas declaradas e ainda não detalhadas. NUNCA afirme "ausência de contingências" ou "zero risco judicial". Trate como item aberto de due diligence.`
        : "")
    : "";

  const prompt =
    `Você é estrategista M&A da V3 Partners. Com base nos dados validados abaixo, gere narrativa comercial cega e tese de investimento.\n\n` +
    `Setor: ${deal.sector ?? "não informado"}\n` +
    `Região: ${deal.location ?? "não informada"}\n` +
    `Valor: R$ ${deal.deal_value ? (Number(deal.deal_value)/1e6).toFixed(1) + "M" : "não informado"}\n` +
    `Score FORJA: ${score}/100 · ${recommendation}\n\n` +
    `Dados validados:\n${validatedSummary}\n\n` +
    (missingSummary ? `Itens ausentes (ALTA prioridade):\n${missingSummary}\n\n` : "") +
    (contextoFinal ? `Contexto:\n${contextoFinal}\n\n` : "") +
    (deal.referencia_mercado?.trim() ? `Referência de mercado (dado real, use os números exatamente como estão, nunca recalcule):\n${deal.referencia_mercado}\n\n` : "") +
    `Retorne APENAS JSON válido, sem markdown:\n` +
    `{\n` +
    `  "tese_investimento": [\n` +
    `    "<bullet 1, verbo forte: Adquira/Acesse/Capture/Consolide/Aproveite>",\n` +
    `    "<bullet 2>", "<bullet 3>", "<bullet 4>", "<bullet 5>"\n` +
    `  ],\n` +
    `  "narrative_pt": "<2-3 parágrafos, cego (sem nome/cidade), tom comercial que gera interesse>",\n` +
    `  "narrative_en": "<2-3 paragraphs, blind, same quality as PT>"\n` +
    `}\n\n` +
    `Regras: narrativas CEGAS (sem nome da empresa, sem cidade exata, só estado/região). ` +
    `Tese: 5 bullets específicos para este ativo, não genéricos. ` +
    `Narrativa: destaque o que é único e valioso. Tom: analítico, direto, institucional. ` +
    `NUNCA use travessão em nenhum texto gerado, use vírgula, dois-pontos ou ponto.` +
    matchingRules;

  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const msg = await client.messages.create({
    model:      "claude-haiku-4-5-20251001",
    max_tokens: 2000,
    messages:   [{ role: "user", content: prompt }],
  });

  const raw = (msg.content[0] as { text: string }).text
    .trim()
    .replace(/^```json\s*/i, "").replace(/```\s*$/i, "");

  try {
    const parsed = JSON.parse(raw);

    // Gate Brand & Grammar Guardian — corrige travessão/acentuação/Bloxs/emoji
    // automaticamente antes de qualquer narrativa chegar ao ForjaPanel.
    const teseCorrigida = (parsed.tese_investimento ?? []).map((bullet: string) => auditText(bullet).corrected);
    const ptResult = auditText(parsed.narrative_pt ?? "");
    const enResult = auditText(parsed.narrative_en ?? "");

    return NextResponse.json({
      ok: true,
      tese_investimento: teseCorrigida,
      narrative_pt:       ptResult.corrected,
      narrative_en:       enResult.corrected,
      brand_gate: {
        violations_found: ptResult.violations.length + enResult.violations.length,
      },
    });
  } catch {
    return NextResponse.json({ error: "Resposta da IA inválida", raw }, { status: 500 });
  }
}
