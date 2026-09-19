import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { createNotification } from "@/lib/notify";
import {
  DEMAND_STATUS_LABELS,
  DEMAND_NEXT_ACTIONS,
  DEMAND_DECLINE_REASON_VALUES,
  DEMAND_KYC_REQUIRED_FOR,
} from "@/lib/cm-demand-stages";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const ADMIN_ROLES = ["ADMIN", "GESTAO"];
const MESA_ROLES = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"];

/** POST /api/cm/investor-demands/[id]/status
 *  Fase 5, sub-entrega 5.3 (19/09/2026): a Mesa move a demanda de compra pelas etapas
 *  do pipeline, espelho de PATCH /api/cm/listings/[id]/status do lado venda.
 *  A autoridade final e transition_cm_demand_status() no banco; esta rota valida antes
 *  so pra devolver mensagem especifica (a funcao so retorna true/false) e aplicar os
 *  gates de papel. Body: { new_status, reason?, reason_category? }.
 *  Blind Wall: o texto livre do motivo fica so em cm_status_transitions (auditoria
 *  interna); a nota de timeline visivel ao partner de origem leva apenas a etapa. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const db = svc();
  const { data: profile } = await db.from("profiles").select("role").eq("id", user.id).single();
  const role = profile?.role as string | undefined;
  if (!role || !MESA_ROLES.includes(role)) {
    return NextResponse.json({ error: "Apenas ADMIN/GESTAO/MESA_OPERACIONAL" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const newStatus = typeof body.new_status === "string" ? body.new_status : "";
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  const reasonCategory = typeof body.reason_category === "string" ? body.reason_category : "";

  if (!newStatus) return NextResponse.json({ error: "Campo obrigatório: new_status" }, { status: 422 });

  const { data: demand } = await db
    .from("investor_demands")
    .select("id, status, nome_contato, apelido, origin_partner_id, kyc_approved_at, nda_accepted_at")
    .eq("id", id)
    .maybeSingle();
  if (!demand) return NextResponse.json({ error: "Demanda não encontrada" }, { status: 404 });

  const action = (DEMAND_NEXT_ACTIONS[demand.status] ?? []).find((a) => a.to === newStatus);
  if (!action) {
    return NextResponse.json({
      error: `Transição não permitida a partir de "${DEMAND_STATUS_LABELS[demand.status] ?? demand.status}".`,
    }, { status: 422 });
  }

  if (action.headOnly && !ADMIN_ROLES.includes(role)) {
    return NextResponse.json({ error: "Apenas ADMIN/GESTAO pode aprovar ou liberar esta etapa" }, { status: 403 });
  }

  if (action.needsCategory && !DEMAND_DECLINE_REASON_VALUES.includes(reasonCategory)) {
    return NextResponse.json({
      error: `Categoria de motivo inválida ou ausente. Use uma de: ${DEMAND_DECLINE_REASON_VALUES.join(", ")}`,
    }, { status: 422 });
  }
  if (action.needsReason && !reason) {
    return NextResponse.json({
      error: newStatus === "reprovado" ? "Justificativa obrigatória para reprovar a demanda" : "Texto da restrição é obrigatório para aprovar com restrições",
    }, { status: 422 });
  }

  if (newStatus === "nda_assinado" && !demand.nda_accepted_at) {
    return NextResponse.json({ error: "NDA ainda não aceito por este comprador. Não é possível avançar." }, { status: 422 });
  }
  if (DEMAND_KYC_REQUIRED_FOR.includes(newStatus) && !demand.kyc_approved_at) {
    return NextResponse.json({
      error: "KYC ainda não aprovado. Aprove o checklist de KYC do comprador antes de aprovar a demanda.",
    }, { status: 422 });
  }

  // Head que aprova fica registrado na propria demanda (a funcao do banco exige
  // head_approved_by preenchido pra aprovado_head / aprovado_com_restricoes).
  if (newStatus === "aprovado_head" || newStatus === "aprovado_com_restricoes") {
    await db.from("investor_demands").update({
      head_approved_by: user.id,
      head_approved_at: new Date().toISOString(),
    }).eq("id", id);
  }

  const { data: ok, error: rpcError } = await db.rpc("transition_cm_demand_status", {
    p_demand_id: id,
    p_new_status: newStatus,
    p_reason: reason || null,
    p_user_id: user.id,
    p_reason_category: reasonCategory || null,
  });

  if (rpcError || !ok) {
    if (newStatus === "aprovado_head" || newStatus === "aprovado_com_restricoes") {
      await db.from("investor_demands").update({ head_approved_by: null, head_approved_at: null }).eq("id", id);
    }
    return NextResponse.json({
      error: "Transição inválida. Verifique os gates obrigatórios (NDA aceito, aprovação do Head, motivo).",
    }, { status: 422 });
  }

  const label = DEMAND_STATUS_LABELS[newStatus] ?? newStatus;

  // Timeline: so a etapa, nunca o texto do motivo (ver cabecalho, Blind Wall).
  void db.from("cm_deal_notes").insert({
    demand_id: id,
    content: `Etapa da demanda alterada para "${label}".`,
    is_system: true,
  });

  if (demand.origin_partner_id) {
    const nome = demand.apelido || (demand.nome_contato !== "Pendente" ? demand.nome_contato : "sua demanda");
    void createNotification({
      user_id: demand.origin_partner_id,
      title: `Demanda ${nome}: ${label}`,
      message: `A demanda de compra que você originou mudou para "${label}".`,
      type: "marketplace",
      action_url: "/meus-compradores",
    });
  }

  return NextResponse.json({ success: true, status: newStatus, label });
}
