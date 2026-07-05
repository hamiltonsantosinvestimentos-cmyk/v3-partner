import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const DIRECTOR_EMAILS = [
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

async function notifyDirectors(params: { anonymousId: string; requesterName: string; reason: string; listingId: string }) {
  if (!process.env.RESEND_API_KEY) return;
  try {
    const { Resend } = await import("resend");
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: "V3 Partners Bolsa de Ativos <noreply@v3partners.com.br>",
      to: DIRECTOR_EMAILS,
      subject: `Autorização de NDA retroativo — ${params.anonymousId}`,
      html: `<p><strong>${params.requesterName}</strong> marcou o NDA do ativo <strong>${params.anonymousId}</strong> como já assinado fora do sistema, e precisa de autorização de um diretor.</p>
             <p><strong>Motivo/contexto:</strong> ${params.reason}</p>
             <p>Acesse a Mesa de Capitais para aprovar ou rejeitar: https://app.v3partners.com.br/bolsa/mesa</p>
             <p style="color:#888;font-size:12px">listing_id: ${params.listingId}</p>`,
    });
  } catch (err) {
    console.error("[CM NDA Authorize] falha ao notificar diretores:", err);
  }
}

// POST: ADMIN marca direto (approved). GESTAO/MESA_OPERACIONAL marcam mas ficam pending_director.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const caller = await getCaller(req);
  if (!caller) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  if (!["ADMIN", "GESTAO", "MESA_OPERACIONAL"].includes(caller.role)) {
    return NextResponse.json({ error: "Sem permissão para marcar NDA" }, { status: 403 });
  }

  const { id } = await params;
  const { nda_signed_at, nda_document_url, reason } = await req.json();

  if (!reason || typeof reason !== "string" || reason.trim().length < 5) {
    return NextResponse.json({ error: "Motivo/contexto é obrigatório (mínimo 5 caracteres)" }, { status: 422 });
  }
  if (!nda_document_url) {
    return NextResponse.json({ error: "Anexo do NDA assinado é obrigatório" }, { status: 422 });
  }

  const { data: listing } = await svc().from("cm_asset_listings").select("id, anonymous_id").eq("id", id).single();
  if (!listing) return NextResponse.json({ error: "Ativo não encontrado" }, { status: 404 });

  const signedAt = nda_signed_at ?? new Date().toISOString();

  if (caller.role === "ADMIN") {
    const { data, error } = await svc()
      .from("cm_asset_listings")
      .update({
        nda_signed_at: signedAt,
        nda_document_url,
        nda_authorization_status: "approved",
        nda_authorized_by: caller.userId,
        nda_authorization_reason: reason.trim(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ listing: data, mode: "approved" });
  }

  const { data, error } = await svc()
    .from("cm_asset_listings")
    .update({
      nda_signed_at: signedAt,
      nda_document_url,
      nda_authorization_status: "pending_director",
      nda_authorization_requested_by: caller.userId,
      nda_authorization_requested_at: new Date().toISOString(),
      nda_authorization_reason: reason.trim(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await notifyDirectors({
    anonymousId: listing.anonymous_id,
    requesterName: caller.fullName ?? "Usuário",
    reason: reason.trim(),
    listingId: id,
  });

  return NextResponse.json({ listing: data, mode: "pending_director" });
}

// PATCH: ADMIN aprova ou rejeita uma marcação pendente
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const caller = await getCaller(req);
  if (!caller || caller.role !== "ADMIN") {
    return NextResponse.json({ error: "Apenas ADMIN pode autorizar NDA retroativo" }, { status: 403 });
  }

  const { id } = await params;
  const { action } = await req.json();
  if (!["approve", "reject"].includes(action)) {
    return NextResponse.json({ error: "action deve ser approve ou reject" }, { status: 422 });
  }

  const update = action === "approve"
    ? { nda_authorization_status: "approved", nda_authorized_by: caller.userId }
    : { nda_authorization_status: "rejected", nda_signed_at: null, nda_document_url: null };

  const { data, error } = await svc()
    .from("cm_asset_listings")
    .update(update)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ listing: data });
}
