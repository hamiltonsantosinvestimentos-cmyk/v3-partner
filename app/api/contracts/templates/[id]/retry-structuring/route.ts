import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

// POST /api/contracts/templates/[id]/retry-structuring — botão "Reprocessar"
// do Agente Estruturador de Contratos (W18), irmão de
// /api/contracts/templates/[id]/retry-analysis (Agente Revisor de Riscos,
// W17, 04-05/09/2026). Mesma lacuna, mesmo motivo: uma estruturação que
// falhou (JSON truncado, erro do Claude, etc.) só podia ser refeita
// descrevendo a intenção de negócio de novo do zero.
//
// DIFERENÇA DE ARQUITETURA em relação ao retry-analysis: o Agente
// Estruturador nunca guarda a entrada original numa coluna própria --
// /api/contracts/templates/draft grava body_text_raw como
// "[placeholder]\n\n<descricao_intencao>" no momento da criação, e
// draft-callback NUNCA sobrescreve esse campo quando status=erro (só
// quando concluido). Por isso a intenção original ainda está lá, intacta,
// só precisa ser extraída de volta removendo o placeholder fixo.
const PLACEHOLDER_PREFIX = "[Estruturando minuta a partir da intenção de negócio descrita pela Mesa...]\n\n";

const WRITE_ROLES = ["ADMIN", "GESTAO"] as const;

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

async function requireWriter() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await svc().from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !WRITE_ROLES.includes(profile.role as typeof WRITE_ROLES[number])) return null;
  return { userId: user.id };
}

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const caller = await requireWriter();
  if (!caller)
    return NextResponse.json({ error: "Apenas ADMIN ou GESTAO podem reprocessar a estruturação" }, { status: 403 });

  const { id } = await params;
  const db = svc();

  const { data: template, error: fetchErr } = await db
    .from("contract_templates")
    .select("id, template_name, vertical, contract_series, origem, analysis_status, body_text_raw")
    .eq("id", id)
    .single();

  if (fetchErr || !template) return NextResponse.json({ error: "Minuta não encontrada" }, { status: 404 });
  if (template.origem !== "agente_ia_estruturador")
    return NextResponse.json({ error: "Reprocessar (estruturação) só está disponível para minutas do Agente Estruturador de Contratos" }, { status: 409 });
  if (template.analysis_status !== "erro")
    return NextResponse.json({ error: `Só é possível reprocessar uma estruturação com falha (status atual: ${template.analysis_status})` }, { status: 409 });

  const rawStored = (template.body_text_raw as string | null) ?? "";
  // Extração honesta: se por algum motivo o prefixo não bater (registro
  // muito antigo, formato mudou), usa o texto inteiro em vez de falhar
  // silenciosamente -- nunca inventa uma intenção de negócio que não existe.
  const descricaoIntencao = rawStored.startsWith(PLACEHOLDER_PREFIX)
    ? rawStored.slice(PLACEHOLDER_PREFIX.length).trim()
    : rawStored.trim();

  if (descricaoIntencao.length < 30)
    return NextResponse.json({ error: "Intenção de negócio original não encontrada ou curta demais para reprocessar com segurança" }, { status: 422 });

  // Mesmas minutas de referência que a criação original buscaria hoje
  // (podem ter mudado desde a tentativa anterior).
  const { data: referenceTemplates } = await db
    .from("contract_templates")
    .select("template_name, body_text_raw")
    .eq("vertical", template.vertical)
    .eq("approval_status", "aprovado")
    .eq("is_active", true)
    .order("updated_at", { ascending: false })
    .limit(3);

  await db.from("contract_templates").update({ analysis_status: "processando", analysis_error: null }).eq("id", id);

  const n8nBase = process.env.N8N_API_URL?.replace("/api/v1", "");
  if (!n8nBase) {
    await db.from("contract_templates").update({
      analysis_status: "erro",
      analysis_error: "N8N_API_URL não configurada — reprocessamento não pode ser disparado",
    }).eq("id", id);
    return NextResponse.json({ error: "Integração de estruturação não configurada (N8N_API_URL ausente)" }, { status: 500 });
  }

  try {
    await fetch(`${n8nBase}/webhook/v3-contract-draft`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-cron-secret": process.env.CRON_SECRET ?? "" },
      body: JSON.stringify({
        template_id: id,
        descricao_intencao: descricaoIntencao,
        vertical: template.vertical,
        contract_series: template.contract_series,
        reference_templates: (referenceTemplates ?? []).map((t) => ({
          template_name: t.template_name,
          body_text_raw: (t.body_text_raw as string).slice(0, 12000),
        })),
      }),
    });
  } catch (e) {
    console.error("[retry-structuring] webhook n8n falhou:", e);
    await db.from("contract_templates").update({
      analysis_status: "erro",
      analysis_error: "Não foi possível acionar o Agente Estruturador de Contratos. Tente novamente em 1 minuto.",
    }).eq("id", id);
    return NextResponse.json({ error: "Agente de estruturação indisponível. Tente novamente em 1 minuto." }, { status: 503 });
  }

  return NextResponse.json({
    ok: true,
    analysis_status: "processando",
    message: "Reprocessamento iniciado. O Agente Estruturador de Contratos está redigindo a minuta novamente.",
  }, { status: 202 });
}
