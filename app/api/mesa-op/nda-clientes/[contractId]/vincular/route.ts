import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { isNdaMesaContract, NDA_MESA_ROLES } from "@/lib/nda-mesa-operacoes";

// POST /api/mesa-op/nda-clientes/[contractId]/vincular — vincula (ou, com
// credit_proposal_id = null, desvincula) um NDA (Mesa de operações) a uma
// proposta da Mesa de Crédito. Só vale para contratos desse template; para
// contrato-mãe regularizado o caminho continua sendo /api/contracts/[id]/link-deal.

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ contractId: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const db = svc();
  const { data: profile } = await db.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !NDA_MESA_ROLES.includes(profile.role as string)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  }

  const { contractId } = await params;
  const body = (await req.json().catch(() => ({}))) as { credit_proposal_id?: string | null };
  const proposalId = body.credit_proposal_id ?? null;

  const { data: contrato } = await db
    .from("operation_contracts")
    .select("id, template_id, contract_code, credit_proposal_id, deleted_at")
    .eq("id", contractId)
    .maybeSingle();
  if (!contrato || contrato.deleted_at) return NextResponse.json({ error: "Contrato não encontrado" }, { status: 404 });
  if (!(await isNdaMesaContract(db, contrato.template_id))) {
    return NextResponse.json({ error: "Só NDAs do template \"NDA (Mesa de operações)\" podem ser vinculados por aqui." }, { status: 422 });
  }

  if (proposalId) {
    const { data: proposta } = await db.from("credit_desk_proposals").select("id").eq("id", proposalId).maybeSingle();
    if (!proposta) return NextResponse.json({ error: "Proposta não encontrada" }, { status: 404 });
  }

  const { error } = await db
    .from("operation_contracts")
    .update({ credit_proposal_id: proposalId, updated_at: new Date().toISOString() })
    .eq("id", contractId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, contract_code: contrato.contract_code, credit_proposal_id: proposalId });
}
