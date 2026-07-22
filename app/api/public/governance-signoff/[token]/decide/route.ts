import { NextRequest, NextResponse } from "next/server";
import { createClient as sc } from "@supabase/supabase-js";
import { getClientIp } from "@/lib/audit";

function serviceClient() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

interface RouteParams { params: Promise<{ token: string }> }

export async function POST(req: NextRequest, { params }: RouteParams) {
  const { token } = await params;
  const body = await req.json();
  const decision = body.decision;
  const note = typeof body.note === "string" ? body.note : null;

  if (decision !== "approved" && decision !== "rejected") {
    return NextResponse.json({ error: "decision deve ser 'approved' ou 'rejected'" }, { status: 422 });
  }

  const svc = serviceClient();
  const { data: signoff } = await svc.from("governance_signoffs").select("*").eq("token", token).single();
  if (!signoff) return NextResponse.json({ error: "Pedido de sign-off não encontrado" }, { status: 404 });
  if (signoff.decision !== "pending") {
    return NextResponse.json({ error: "Este pedido já foi decidido" }, { status: 409 });
  }

  const ip = getClientIp(req);
  const userAgent = req.headers.get("user-agent");

  const { error } = await svc.from("governance_signoffs").update({
    decision,
    decision_note: note,
    decided_at: new Date().toISOString(),
    ip_address: ip,
    user_agent: userAgent,
  }).eq("token", token);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Notifica quem pediu o sign-off, isolado para não bloquear a resposta ao usuário
  try {
    if (signoff.requested_by && process.env.RESEND_API_KEY) {
      const { data: requester } = await svc.from("profiles").select("email").eq("id", signoff.requested_by).single();
      if (requester?.email) {
        const { Resend } = await import("resend");
        const resend = new Resend(process.env.RESEND_API_KEY);
        const decisionLabel = decision === "approved" ? "Aprovado" : "Recusado";
        await resend.emails.send({
          from: "V3 Partners Governança <noreply@v3partners.com.br>",
          to: [requester.email],
          subject: `Sign-off decidido: ${signoff.subject} (${decisionLabel})`,
          html: `<div style="background:#09081A;color:#F5F1E8;font-family:'DM Sans',sans-serif;padding:32px;border-radius:8px;max-width:520px;margin:0 auto">
            <div style="color:#C9A84C;font-size:11px;font-weight:700;letter-spacing:3px;text-transform:uppercase;margin-bottom:16px">V3 Partners &middot; Governança</div>
            <h2 style="font-size:17px;margin-bottom:12px;color:#F5F1E8">${signoff.requested_of_name} ${decision === "approved" ? "aprovou" : "recusou"} o pedido</h2>
            <p style="color:#9BAFC5;font-size:13px;line-height:1.6"><strong style="color:#F5F1E8">Assunto:</strong> ${signoff.subject}</p>
            ${note ? `<p style="color:#9BAFC5;font-size:13px;line-height:1.6"><strong style="color:#F5F1E8">Observação:</strong> ${note}</p>` : ""}
          </div>`,
        });
      }
    }
  } catch (e) {
    console.error("Falha ao notificar sobre decisão de sign-off:", e);
  }

  return NextResponse.json({ success: true, decision });
}
