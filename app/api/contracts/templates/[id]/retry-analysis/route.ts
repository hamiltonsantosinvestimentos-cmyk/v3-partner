import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

// POST /api/contracts/templates/[id]/retry-analysis — botão "Reprocessar"
// (04-05/09/2026, achado real: contrato "CAMPO CAPITAL P2P..." ficou preso em
// analysis_status=erro por Unterminated JSON, causa raiz max_tokens baixo
// no workflow n8n W17, já corrigido em 03/09. Não existia forma de destravar
// um registro parado sem reenviar o arquivo do zero -- essa rota fecha essa
// lacuna, reaproveitando body_text_raw já salvo no upload original (nunca
// sobrescrito em caso de erro, só em caso de sucesso).
//
// Escopo deliberado: só origem=agente_ia (Agente Revisor de Riscos, W17).
// O Agente Estruturador (agente_ia_estruturador, W18) usa payload/webhook
// diferentes (intenção de negócio em texto livre, não documento de
// terceiro) e não foi coberto aqui -- mesma lacuna de "reprocessar" existe
// lá, registrada como pendente, fora do escopo deste pedido.

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
    return NextResponse.json({ error: "Apenas ADMIN ou GESTAO podem reprocessar a análise" }, { status: 403 });

  const { id } = await params;
  const db = svc();

  const { data: template, error: fetchErr } = await db
    .from("contract_templates")
    .select("id, template_name, vertical, origem, analysis_status, valor_operacao_estimado, body_text_raw")
    .eq("id", id)
    .single();

  if (fetchErr || !template) return NextResponse.json({ error: "Minuta não encontrada" }, { status: 404 });
  if (template.origem !== "agente_ia")
    return NextResponse.json({ error: "Reprocessar só está disponível para minutas do Agente Revisor de Riscos" }, { status: 409 });
  if (template.analysis_status !== "erro")
    return NextResponse.json({ error: `Só é possível reprocessar uma análise com falha (status atual: ${template.analysis_status})` }, { status: 409 });
  if (!template.body_text_raw?.trim())
    return NextResponse.json({ error: "Texto original do contrato não encontrado, não é possível reprocessar" }, { status: 422 });

  // Mesmas 3 referências institucionais que o upload original buscaria hoje
  // (podem ter mudado desde a tentativa anterior, ex: nova minuta aprovada
  // nesse meio tempo -- reprocessar sempre busca o estado atual, nunca o congelado).
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
    return NextResponse.json({ error: "Integração de análise não configurada (N8N_API_URL ausente)" }, { status: 500 });
  }

  try {
    await fetch(`${n8nBase}/webhook/v3-contract-analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-cron-secret": process.env.CRON_SECRET ?? "" },
      body: JSON.stringify({
        template_id: id,
        document_text: (template.body_text_raw as string).slice(0, 40000),
        vertical: template.vertical,
        valor_operacao_estimado: template.valor_operacao_estimado,
        reference_templates: (referenceTemplates ?? []).map((t) => ({
          template_name: t.template_name,
          body_text_raw: (t.body_text_raw as string).slice(0, 12000),
        })),
      }),
    });
  } catch (e) {
    console.error("[retry-analysis] webhook n8n falhou:", e);
    await db.from("contract_templates").update({
      analysis_status: "erro",
      analysis_error: "Não foi possível acionar o agente de análise. Tente novamente em 1 minuto.",
    }).eq("id", id);
    return NextResponse.json({ error: "Agente de análise indisponível. Tente novamente em 1 minuto." }, { status: 503 });
  }

  return NextResponse.json({
    ok: true,
    analysis_status: "processando",
    message: "Reprocessamento iniciado. O Agente Revisor de Riscos está lendo o contrato novamente.",
  }, { status: 202 });
}
