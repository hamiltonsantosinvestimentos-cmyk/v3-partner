import { NextRequest, NextResponse } from "next/server";
import { createClient as sc } from "@supabase/supabase-js";
import { randomUUID } from "crypto";

export const dynamic = "force-dynamic";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

// POST — pedido publico de Vistoria Tecnica (Onboarding Invertido).
// Sem autenticacao. Trava de compliance: o pedido entra SEMPRE como
// proof_of_funds_status "pendente" — so ADMIN/GESTAO/MESA_OPERACIONAL
// consegue aprovar (rota /api/cm/listings/[id]/inspection/[requestId]),
// e so depois de aprovado o agendamento pode ser confirmado.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ anonymous_id: string }> }
) {
  const { anonymous_id } = await params;
  const body = await req.json();

  const { buyer_name, buyer_email, buyer_phone, nda_accepted, ncnd_accepted } = body;

  if (!buyer_name || !buyer_email) {
    return NextResponse.json({ error: "Nome e email são obrigatórios" }, { status: 422 });
  }
  if (nda_accepted !== true || ncnd_accepted !== true) {
    return NextResponse.json(
      { error: "É necessário aceitar o NDA e a Cláusula de Não Circunvenção (NCND) para solicitar vistoria" },
      { status: 422 }
    );
  }

  const { data: listing } = await svc()
    .from("cm_asset_listings")
    .select("id, anonymous_id, asset_type, allow_public_listing, inspection_requests")
    .eq("anonymous_id", anonymous_id)
    .single();

  if (!listing || listing.asset_type !== "imovel" || !listing.allow_public_listing) {
    return NextResponse.json({ error: "Ativo não encontrado ou não disponível" }, { status: 404 });
  }

  const now = new Date().toISOString();
  const newRequest = {
    id: randomUUID(),
    buyer_name,
    buyer_email,
    buyer_phone: buyer_phone ?? null,
    requested_at: now,
    nda_accepted_at: now,
    ncnd_accepted_at: now,
    proof_of_funds_status: "pendente" as const,
    proof_of_funds_document_url: null,
    approved_by: null,
    approved_at: null,
    scheduled_at: null,
    status: "aguardando_aprovacao",
  };

  const current = Array.isArray(listing.inspection_requests) ? listing.inspection_requests : [];
  const updated = [...current, newRequest];

  const { error } = await svc()
    .from("cm_asset_listings")
    .update({ inspection_requests: updated })
    .eq("id", listing.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    try {
      const { Resend } = await import("resend");
      const resend = new Resend(resendKey);
      await resend.emails.send({
        from: "V3 Partners Plataforma <noreply@v3partners.com.br>",
        to: "deal@v3partners.com.br",
        subject: `[Bolsa de Ativos] Pedido de Vistoria — ${listing.anonymous_id}`,
        html: `
          <div style="font-family:'DM Sans',Arial,sans-serif;background:#09081A;color:#F5F1E8;padding:24px">
            <p style="color:#C9A84C;font-weight:700;text-transform:uppercase;font-size:11px;letter-spacing:.08em">Novo pedido de vistoria técnica</p>
            <p><strong>Ativo:</strong> ${listing.anonymous_id}</p>
            <p><strong>Comprador:</strong> ${buyer_name} · ${buyer_email}${buyer_phone ? ` · ${buyer_phone}` : ""}</p>
            <p>NDA e NCND aceitos. Prova de Fundos <strong>pendente</strong> de aprovação manual da Mesa antes de qualquer agendamento.</p>
          </div>
        `.trim(),
      });
    } catch (err) {
      console.error("[vistoria] Falha ao enviar email de notificação:", err);
    }
  }

  return NextResponse.json({
    ok: true,
    message: "Pedido registrado. A Mesa V3 vai analisar a Prova de Fundos antes de confirmar a data da vistoria.",
  });
}
