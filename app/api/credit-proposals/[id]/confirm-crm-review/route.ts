import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { notifyNovaProposta } from "@/lib/email";
import { createNotification, notifyByRoles } from "@/lib/notify";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const ADMIN_ROLES = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"] as const;

type RouteContext = { params: Promise<{ id: string }> };

// POST — o partner confere os documentos do lead de captação e confirma o
// envio pra Mesa de Crédito. A proposta já existe (criada no submit do link,
// marcada como metadata.crm_pending_review) — aqui só tiramos a pendência e
// disparamos as notificações que hoje disparam na criação normal de proposta.
export async function POST(req: NextRequest, ctx: RouteContext) {
  const { id: proposalId } = await ctx.params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const db = svc();
  const { data: profile } = await db.from("profiles").select("role, full_name").eq("id", user.id).single();
  const isAdmin = ADMIN_ROLES.includes(profile?.role as typeof ADMIN_ROLES[number]);

  const { data: proposal, error: propErr } = await db
    .from("credit_desk_proposals")
    .select("id, code, title, client_name, credit_line, requested_value, current_level, partner_id, metadata")
    .eq("id", proposalId)
    .single();

  if (propErr || !proposal) return NextResponse.json({ error: "Proposta não encontrada" }, { status: 404 });
  if (!isAdmin && proposal.partner_id !== user.id) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const meta = (proposal.metadata as Record<string, unknown>) ?? {};
  if (meta.crm_pending_review !== true) {
    return NextResponse.json({ error: "Esta proposta já foi enviada para a Mesa de Crédito" }, { status: 400 });
  }

  const { data: updated, error: updateError } = await db
    .from("credit_desk_proposals")
    .update({ metadata: { ...meta, crm_pending_review: false, crm_review_confirmed_at: new Date().toISOString(), crm_review_confirmed_by: user.id } })
    .eq("id", proposalId)
    .select().single();

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  const partnerName = profile?.full_name ?? "Partner";
  try {
    const adminEmail = process.env.EMAIL_ADMIN;
    if (adminEmail) {
      notifyNovaProposta({
        adminEmail,
        partnerName,
        proposalCode:   proposal.code,
        proposalTitle:  proposal.title,
        clientName:     proposal.client_name,
        creditLine:     proposal.credit_line,
        requestedValue: proposal.requested_value,
      });
    }
  } catch { /* notificação é opcional, nunca bloqueia a resposta */ }

  await Promise.allSettled([
    createNotification({
      user_id: proposal.partner_id,
      type: "proposal",
      title: "Proposta de crédito enviada",
      message: `${proposal.code} — ${proposal.client_name} · ${proposal.credit_line}`,
      action_url: "/mesa-credito",
    }),
    notifyByRoles(["ADMIN", "GESTAO", "MESA_OPERACIONAL"], {
      type: "proposal",
      title: `Nova Proposta — ${proposal.code}`,
      message: `${partnerName}: ${proposal.client_name} · ${proposal.credit_line} · ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(proposal.requested_value)}`,
      action_url: `/mesa-credito/${proposal.current_level.toLowerCase().replace("_", "-")}`,
    }),
  ]);

  return NextResponse.json({ ok: true, proposal: updated });
}
