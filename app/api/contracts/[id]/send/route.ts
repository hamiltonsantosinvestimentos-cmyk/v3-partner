import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { MESA_OPERACIONAL_VERTICALS } from "@/lib/contract-verticals";
import { isNdaMesaContract } from "@/lib/nda-mesa-operacoes";
import { isMandatoCreditoContract } from "@/lib/mandato-credito";
import { SEND_CONTRACT_COLUMNS, checkSendGates, sendContractToSignature, type SendContract } from "@/lib/contract-send";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

async function requireRole(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await svc().from("profiles").select("role").eq("id", user.id).single();
  // MESA_OPERACIONAL (analista, ex: Taisa Pedroso) passa a poder enviar (24/09/2026, urgência de João):
  // ficava barrada aqui mesmo com acesso a gerar e listar. O escopo de vertical é conferido abaixo.
  if (!profile || !["ADMIN", "GESTAO", "MESA_OPERACIONAL"].includes(profile.role as string)) return null;
  return { userId: user.id, role: profile.role as string };
}

// POST /api/contracts/[id]/send — dispara o contrato gerado pela Central de
// Contratos (status "rascunho"/"aprovado") para assinatura digital real via
// ClickSign, usando o array `parties` já gravado (inclui os N signatários
// vindos da esteira de qualificação, quando qualification_batch_id existe).
// Os bloqueios e o envio ficam em lib/contract-send.ts (05/11/2026), reaproveitados
// pela rota "Alterar e-mail e reenviar" (change-signer-email).
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const caller = await requireRole(_req);
  if (!caller) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await params;
  const db = svc();

  const { data: contract } = await db
    .from("operation_contracts")
    .select(SEND_CONTRACT_COLUMNS)
    .eq("id", id)
    .single();

  if (!contract) return NextResponse.json({ error: "Contrato não encontrado" }, { status: 404 });
  // Analista só opera contrato das verticais dela, o mesmo escopo da lista (nunca Crédito, Institucional etc.).
  // Exceção (30/09/2026): o NDA (Mesa de operações) enviado ao cliente pelo painel
  // "NDA para clientes" da Mesa Operacional, que é da vertical Crédito.
  // Exceção (09/10/2026): o Mandato de Crédito enviado pelo botão "Mandato" do modal da proposta.
  if (caller.role === "MESA_OPERACIONAL" && !MESA_OPERACIONAL_VERTICALS.includes(contract.vertical as string)
      && !(await isNdaMesaContract(db, contract.template_id as string | null))
      && !(await isMandatoCreditoContract(db, contract.template_id as string | null))) {
    return NextResponse.json({ error: "Este contrato não pertence às verticais da Mesa Operacional. Peça a um ADMIN ou GESTAO para enviá-lo." }, { status: 403 });
  }
  if (!["rascunho", "aprovado"].includes(contract.status_signature)) {
    return NextResponse.json({ error: `Contrato em status "${contract.status_signature}" não pode ser (re)enviado por esta rota.` }, { status: 409 });
  }

  const gate = await checkSendGates(db, contract as SendContract);
  if (gate) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const sent = await sendContractToSignature(db, contract as SendContract, { userId: caller.userId, label: caller.role });
  if (!sent.ok) return NextResponse.json({ error: sent.error }, { status: sent.status });

  return NextResponse.json({ ok: true, envelope_id: sent.envelopeId, signatarios: sent.signatarios });
}
