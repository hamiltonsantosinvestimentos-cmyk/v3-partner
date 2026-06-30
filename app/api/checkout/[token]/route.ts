import { NextRequest, NextResponse } from "next/server";
import { createClient as sc } from "@supabase/supabase-js";
import { coraFetch } from "@/lib/cora";
import { randomUUID, randomBytes } from "crypto";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

interface Params { params: Promise<{ token: string }> }

// GET — dados públicos do link (sem autenticação)
export async function GET(_req: NextRequest, { params }: Params) {
  const { token } = await params;
  const db = svc();

  const { data, error } = await db
    .from("partner_service_links")
    .select("id, title, service_type, description, price_cents, active, partner_id, profiles(full_name)")
    .eq("token", token)
    .single();

  if (error || !data) return NextResponse.json({ error: "Link inválido" }, { status: 404 });
  if (!data.active) return NextResponse.json({ error: "Este link foi desativado" }, { status: 410 });

  const profiles = data.profiles as { full_name?: string } | null;
  return NextResponse.json({
    title: data.title,
    service_type: data.service_type,
    description: data.description,
    price_cents: data.price_cents,
    partner_name: profiles?.full_name ?? "Partner V3",
  });
}

// POST — cliente preenche dados e gera cobrança Cora
export async function POST(req: NextRequest, { params }: Params) {
  const { token } = await params;
  const db = svc();

  const { data: link, error: linkErr } = await db
    .from("partner_service_links")
    .select("id, title, service_type, price_cents, active, partner_id")
    .eq("token", token)
    .single();

  if (linkErr || !link) return NextResponse.json({ error: "Link inválido" }, { status: 404 });
  if (!link.active) return NextResponse.json({ error: "Link desativado" }, { status: 410 });

  const body = await req.json() as {
    client_name?: string;
    client_email?: string;
    client_doc?: string;
    payment_method?: "pix" | "boleto";
  };

  if (!body.client_name?.trim()) return NextResponse.json({ error: "Nome obrigatório" }, { status: 400 });
  if (!body.client_email?.trim()) return NextResponse.json({ error: "Email obrigatório" }, { status: 400 });
  if (!body.client_doc?.replace(/\D/g, "")) return NextResponse.json({ error: "CPF/CNPJ obrigatório" }, { status: 400 });

  const docDigits = body.client_doc.replace(/\D/g, "");
  const docType = docDigits.length === 11 ? "CPF" : "CNPJ";
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 2);
  const dueDateStr = dueDate.toISOString().split("T")[0];

  // Gera cobrança na Cora (gratuito = pula Cora, gera intake direto)
  let coraData: {
    id?: string;
    pix?: { emv?: string; qr_code?: string };
    bank_slip?: { pdf?: { url?: string }; our_number?: string };
  } = {};

  const isPaid = link.price_cents === 0;
  const intakeToken = isPaid ? randomBytes(20).toString("hex") : null;

  if (!isPaid) {
    try {
      const res = await coraFetch("/v2/invoices", {
        method: "POST",
        body: JSON.stringify({
          code: randomUUID().slice(0, 8).toUpperCase(),
          customer: {
            name: body.client_name.trim(),
            document: { identity: docDigits, type: docType },
            contacts: [{ contact: body.client_email.trim(), type: "EMAIL" }],
          },
          payment_terms: { due_date: dueDateStr, amount: link.price_cents },
          payment_options: { interest: { type: "MONTHLY_PERCENTAGE", value: 1 }, fine: { type: "PERCENTAGE", value: 2 } },
          services: [{ name: link.title, amount: link.price_cents }],
          notifications: { formats: ["EMAIL"], by_email: { should_notify: true } },
        }),
        idempotencyKey: randomUUID(),
      });
      if (res.ok) coraData = await res.json() as typeof coraData;
    } catch (e) {
      console.error("Cora checkout error:", e);
      return NextResponse.json({ error: "Erro ao gerar cobrança. Tente novamente." }, { status: 500 });
    }
  }

  // Persiste order
  const { data: order, error: orderErr } = await db
    .from("partner_service_orders")
    .insert({
      link_id:        link.id,
      partner_id:     link.partner_id,
      client_name:    body.client_name.trim(),
      client_email:   body.client_email.trim(),
      client_doc:     docDigits,
      cora_invoice_id: coraData.id ?? null,
      amount_cents:   link.price_cents,
      status:         isPaid ? "PAID" : "PENDING",
      paid_at:        isPaid ? new Date().toISOString() : null,
      pix_emv:        coraData.pix?.emv ?? null,
      pix_qr_code:    coraData.pix?.qr_code ?? null,
      boleto_barcode: coraData.bank_slip?.our_number ?? null,
      boleto_pdf:     coraData.bank_slip?.pdf?.url ?? null,
      intake_token:   intakeToken,
    })
    .select()
    .single();

  if (orderErr) return NextResponse.json({ error: orderErr.message }, { status: 500 });

  // Incrementa usos no link
  await db.rpc("increment_link_uses" as never, { p_link_id: link.id } as never).then(null, () => {});

  // Serviço gratuito: provisiona intake token e incrementa receita (R$0)
  if (isPaid && intakeToken) {
    await db.from("captacao_links").insert({
      token: intakeToken,
      partner_id: link.partner_id,
      partner_name: "V3 Partners",
      active: true,
      uses_count: 0,
    }).then(null, () => {});
  }

  return NextResponse.json({
    order_id: order.id,
    status: order.status,
    price_cents: link.price_cents,
    pix_emv: order.pix_emv,
    pix_qr_code: order.pix_qr_code,
    boleto_barcode: order.boleto_barcode,
    boleto_pdf: order.boleto_pdf,
    intake_token: order.intake_token,
    service_type: link.service_type,
  });
}
