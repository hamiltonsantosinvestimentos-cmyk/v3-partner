import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { nextLegacyCode } from "@/lib/v3-codes";

function serviceClient() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

async function getAuthedUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, profile: null, supabase };
  const { data: profile } = await supabase.from("profiles").select("id, full_name, role").eq("id", user.id).single();
  return { user, profile, supabase };
}

// GET — lista leads do partner (ou todos se admin)
export async function GET() {
  const { user, profile, supabase } = await getAuthedUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const isAdmin = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"].includes(profile?.role ?? "");
  let query = supabase.from("crm_leads").select("*").is("deleted_at", null).order("created_at", { ascending: false });
  if (!isAdmin) query = query.eq("partner_id", user.id);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ leads: data ?? [] });
}

// POST — cria novo lead vinculado ao partner logado
export async function POST(req: NextRequest) {
  const { user, profile, supabase } = await getAuthedUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await req.json();

  // O código do lead passa a ser emitido no servidor, por MAX real, e não mais
  // recebido do navegador. O cliente calculava `leads.length + 1` sobre a lista
  // que estava na tela, que é a pior fonte possível: reflete apenas os leads
  // carregados naquele filtro, ignora os de outros partners e produzia formato
  // de 3 dígitos enquanto a tabela usa 4. O parâmetro do body ainda é aceito
  // para não quebrar chamadas antigas em trânsito.
  const code = body.code ?? (await nextLegacyCode(serviceClient(), "crm_leads", "CRM-26"));

  const { data, error } = await supabase.from("crm_leads").insert({
    code,
    name:             body.name,
    document:         body.document ?? null,
    person_type:      body.personType ?? "PJ",
    email:            body.email ?? null,
    phone:            body.phone ?? null,
    segment:          body.segment ?? null,
    annual_revenue:   body.annualRevenue ?? 0,
    city:             body.city ?? null,
    state:            body.state ?? null,
    status:           body.status ?? "prospect",
    source:           body.source ?? "ativo",
    visit_date:       body.visitDate || null,
    next_contact:     body.nextContact || null,
    notes:            body.notes ?? null,
    product_interest: body.productInterest ?? null,
    credit_line:      body.creditLine ?? null,
    interactions:     body.interactions ?? [],
    partner_id:       user.id,
    partner_name:     profile?.full_name ?? "Partner",
    created_by:       user.id,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ lead: data });
}

// PATCH — atualiza lead (interações, status, notas)
export async function PATCH(req: NextRequest) {
  const { user, profile, supabase } = await getAuthedUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await req.json();
  const { id, ...updates } = body;
  if (!id) return NextResponse.json({ error: "ID obrigatório" }, { status: 400 });

  const isAdmin = ["ADMIN", "GESTAO"].includes(profile?.role ?? "");
  let query = supabase.from("crm_leads").update(updates).eq("id", id);
  if (!isAdmin) query = query.eq("partner_id", user.id);

  const { error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// DELETE — descontinuado: exclusão de lead agora passa por soft delete +
// governança em POST /api/crm/{id}/delete (ver lib/governance-delete.ts).
export async function DELETE() {
  return NextResponse.json(
    { error: "Use POST /api/crm/{id}/delete — exclusão direta foi descontinuada (soft delete + governança)" },
    { status: 410 }
  );
}
