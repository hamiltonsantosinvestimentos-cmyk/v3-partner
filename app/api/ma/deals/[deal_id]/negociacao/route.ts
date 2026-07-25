import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { STAGES } from "@/lib/ma-negociacao-stages";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const ALLOWED = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"];

type RouteContext = { params: Promise<{ deal_id: string }> };

// GET — status das 4 etapas da esteira de negociação para um deal especifico,
// para a aba "Negociação" dentro do modal do deal na Mesa M&A.
export async function GET(_req: NextRequest, ctx: RouteContext) {
  const { deal_id: dealId } = await ctx.params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = svc();
  const { data: profile } = await db.from("profiles").select("role").eq("id", user.id).single();
  if (!ALLOWED.includes(profile?.role ?? "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: deal, error: dealErr } = await db
    .from("ma_deals")
    .select("id, v3_code, legacy_code")
    .eq("id", dealId)
    .single();
  if (dealErr || !deal) return NextResponse.json({ error: "Deal não encontrado" }, { status: 404 });

  const { data: room } = await db
    .from("deal_rooms")
    .select("id")
    .eq("deal_id", dealId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const templateNames = STAGES.map(s => s.templateName);
  const { data: templates } = await db
    .from("contract_templates")
    .select("id, template_name")
    .in("template_name", templateNames);
  const templateIdByName = new Map((templates ?? []).map(t => [t.template_name, t.id]));

  const { data: contracts } = await db
    .from("operation_contracts")
    .select("id, template_id, status_signature, external_envelope_id, deal_room_invite_id, created_at, signed_at")
    .eq("deal_id", dealId)
    .eq("vertical", "ma")
    .not("template_id", "is", null)
    .order("created_at", { ascending: false });

  const { data: invites } = room
    ? await db
        .from("deal_room_invites")
        .select("id, investor_name, investor_email, access_side, source_group, token, status, sent_at, created_at")
        .eq("deal_room_id", room.id)
        .order("created_at", { ascending: false })
    : { data: [] as never[] };

  const stages = STAGES.map(stage => {
    const templateId = templateIdByName.get(stage.templateName) ?? null;
    const contract = templateId
      ? (contracts ?? []).find(c => c.template_id === templateId) ?? null
      : null;

    if (contract) {
      const invite = (invites ?? []).find(i => i.id === contract.deal_room_invite_id) ?? null;
      return {
        etapa: stage.etapa,
        label: stage.label,
        status: contract.status_signature as "enviado_assinatura" | "assinado" | "rascunho",
        contractId: contract.id,
        externalEnvelopeId: contract.external_envelope_id,
        signedAt: contract.signed_at,
        invite: invite
          ? { id: invite.id, nome: invite.investor_name, email: invite.investor_email, token: invite.token }
          : null,
      };
    }

    // Sem documento gerado ainda: procura convite pendente desta etapa
    // especifica (disambiguado por source_group, já que FPA Venda e
    // Contrato de Venda compartilham o mesmo access_side "seller").
    const pendingInvite = (invites ?? []).find(
      i => i.access_side === stage.accessSide && i.source_group === `negociacao:${stage.etapa}`
    );

    return {
      etapa: stage.etapa,
      label: stage.label,
      status: pendingInvite ? ("convite_enviado" as const) : ("nao_iniciado" as const),
      contractId: null,
      externalEnvelopeId: null,
      signedAt: null,
      invite: pendingInvite
        ? { id: pendingInvite.id, nome: pendingInvite.investor_name, email: pendingInvite.investor_email, token: pendingInvite.token }
        : null,
    };
  });

  return NextResponse.json({
    dealId,
    dealCode: deal.v3_code ?? deal.legacy_code ?? deal.id,
    dealRoomId: room?.id ?? null,
    stages,
  });
}
