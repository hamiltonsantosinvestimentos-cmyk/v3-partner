import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

// Remove campos nulos/vazios e irrelevantes para análise M&A antes de enviar à IA.
// Reduz tokens de entrada em ~60%, liberando espaço para output completo sem caps.
function sanitizeDeal(deal: Record<string, unknown>): Record<string, unknown> {
  const EXCLUDE_KEYS = new Set([
    "id", "dbStage", "createdAt", "assigned_to_id", "responsible",
    "comments", "probability", "stage",
  ]);

  function stripEmpty(obj: unknown): unknown {
    if (obj === null || obj === undefined || obj === "") return undefined;
    if (Array.isArray(obj)) {
      const arr = obj.map(stripEmpty).filter(v => v !== undefined);
      return arr.length ? arr : undefined;
    }
    if (typeof obj === "object") {
      const result: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
        if (EXCLUDE_KEYS.has(k)) continue;
        const cleaned = stripEmpty(v);
        if (cleaned !== undefined) result[k] = cleaned;
      }
      return Object.keys(result).length ? result : undefined;
    }
    return obj;
  }

  return (stripEmpty(deal) ?? {}) as Record<string, unknown>;
}

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

    const cleanDeal = sanitizeDeal(deal);

    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 3000,
      system:
        "Você é o FORJA, validador inteligente de dados de deals M&A da V3 Partners. " +
        "Analise os dados do deal fornecido e retorne APENAS um JSON válido, sem markdown, com esta estrutura exata:\n" +
        "{\n" +
        '  "score": <número 0-100>,\n' +
        '  "validated": [ { "field": "<campo>", "value": "<valor>", "note": "<observação opcional>" } ],\n' +
        '  "corrected": [ { "field": "<campo>", "original": "<valor original>", "corrected": "<valor corrigido>", "reason": "<motivo>" } ],\n' +
        '  "missing": [ { "field": "<campo>", "impact": "<impacto>", "priority": "ALTA" | "MEDIA" | "BAIXA" } ],\n' +
        '  "narrative_pt": "<narrativa de investimento em português — máximo 3 frases>",\n' +
        '  "narrative_en": "<investment narrative in english — maximum 3 sentences>",\n' +
        '  "recommendation": "APROVADO" | "APROVADO_COM_RESSALVAS" | "PENDENTE" | "BLOQUEADO",\n' +
        '  "recommendation_note": "<justificativa da recomendação>"\n' +
        "}\n\n" +
        "Regras:\n" +
        "- Liste TODOS os campos presentes em validated e TODOS os ausentes em missing\n" +
        "- score >= 80 e dados completos → APROVADO\n" +
        "- score 60-79 ou poucos dados ausentes não críticos → APROVADO_COM_RESSALVAS\n" +
        "- score 40-59 ou campos importantes ausentes → PENDENTE\n" +
        "- score < 40 ou dados insuficientes para análise → BLOQUEADO\n" +
        "- validated: campos que existem e estão corretos\n" +
        "- corrected: campos com erros de formatação ou valores inconsistentes\n" +
        "- missing: campos obrigatórios para um deal M&A completo que estão ausentes\n" +
        "- Retorne APENAS o JSON, sem texto adicional.",
      messages: [
        {
          role: "user",
          content: `Analise este deal M&A:\n\n${JSON.stringify(cleanDeal, null, 2)}`,
        },
      ],
    });

    if (message.stop_reason === "max_tokens") {
      throw new Error("Resposta da IA truncada — tente novamente com menos dados no deal");
    }

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
