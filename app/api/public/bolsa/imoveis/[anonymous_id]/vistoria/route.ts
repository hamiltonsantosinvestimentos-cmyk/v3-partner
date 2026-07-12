import { NextRequest, NextResponse } from "next/server";
import { createClient as sc } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import { auditText, auditHtml } from "@/lib/brand-guardian-gate";

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

      const rawSubject = `[Bolsa de Ativos] Pedido de Vistoria: ${listing.anonymous_id}`;
      const rawHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Pedido de Vistoria · V3 Partners</title>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700&display=swap" rel="stylesheet" />
</head>
<body style="font-family:'DM Sans',Arial,sans-serif;background:#09081A;color:#F5F1E8;margin:0;padding:0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#09081A;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#13223A;border:1px solid #243A66;border-radius:12px;overflow:hidden;">

          <!-- Header -->
          <tr>
            <td style="background:#162744;padding:24px 32px;border-bottom:1px solid #243A66;">
              <img src="https://app.v3partners.com.br/v3-logo-flat-gold-alpha.png" alt="V3 Partners" style="height:32px;display:block;margin-bottom:12px;" />
              <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#C9A84C;">Bolsa de Grandes Ativos</p>
              <h1 style="margin:8px 0 0;font-size:20px;font-weight:700;color:#F5F1E8;">Novo Pedido de Vistoria Técnica</h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#162744;border:1px solid #243A66;border-radius:8px;margin-bottom:20px;">
                <tr>
                  <td style="padding:20px 24px;">
                    <p style="margin:0 0 4px;font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#C9A84C;">Ativo</p>
                    <p style="margin:0 0 16px;font-size:18px;font-weight:700;color:#F5F1E8;font-family:monospace;">${listing.anonymous_id}</p>
                    <p style="margin:0 0 4px;font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#C9A84C;">Comprador</p>
                    <p style="margin:0 0 4px;font-size:13px;font-weight:600;color:#F5F1E8;">${buyer_name}</p>
                    <p style="margin:0;font-size:12px;color:#9BAFC5;">${buyer_email}${buyer_phone ? ` · ${buyer_phone}` : ""}</p>
                  </td>
                </tr>
              </table>
              <p style="margin:0;font-size:13px;color:#9BAFC5;line-height:1.6;">
                NDA e NCND aceitos pelo comprador. Prova de Fundos <strong style="color:#F5F1E8;">pendente</strong> de aprovação manual da Mesa antes de confirmar a data da vistoria.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px;border-top:1px solid #243A66;">
              <p style="margin:0;font-size:10px;color:#9BAFC5;">V3 Partners Soluções Ltda · CNPJ 14.219.287/0001-50</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();

      const subjectGate = auditText(rawSubject);
      const htmlGate = auditHtml(rawHtml);
      if (htmlGate.blocking.length > 0) {
        console.error("[vistoria] Brand Guardian bloqueou o email:", htmlGate.blocking);
      }

      await resend.emails.send({
        from: "V3 Partners Plataforma <noreply@v3partners.com.br>",
        to: "deal@v3partners.com.br",
        subject: subjectGate.corrected,
        html: htmlGate.corrected,
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
