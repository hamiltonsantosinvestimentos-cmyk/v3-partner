import { NextRequest, NextResponse } from "next/server";
import { createClient as sc } from "@supabase/supabase-js";

function serviceClient() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

// POST — recebe dados do formulário público de captação (sem auth)
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { token, ...formData } = body;

  if (!token) return NextResponse.json({ error: "Token obrigatório" }, { status: 400 });
  if (!formData.lgpdConsent) return NextResponse.json({ error: "Autorização LGPD obrigatória" }, { status: 400 });

  const svc = serviceClient();

  // Valida token
  const { data: link, error: linkError } = await svc
    .from("captacao_links")
    .select("id, partner_id, partner_name, active, uses_count")
    .eq("token", token)
    .single();

  if (linkError || !link || !link.active) {
    return NextResponse.json({ error: "Link inválido ou desativado" }, { status: 404 });
  }

  // Monta nome do cliente
  const clientName = formData.personType === "PF"
    ? (formData.name ?? "").trim()
    : (formData.razaoSocial || formData.name || "").trim();

  if (!clientName) return NextResponse.json({ error: "Nome do cliente obrigatório" }, { status: 400 });

  // Gera código CRM
  const { count } = await svc.from("crm_leads").select("*", { count: "exact", head: true });
  const code = `CRM-26-${String((count ?? 0) + 1).padStart(4, "0")}`;

  // Calcula receita anual aproximada
  const parseMoney = (v?: string) => parseFloat((v ?? "").replace(/\D/g, "")) || 0;
  const annualRevenue = formData.personType === "PF"
    ? parseMoney(formData.renda) * 12
    : parseMoney(formData.faturamento) * 12;

  // Insere lead no CRM
  const { data: lead, error } = await svc.from("crm_leads").insert({
    code,
    name: clientName,
    document:         formData.cpfCnpj ?? null,
    person_type:      formData.personType ?? "PF",
    email:            formData.email ?? null,
    phone:            formData.phone ?? null,
    segment:          formData.productInterest ?? formData.segment ?? null,
    annual_revenue:   annualRevenue,
    city:             formData.city ?? null,
    state:            formData.state ?? null,
    status:           "prospect",
    source:           "digital",
    visit_date:       null,
    next_contact:     null,
    notes:            formData.observacoes ?? null,
    product_interest: formData.productInterest ?? null,
    credit_line:      formData.creditLine ?? null,
    partner_id:       link.partner_id,
    partner_name:     link.partner_name,
    created_by:       link.partner_id,
    interactions:     [],
    metadata:         {
      ...formData,
      lgpdConsent: true,
      captacao_token: token,
      submitted_at: new Date().toISOString(),
    },
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Incrementa uses_count
  await svc
    .from("captacao_links")
    .update({ uses_count: (link.uses_count ?? 0) + 1 })
    .eq("id", link.id);

  return NextResponse.json({ ok: true, code: lead.code });
}
