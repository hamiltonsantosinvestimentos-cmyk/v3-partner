import { NextRequest, NextResponse } from "next/server";
import { auditText } from "@/lib/brand-guardian-gate";

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
      contexto_forja?: string; code?: string; [key: string]: unknown;
    };
    validated: { field: string; value: string; note?: string }[];
    missing:   { field: string; impact: string; priority: string }[];
    recommendation: string;
    score: number;
  };

  const { deal, validated = [], missing = [], recommendation, score } = body;

  // Resumo compacto dos campos validados para a narrativa
  const validatedSummary = validated
    .slice(0, 12)
    .map(v => `${v.field}: ${v.value}`)
    .join("\n");

  const missingSummary = missing
    .filter(m => m.priority === "ALTA")
    .slice(0, 5)
    .map(m => `- ${m.field}: ${m.impact}`)
    .join("\n");

  const prompt =
    `Você é estrategista M&A da V3 Partners. Com base nos dados validados abaixo, gere narrativa comercial cega e tese de investimento.\n\n` +
    `Setor: ${deal.sector ?? "não informado"}\n` +
    `Região: ${deal.location ?? "não informada"}\n` +
    `Valor: R$ ${deal.deal_value ? (Number(deal.deal_value)/1e6).toFixed(1) + "M" : "não informado"}\n` +
    `Score FORJA: ${score}/100 · ${recommendation}\n\n` +
    `Dados validados:\n${validatedSummary}\n\n` +
    (missingSummary ? `Itens ausentes (ALTA prioridade):\n${missingSummary}\n\n` : "") +
    (deal.contexto_forja?.trim()
      ? `Contexto da Mesa (PRIORITÁRIO — use para enriquecer a narrativa):\n${deal.contexto_forja}\n\n`
      : deal.notes?.trim()
      ? `Notas: ${deal.notes}\n\n`
      : "") +
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
    `NUNCA use travessão (—) em nenhum texto gerado, use vírgula, dois-pontos ou ponto.`;

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
