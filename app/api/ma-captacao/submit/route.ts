import { NextRequest, NextResponse } from "next/server";
import { createClient as sc } from "@supabase/supabase-js";

function serviceClient() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

// POST — recebe dados do formulário público M&A (sem auth)
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { token, ...formData } = body;

  if (!token) return NextResponse.json({ error: "Token obrigatório" }, { status: 400 });
  if (!formData.lgpdConsent) return NextResponse.json({ error: "Autorização LGPD obrigatória" }, { status: 400 });

  const svc = serviceClient();

  // Valida token M&A
  const { data: link, error: linkError } = await svc
    .from("ma_captacao_links")
    .select("id, partner_id, partner_name, active, uses_count")
    .eq("token", token)
    .single();

  if (linkError || !link || !link.active) {
    return NextResponse.json({ error: "Link inválido ou desativado" }, { status: 404 });
  }

  const empresa = (formData.empresa || formData.nome || "").trim();
  if (!empresa) return NextResponse.json({ error: "Nome/Empresa obrigatório" }, { status: 400 });

  // Gera código CRM
  const { count } = await svc.from("crm_leads").select("*", { count: "exact", head: true });
  const code = `CRM-26-${String((count ?? 0) + 1).padStart(4, "0")}`;

  const parseMoney = (v?: string) => parseFloat((v ?? "").replace(/[^\d,]/g, "").replace(",", ".")) || 0;
  const faturamento = parseMoney(formData.faturamento);

  // Insere lead no CRM com creditLine = M&A
  const { data: lead, error } = await svc.from("crm_leads").insert({
    code,
    name:             empresa,
    document:         formData.cnpj ?? null,
    person_type:      "PJ",
    email:            formData.email ?? null,
    phone:            formData.telefone ?? null,
    segment:          formData.setor ?? "M&A",
    annual_revenue:   faturamento,
    city:             formData.cidade ?? null,
    state:            formData.estado ?? null,
    status:           "prospect",
    source:           "digital",
    visit_date:       null,
    next_contact:     null,
    notes:            formData.descricao ?? null,
    product_interest: "ma",
    credit_line:      "M&A",
    partner_id:       link.partner_id,
    partner_name:     link.partner_name,
    created_by:       link.partner_id,
    interactions:     [],
    metadata: {
      ...formData,
      lgpdConsent:      true,
      ma_captacao_token: token,
      submitted_at:     new Date().toISOString(),
      form_type:        "ma",
    },
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Incrementa uses_count
  await svc
    .from("ma_captacao_links")
    .update({ uses_count: (link.uses_count ?? 0) + 1 })
    .eq("id", link.id);

  return NextResponse.json({ ok: true, code: lead.code });
}
