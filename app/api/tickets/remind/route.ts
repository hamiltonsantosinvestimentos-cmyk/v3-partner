import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

function serviceClient() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const ADMIN_ROLES = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"] as const;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .eq("id", user.id)
    .single();

  if (!profile || !ADMIN_ROLES.includes(profile.role as typeof ADMIN_ROLES[number])) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const body = await req.json();
  const { ticket_id, proposal_id } = body ?? {};
  if (!ticket_id && !proposal_id) {
    return NextResponse.json({ error: "ticket_id ou proposal_id obrigatório" }, { status: 400 });
  }

  const svc = serviceClient();

  let partnerId: string | null = null;
  let partnerName = "Partner";
  let partnerEmail: string | null = null;
  let pendingReason = "Pendência não especificada";
  let pendingAt = new Date().toLocaleDateString("pt-BR");
  let entityTitle = "";
  let entityCode = "";
  let entityId = "";
  let isTicket = !!ticket_id;

  if (ticket_id) {
    // ── Fluxo Ticket ──────────────────────────────────────────────────────────
    const { data: ticket, error: ticketErr } = await svc
      .from("operational_tickets")
      .select(`
        id, code, title, status, pending_reason, pending_at,
        requester_id,
        requester:profiles!operational_tickets_requester_id_fkey(id, full_name, email)
      `)
      .eq("id", ticket_id)
      .single();

    if (ticketErr || !ticket) {
      return NextResponse.json({ error: "Ticket não encontrado" }, { status: 404 });
    }
    if (ticket.status !== "PENDING") {
      return NextResponse.json({ error: "Ticket não está com status pendente" }, { status: 400 });
    }

    const requester = ticket.requester as { id: string; full_name: string; email: string | null } | null;
    partnerId = requester?.id ?? ticket.requester_id ?? null;
    partnerName = requester?.full_name ?? "Partner";
    partnerEmail = requester?.email ?? null;
    pendingReason = ticket.pending_reason ?? "Pendência não especificada";
    pendingAt = ticket.pending_at
      ? new Date(ticket.pending_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })
      : new Date().toLocaleDateString("pt-BR");
    entityTitle = ticket.title;
    entityCode = ticket.code;
    entityId = ticket.id;

  } else {
    // ── Fluxo Proposta/Deal ────────────────────────────────────────────────────
    const { data: proposal, error: proposalErr } = await svc
      .from("credit_desk_proposals")
      .select("id, code, title, stage, pending_reason, pending_at, partner_id")
      .eq("id", proposal_id)
      .single();

    if (proposalErr || !proposal) {
      return NextResponse.json({ error: "Proposta não encontrada" }, { status: 404 });
    }

    partnerId = proposal.partner_id ?? null;
    pendingReason = proposal.pending_reason ?? "Pendência não especificada";
    pendingAt = proposal.pending_at
      ? new Date(proposal.pending_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })
      : new Date().toLocaleDateString("pt-BR");
    entityTitle = proposal.title;
    entityCode = proposal.code;
    entityId = proposal.id;

    // Busca dados do partner
    if (partnerId) {
      const { data: partnerProfile } = await svc
        .from("profiles")
        .select("full_name")
        .eq("id", partnerId)
        .single();
      partnerName = partnerProfile?.full_name ?? "Partner";

      const { data: authUser } = await svc.auth.admin.getUserById(partnerId);
      partnerEmail = authUser?.user?.email ?? null;
    }
  }

  let emailSent = false;
  let chatSent = false;

  // ── Email via Resend ──────────────────────────────────────────────────────
  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey && partnerEmail) {
    try {
      const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Lembrete de Pendência — V3 Partners</title>
</head>
<body style="margin:0;padding:0;background:#09081A;font-family:'DM Sans',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#09081A;padding:32px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#111F35;border:1px solid #243A66;border-radius:16px;overflow:hidden;max-width:600px;">
          <!-- Header -->
          <tr>
            <td style="padding:28px 32px;background:linear-gradient(135deg,#09081A 0%,#162744 100%);border-bottom:1px solid #C9A84C30;">
              <p style="margin:0;font-size:20px;font-weight:700;color:#C9A84C;letter-spacing:0.5px;">V3 Partners</p>
              <p style="margin:4px 0 0;font-size:12px;color:#7A8FA8;">Plataforma de Estruturação Financeira</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 8px;font-size:13px;color:#7A8FA8;">Olá, <strong style="color:#F0ECE4;">${partnerName}</strong></p>
              <h2 style="margin:0 0 24px;font-size:18px;font-weight:700;color:#F0ECE4;">
                ⚠️ Lembrete: Pendência no seu processo V3 Partners
              </h2>
              <!-- Ticket Box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#162744;border:1px solid #FF6B6B30;border-radius:12px;margin-bottom:24px;">
                <tr>
                  <td style="padding:20px;">
                    <p style="margin:0 0 4px;font-size:10px;font-weight:700;color:#FF6B6B;letter-spacing:1px;text-transform:uppercase;">PENDÊNCIA ATIVA</p>
                    <p style="margin:0 0 16px;font-size:15px;font-weight:600;color:#F0ECE4;">${entityTitle}</p>
                    <p style="margin:0 0 6px;font-size:11px;font-weight:600;color:#7A8FA8;text-transform:uppercase;letter-spacing:0.5px;">Motivo da Pendência</p>
                    <p style="margin:0 0 16px;font-size:13px;color:#F0ECE4;line-height:1.5;font-style:italic;">${pendingReason}</p>
                    <p style="margin:0;font-size:11px;color:#7A8FA8;">Código: <span style="color:#C9A84C;font-family:monospace;">${entityCode}</span> &nbsp;|&nbsp; Em pendência desde: <span style="color:#F0ECE4;">${pendingAt}</span></p>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 24px;font-size:13px;color:#7A8FA8;line-height:1.6;">
                Por favor, acesse a plataforma para verificar e resolver a pendência o quanto antes. Nossa equipe está disponível para auxiliar você.
              </p>
              <!-- CTA -->
              <table cellpadding="0" cellspacing="0" style="margin:0 auto 24px;">
                <tr>
                  <td style="background:#C9A84C;border-radius:10px;">
                    <a href="${process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.v3partners.com.br'}/mesa-operacional"
                      style="display:inline-block;padding:14px 28px;font-size:13px;font-weight:700;color:#09081A;text-decoration:none;">
                      Acessar Plataforma →
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px;border-top:1px solid #243A66;">
              <p style="margin:0;font-size:11px;color:#7A8FA8;text-align:center;">
                V3 Partners Soluções Ltda · CNPJ 14.219.287/0001-50<br/>
                <a href="https://v3partners.com.br" style="color:#C9A84C;text-decoration:none;">v3partners.com.br</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

      const emailRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${resendKey}`,
        },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM ?? "V3 Partners <noreply@v3partners.com.br>",
          to: [partnerEmail],
          subject: `Lembrete: Pendência no seu processo V3 Partners — ${entityCode}`,
          html,
        }),
      });
      emailSent = emailRes.ok;
    } catch {
      // email falhou, continua
    }
  }

  // ── Chat: insere mensagem na sala do partner ──────────────────────────────
  if (partnerId) {
    try {
      const roomId = `partner_${partnerId}`;
      const chatContent = `⚠️ Lembrete de pendência: ${entityTitle}\n\nMotivo: ${pendingReason}\n\nPor favor, entre em contato para resolver.`;

      // Usa o ID do usuário admin atual como sender para passar FK constraints
      const { error: chatErr } = await svc
        .from("chat_messages")
        .insert({
          room_id: roomId,
          sender_id: user.id,
          sender_name: "Mesa Operacional V3",
          sender_role: "MESA_OPERACIONAL",
          content: chatContent,
        });

      chatSent = !chatErr;
    } catch {
      // chat falhou, continua
    }
  }

  // ── Atualiza reminder_sent_at ─────────────────────────────────────────────
  if (isTicket) {
    await svc
      .from("operational_tickets")
      .update({ reminder_sent_at: new Date().toISOString() })
      .eq("id", entityId);
  } else {
    await svc
      .from("credit_desk_proposals")
      .update({ reminder_sent_at: new Date().toISOString() } as Record<string, unknown>)
      .eq("id", entityId)
      .catch(() => {}); // coluna pode não existir, ignora erro
  }

  return NextResponse.json({ ok: true, emailSent, chatSent });
}
