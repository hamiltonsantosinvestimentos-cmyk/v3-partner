import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const ALLOWED = ["ADMIN", "GESTAO", "MESA", "MESA_OPERACIONAL"];

type RouteContext = { params: Promise<{ deal_id: string }> };

// ── POST /api/ma/deals/[deal_id]/submit-partner ───────────────────────────────
export async function POST(req: NextRequest, ctx: RouteContext) {
  const { deal_id } = await ctx.params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const db = svc();
  const { data: profile } = await db
    .from("profiles")
    .select("role, full_name, email")
    .eq("id", user.id)
    .single();

  if (!ALLOWED.includes(profile?.role ?? "")) {
    return NextResponse.json({ error: "Acesso restrito a ADMIN, GESTAO, MESA e MESA_OPERACIONAL" }, { status: 403 });
  }

  const body = await req.json() as { partner_id?: string };
  const { partner_id } = body;
  if (!partner_id) return NextResponse.json({ error: "partner_id obrigatório" }, { status: 422 });

  // ── Ler deal ────────────────────────────────────────────────────────────────
  const { data: deal, error: dealErr } = await db
    .from("ma_deals")
    .select("id, v3_code, code, target_company, sector, deal_value, asset_data, location")
    .eq("id", deal_id)
    .single();

  if (dealErr || !deal) return NextResponse.json({ error: "Deal não encontrado" }, { status: 404 });

  // ── Ler parceiro ─────────────────────────────────────────────────────────────
  const { data: partner, error: partnerErr } = await db
    .from("integration_partners")
    .select("id, name, display_name, crm_type, api_key_enc, active, sla_days, config_json")
    .eq("id", partner_id)
    .single();

  if (partnerErr || !partner) return NextResponse.json({ error: "Parceiro não encontrado" }, { status: 404 });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.v3partners.com.br";
  const dealCode = (deal.v3_code ?? deal.code ?? "V3-DEAL") as string;
  const assetData = (deal.asset_data ?? {}) as Record<string, unknown>;

  // ── Buscar ou criar deal_room sem NDA (para análise de crédito) ──────────────
  let dealRoomId: string;

  const { data: existingRoom } = await db
    .from("deal_rooms")
    .select("id")
    .eq("deal_id", deal_id)
    .eq("nda_required", false)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingRoom) {
    dealRoomId = existingRoom.id;
  } else {
    const { data: newRoom, error: roomErr } = await db
      .from("deal_rooms")
      .insert({
        deal_id,
        created_by: user.id,
        name: `${dealCode} — Análise de Crédito`,
        nda_required: false,
        expires_at: null,
      })
      .select("id")
      .single();

    if (roomErr || !newRoom) {
      return NextResponse.json({ error: "Erro ao criar Deal Room: " + roomErr?.message }, { status: 500 });
    }
    dealRoomId = newRoom.id;
  }

  // ── Gerar VDR invite para securitizadora ─────────────────────────────────────
  const token = crypto.randomUUID().replace(/-/g, "");
  const tokenExpiresAt = new Date();
  tokenExpiresAt.setDate(tokenExpiresAt.getDate() + 30);

  const vdrUrl = `${appUrl}/vdr/${dealCode}/${token}?grp=securitizadora&side=credit_partner`;

  const { data: invite, error: invErr } = await db
    .from("deal_room_invites")
    .insert({
      deal_room_id: dealRoomId,
      investor_name: partner.display_name,
      investor_email: null,
      investor_company: partner.display_name,
      token,
      token_expires_at: tokenExpiresAt.toISOString(),
      source_group: "securitizadora",
      access_side: "credit_partner",
      utm_params: { partner_id: partner.id, partner_name: partner.name },
      sent_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (invErr) return NextResponse.json({ error: "Erro ao criar invite VDR: " + invErr.message }, { status: 500 });

  // ── Montar payload_snapshot imutável ─────────────────────────────────────────
  const slaDeadline = new Date();
  slaDeadline.setDate(slaDeadline.getDate() + (partner.sla_days ?? 5));

  const payloadSnapshot = {
    deal_code: dealCode,
    company: deal.target_company,
    sector: deal.sector,
    deal_value: deal.deal_value,
    location: deal.location,
    cnpj: assetData.cnpj ?? assetData.seller_cpf_cnpj ?? null,
    contato_nome: assetData.contato_nome ?? assetData.nome_cedente ?? null,
    contato_email: assetData.contato_email ?? null,
    contato_telefone: assetData.contato_telefone ?? null,
    garantia_tipo: assetData.garantia_tipo ?? null,
    garantia_valor: assetData.garantia_valor ?? assetData.valor_garantia ?? null,
    vdr_url: vdrUrl,
    submitted_by: profile?.full_name ?? profile?.email ?? user.email ?? "Mesa V3",
    submitted_at: new Date().toISOString(),
  };

  // ── Registrar submissão ───────────────────────────────────────────────────────
  const { data: submission, error: subErr } = await db
    .from("deal_partner_submissions")
    .insert({
      deal_id,
      partner_id,
      submitted_by: user.id,
      vdr_invite_id: invite.id,
      payload_snapshot: payloadSnapshot,
      status: "sent",
      sla_deadline: slaDeadline.toISOString(),
    })
    .select("id")
    .single();

  if (subErr) return NextResponse.json({ error: subErr.message }, { status: 500 });

  // ── Integração Pipedrive (só executa quando active=true e api_key_enc presente) ─
  let pipedriveSent = false;
  let pipedriveLeadId: string | null = null;

  if (partner.active && partner.api_key_enc && partner.crm_type === "pipedrive") {
    try {
      const apiKey = partner.api_key_enc as string;
      const leadTitle = `${payloadSnapshot.company ?? dealCode} — ${payloadSnapshot.sector ?? "M&A"} · V3 Partners`;

      const pipeRes = await fetch(
        `https://api.pipedrive.com/v1/leads?api_token=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: leadTitle,
            value: payloadSnapshot.deal_value
              ? { amount: payloadSnapshot.deal_value, currency: "BRL" }
              : undefined,
            note: `VDR V3 Partners: ${vdrUrl}\n\nOperação: ${dealCode}\nSetor: ${payloadSnapshot.sector}\nUF: ${payloadSnapshot.location ?? "—"}\nGarantia: ${payloadSnapshot.garantia_tipo ?? "—"} · R$ ${payloadSnapshot.garantia_valor ?? "—"}`,
          }),
        }
      );

      if (pipeRes.ok) {
        const pipeJson = await pipeRes.json() as { data?: { id: string } };
        pipedriveSent = true;
        pipedriveLeadId = pipeJson.data?.id ?? null;

        await db
          .from("deal_partner_submissions")
          .update({
            external_lead_id: pipedriveLeadId,
            external_url: pipedriveLeadId
              ? `https://app.pipedrive.com/leads/details/${pipedriveLeadId}`
              : null,
            status: "sent",
          })
          .eq("id", submission.id);
      }
    } catch (e) {
      console.error("[submit-partner] Pipedrive error:", e);
    }
  }

  return NextResponse.json({
    submission_id: submission.id,
    vdr_url: vdrUrl,
    vdr_invite_id: invite.id,
    pipedrive_sent: pipedriveSent,
    pipedrive_lead_id: pipedriveLeadId,
    sla_deadline: slaDeadline.toISOString(),
    partner: {
      id: partner.id,
      display_name: partner.display_name,
      active: partner.active,
    },
  });
}
