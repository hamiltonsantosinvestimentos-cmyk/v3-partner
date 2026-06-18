import { NextRequest, NextResponse } from "next/server";
import { createClient as sc } from "@supabase/supabase-js";
import { buildTecEmail2 } from "@/components/propostas/tec-email-templates";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

function fmtBRLNum(v?: number | null) {
  if (!v) return "—";
  return `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const { data: acc } = await svc()
    .from("tec_acceptances")
    .select("*, commercial_proposals(*)")
    .eq("token", token)
    .single();

  if (!acc) return NextResponse.json({ error: "Token não encontrado" }, { status: 404 });

  if (acc.status === "accepted") {
    return NextResponse.json({ error: "Este mandato já foi aceito.", accepted_at: acc.accepted_at }, { status: 409 });
  }

  if (new Date(acc.expires_at) < new Date()) {
    await svc().from("tec_acceptances").update({ status: "expired" }).eq("id", acc.id);
    return NextResponse.json({ error: "Este mandato expirou. Solicite um novo link à equipe V3 Partners." }, { status: 410 });
  }

  const p = acc.commercial_proposals;
  const feeValue = p?.value && p?.tec_percentage ? p.value * p.tec_percentage / 100 : null;

  return NextResponse.json({
    fund_name: p?.fund_name ?? "",
    deal_code: p?.deal_code_ref ?? p?.code ?? "",
    tec_percentage: acc.tec_percentage,
    fee_value: fmtBRLNum(feeValue),
    deal_value: fmtBRLNum(p?.value),
    recipient_name: p?.recipient_name ?? "",
    penalty_clause: acc.penalty_clause,
    negativation_clause: acc.negativation_clause,
    status: acc.status,
  });
}

function fmtBRL(v?: number | null) {
  if (!v) return "—";
  return `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
}

function fmtDate(d: Date) {
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const body = await req.json().catch(() => ({}));
  const acceptedBy = body.accepted_by?.trim();

  if (!acceptedBy) return NextResponse.json({ error: "Campo 'accepted_by' obrigatório" }, { status: 422 });

  // 1. Buscar acceptance
  const { data: acc } = await svc()
    .from("tec_acceptances")
    .select("*, commercial_proposals(*)")
    .eq("token", token)
    .single();

  if (!acc) return NextResponse.json({ error: "Token não encontrado" }, { status: 404 });
  if (acc.status === "accepted") return NextResponse.json({ error: "Mandato já aceito", accepted_at: acc.accepted_at }, { status: 409 });
  if (new Date(acc.expires_at) < new Date()) {
    await svc().from("tec_acceptances").update({ status: "expired" }).eq("id", acc.id);
    return NextResponse.json({ error: "Mandato expirado. Solicite um novo link à equipe V3 Partners." }, { status: 410 });
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? req.headers.get("x-real-ip") ?? "";
  const ua = req.headers.get("user-agent") ?? "";

  // 2. Atualizar acceptance
  await svc().from("tec_acceptances").update({
    status: "accepted",
    accepted_by: acceptedBy,
    accepted_email: acc.commercial_proposals?.recipient_email ?? "",
    ip_address: ip,
    user_agent: ua,
    accepted_at: new Date().toISOString(),
  }).eq("id", acc.id);

  // 3. Atualizar proposal
  const proposal = acc.commercial_proposals;
  await svc().from("commercial_proposals").update({
    status: "signed",
    signed_at: new Date().toISOString(),
  }).eq("id", acc.proposal_id);

  // 4. Enviar Email 2 (pós-aceite)
  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey && proposal) {
    try {
      const meetingFormatted = proposal.meeting_at ? fmtDate(new Date(proposal.meeting_at)) : undefined;

      const emailHtml = buildTecEmail2({
        fund_name: proposal.fund_name ?? "",
        deal_code: proposal.deal_code_ref ?? proposal.code,
        tec_percentage: proposal.tec_percentage ?? acc.tec_percentage,
        fee_value: fmtBRL(proposal.value && proposal.tec_percentage ? proposal.value * proposal.tec_percentage / 100 : null),
        deal_value: fmtBRL(proposal.value),
        recipient_name: proposal.recipient_name,
        meeting_link: proposal.meeting_link ?? undefined,
        meeting_date_formatted: meetingFormatted,
        accepted_date: new Date().toLocaleDateString("pt-BR"),
      });

      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "inteligencia@v3partners.com.br",
          to: [proposal.recipient_email],
          cc: proposal.partner_email ? [proposal.partner_email] : undefined,
          subject: `Mandato TEC Aceito — Próximos Passos · ${proposal.fund_name ?? ""}`,
          html: emailHtml,
        }),
      });
    } catch (e) {
      void svc().from("execution_errors").insert({ workflow: "mandato-tec/accept Resend", error_message: String(e), severity: "medium" });
    }
  }

  // 5. Log
  if (proposal) {
    void svc().from("proposal_messages").insert({
      proposal_id: acc.proposal_id,
      sender_id: null,
      sender_name: acceptedBy,
      sender_role: "CLIENTE",
      content: `Mandato TEC aceito por ${acceptedBy} (IP: ${ip})`,
      type: "client_update",
    });
  }

  return NextResponse.json({ ok: true, message: "Mandato TEC aceito com sucesso." });
}
