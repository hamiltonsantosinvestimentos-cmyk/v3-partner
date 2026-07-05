import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const ADMIN_EMAILS_FOR_GOVERNANCE = [
  "joao.lemos@v3partners.com.br",
  "suporte@v3partners.com.br",
  "robinholino16@gmail.com",
];

async function getCaller(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await svc().from("profiles").select("id, role, full_name").eq("id", user.id).single();
  if (!profile) return null;
  return { userId: user.id, role: profile.role as string, fullName: profile.full_name as string | null };
}

async function notifyGovernance(params: { anonymousId: string; requesterName: string; reason: string; listingId: string }) {
  if (!process.env.RESEND_API_KEY) return;
  try {
    const { Resend } = await import("resend");
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: "V3 Partners Bolsa de Ativos <noreply@v3partners.com.br>",
      to: ADMIN_EMAILS_FOR_GOVERNANCE,
      subject: `Solicitação de exclusão — ${params.anonymousId}`,
      html: `<p><strong>${params.requesterName}</strong> solicitou a exclusão do ativo <strong>${params.anonymousId}</strong>.</p>
             <p><strong>Motivo:</strong> ${params.reason}</p>
             <p>Acesse a Mesa de Capitais para aprovar ou rejeitar: https://app.v3partners.com.br/bolsa/mesa</p>
             <p style="color:#888;font-size:12px">listing_id: ${params.listingId}</p>`,
    });
  } catch (err) {
    console.error("[CM Delete] falha ao notificar governança:", err);
  }
}

// POST: ADMIN exclui direto (soft delete). GESTAO/MESA_OPERACIONAL solicitam (pending_governance).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const caller = await getCaller(req);
  if (!caller) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  if (!["ADMIN", "GESTAO", "MESA_OPERACIONAL"].includes(caller.role)) {
    return NextResponse.json({ error: "Sem permissão para excluir ou solicitar exclusão" }, { status: 403 });
  }

  const { id } = await params;
  const { reason } = await req.json();
  if (!reason || typeof reason !== "string" || reason.trim().length < 5) {
    return NextResponse.json({ error: "Motivo da exclusão é obrigatório (mínimo 5 caracteres)" }, { status: 422 });
  }

  const { data: listing } = await svc().from("cm_asset_listings").select("id, anonymous_id").eq("id", id).single();
  if (!listing) return NextResponse.json({ error: "Ativo não encontrado" }, { status: 404 });

  if (caller.role === "ADMIN") {
    const { data, error } = await svc()
      .from("cm_asset_listings")
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: caller.userId,
        deletion_reason: reason.trim(),
        deletion_status: "approved",
      })
      .eq("id", id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ listing: data, mode: "deleted" });
  }

  // GESTAO / MESA_OPERACIONAL — solicitação, não deleta ainda
  const { data, error } = await svc()
    .from("cm_asset_listings")
    .update({
      deletion_status: "pending_governance",
      deletion_requested_by: caller.userId,
      deletion_requested_at: new Date().toISOString(),
      deletion_reason: reason.trim(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await notifyGovernance({
    anonymousId: listing.anonymous_id,
    requesterName: caller.fullName ?? "Usuário",
    reason: reason.trim(),
    listingId: id,
  });

  return NextResponse.json({ listing: data, mode: "pending_governance" });
}

// PATCH: ADMIN aprova ou rejeita uma solicitação pendente
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const caller = await getCaller(req);
  if (!caller || caller.role !== "ADMIN") {
    return NextResponse.json({ error: "Apenas ADMIN pode aprovar ou rejeitar exclusões" }, { status: 403 });
  }

  const { id } = await params;
  const { action } = await req.json();
  if (!["approve", "reject"].includes(action)) {
    return NextResponse.json({ error: "action deve ser approve ou reject" }, { status: 422 });
  }

  const update = action === "approve"
    ? {
        deleted_at: new Date().toISOString(),
        deleted_by: caller.userId,
        deletion_status: "approved",
      }
    : {
        deletion_status: "rejected",
        deletion_requested_by: null,
        deletion_requested_at: null,
      };

  const { data, error } = await svc()
    .from("cm_asset_listings")
    .update(update)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ listing: data });
}
