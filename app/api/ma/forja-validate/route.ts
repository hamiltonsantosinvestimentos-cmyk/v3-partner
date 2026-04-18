import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { deal } = body;

    if (!deal) {
      return NextResponse.json({ error: "deal é obrigatório" }, { status: 400 });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: "ANTHROPIC_API_KEY não configurada no servidor" }, { status: 500 });
    }

    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system:
        "Você é o FORJA, validador inteligente de dados de deals M&A da V3 Partners. " +
        "Analise os dados do deal fornecido e retorne APENAS um JSON válido, sem markdown, com esta estrutura exata:\n" +
        "{\n" +
        '  "score": <número 0-100>,\n' +
        '  "validated": [ { "field": "<campo>", "value": "<valor>", "note": "<observação opcional>" } ],\n' +
        '  "corrected": [ { "field": "<campo>", "original": "<valor original>", "corrected": "<valor corrigido>", "reason": "<motivo>" } ],\n' +
        '  "missing": [ { "field": "<campo>", "impact": "<impacto de não ter este campo>", "priority": "ALTA" | "MEDIA" | "BAIXA" } ],\n' +
        '  "narrative_pt": "<narrativa de investimento em português>",\n' +
        '  "narrative_en": "<investment narrative in english>",\n' +
        '  "recommendation": "APROVADO" | "APROVADO_COM_RESSALVAS" | "PENDENTE" | "BLOQUEADO",\n' +
        '  "recommendation_note": "<justificativa da recomendação>"\n' +
        "}\n\n" +
        "Regras:\n" +
        "- score >= 80 e dados completos → APROVADO\n" +
        "- score 60-79 ou poucos dados ausentes não críticos → APROVADO_COM_RESSALVAS\n" +
        "- score 40-59 ou campos importantes ausentes → PENDENTE\n" +
        "- score < 40 ou dados insuficientes para análise → BLOQUEADO\n" +
        "- validated: campos que existem e estão corretos\n" +
        "- corrected: campos com erros ortográficos, formatação ou valores inconsistentes que foram corrigidos\n" +
        "- missing: campos que deveriam existir para um deal M&A completo mas estão ausentes\n" +
        "- Retorne APENAS o JSON, sem texto adicional.",
      messages: [
        {
          role: "user",
          content: `Analise este deal M&A:\n\n${JSON.stringify(deal, null, 2)}`,
        },
      ],
    });

    const content = message.content[0];
    if (content.type !== "text") {
      throw new Error("Resposta inesperada da IA");
    }

    // Remove possível markdown se a IA incluir
    const raw = content.text.trim().replace(/^```json\s*/i, "").replace(/```\s*$/i, "");
    const parsed = JSON.parse(raw);
    return NextResponse.json(parsed);
  } catch (error) {
    console.error("[forja-validate] ERRO COMPLETO:", JSON.stringify(error, null, 2));
    const msg = error instanceof Error ? error.message : String(error);
    const status = (error as { status?: number })?.status ?? 500;
    return NextResponse.json(
      { error: `FORJA erro (${status}): ${msg}` },
      { status: 500 }
    );
  }
}
