import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { notifySociosMinutaEmRevisao } from "@/lib/socios-notify";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await svc().from("profiles").select("role").eq("id", user.id).single();
  if (!profile || profile.role !== "ADMIN") return null;
  return user.id;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await requireAdmin();
  if (!userId) return NextResponse.json({ error: "Apenas ADMIN" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const { template_name, body_text_raw, is_active, submit_for_review } = body;

  const { data: current } = await svc().from("contract_templates").select("template_name, version, approval_status, review_round").eq("id", id).single();
  if (!current) return NextResponse.json({ error: "Minuta não encontrada" }, { status: 404 });

  const updates: Record<string, any> = {};
  if (template_name !== undefined) updates.template_name = template_name;
  if (is_active !== undefined) updates.is_active = is_active;
  if (body_text_raw !== undefined) {
    updates.body_text_raw = body_text_raw;
    const vars = (body_text_raw.match(/\{\{([^}]+)\}\}/g) || []).map((v: string) => v.replace(/\{\{|\}\}/g, "").trim());
    updates.variables_map = vars.map((v: string) => ({ key: v, label: v.replace(/_/g, " "), source: "auto" }));
    updates.version = (current.version ?? 0) + 1;
    // Editar o texto de uma minuta já aprovada invalida a aprovação — o
    // jurídico aprovou UM texto específico, não qualquer versão futura dele.
    if (current.approval_status === "aprovado") updates.approval_status = "rascunho";
  }

  // "Enviar para Revisão Jurídica": autor (ADMIN) pede revisão explicitamente.
  // Só sai de rascunho/reprovado — nunca pula revisão em andamento.
  if (submit_for_review) {
    if (!["rascunho", "reprovado"].includes(updates.approval_status ?? current.approval_status))
      return NextResponse.json({ error: `Minuta não pode ser enviada para revisão no status atual (${current.approval_status})` }, { status: 409 });
    updates.approval_status = "em_revisao";
    updates.review_round = (current.review_round ?? 1) + (current.approval_status === "reprovado" ? 1 : 0);
  }

  const { data, error } = await svc()
    .from("contract_templates")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Notificação Universal (BRIEF 30/08/2026, item residual 1): a mesma
  // rotina do Fast-Track avisa os 3 sócios também quando a minuta entra em
  // em_revisao pelo fluxo manual ("Enviar para Revisão Jurídica"). Antes
  // disso o gap era real: nenhuma minuta manual jamais notificava ninguém,
  // só descoberta entrando na Central de Contratos. Best-effort — falha de
  // notificação nunca desfaz a transição de status já persistida acima.
  if (submit_for_review) {
    await notifySociosMinutaEmRevisao({
      templateId: id,
      templateName: data.template_name ?? current.template_name,
      origem: "manual",
    }).catch((e) => console.error("[templates/[id] PATCH] falha ao notificar sócios:", e));
  }

  return NextResponse.json({ template: data });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await requireAdmin();
  if (!userId) return NextResponse.json({ error: "Apenas ADMIN" }, { status: 403 });

  const { id } = await params;
  const { error } = await svc()
    .from("contract_templates")
    .update({ is_active: false })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
