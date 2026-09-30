import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { findNdaMesaTemplate, NDA_MESA_ROLES } from "@/lib/nda-mesa-operacoes";

// GET /api/mesa-op/nda-clientes — painel "NDA para clientes" da Mesa Operacional.
//   Sem parâmetros: lotes de qualificação do template NDA (Mesa de operações),
//   com a parte (cliente), o contrato gerado a partir do lote e a proposta vinculada.
//   ?contratos=1: contratos NDA gerados (para o vínculo no modal da proposta);
//   ?credit_proposal_id=X filtra os já vinculados àquela proposta.

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

async function requireRole() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await svc().from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !NDA_MESA_ROLES.includes(profile.role as string)) return null;
  return { userId: user.id, role: profile.role as string };
}

type Party = {
  id: string; full_name: string; email: string; phone: string | null; status: string; filled_at: string | null;
  qualification_token: string; cpf_cnpj: string | null; company_name: string | null; company_cnpj: string | null;
  party_nature: string | null; person_type: string | null; deleted_at: string | null;
};

export async function GET(req: NextRequest) {
  const caller = await requireRole();
  if (!caller) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });

  const db = svc();
  const tpl = await findNdaMesaTemplate(db);
  if (!tpl) return NextResponse.json({ error: 'Template "NDA (Mesa de operações)" não encontrado na Central de Contratos.' }, { status: 404 });

  const { searchParams } = new URL(req.url);

  // ── Contratos NDA (vínculo no modal da proposta) ──
  if (searchParams.get("contratos") === "1") {
    let q = db.from("operation_contracts")
      .select("id, contract_code, status_signature, credit_proposal_id, parties, created_at, sent_to_signature_at, signed_at")
      .eq("template_id", tpl.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(200);
    const pid = searchParams.get("credit_proposal_id");
    if (pid) q = q.eq("credit_proposal_id", pid);
    const { data, error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ template: tpl, contratos: data ?? [] });
  }

  // ── Lotes (painel da Mesa Operacional) ──
  const { data: batches, error } = await db
    .from("cm_qualification_batches")
    .select("id, status, created_at, completed_at, consumido_por_contract_id, cm_party_qualifications(id, full_name, email, phone, status, filled_at, qualification_token, cpf_cnpj, company_name, company_cnpj, party_nature, person_type, deleted_at)")
    .eq("template_id", tpl.id)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const batchIds = (batches ?? []).map((b) => b.id);
  const { data: contratos } = batchIds.length
    ? await db.from("operation_contracts")
        .select("id, contract_code, status_signature, credit_proposal_id, qualification_batch_id, sent_to_signature_at, signed_at, deleted_at")
        .in("qualification_batch_id", batchIds)
        .is("deleted_at", null)
    : { data: [] as { id: string; contract_code: string | null; status_signature: string; credit_proposal_id: string | null; qualification_batch_id: string | null; sent_to_signature_at: string | null; signed_at: string | null }[] };

  const proposalIds = [...new Set((contratos ?? []).map((c) => c.credit_proposal_id).filter(Boolean))] as string[];
  const { data: propostas } = proposalIds.length
    ? await db.from("credit_desk_proposals").select("id, code, client_name").in("id", proposalIds)
    : { data: [] as { id: string; code: string; client_name: string | null }[] };
  const propMap = new Map((propostas ?? []).map((p) => [p.id, p]));

  const itens = (batches ?? []).map((b) => {
    const parties = ((b.cm_party_qualifications ?? []) as Party[]).filter((p) => !p.deleted_at);
    const cliente = parties[0] ?? null;
    const contrato = (contratos ?? []).find((c) => c.qualification_batch_id === b.id) ?? null;
    const proposta = contrato?.credit_proposal_id ? propMap.get(contrato.credit_proposal_id) ?? null : null;
    return {
      batch_id: b.id,
      batch_status: b.status,
      created_at: b.created_at,
      completed_at: b.completed_at,
      cliente,
      contrato: contrato ? { id: contrato.id, contract_code: contrato.contract_code, status_signature: contrato.status_signature, sent_to_signature_at: contrato.sent_to_signature_at, signed_at: contrato.signed_at } : null,
      proposta: proposta ? { id: proposta.id, code: proposta.code, client_name: proposta.client_name } : null,
    };
  });

  return NextResponse.json({ template: tpl, itens });
}
