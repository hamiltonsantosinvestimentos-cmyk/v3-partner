import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

function serviceClient() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

/** GET /api/tickets/comments?ticket_id=xxx */
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const ticket_id = searchParams.get("ticket_id");
  if (!ticket_id) return NextResponse.json({ error: "ticket_id obrigatório" }, { status: 400 });

  const svc = serviceClient();
  const { data, error } = await svc
    .from("ticket_comments")
    .select(`id, content, created_at, author:profiles(id, full_name)`)
    .eq("ticket_id", ticket_id)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ comments: data ?? [] });
}

/** POST /api/tickets/comments */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { ticket_id, content, send_email, send_chat } = await req.json();
  if (!ticket_id || !content?.trim()) {
    return NextResponse.json({ error: "ticket_id e content obrigatórios" }, { status: 400 });
  }

  const svc = serviceClient();

  // Busca perfil do autor para incluir no sender_name do chat
  const { data: authorProfile } = await svc
    .from("profiles")
    .select("full_name, role")
    .eq("id", user.id)
    .single();

  // Insere o comentário
  const { data, error } = await svc
    .from("ticket_comments")
    .insert({ ticket_id, author_id: user.id, content: content.trim() })
    .select(`id, content, created_at, author:profiles(id, full_name)`)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let emailSent = false;
  let chatSent = false;

  if (send_email || send_chat) {
    // Busca ticket + solicitante
    const { data: ticket } = await svc
      .from("operational_tickets")
      .select(`id, code, title, requester_id`)
      .eq("id", ticket_id)
      .single();

    if (ticket) {
      const requesterId: string | null = ticket.requester_id ?? null;

      // Busca nome do solicitante separadamente
      let requesterName = "Partner";
      if (requesterId) {
        const { data: rp } = await svc.from("profiles").select("full_name").eq("id", requesterId).single();
        requesterName = rp?.full_name ?? "Partner";
      }
      const authorName = authorProfile?.full_name ?? "Mesa Operacional V3";

      // ── Email ────────────────────────────────────────────────────────────────
      if (send_email && requesterId && process.env.RESEND_API_KEY) {
        try {
          const { data: authUser } = await svc.auth.admin.getUserById(requesterId);
          const partnerEmail = authUser?.user?.email ?? null;

          if (partnerEmail) {
            const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Novo comentário — V3 Partners</title>
</head>
<body style="margin:0;padding:0;background:#09081A;font-family:'DM Sans',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#09081A;padding:32px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#111F35;border:1px solid #243A66;border-radius:16px;overflow:hidden;max-width:600px;">
          <tr>
            <td style="padding:28px 32px;background:linear-gradient(135deg,#09081A 0%,#162744 100%);border-bottom:1px solid #C9A84C30;">
              <p style="margin:0;font-size:20px;font-weight:700;color:#C9A84C;letter-spacing:0.5px;">V3 Partners</p>
              <p style="margin:4px 0 0;font-size:12px;color:#7A8FA8;">Plataforma de Estruturação Financeira</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 8px;font-size:13px;color:#7A8FA8;">Olá, <strong style="color:#F0ECE4;">${requesterName}</strong></p>
              <h2 style="margin:0 0 24px;font-size:18px;font-weight:700;color:#F0ECE4;">
                💬 Novo comentário no seu ticket
              </h2>
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#162744;border:1px solid #243A6680;border-radius:12px;margin-bottom:24px;">
                <tr>
                  <td style="padding:20px;">
                    <p style="margin:0 0 4px;font-size:10px;font-weight:700;color:#C9A84C;letter-spacing:1px;text-transform:uppercase;">TICKET ${ticket.code}</p>
                    <p style="margin:0 0 16px;font-size:15px;font-weight:600;color:#F0ECE4;">${ticket.title}</p>
                    <p style="margin:0 0 6px;font-size:11px;font-weight:600;color:#7A8FA8;text-transform:uppercase;letter-spacing:0.5px;">Comentário de ${authorName}</p>
                    <p style="margin:0;font-size:13px;color:#F0ECE4;line-height:1.6;white-space:pre-wrap;">${content.trim()}</p>
                  </td>
                </tr>
              </table>
              <table cellpadding="0" cellspacing="0" style="margin:0 auto 24px;">
                <tr>
                  <td style="background:#C9A84C;border-radius:10px;">
                    <a href="${process.env.NEXT_PUBLIC_APP_URL ?? "https://app.v3partners.com.br"}/mesa-operacional"
                      style="display:inline-block;padding:14px 28px;font-size:13px;font-weight:700;color:#09081A;text-decoration:none;">
                      Acessar Plataforma →
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
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
                "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
              },
              body: JSON.stringify({
                from: process.env.EMAIL_FROM ?? "V3 Partners <noreply@v3partners.com.br>",
                to: [partnerEmail],
                subject: `Novo comentário no ticket ${ticket.code} — V3 Partners`,
                html,
              }),
            });
            emailSent = emailRes.ok;
          }
        } catch { /* silent */ }
      }

      // ── Chat ─────────────────────────────────────────────────────────────────
      if (send_chat && requesterId) {
        try {
          const chatContent = `💬 Comentário no ticket ${ticket.code} — ${ticket.title}:\n\n${content.trim()}`;
          const { error: chatErr } = await svc
            .from("chat_messages")
            .insert({
              room_id: `partner_${requesterId}`,
              sender_id: user.id,
              sender_name: authorName,
              sender_role: authorProfile?.role ?? "MESA_OPERACIONAL",
              content: chatContent,
            });
          chatSent = !chatErr;
        } catch { /* silent */ }
      }
    }
  }

  return NextResponse.json({ comment: data, emailSent, chatSent }, { status: 201 });
}
