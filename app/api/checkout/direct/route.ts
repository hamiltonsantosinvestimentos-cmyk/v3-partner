import { NextRequest, NextResponse } from "next/server";
import { createClient as sc } from "@supabase/supabase-js";
import { coraFetch } from "@/lib/cora";
import { randomUUID } from "crypto";
import { clampSelection, calcTotalCents, buildModularTitle, getMinCounts, type ProfileType, type CompanyStructure } from "@/lib/credit-analysis-pricing";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

// POST — venda direta na landing page /analise-v2, sem link de partner.
// Preço modular: R$197 por CNPJ + R$197 por CPF + R$197 opcional de
// Consultoria (ver lib/credit-analysis-pricing.ts). Substituiu os 2
// pacotes fixos (R$497/R$997) em 20/08/2026.
// ref_partner_id é só atribuição opcional (?ref= na URL), nunca o "dono" do pedido.
export async function POST(req: NextRequest) {
  const db = svc();

  const body = await req.json() as {
    cnpj_count?: number;
    cpf_count?: number;
    has_consultancy?: boolean;
    client_name?: string;
    client_email?: string;
    client_doc?: string;
    ref_partner_id?: string | null;
    prop_code?: string | null;
    profile_type?: string | null;
    company_structure?: string | null;
  };

  // Mínimos de negócio (ver PATCH 26/08/2026) resolvidos e aplicados no
  // servidor, nunca confiando só no client: sem isso, editar a URL/payload
  // do checkout direto driblaria a trava de "CNPJ sem sócio" ou "CPF sem
  // necessidade" que essa regra existe pra impedir.
  const profileType: ProfileType | null = body.profile_type === "PF" || body.profile_type === "PJ" ? body.profile_type : null;
  const companyStructure: CompanyStructure | null =
    body.company_structure === "UNIPESSOAL" || body.company_structure === "MULTIPLOS_SOCIOS" ? body.company_structure : null;
  const min = getMinCounts(profileType, companyStructure);

  const selection = clampSelection({
    cnpjCount: Number(body.cnpj_count ?? min.minCnpj),
    cpfCount: Number(body.cpf_count ?? min.minCpf),
    hasConsultancy: Boolean(body.has_consultancy),
  }, min);
  const priceCents = calcTotalCents(selection);
  const title = buildModularTitle(selection);

  if (!body.client_name?.trim()) return NextResponse.json({ error: "Nome obrigatório" }, { status: 400 });
  if (!body.client_email?.trim()) return NextResponse.json({ error: "Email obrigatório" }, { status: 400 });
  if (!body.client_doc?.replace(/\D/g, "")) return NextResponse.json({ error: "CPF/CNPJ obrigatório" }, { status: 400 });

  // Link por proposta (?prop=<code> em /analise-v2, gerado no modal da proposta
  // na Mesa de Crédito): valida contra uma proposta real e, se achar, já grava
  // credit_desk_proposal_id na criação do pedido -- o pedido nasce vinculado,
  // sem precisar do fluxo manual de "Pedidos de Partners" depois.
  let creditDeskProposalId: string | null = null;
  let proposalPartnerId: string | null = null;
  if (body.prop_code) {
    const { data: prop } = await db
      .from("credit_desk_proposals")
      .select("id, partner_id")
      .eq("code", body.prop_code.trim().toUpperCase())
      .single();
    if (prop) {
      creditDeskProposalId = prop.id;
      proposalPartnerId = prop.partner_id ?? null;
    }
  }

  // Valida ref_partner_id contra um profile real antes de gravar, para não
  // persistir lixo de query string malformada (ads mal configurado, bot, etc).
  // Se não veio ref (ou veio inválido) mas a proposta tem partner, usa o
  // partner da proposta -- é uma atribuição mais confiável que o ref genérico.
  let refPartnerId: string | null = null;
  if (body.ref_partner_id) {
    const { data: refProfile } = await db.from("profiles").select("id").eq("id", body.ref_partner_id).single();
    if (refProfile) refPartnerId = refProfile.id;
  }
  if (!refPartnerId && proposalPartnerId) refPartnerId = proposalPartnerId;

  const docDigits = body.client_doc.replace(/\D/g, "");
  const docType = docDigits.length === 11 ? "CPF" : "CNPJ";
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 2);
  const dueDateStr = dueDate.toISOString().split("T")[0];

  let coraData: {
    id?: string;
    pix?: { emv?: string; qr_code?: string };
    payment_options?: { bank_slip?: { digitable?: string; barcode?: string; url?: string } };
  } = {};

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
        payment_terms: { due_date: dueDateStr, amount: priceCents },
        payment_options: { interest: { type: "MONTHLY_PERCENTAGE", value: 1 }, fine: { type: "PERCENTAGE", value: 2 } },
        payment_forms: ["BANK_SLIP", "PIX"],
        services: [{ name: title, amount: priceCents }],
        notifications: { formats: ["EMAIL"], by_email: { should_notify: true } },
      }),
      idempotencyKey: randomUUID(),
    });

    if (res.ok) {
      coraData = await res.json() as typeof coraData;
    } else {
      const errBody = await res.json().catch(() => ({}));
      console.error("Cora checkout direto error:", res.status, errBody);
      return NextResponse.json({ error: `Erro ao gerar cobrança (Cora ${res.status})` }, { status: 502 });
    }
  } catch (e) {
    console.error("Cora checkout direto error:", e);
    return NextResponse.json({ error: "Erro ao gerar cobrança. Tente novamente." }, { status: 500 });
  }

  const { data: order, error: orderErr } = await db
    .from("partner_service_orders")
    .insert({
      link_id: null,
      partner_id: null,
      source: "direct",
      service_type: "credit_analysis",
      cnpj_count: selection.cnpjCount,
      cpf_count: selection.cpfCount,
      has_consultancy: selection.hasConsultancy,
      profile_type: profileType,
      company_structure: companyStructure,
      ref_partner_id: refPartnerId,
      credit_desk_proposal_id: creditDeskProposalId,
      client_name: body.client_name.trim(),
      client_email: body.client_email.trim(),
      client_doc: docDigits,
      cora_invoice_id: coraData.id ?? null,
      amount_cents: priceCents,
      status: "PENDING",
      pix_emv: coraData.pix?.emv ?? null,
      pix_qr_code: coraData.pix?.qr_code ?? null,
      boleto_barcode: coraData.payment_options?.bank_slip?.digitable ?? null,
      boleto_pdf: coraData.payment_options?.bank_slip?.url ?? null,
    })
    .select()
    .single();

  if (orderErr) return NextResponse.json({ error: orderErr.message }, { status: 500 });

  return NextResponse.json({
    order_id: order.id,
    status: order.status,
    price_cents: priceCents,
    pix_emv: order.pix_emv,
    pix_qr_code: order.pix_qr_code,
    boleto_barcode: order.boleto_barcode,
    boleto_pdf: order.boleto_pdf,
    cnpj_count: selection.cnpjCount,
    cpf_count: selection.cpfCount,
    has_consultancy: selection.hasConsultancy,
  });
}
