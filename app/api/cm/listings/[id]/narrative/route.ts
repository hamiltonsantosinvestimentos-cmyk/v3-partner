import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { auditText } from "@/lib/brand-guardian-gate";
import { getThesisTemplate } from "@/lib/thesis-templates";

export const maxDuration = 60;

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

async function getCaller(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await svc().from("profiles").select("id, role").eq("id", user.id).single();
  if (!profile || !["ADMIN", "GESTAO", "MESA_OPERACIONAL"].includes(profile.role as string)) return null;
  return { userId: user.id, role: profile.role as string };
}

// POST — (re)gera a narrativa comercial publica do ativo com base na tese
// selecionada (selected_thesis_template). Fase 3: Switcher de Teses.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const caller = await getCaller(req);
  if (!caller) return NextResponse.json({ error: "Apenas ADMIN/GESTAO/MESA_OPERACIONAL" }, { status: 403 });

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY não configurada" }, { status: 500 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const thesisId = body.selected_thesis_template as string | undefined;

  const { data: listing } = await svc()
    .from("cm_asset_listings")
    .select("id, anonymous_id, asset_type, natureza, uf_ente_devedor, municipio_ente_devedor, valor_face, risk_score, selected_thesis_template")
    .eq("id", id)
    .single();

  if (!listing) return NextResponse.json({ error: "Listing não encontrado" }, { status: 404 });
  if (listing.asset_type !== "imovel")
    return NextResponse.json({ error: "Narrativa por tese disponível apenas para a classe Imóvel/Alternativo" }, { status: 422 });

  // Se veio no body, atualiza a tese selecionada antes de gerar
  const effectiveThesisId = thesisId ?? listing.selected_thesis_template;
  const thesis = getThesisTemplate(effectiveThesisId);
  if (!thesis) {
    return NextResponse.json({ error: "Selecione uma tese válida antes de gerar a narrativa" }, { status: 422 });
  }

  const local = listing.municipio_ente_devedor
    ? `${listing.municipio_ente_devedor} · ${listing.uf_ente_devedor ?? ""}`
    : listing.uf_ente_devedor ?? "Brasil";
  const valor = listing.valor_face
    ? `R$ ${(Number(listing.valor_face) / 1e6).toFixed(1)}M`
    : "valor sob consulta";

  const prompt =
    `Você é estrategista comercial da V3 Partners, escrevendo a narrativa pública (anonimizada) de um ativo ` +
    `imobiliário/alternativo para a vitrine da Bolsa de Grandes Ativos.\n\n` +
    `Tipo: ${listing.natureza ?? "ativo alternativo"}\nRegião: ${local}\nValor: ${valor}\n` +
    (listing.risk_score ? `Score V3: ${listing.risk_score}/100\n` : "") +
    `\n${thesis.promptFragment}\n\n` +
    `Escreva 2 parágrafos (máximo 500 caracteres no total), em português, tom institucional e direto, ` +
    `SEM citar nome de empresa, endereço exato ou dados que identifiquem o vendedor. ` +
    `Nunca use travessão (—); use vírgula, dois-pontos ou ponto. Retorne APENAS o texto da narrativa, sem markdown, sem aspas.`;

  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const msg = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 600,
    messages: [{ role: "user", content: prompt }],
  });

  const rawNarrative = (msg.content[0] as { text: string }).text.trim();

  // Gate Brand & Grammar Guardian — corrige travessão/acentuação/Bloxs/emoji
  const gate = auditText(rawNarrative);

  const { data: updated, error } = await svc()
    .from("cm_asset_listings")
    .update({
      selected_thesis_template: effectiveThesisId,
      public_narrative: gate.corrected,
      public_narrative_generated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("selected_thesis_template, public_narrative, public_narrative_generated_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    listing: updated,
    thesis: thesis.label,
    brand_gate: { violations_found: gate.violations.length },
  });
}
