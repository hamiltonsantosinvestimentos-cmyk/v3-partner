import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { createNotification } from "@/lib/notify";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const ADMIN_ROLES = ["ADMIN", "GESTAO"];

const STATUS_LABELS: Record<string, string> = {
  reuniao_validada: "Reunião Validada",
  formulario_preenchido: "Formulário Preenchido",
  nda_assinado: "NDA Assinado",
  em_analise: "Em Análise",
  aprovado_head: "Aprovado pela Diretoria",
  ativo_vitrine: "Ativo na Vitrine",
  proposta_recebida: "Proposta Recebida",
  em_escrow_due_diligence: "Em Escrow / Due Diligence",
  liquidado: "Liquidado",
  cancelado: "Cancelado",
  expirado: "Expirado",
};

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
  const { new_status, reason, nda_signed_at, nda_document_url, head_approved_by } = body;

  if (!new_status) {
    return NextResponse.json({ error: "Campo obrigatório: new_status" }, { status: 422 });
  }

  const headOnlyStatuses = ["aprovado_head", "ativo_vitrine", "em_escrow_due_diligence", "liquidado"];
  if (headOnlyStatuses.includes(new_status) && !ADMIN_ROLES.includes(caller.role)) {
    return NextResponse.json({ error: "Apenas ADMIN/GESTAO pode aprovar esta transição" }, { status: 403 });
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

  if (head_approved_by || new_status === "aprovado_head") {
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
  });

  if (!result) {
    return NextResponse.json({
      error: "Transição inválida. Verifique os gates obrigatórios (NDA assinado, aprovação Head).",
    }, { status: 422 });
  }

  const { data: listing } = await svc().from("cm_asset_listings")
    .select("id, anonymous_id, listing_status, nda_signed_at, head_approved_at, originator_profile_id")
    .eq("id", id).single();

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

  return NextResponse.json({ success: true, listing });
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
