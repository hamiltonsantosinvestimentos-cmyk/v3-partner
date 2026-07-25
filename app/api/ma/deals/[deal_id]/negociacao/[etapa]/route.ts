import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { notifyDealTimeline } from "@/lib/ma-negociacao-notify";
import { STAGES } from "@/lib/ma-negociacao-stages";

// Todo email do sistema V3 passa por um workflow n8n dedicado (formata o
// HTML + roda o Brand Audit bloqueante antes de disparar via Resend) — nunca
// Resend chamado direto de uma API route. Ver W14, workflow ypTD3V5MBhWLV32m.
const N8N_EMAIL_WEBHOOK = "https://n8n-514n.onrender.com/webhook/v3-negociacao-email";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const ALLOWED = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"];

type RouteContext = { params: Promise<{ deal_id: string; etapa: string }> };

// POST — aciona uma etapa da esteira de negociação: cria (ou reaproveita, se
// já existir um convite pendente sem documento assinado) o deal_room_invite
// e manda por email o link publico de intake. A assinatura em si continua
// acontecendo do jeito que já existe (destinatario preenche o formulario
// publico, isso dispara o ClickSign) — esta rota só cobre o "convite".
export async function POST(req: NextRequest, ctx: RouteContext) {
  const { deal_id: dealId, etapa } = await ctx.params;

  const stage = STAGES.find(s => s.etapa === etapa);
  if (!stage) return NextResponse.json({ error: "Etapa desconhecida" }, { status: 404 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = svc();
  const { data: profile } = await db.from("profiles").select("role").eq("id", user.id).single();
  if (!ALLOWED.includes(profile?.role ?? "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const nome = (body.nome ?? "").trim();
  const email = (body.email ?? "").trim();
  if (!nome || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Informe nome e email válidos do signatário." }, { status: 422 });
  }

  const { data: deal, error: dealErr } = await db
    .from("ma_deals")
    .select("id, v3_code, legacy_code, target_company")
    .eq("id", dealId)
    .single();
  if (dealErr || !deal) return NextResponse.json({ error: "Deal não encontrado" }, { status: 404 });

  // Já existe documento gerado para esta etapa? Se sim, esta rota não é o
  // caminho certo (o reenvio de assinatura já em curso usa
  // /api/ma/loi-contracts/[id]/resend, que reenvia a notificação ClickSign).
  const { data: template } = await db
    .from("contract_templates")
    .select("id")
    .eq("template_name", stage.templateName)
    .single();

  if (template) {
    const { data: existingContract } = await db
      .from("operation_contracts")
      .select("id, status_signature")
      .eq("deal_id", dealId)
      .eq("template_id", template.id)
      .eq("vertical", "ma")
      .maybeSingle();
    if (existingContract) {
      return NextResponse.json(
        { error: "Esta etapa já tem documento gerado. Use o reenvio de assinatura, não crie um novo convite." },
        { status: 409 }
      );
    }
  }

  // Sala do deal: reaproveita a mais recente, ou cria uma nova dedicada à
  // negociação se o deal ainda não tiver nenhuma.
  let { data: room } = await db
    .from("deal_rooms")
    .select("id")
    .eq("deal_id", dealId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!room) {
    const { data: newRoom, error: roomErr } = await db
      .from("deal_rooms")
      .insert({ deal_id: dealId, created_by: user.id, name: `Negociação, ${deal.v3_code ?? deal.legacy_code ?? dealId}` })
      .select("id")
      .single();
    if (roomErr || !newRoom) return NextResponse.json({ error: `Falha ao criar sala do deal: ${roomErr?.message}` }, { status: 500 });
    room = newRoom;
    await db.from("ma_deals").update({ has_deal_room: true }).eq("id", dealId);
  }

  // Reaproveita convite pendente da mesma etapa, se existir (evita acumular
  // convites órfãos a cada clique em "reenviar").
  const { data: pendingInvite } = await db
    .from("deal_room_invites")
    .select("id, token, investor_name, investor_email")
    .eq("deal_room_id", room.id)
    .eq("access_side", stage.accessSide)
    .eq("source_group", `negociacao:${etapa}`)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.v3partners.com.br";
  const dealCode = deal.v3_code ?? deal.legacy_code ?? "V3-DEAL";

  let inviteId: string;
  let token: string;

  if (pendingInvite) {
    inviteId = pendingInvite.id;
    token = pendingInvite.token;
    // Atualiza nome/email caso a mesa tenha corrigido o destinatário.
    await db.from("deal_room_invites").update({ investor_name: nome, investor_email: email, sent_at: new Date().toISOString() }).eq("id", inviteId);
  } else {
    token = crypto.randomUUID().replace(/-/g, "");
    const tokenExpiresAt = new Date();
    tokenExpiresAt.setDate(tokenExpiresAt.getDate() + 30);

    const { data: invite, error: invErr } = await db
      .from("deal_room_invites")
      .insert({
        deal_room_id: room.id,
        investor_name: nome,
        investor_email: email,
        access_side: stage.accessSide,
        source_group: `negociacao:${etapa}`,
        token,
        token_expires_at: tokenExpiresAt.toISOString(),
        sent_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (invErr || !invite) return NextResponse.json({ error: `Falha ao criar convite: ${invErr?.message}` }, { status: 500 });
    inviteId = invite.id;
  }

  const intakeUrl = `${appUrl}/intake/${etapa}/${token}`;

  let emailSent = false;
  try {
    const n8nRes = await fetch(N8N_EMAIL_WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: email,
        nome,
        etapa,
        stageLabel: stage.label,
        dealName: deal.target_company ?? dealCode,
        dealCode,
        intakeUrl,
        role: stage.role,
      }),
    });
    const n8nBody = await n8nRes.json().catch(() => null);
    emailSent = n8nRes.ok && n8nBody?.ok === true;
    if (!emailSent) console.error("[negociacao/invite] W14 n8n falhou:", n8nRes.status, n8nBody);
  } catch (e) {
    console.error("[negociacao/invite] Erro ao chamar W14 n8n:", e);
  }

  await notifyDealTimeline({
    dealId,
    title: `${stage.label} enviada a ${nome}`,
    message: `Convite de ${stage.label} enviado para ${email}.${emailSent ? "" : " (email não confirmado, verificar manualmente)"}`,
    type: "negociacao_convite",
  });

  return NextResponse.json({ invite_id: inviteId, token, url: intakeUrl, email_sent: emailSent });
}
