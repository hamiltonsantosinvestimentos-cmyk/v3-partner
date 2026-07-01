import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const ALLOWED = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"];

type RouteContext = { params: Promise<{ id: string }> };

// POST /api/credit-proposals/[id]/submit-partner
export async function POST(req: NextRequest, ctx: RouteContext) {
  const { id: proposalId } = await ctx.params;

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
    return NextResponse.json({ error: "Acesso restrito a ADMIN, GESTAO e MESA_OPERACIONAL" }, { status: 403 });
  }

  const body = await req.json() as { partner_id?: string };
  const { partner_id } = body;
  if (!partner_id) return NextResponse.json({ error: "partner_id obrigatório" }, { status: 422 });

  // Ler proposta de crédito
  const { data: proposal, error: propErr } = await db
    .from("credit_desk_proposals")
    .select("id, code, title, client_name, credit_line, requested_value, approved_value, current_level, stage, status")
    .eq("id", proposalId)
    .single();

  if (propErr || !proposal) return NextResponse.json({ error: "Proposta não encontrada" }, { status: 404 });

  // Ler parceiro
  const { data: partner, error: partnerErr } = await db
    .from("integration_partners")
    .select("id, name, display_name, crm_type, api_key_enc, active, sla_days")
    .eq("id", partner_id)
    .single();

  if (partnerErr || !partner) return NextResponse.json({ error: "Parceiro não encontrado" }, { status: 404 });

  const slaDeadline = new Date();
  slaDeadline.setDate(slaDeadline.getDate() + (partner.sla_days ?? 5));

  const payloadSnapshot = {
    proposal_code: proposal.code,
    title: proposal.title,
    client_name: proposal.client_name,
    credit_line: proposal.credit_line,
    requested_value: proposal.requested_value,
    approved_value: proposal.approved_value,
    level: proposal.current_level,
    stage: proposal.stage,
    submitted_by: profile?.full_name ?? profile?.email ?? user.email ?? "Mesa V3",
    submitted_at: new Date().toISOString(),
  };

  // Registrar submissão (deal_id = null para propostas de crédito)
  const { data: submission, error: subErr } = await db
    .from("deal_partner_submissions")
    .insert({
      deal_id: null,
      proposal_id: proposalId,
      partner_id,
      submitted_by: user.id,
      payload_snapshot: payloadSnapshot,
      status: "sent",
      sla_deadline: slaDeadline.toISOString(),
    })
    .select("id")
    .single();

  if (subErr) return NextResponse.json({ error: subErr.message }, { status: 500 });

  // Integração Pipedrive (opcional — só executa quando active=true e api_key_enc presente)
  let pipedriveSent = false;
  let pipedriveLeadId: string | null = null;

  if (partner.active && partner.api_key_enc && partner.crm_type === "pipedrive") {
    try {
      const apiKey = partner.api_key_enc as string;
      const leadTitle = `${proposal.client_name} — ${proposal.credit_line} · V3 Partners`;

      const pipeRes = await fetch(
        `https://api.pipedrive.com/v1/leads?api_token=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: leadTitle,
            value: proposal.requested_value
              ? { amount: proposal.requested_value, currency: "BRL" }
              : undefined,
            note: `Proposta de Crédito — V3 Partners\n\nCódigo: ${proposal.code}\nLinha: ${proposal.credit_line}\nNível: ${proposal.current_level}\nValor solicitado: R$ ${(proposal.requested_value ?? 0).toLocaleString("pt-BR")}\nFase: ${proposal.stage}`,
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
          })
          .eq("id", submission.id);
      }
    } catch (e) {
      console.error("[submit-partner-credit] Pipedrive error:", e);
    }
  }

  return NextResponse.json({
    submission_id: submission.id,
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
