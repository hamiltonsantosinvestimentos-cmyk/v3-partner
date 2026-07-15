import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { Resend } from "resend";
import { auditText, auditHtml } from "@/lib/brand-guardian-gate";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const ALLOWED = ["ADMIN", "GESTAO"];

type RouteContext = { params: Promise<{ id: string }> };

// ── POST /api/ma/deal-rooms/[id]/invite ───────────────────────────────────────
export async function POST(req: NextRequest, ctx: RouteContext) {
  const { id: deal_room_id } = await ctx.params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const db = svc();
  const { data: profile } = await db.from("profiles").select("role").eq("id", user.id).single();
  if (!ALLOWED.includes(profile?.role ?? "")) {
    return NextResponse.json({ error: "Acesso restrito a ADMIN e GESTAO" }, { status: 403 });
  }

  const body = await req.json();
  const {
    investor_name,
    investor_email,
    investor_company,
    source_group,       // ex: "btg-pactual", "xp-advisors", "direct"
    access_side = "buyer",  // buyer | intermediario | co_advisor | seller
    utm_params = {},
    message,
    expires_days = 7,
  } = body;

  if (!investor_name || !investor_email) {
    return NextResponse.json({ error: "investor_name e investor_email são obrigatórios" }, { status: 422 });
  }

  // Buscar sala e deal para construir URL
  const { data: room, error: roomErr } = await db
    .from("deal_rooms")
    .select("id, name, deal_id, nda_required, deal_id")
    .eq("id", deal_room_id)
    .single();

  if (roomErr || !room) {
    return NextResponse.json({ error: "Sala não encontrada" }, { status: 404 });
  }

  // Buscar v3_code do deal
  const { data: deal } = await db
    .from("ma_deals")
    .select("v3_code, code, target_company")
    .eq("id", room.deal_id)
    .single();

  const dealCode = deal?.v3_code ?? deal?.code ?? "V3-DEAL";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.v3partners.com.br";

  // Gerar token único
  const token = crypto.randomUUID().replace(/-/g, "");

  // Expiração configurável
  const tokenExpiresAt = new Date();
  tokenExpiresAt.setDate(tokenExpiresAt.getDate() + expires_days);

  // Construir URL parametrizada
  const vdrUrl = `${appUrl}/vdr/${dealCode}/${token}${source_group ? `?grp=${encodeURIComponent(source_group)}&side=${access_side}` : ""}`;

  // Inserir convite
  const { data: invite, error: invErr } = await db
    .from("deal_room_invites")
    .insert({
      deal_room_id,
      investor_name,
      investor_email,
      investor_company: investor_company ?? null,
      token,
      token_expires_at: tokenExpiresAt.toISOString(),
      source_group:     source_group ?? null,
      access_side,
      utm_params,
      sent_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (invErr) return NextResponse.json({ error: invErr.message }, { status: 500 });

  // Enviar email via Resend
  let emailSent = false;
  if (process.env.RESEND_API_KEY) {
    try {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const inviteHtmlGate = auditHtml(buildInviteEmail({
        investorName: investor_name,
        dealName:     deal?.target_company ?? dealCode,
        dealCode,
        vdrUrl,
        expiresDate:  tokenExpiresAt.toLocaleDateString("pt-BR"),
        message,
        requiresNda:  room.nda_required,
      }));
      if (inviteHtmlGate.blocking.length > 0) console.error("[deal-rooms/invite] Brand Guardian bloqueou:", inviteHtmlGate.blocking);
      await resend.emails.send({
        from:    "V3 Partners <noreply@v3partners.com.br>",
        to:      investor_email,
        subject: auditText(`Acesso ao Deal Room: ${deal?.target_company ?? dealCode} | V3 Partners`).corrected,
        html: inviteHtmlGate.corrected,
      });
      emailSent = true;
    } catch (e) {
      console.error("[deal-rooms/invite] Resend error:", e);
    }
  }

  return NextResponse.json({
    invite_id:   invite.id,
    token,
    vdr_url:     vdrUrl,
    email_sent:  emailSent,
    expires_at:  tokenExpiresAt.toISOString(),
    source_group: source_group ?? null,
    access_side,
  });
}

// ── Template de email ─────────────────────────────────────────────────────────
function buildInviteEmail(p: {
  investorName: string; dealName: string; dealCode: string;
  vdrUrl: string; expiresDate: string; message?: string; requiresNda: boolean;
}): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><style>
  body { font-family: 'DM Sans', Arial, sans-serif; background: #09081A; color: #F0ECE4; margin: 0; padding: 0; }
  .container { max-width: 560px; margin: 40px auto; }
  .header { background: #162744; border: 1px solid #243A66; border-radius: 12px 12px 0 0; padding: 24px; text-align: center; }
  .body { background: #13223A; border: 1px solid #243A66; border-top: none; border-radius: 0 0 12px 12px; padding: 28px; }
  .badge { display: inline-block; background: rgba(201,168,76,0.15); border: 1px solid rgba(201,168,76,0.3); border-radius: 4px; padding: 3px 10px; font-size: 11px; color: #E8C97A; font-weight: 600; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 12px; }
  .deal-name { font-size: 22px; font-weight: 800; color: #F0ECE4; margin: 0 0 4px; }
  .deal-code { font-size: 13px; color: #C9A84C; font-weight: 600; }
  p { color: #7A8FA8; font-size: 14px; line-height: 1.6; }
  .btn { display: block; width: fit-content; margin: 24px auto; background: #C9A84C; color: #09081A; text-decoration: none; font-weight: 700; font-size: 15px; padding: 14px 32px; border-radius: 10px; }
  .warning { font-size: 11px; color: #7A8FA8; text-align: center; margin-top: 20px; border-top: 1px solid #243A66; padding-top: 16px; }
</style></head>
<body>
<div class="container">
  <div class="header">
    <div class="badge">Deal Room Exclusivo</div>
    <h1 class="deal-name">${p.dealName}</h1>
    <div class="deal-code">${p.dealCode}</div>
  </div>
  <div class="body">
    <p>Prezado(a) <strong style="color:#F0ECE4">${p.investorName}</strong>,</p>
    <p>A <strong style="color:#F0ECE4">V3 Partners</strong> preparou um Deal Room exclusivo com os documentos de investimento deste ativo. Seu acesso foi configurado de forma individual e rastreável.</p>
    ${p.message ? `<p style="background:rgba(201,168,76,0.08);border-left:3px solid #C9A84C;padding:12px 16px;border-radius:0 8px 8px 0;">${p.message}</p>` : ""}
    ${p.requiresNda ? `<p><strong style="color:#E8C97A">Importante:</strong> O acesso requer a assinatura eletrônica de um Acordo de Confidencialidade (NDA). O processo é digital e leva menos de 1 minuto.</p>` : ""}
    <a href="${p.vdrUrl}" class="btn">Acessar Deal Room →</a>
    <p style="text-align:center;font-size:12px;">Link válido até <strong style="color:#F0ECE4">${p.expiresDate}</strong> · Exclusivo para este destinatário</p>
    <div class="warning">
      Este link é personalizado. Não repasse a terceiros.<br>
      V3 Partners · privacidade@v3partners.com.br · v3partners.com.br
    </div>
  </div>
</div>
</body>
</html>`;
}
