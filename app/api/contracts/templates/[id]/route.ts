import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { notifySociosMinutaEmRevisao } from "@/lib/socios-notify";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

// P0 hotfix (02/09/2026): mesmo motivo das rotas irmãs (templates POST,
// templates/upload POST) — Dr. Athaydes (Jurídico) tem role GESTAO, não
// ADMIN, e estava bloqueado de salvar edição/enviar para revisão até em
// minuta que ele próprio acabou de criar ou subir. Não existe role
// "JURIDICO" no enum do sistema, GESTAO estendido aqui em vez disso.
async function requireWriter() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await svc().from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !["ADMIN", "GESTAO"].includes(profile.role as string)) return null;
  return user.id;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await requireWriter();
  if (!userId) return NextResponse.json({ error: "Apenas ADMIN ou GESTAO" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const { template_name, body_text_raw, is_active, submit_for_review, force_revalidation } = body;

  const { data: current } = await svc().from("contract_templates").select("template_name, body_text_raw, version, approval_status, review_round").eq("id", id).single();
  if (!current) return NextResponse.json({ error: "Minuta não encontrada" }, { status: 404 });

  const updates: Record<string, any> = {};
  if (template_name !== undefined) updates.template_name = template_name;
  if (is_active !== undefined) updates.is_active = is_active;

  const bodyChanged = body_text_raw !== undefined && body_text_raw !== current.body_text_raw;
  if (bodyChanged) {
    updates.body_text_raw = body_text_raw;
    const vars = (body_text_raw.match(/\{\{([^}]+)\}\}/g) || []).map((v: string) => v.replace(/\{\{|\}\}/g, "").trim());
    updates.variables_map = vars.map((v: string) => ({ key: v, label: v.replace(/_/g, " "), source: "auto" }));
    updates.version = (current.version ?? 0) + 1;
  }

  // P0 real achado 04/09/2026: editar o corpo de uma minuta já aprovada
  // resetava approval_status pra rascunho, mas nunca avançava review_round.
  // Os votos antigos (contract_template_reviews) ficavam presos na mesma
  // rodada, e como o quórum em [id]/review/route.ts conta votos POR RODADA,
  // qualquer voto novo nessa mesma rodada reaproveitaria silenciosamente
  // aprovações dadas sobre o texto ERRADO (achado ao vivo: minuta corrigida
  // continuava mostrando "aprovado por Dr. Luis e Robson" na tela mesmo já
  // em rascunho). Toda edição real de corpo agora sempre abre rodada nova.
  // `force_revalidation` (novo): exige nova rodada mesmo sem mudar o texto
  // agora — usado pra corrigir minutas que já ficaram presas nesse estado
  // antes deste fix, e pra qualquer caso futuro em que o jurídico precise
  // reavaliar sem uma edição de texto ter disparado isso automaticamente.
  let nextRound = current.review_round ?? 1;
  let roundBumped = false;
  if (bodyChanged || force_revalidation === true) {
    if (current.approval_status === "aprovado" || force_revalidation === true) updates.approval_status = "rascunho";
    nextRound += 1;
    roundBumped = true;
  }

  // "Enviar para Revisão Jurídica": autor (ADMIN) pede revisão explicitamente.
  // Só sai de rascunho/reprovado — nunca pula revisão em andamento.
  if (submit_for_review) {
    if (!["rascunho", "reprovado"].includes(updates.approval_status ?? current.approval_status))
      return NextResponse.json({ error: `Minuta não pode ser enviada para revisão no status atual (${current.approval_status})` }, { status: 409 });
    updates.approval_status = "em_revisao";
    // Reprovação seguida de reenvio sem edição de corpo também abre rodada
    // nova (comportamento original). Se o corpo já mudou nesta mesma
    // chamada, a rodada já foi avançada acima — não soma duas vezes.
    if (current.approval_status === "reprovado" && !roundBumped) {
      nextRound += 1;
      roundBumped = true;
    }
  }

  if (roundBumped) updates.review_round = nextRound;

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

async function requireAdminOnly() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await svc().from("profiles").select("role").eq("id", user.id).single();
  if (!profile || profile.role !== "ADMIN") return null;
  return user.id;
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Desativar minuta permanece ADMIN-only, deliberado -- fora do escopo do
  // hotfix (só pediram INSERT/UPDATE), e é uma ação destrutiva de maior risco.
  const userId = await requireAdminOnly();
  if (!userId) return NextResponse.json({ error: "Apenas ADMIN" }, { status: 403 });

  const { id } = await params;
  const { error } = await svc()
    .from("contract_templates")
    .update({ is_active: false })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
