import { NextResponse } from "next/server";
import { createClient as sc } from "@supabase/supabase-js";

function svcClient() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const IS_DEMO = false;

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();

  if (IS_DEMO) {
    return NextResponse.json({ id, ...body });
  }

  const { createServiceClient } = await import("@/lib/supabase/server");
  const supabase = await createServiceClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data: profileData } = await supabase.from("profiles").select("role, full_name, email").eq("id", user.id).single();
  const profile = profileData as { role: string; full_name: string | null; email: string } | null;
  if (profile?.role !== "ADMIN") return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  // Se enviou novo e-mail, atualiza no Supabase Auth primeiro
  if (body.email) {
    const { error: authEmailError } = await supabase.auth.admin.updateUserById(id, { email: body.email });
    if (authEmailError) {
      return NextResponse.json({ error: authEmailError.message }, { status: 500 });
    }
  }

  const allowedFields = ["role", "is_active", "phone", "full_name", "document_cpf", "trial_expires_at", "email"];
  const updateData: Record<string, unknown> = {};
  for (const field of allowedFields) {
    if (field in body) updateData[field] = body[field];
  }

  const supabaseAny = supabase as unknown as {
    from: (table: string) => {
      update: (data: unknown) => {
        eq: (col: string, val: string) => {
          select: () => { single: () => Promise<{ data: unknown; error: { message: string } | null }> };
        };
      };
    };
  };
  const { data, error: updateError } = await supabaseAny
    .from("profiles")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // Grava auditoria (fire-and-forget)
  const actionLabel = body.email ? "EDITAR_EMAIL"
    : body.role ? "EDITAR_ROLE"
    : body.is_active === false ? "SUSPENDER"
    : body.is_active === true ? "REATIVAR"
    : body.trial_expires_at ? "RENOVAR_TRIAL"
    : "EDITAR_PERFIL";

  svcClient().from("audit_logs").insert({
    user_id: user.id,
    user_name: profile?.full_name ?? profile?.email ?? user.email,
    action: actionLabel,
    entity: "profiles",
    entity_id: id,
    new_data: updateData,
    old_data: null,
    ip_address: null,
  }).then(() => {}, () => {});

  return NextResponse.json(data);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (IS_DEMO) {
    return NextResponse.json({ success: true, id });
  }

  const { createServiceClient } = await import("@/lib/supabase/server");
  const supabase = await createServiceClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data: profileData } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const profile = profileData as { role: string } | null;
  if (profile?.role !== "ADMIN") return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

  // Nullifica TODAS as FKs que referenciam profiles (preserva os registros)
  const svc2 = svcClient();
  await Promise.allSettled([
    // credit_desk_proposals
    svc2.from("credit_desk_proposals").update({ partner_id: null }).eq("partner_id", id),
    svc2.from("credit_desk_proposals").update({ created_by: null }).eq("created_by", id),
    svc2.from("credit_desk_proposals").update({ level1_analyst_id: null }).eq("level1_analyst_id", id),
    svc2.from("credit_desk_proposals").update({ level2_analyst_id: null }).eq("level2_analyst_id", id),
    svc2.from("credit_desk_proposals").update({ level3_approver_id: null }).eq("level3_approver_id", id),
    // crm_leads
    svc2.from("crm_leads").update({ partner_id: null }).eq("partner_id", id),
    svc2.from("crm_leads").update({ created_by: null }).eq("created_by", id),
    // ma_deals
    svc2.from("ma_deals").update({ partner_id: null }).eq("partner_id", id),
    svc2.from("ma_deals").update({ assigned_to: null }).eq("assigned_to", id),
    svc2.from("ma_deals").update({ created_by: null }).eq("created_by", id),
    // ma_captacao_links
    svc2.from("ma_captacao_links").update({ partner_id: null }).eq("partner_id", id),
    // ma_deal_history
    svc2.from("ma_deal_history").update({ changed_by: null }).eq("changed_by", id),
    // captacao_links
    svc2.from("captacao_links").update({ partner_id: null }).eq("partner_id", id),
    // partner_registrations / contracts
    svc2.from("partner_registrations").update({ user_id: null }).eq("user_id", id),
    svc2.from("partner_contracts").update({ partner_id: null }).eq("partner_id", id),
    // split_fiscal
    svc2.from("split_fiscal").update({ partner_id: null }).eq("partner_id", id),
    svc2.from("split_fiscal").update({ created_by: null }).eq("created_by", id),
    svc2.from("split_fiscal").update({ approved_by: null }).eq("approved_by", id),
    // prospeccao
    svc2.from("prospeccao_leads").update({ partner_id: null }).eq("partner_id", id),
    svc2.from("prospeccao_leads").update({ created_by: null }).eq("created_by", id),
    svc2.from("prospeccao_leads").update({ indicado_por_partner_id: null }).eq("indicado_por_partner_id", id),
    svc2.from("prospeccao_leads").update({ responsavel_id: null }).eq("responsavel_id", id),
    svc2.from("prospeccao_followups").update({ created_by: null }).eq("created_by", id),
    svc2.from("prospeccao_historico").update({ created_by: null }).eq("created_by", id),
    // operacional
    svc2.from("operational_tickets").update({ assigned_to: null }).eq("assigned_to", id),
    svc2.from("operational_tickets").update({ requester_id: null }).eq("requester_id", id),
    svc2.from("ticket_comments").update({ author_id: null }).eq("author_id", id),
    // financeiro / investor / deal
    svc2.from("financeiro_records").update({ created_by: null }).eq("created_by", id),
    svc2.from("investor_profiles").update({ created_by: null }).eq("created_by", id),
    svc2.from("deal_assessments").update({ created_by: null }).eq("created_by", id),
    svc2.from("deal_opportunities").update({ created_by: null }).eq("created_by", id),
    svc2.from("deal_rooms").update({ created_by: null }).eq("created_by", id),
    svc2.from("deal_workspaces").update({ created_by: null }).eq("created_by", id),
    svc2.from("deal_qa_messages").update({ sender_profile_id: null }).eq("sender_profile_id", id),
    // kyc
    svc2.from("kyc_access_log").update({ user_id: null }).eq("user_id", id),
    svc2.from("kyc_analyses").update({ analyst_id: null }).eq("analyst_id", id),
    svc2.from("kyc_api_keys").update({ updated_by: null }).eq("updated_by", id),
    svc2.from("kyc_blacklist").update({ added_by: null }).eq("added_by", id),
    // nps / push / chat
    svc2.from("nps_responses").update({ partner_id: null }).eq("partner_id", id),
    svc2.from("push_subscriptions").delete().eq("user_id", id),
    svc2.from("chat_messages").update({ sender_id: null }).eq("sender_id", id),
    svc2.from("team_chat_messages").update({ sender_id: null }).eq("sender_id", id),
    // outros
    svc2.from("creative_jobs").update({ created_by: null }).eq("created_by", id),
    svc2.from("meeting_summaries").update({ user_id: null }).eq("user_id", id),
    svc2.from("profiles").update({ created_by: null }).eq("created_by", id),
  ]);

  // Deleta registros que pertencem exclusivamente ao usuário
  await Promise.allSettled([
    svc2.from("notifications").delete().eq("user_id", id),
    svc2.from("ai_conversations").delete().eq("user_id", id),
    svc2.from("agent_sessions").delete().eq("user_id", id),
    svc2.from("profiles").delete().eq("id", id),
  ]);

  // Usa REST API direta do Supabase Admin para garantir deleção mesmo com constraints
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const adminRes = await fetch(`${supabaseUrl}/auth/v1/admin/users/${id}`, {
    method: "DELETE",
    headers: {
      "apikey": serviceKey,
      "Authorization": `Bearer ${serviceKey}`,
    },
  });

  if (!adminRes.ok) {
    const body = await adminRes.json().catch(() => ({}));
    const msg = (body as { msg?: string; message?: string })?.msg ?? (body as { msg?: string; message?: string })?.message ?? `Erro ${adminRes.status}`;
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
