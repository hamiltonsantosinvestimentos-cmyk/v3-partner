import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const ADMIN_ROLES = ["ADMIN", "GESTAO"];

const SCORE_SYSTEM_PROMPT = `Voce e um analista de risco especializado em precatorios e direitos creditorios no mercado brasileiro.

Analise os dados do ativo fornecido e retorne um JSON com:
- "score": integer 0-100 (0 = risco maximo, 100 = risco minimo)
- "components": objeto com os 5 componentes do score, cada um de 0-20:
  - "ente_devedor": solidez financeira do ente devedor (Federal = alto, Municipal pequeno = baixo)
  - "natureza_juridica": alimentar tem prioridade legal sobre comum
  - "fase_processual": quanto mais avancado no processo, menor o risco
  - "liquidez_mercado": facilidade de revenda no mercado secundario
  - "documentacao": completude e validade dos documentos apresentados
- "justificativa": texto curto (max 200 chars) explicando o score
- "alertas": array de strings com riscos identificados (pode ser vazio)

Responda APENAS com o JSON, sem markdown, sem explicacao adicional.`;

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data: profile } = await svc().from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !ADMIN_ROLES.includes(profile.role as string)) {
    return NextResponse.json({ error: "Apenas ADMIN/GESTAO" }, { status: 403 });
  }

  const { id } = await params;

  const { data: listing } = await svc()
    .from("cm_asset_listings")
    .select("*")
    .eq("id", id)
    .single();

  if (!listing) return NextResponse.json({ error: "Listing não encontrado" }, { status: 404 });

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY não configurada" }, { status: 500 });
  }

  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const listingData = {
    tipo: listing.asset_type,
    ente_devedor: listing.ente_devedor,
    esfera: listing.esfera,
    tribunal: listing.tribunal,
    natureza: listing.natureza,
    valor_face: listing.valor_face,
    valor_atualizado: listing.valor_atualizado,
    desagio_pretendido: listing.desagio_pretendido,
    prazo_estimado_meses: listing.prazo_estimado_meses,
    allows_tranching: listing.allows_tranching,
    ocr_validation: listing.ocr_validation,
    conditional_blocks: listing.conditional_blocks,
  };

  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 800,
    system: SCORE_SYSTEM_PROMPT,
    messages: [{ role: "user", content: JSON.stringify(listingData) }],
  });

  const rawContent = message.content[0];
  if (rawContent.type !== "text") {
    return NextResponse.json({ error: "Resposta inesperada da IA" }, { status: 500 });
  }

  let scoreResult;
  try {
    scoreResult = JSON.parse(rawContent.text);
  } catch {
    return NextResponse.json({ error: "IA retornou formato inválido", raw: rawContent.text }, { status: 500 });
  }

  const score = Math.min(100, Math.max(0, Number(scoreResult.score) || 50));

  await svc().from("cm_risk_scores").insert({
    listing_id: id,
    score,
    components: scoreResult.components ?? {},
    model_version: "haiku-4.5-v1",
    calculated_by: "ia",
  });

  await svc().from("cm_asset_listings").update({
    risk_score: score,
    risk_details: {
      components: scoreResult.components,
      justificativa: scoreResult.justificativa,
      alertas: scoreResult.alertas,
      calculated_at: new Date().toISOString(),
    },
  }).eq("id", id);

  return NextResponse.json({
    score,
    components: scoreResult.components,
    justificativa: scoreResult.justificativa,
    alertas: scoreResult.alertas,
  });
}
