import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

// Vínculo de contrato-mãe (operation_contracts.is_master_agreement=true) a
// um deal/listing/proposta/ticket futuro (19/08/2026, item 2 dos ajustes
// de governança pedidos por João). Trava de validade obrigatória: bloqueia
// (422) se o contrato-mãe estiver expirado, ANTES de qualquer INSERT
// ("não podemos correr o risco de amarrar um deal futuro num NDA manual
// de 2023 que já venceu").

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

async function requireRole(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await svc().from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !["ADMIN", "GESTAO"].includes(profile.role as string)) return null;
  return { userId: user.id };
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const caller = await requireRole(_req);
  if (!caller) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });

  const { id } = await params;
  const { data: links, error } = await svc()
    .from("operation_contract_links")
    .select("*")
    .eq("master_contract_id", id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ links: links ?? [] });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const caller = await requireRole(req);
  if (!caller) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });

  const { id } = await params;
  const { deal_id, listing_id, credit_proposal_id, ticket_id, justification } = await req.json();

  const targets = [deal_id, listing_id, credit_proposal_id, ticket_id].filter(Boolean);
  if (targets.length !== 1) {
    return NextResponse.json({ error: "Informe exatamente um destino: deal_id, listing_id, credit_proposal_id ou ticket_id." }, { status: 422 });
  }
  if (!justification?.trim()) {
    return NextResponse.json({ error: "Justificativa obrigatória: explique por que este negócio está sendo coberto pelo contrato-mãe." }, { status: 422 });
  }

  const db = svc();

  const { data: master } = await db
    .from("operation_contracts")
    .select("id, is_master_agreement, regularization_expires_at, contract_code, contract_title")
    .eq("id", id)
    .single();

  if (!master) return NextResponse.json({ error: "Contrato não encontrado" }, { status: 404 });
  if (!master.is_master_agreement) {
    return NextResponse.json({ error: `"${master.contract_title}" não é um contrato-mãe (is_master_agreement=false); só contratos regularizados via upload manual podem ser vinculados a deals futuros.` }, { status: 422 });
  }

  // Trava de validade (item 2 dos ajustes de governança, pedido explícito
  // de João): bloqueia ANTES de qualquer vínculo se o contrato-mãe já
  // venceu.
  if (master.regularization_expires_at && new Date(master.regularization_expires_at) < new Date()) {
    return NextResponse.json({
      error: `Contrato-mãe "${master.contract_code ?? master.contract_title}" está expirado desde ${new Date(master.regularization_expires_at).toLocaleDateString("pt-BR")}. Não é possível vincular novo deal, regularize um novo termo antes de prosseguir.`,
    }, { status: 422 });
  }

  // Snapshot da validade no momento do vínculo: 'infinity' (valor nativo do
  // Postgres para timestamptz) quando o contrato-mãe não tem prazo definido,
  // já que a coluna é NOT NULL por pedido explícito de João e não deve virar
  // nullable só para representar "nunca expira".
  const expirationSnapshot = master.regularization_expires_at ?? "infinity";

  const { data: link, error } = await db
    .from("operation_contract_links")
    .insert({
      master_contract_id: id,
      deal_id: deal_id ?? null,
      listing_id: listing_id ?? null,
      credit_proposal_id: credit_proposal_id ?? null,
      ticket_id: ticket_id ?? null,
      expiration_date: expirationSnapshot,
      justification: justification.trim(),
      linked_by: caller.userId,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ link }, { status: 201 });
}
