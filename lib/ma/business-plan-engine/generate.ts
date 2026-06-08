import { createHash } from "crypto";
import type { SectorSchemaId } from "@/lib/ma/business-plan-schemas/registry";

const BUSINESS_PLAN_MODEL = "claude-haiku-4-5-20251001"; // ADR-001: payload <800 tokens, sem PDFs
const BUSINESS_PLAN_MAX_TOKENS = 4096; // ADR-003 default global

const SYSTEM_PROMPT = `Você é o motor de geração de Business Plans da Mesa M&A da V3 Partners.
REGRAS ABSOLUTAS:
1. Nunca calcule/estime/projete/invente valores financeiros — apenas narre o payload.
2. Toda afirmação numérica deve ter entrada em claim_trace[] com source_path exato.
3. Nunca inclua nomes de PF, contatos, CPF, endereço — refira-se à "gestão do ativo"/"operador".
4. Tom institucional, PT-BR, sem floreios, sem emojis.
5. Estruture em seções: Visão Geral do Ativo · Premissas Financeiras · Cenários Projetados (se houver) · Riscos e Considerações.
6. Omita seções sem dados suficientes — nunca generalize para parecer completo.
Responda em JSON estrito conforme o schema fornecido.`;

export interface SanitizedBusinessPlanPayload {
  sector: string;
  schema_id: SectorSchemaId;
  deal_reference: string;
  financial_projections: Record<string, unknown>;
}

export interface ClaimTraceEntry {
  claim: string;
  source_path: string;
  source_value: unknown;
}

export interface NarrativeSection {
  title: string;
  body: string;
}

export interface GeneratedPlan {
  schema_version: number;
  generated_at: string;
  generated_by: string;
  model: string;
  narrative_sections: NarrativeSection[];
  claim_trace: ClaimTraceEntry[];
  source_hash: string;
}

const RESPONSE_JSON_SCHEMA = `{
  "narrative_sections": [
    { "title": "<título da seção>", "body": "<corpo em markdown, 1-3 parágrafos>" }
  ],
  "claim_trace": [
    { "claim": "<frase com a afirmação numérica>", "source_path": "<caminho exato no payload, ex: financial_projections.noi_mensal>", "source_value": <valor exatamente como está no payload> }
  ]
}`;

export function buildSanitizedPayload(params: {
  sector: string;
  schemaId: SectorSchemaId;
  dealReference: string;
  financialProjections: Record<string, unknown>;
}): SanitizedBusinessPlanPayload {
  return {
    sector: params.sector,
    schema_id: params.schemaId,
    deal_reference: params.dealReference,
    financial_projections: params.financialProjections,
  };
}

export function computeSourceHash(financialProjections: Record<string, unknown>): string {
  const json = JSON.stringify(financialProjections);
  return createHash("sha256").update(json).digest("hex");
}

function getByPath(source: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object" && key in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, source);
}

export function validateClaimTrace(
  claimTrace: ClaimTraceEntry[],
  sourceData: Record<string, unknown>
): boolean {
  if (!Array.isArray(claimTrace) || claimTrace.length === 0) return false;
  return claimTrace.every((claim) => {
    const value = getByPath(sourceData, claim.source_path);
    return value !== undefined && value === claim.source_value;
  });
}

export class BusinessPlanGenerationError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "BusinessPlanGenerationError";
  }
}

export async function generateBusinessPlan(params: {
  sector: string;
  schemaId: SectorSchemaId;
  dealReference: string;
  financialProjections: Record<string, unknown>;
  generatedBy: string;
}): Promise<GeneratedPlan> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new BusinessPlanGenerationError("generation_failed", "ANTHROPIC_API_KEY não configurada");
  }

  const sanitizedPayload = buildSanitizedPayload({
    sector: params.sector,
    schemaId: params.schemaId,
    dealReference: params.dealReference,
    financialProjections: params.financialProjections,
  });

  const userPrompt =
    `Gere o business plan narrativo para o ativo abaixo, com base EXCLUSIVAMENTE nos dados fornecidos.\n\n` +
    `Payload:\n${JSON.stringify(sanitizedPayload, null, 2)}\n\n` +
    `Responda APENAS com JSON válido, sem markdown, no formato:\n${RESPONSE_JSON_SCHEMA}`;

  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  let raw: string;
  try {
    const msg = await client.messages.create({
      model: BUSINESS_PLAN_MODEL,
      max_tokens: BUSINESS_PLAN_MAX_TOKENS,
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: userPrompt }],
    });
    raw = (msg.content[0] as { text: string }).text
      .trim()
      .replace(/^```json\s*/i, "")
      .replace(/```\s*$/i, "");
  } catch (err) {
    throw new BusinessPlanGenerationError(
      "generation_failed",
      err instanceof Error ? err.message : "Falha ao chamar o modelo de geração"
    );
  }

  let parsed: { narrative_sections?: NarrativeSection[]; claim_trace?: ClaimTraceEntry[] };
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new BusinessPlanGenerationError("generation_failed", "Resposta do modelo não é JSON válido");
  }

  const narrativeSections = parsed.narrative_sections ?? [];
  const claimTrace = parsed.claim_trace ?? [];

  if (narrativeSections.length === 0) {
    throw new BusinessPlanGenerationError("generation_failed", "Nenhuma seção narrativa retornada");
  }

  if (!validateClaimTrace(claimTrace, sanitizedPayload as unknown as Record<string, unknown>)) {
    throw new BusinessPlanGenerationError(
      "claim_trace_mismatch",
      "Uma ou mais afirmações numéricas não correspondem aos dados-fonte — geração descartada"
    );
  }

  return {
    schema_version: 1,
    generated_at: new Date().toISOString(),
    generated_by: params.generatedBy,
    model: BUSINESS_PLAN_MODEL,
    narrative_sections: narrativeSections,
    claim_trace: claimTrace,
    source_hash: computeSourceHash(params.financialProjections),
  };
}
