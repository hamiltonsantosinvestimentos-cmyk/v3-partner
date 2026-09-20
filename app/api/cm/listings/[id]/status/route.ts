import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { createNotification } from "@/lib/notify";
import { CM_MEETING_URL, notifyMeetingLink } from "@/lib/cm-meeting";
import { ASSET_DECLINE_REASON_VALUES } from "@/lib/cm-decline-reasons";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const ADMIN_ROLES = ["ADMIN", "GESTAO"];
const MESA_ROLES = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"];

const STATUS_LABELS: Record<string, string> = {
  reuniao_validada: "Reunião Validada",
  formulario_preenchido: "Formulário Preenchido",
  reuniao_agendada: "Reunião Agendada",
  em_qualificacao: "Em Qualificação",
  nda_assinado: "NDA Assinado",
  em_analise: "Em Análise",
  aprovado_head: "Aprovado pela Diretoria",
  aprovado_com_restricoes: "Aprovado com Restrições",
  reprovado: "Reprovado",
  ativo_vitrine: "Ativo na Vitrine",
  proposta_recebida: "Proposta Recebida",
  em_escrow_due_diligence: "Em Escrow / Due Diligence",
  liquidado: "Liquidado",
  cancelado: "Cancelado",
  expirado: "Expirado",
};

// Transicoes que exigem justificativa (17/09/2026): restricao ou reprovacao
// sem motivo escrito nao passa nem daqui nem de transition_cm_listing_status()
// no banco -- validado nos dois lugares de proposito (defesa em profundidade).
const REASON_REQUIRED_STATUSES = ["aprovado_com_restricoes", "reprovado"];

async function getCallerRole(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await svc().from("profiles").select("id, role").eq("id", user.id).single();
  if (!profile) return null;
  return { userId: user.id, role: profile.role as string };
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const caller = await getCallerRole(req);
  if (!caller) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const { new_status, reason, reason_category, nda_signed_at, nda_document_url, head_approved_by } = body;

  if (!new_status) {
    return NextResponse.json({ error: "Campo obrigatório: new_status" }, { status: 422 });
  }

  // Motivo estruturado (Fase 5, 19/09/2026): reprovar sem categoria fixa nao
  // passa nem daqui nem do banco -- validado nos dois lugares de proposito.
  if (new_status === "reprovado" && !ASSET_DECLINE_REASON_VALUES.includes(reason_category)) {
    return NextResponse.json({
      error: `Categoria de motivo inválida ou ausente. Use uma de: ${ASSET_DECLINE_REASON_VALUES.join(", ")}`,
    }, { status: 422 });
  }

  // Reprovar fica aberto a qualquer role da Mesa (ADMIN/GESTAO/MESA_OPERACIONAL)
  // -- decisao de Joao (17/09/2026): rejeitar tem risco menor que aprovar,
  // nao precisa da mesma autoridade de Head. Aprovar (com ou sem restricao)
  // continua exigindo ADMIN/GESTAO, igual a aprovado_head.
  if (new_status === "reprovado" && !MESA_ROLES.includes(caller.role)) {
    return NextResponse.json({ error: "Apenas ADMIN/GESTAO/MESA_OPERACIONAL pode reprovar" }, { status: 403 });
  }

  const headOnlyStatuses = ["aprovado_head", "aprovado_com_restricoes", "ativo_vitrine", "em_escrow_due_diligence", "liquidado"];
  if (headOnlyStatuses.includes(new_status) && !ADMIN_ROLES.includes(caller.role)) {
    return NextResponse.json({ error: "Apenas ADMIN/GESTAO pode aprovar esta transição" }, { status: 403 });
  }

  if (REASON_REQUIRED_STATUSES.includes(new_status) && (!reason || !reason.trim())) {
    return NextResponse.json({
      error: new_status === "reprovado"
        ? "Justificativa obrigatória para reprovar o ativo"
        : "Texto da restrição é obrigatório para aprovar com restrições",
    }, { status: 422 });
  }

  if (nda_signed_at || nda_document_url) {
    // Marcacao retroativa de NDA exige autorizacao de diretor — ver
    // /api/cm/listings/[id]/nda-authorize. So ADMIN pode setar direto aqui.
    if (caller.role !== "ADMIN") {
      return NextResponse.json({
        error: "Use /api/cm/listings/[id]/nda-authorize para marcar NDA — exige autorização de diretor para GESTAO/MESA_OPERACIONAL",
      }, { status: 403 });
    }
    await svc().from("cm_asset_listings").update({
      nda_signed_at: nda_signed_at ?? new Date().toISOString(),
      nda_document_url: nda_document_url ?? null,
    }).eq("id", id);
  }

  if (head_approved_by || new_status === "aprovado_head" || new_status === "aprovado_com_restricoes") {
    await svc().from("cm_asset_listings").update({
      head_approved_by: head_approved_by ?? caller.userId,
      head_approved_at: new Date().toISOString(),
    }).eq("id", id);
  }

  const { data: result } = await svc().rpc("transition_cm_listing_status", {
    p_listing_id: id,
    p_new_status: new_status,
    p_reason: reason ?? null,
    p_user_id: caller.userId,
    p_reason_category: reason_category ?? null,
  });

  if (!result) {
    return NextResponse.json({
      error: "Transição inválida. Verifique os gates obrigatórios (NDA assinado, aprovação Head).",
    }, { status: 422 });
  }

  const { data: listing } = await svc().from("cm_asset_listings")
    .select("id, anonymous_id, listing_status, nda_signed_at, head_approved_at, originator_profile_id, created_by")
    .eq("id", id).single();

  // Botao manual "Agendar Reuniao" (20/09/2026, pedido de Joao): alem de mover a etapa,
  // entrega o link da agenda do Head (na resposta e por notificacao). O gatilho automatico
  // so roda com a chave meeting_autotrigger ligada (ver app/api/cm/intake/[token]).
  let meetingUrl: string | undefined;
  if (new_status === "reuniao_agendada" && listing) {
    meetingUrl = CM_MEETING_URL;
    await notifyMeetingLink({
      userId: listing.created_by ?? listing.originator_profile_id ?? caller.userId,
      title: `Ativo ${listing.anonymous_id}: agende a reunião inicial`,
      intro: "A Mesa liberou o agendamento.",
      actionUrl: "/bolsa/mesa",
    });
  }

  // Etapa 7 (20/09/2026): ativo liquidado conclui o mandato de compra vinculado a oferta
  // aceita (cm_bids.demand_id). Best-effort: o fechamento do ativo nunca depende disto.
  if (new_status === "liquidado" && listing) {
    const { data: acceptedBids } = await svc()
      .from("cm_bids")
      .select("demand_id")
      .eq("listing_id", id)
      .eq("status", "aceita")
      .not("demand_id", "is", null);
    const demandIds = [...new Set((acceptedBids ?? []).map((b) => b.demand_id as string))];
    for (const demandId of demandIds) {
      await svc().rpc("transition_cm_demand_status", {
        p_demand_id: demandId,
        p_new_status: "concluido",
        p_reason: `Ativo ${listing.anonymous_id} liquidado, mandato concluído.`,
        p_user_id: caller.userId,
      });
    }
  }

  // Notifica o Partner originador (push real + in-app) -- achado 13/08/2026: a infra ja
  // existia (lib/push.ts, VAPID configurado) mas nunca era chamada em nenhuma transicao de
  // status da Bolsa de Ativos. Fire-and-forget, nunca bloqueia a resposta da rota.
  if (listing?.originator_profile_id) {
    const label = STATUS_LABELS[listing.listing_status] ?? listing.listing_status;
    void createNotification({
      user_id: listing.originator_profile_id,
      title: `Ativo ${listing.anonymous_id}: ${label}`,
      message: `O status do ativo que você originou mudou para "${label}".`,
      type: "marketplace",
      action_url: "/meus-ativos",
    });
  }

  return NextResponse.json({ success: true, listing, meeting_url: meetingUrl });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const caller = await getCallerRole(req);
  if (!caller || !ADMIN_ROLES.includes(caller.role)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const { data, error } = await svc()
    .from("cm_status_transitions")
    .select("*")
    .eq("listing_id", id)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ transitions: data ?? [] });
}
