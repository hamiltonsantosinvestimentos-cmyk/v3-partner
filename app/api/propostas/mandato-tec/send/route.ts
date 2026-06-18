import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { buildTecEmail1 } from "@/components/propostas/tec-email-templates";

const ALLOWED = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"];

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

function fmtBRL(v?: number | null) {
  if (!v) return "—";
  return `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await svc().from("profiles").select("id, full_name, role").eq("id", user.id).single();
  if (!ALLOWED.includes(profile?.role ?? "")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { deal_code_ref, fund_name, tec_percentage, recipient_name, recipient_email,
          recipient_company, partner_name, partner_email, meeting_link, meeting_at, deal_value } = body;

  if (!deal_code_ref?.trim() || !fund_name?.trim() || !tec_percentage || !recipient_name?.trim() || !recipient_email?.trim()) {
    return NextResponse.json({ error: "deal_code_ref, fund_name, tec_percentage, recipient_name e recipient_email são obrigatórios" }, { status: 422 });
  }

  const tecPerc = Number(tec_percentage);
  const dealVal = deal_value ? Number(deal_value) : null;
  const feeValue = dealVal && tecPerc ? dealVal * tecPerc / 100 : null;

  // 1. Criar commercial_proposal tipo mandato_tec
  const { count } = await svc().from("commercial_proposals").select("*", { count: "exact", head: true });
  const code = `TEC-26-${String((count ?? 0) + 1).padStart(4, "0")}`;

  const { data: proposal, error: propErr } = await svc()
    .from("commercial_proposals")
    .insert({
      code,
      title: `Mandato TEC — ${fund_name.trim()}`,
      service_type: "mandato_tec",
      recipient_name: recipient_name.trim(),
      recipient_email: recipient_email.trim().toLowerCase(),
      recipient_company: recipient_company?.trim() ?? null,
      value: dealVal,
      description: `Taxa de Estruturação de Crédito: ${tecPerc}% sobre ${fmtBRL(dealVal)}`,
      deal_id: null,
      partner_name: partner_name?.trim() ?? null,
      partner_email: partner_email?.trim().toLowerCase() ?? null,
      created_by: user.id,
      status: "sent",
      sent_at: new Date().toISOString(),
      tec_percentage: tecPerc,
      fund_name: fund_name.trim(),
      meeting_link: meeting_link?.trim() ?? null,
      meeting_at: meeting_at ?? null,
      deal_code_ref: deal_code_ref.trim(),
      metadata: {},
    })
    .select()
    .single();

  if (propErr || !proposal) {
    void svc().from("execution_errors").insert({ workflow: "api/propostas/mandato-tec/send", error_message: propErr?.message ?? "Insert failed", severity: "high" });
    return NextResponse.json({ error: propErr?.message ?? "Erro ao criar proposta" }, { status: 500 });
  }

  // 2. Criar tec_acceptance com token
  const { data: acceptance, error: accErr } = await svc()
    .from("tec_acceptances")
    .insert({
      proposal_id: proposal.id,
      tec_percentage: tecPerc,
    })
    .select("token")
    .single();

  if (accErr || !acceptance) {
    void svc().from("execution_errors").insert({ workflow: "api/propostas/mandato-tec/send acceptance", error_message: accErr?.message ?? "Insert failed", severity: "high" });
    return NextResponse.json({ error: "Erro ao criar aceite" }, { status: 500 });
  }

  const host = req.headers.get("host") ?? "app.v3partners.com.br";
  const proto = host.includes("localhost") ? "http" : "https";
  const acceptanceUrl = `${proto}://${host}/aceite-tec/${acceptance.token}`;

  // 3. Enviar Email 1 via Resend
  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    try {
      const emailHtml = buildTecEmail1({
        fund_name: fund_name.trim(),
        deal_code: deal_code_ref.trim(),
        tec_percentage: tecPerc,
        fee_value: fmtBRL(feeValue),
        deal_value: fmtBRL(dealVal),
        recipient_name: recipient_name.trim(),
        acceptance_url: acceptanceUrl,
      });

      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "inteligencia@v3partners.com.br",
          to: [recipient_email.trim().toLowerCase()],
          cc: partner_email ? [partner_email.trim().toLowerCase()] : undefined,
          subject: `Aprovação de Operação — Mandato TEC · ${fund_name.trim()}`,
          html: emailHtml,
        }),
      });
    } catch (e) {
      void svc().from("execution_errors").insert({ workflow: "api/propostas/mandato-tec/send Resend", error_message: String(e), severity: "medium" });
    }
  }

  // 4. Log no proposal_messages
  void svc().from("proposal_messages").insert({
    proposal_id: proposal.id,
    sender_id: user.id,
    sender_name: profile?.full_name ?? "Mesa",
    sender_role: profile?.role ?? "MESA_OPERACIONAL",
    content: `Mandato TEC enviado para ${recipient_name.trim()} (${recipient_email.trim()}) — TEC ${tecPerc}% sobre ${fmtBRL(dealVal)}`,
    type: "system_event",
  });

  return NextResponse.json({ proposal: { id: proposal.id, code, status: "sent" }, acceptance_url: acceptanceUrl });
}
