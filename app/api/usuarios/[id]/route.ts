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
    // assinaturas / financeiro
    svc2.from("partner_subscriptions").update({ partner_id: null }).eq("partner_id", id),
    svc2.from("split_fiscal").update({ partner_id: null }).eq("partner_id", id),
    svc2.from("split_fiscal").update({ created_by: null }).eq("created_by", id),
    svc2.from("split_fiscal").update({ approved_by: null }).eq("approved_by", id),
    svc2.from("partner_goals").update({ created_by: null }).eq("created_by", id),
    // consórcio
    svc2.from("consorcio_leads").update({ created_by: null }).eq("created_by", id),
    svc2.from("consorcio_projetos").update({ created_by: null }).eq("created_by", id),
    svc2.from("consorcio_cartas").update({ created_by: null }).eq("created_by", id),
    // marketplace
    svc2.from("marketplace_products").update({ reviewed_by: null }).eq("reviewed_by", id),
    svc2.from("creative_files").update({ created_by: null }).eq("created_by", id),
    // partner registrations/registro — coluna que a limpeza acima não cobria
    svc2.from("partner_registrations").update({ revisado_por: null }).eq("revisado_por", id),
    // M&A — colunas adicionadas em migrações mais recentes que a lista original
    svc2.from("ma_deals").update({ originator_profile_id: null }).eq("originator_profile_id", id),
    // Mesa de Capitais (cm_*)
    svc2.from("cm_asset_listings").update({ originator_profile_id: null }).eq("originator_profile_id", id),
    svc2.from("cm_asset_listings").update({ nda_authorization_requested_by: null }).eq("nda_authorization_requested_by", id),
    svc2.from("cm_asset_listings").update({ nda_authorized_by: null }).eq("nda_authorized_by", id),
    svc2.from("cm_asset_listings").update({ deleted_by: null }).eq("deleted_by", id),
    svc2.from("cm_asset_listings").update({ deletion_requested_by: null }).eq("deletion_requested_by", id),
    svc2.from("cm_deal_intermediaries").update({ created_by: null }).eq("created_by", id),
    svc2.from("cm_referral_partners").update({ created_by: null }).eq("created_by", id),
    svc2.from("cm_deal_room_security_kyc").update({ reviewed_by: null }).eq("reviewed_by", id),
    svc2.from("cm_deal_room_security_kyc").update({ created_by: null }).eq("created_by", id),
    // V3 Academy — overrides administrativos
    svc2.from("academy_onboarding_overrides").update({ updated_by: null }).eq("updated_by", id),
    svc2.from("academy_home_banner").update({ updated_by: null }).eq("updated_by", id),
    svc2.from("academy_category_overrides").update({ updated_by: null }).eq("updated_by", id),
    svc2.from("academy_video_overrides").update({ updated_by: null }).eq("updated_by", id),
    svc2.from("academy_badges").update({ updated_by: null }).eq("updated_by", id),
    svc2.from("academy_live_classes").update({ created_by: null }).eq("created_by", id),
    // Projeto (5W2H / SWOT / Metas por setor)
    svc2.from("sector_5w2h").update({ updated_by: null }).eq("updated_by", id),
    svc2.from("sector_swot").update({ updated_by: null }).eq("updated_by", id),
    svc2.from("sector_goals").update({ updated_by: null }).eq("updated_by", id),
    // credit engine
    svc2.from("credit_engine_credit_profiles").update({ requested_by: null }).eq("requested_by", id),
    svc2.from("credit_engine_credit_consents").update({ requested_by: null }).eq("requested_by", id),
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
    const rawMsg = (body as { msg?: string; message?: string })?.msg ?? (body as { msg?: string; message?: string })?.message ?? `Erro ${adminRes.status}`;
    // Ainda há registro obrigatório (coluna NOT NULL) apontando pra este usuário
    // que não pode ser nulificado — a exclusão definitiva não é segura aqui.
    const isFkBlock = /foreign key constraint/i.test(rawMsg);
    const msg = isFkBlock
      ? `Este usuário ainda possui registros vinculados que não podem ser removidos automaticamente (${rawMsg}). Use "Desativar" em vez de excluir, ou remova manualmente os registros dependentes antes de tentar novamente.`
      : rawMsg;
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
