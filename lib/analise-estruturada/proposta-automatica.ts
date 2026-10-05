import type { SupabaseClient } from "@supabase/supabase-js";
import { issueCreditCode } from "@/lib/v3-codes";
import { resolveClient } from "@/lib/v3-clients";
import { isAccessPackage } from "@/lib/credit-analysis-pricing";

// Pedido da Análise Estruturada V3 pago pelo link do dashboard do partner Access (sem proposta
// por trás): cria a proposta na Mesa de Crédito na hora do pagamento, com código, já em nome
// do partner, e vincula ao pedido. Mesma criação que a Mesa faz à mão em
// app/api/credit-engine/orders/[id]/link-proposal (código pelo emissor oficial, cliente na base).
// Idempotente: pedido que já tem proposta não ganha outra.

export async function criarPropostaDoPedidoAccess(db: SupabaseClient, orderId: string): Promise<{ code: string; id: string } | null> {
  const { data: order } = await db
    .from("partner_service_orders")
    .select("id, ref_partner_id, partner_id, client_name, client_email, client_doc, amount_cents, status, source, credit_desk_proposal_id")
    .eq("id", orderId)
    .single();
  if (!order || order.status !== "PAID" || order.credit_desk_proposal_id || !isAccessPackage(order.amount_cents)) return null;

  const partnerId = (order.partner_id ?? order.ref_partner_id) as string | null;
  const { code } = await issueCreditCode(null, undefined, db);
  const v3ClientId = await resolveClient(order.client_doc, { legalName: order.client_name, vertical: "credito", db }).catch(() => null);

  const { data: proposta, error } = await db
    .from("credit_desk_proposals")
    .insert({
      code,
      title: `Análise Estruturada V3 · ${order.client_name}`,
      client_name: order.client_name,
      client_cpf_cnpj: order.client_doc,
      v3_client_id: v3ClientId,
      credit_line: "ANALISE_AVULSA",
      requested_value: (order.amount_cents ?? 0) / 100,
      current_level: "NIVEL_1",
      status: "PENDING",
      stage: "RECEBIDO",
      partner_id: partnerId,
      created_by: partnerId,
      metadata: {
        source: "analise_estruturada_access",
        partner_service_order_id: order.id,
        client_email: order.client_email,
        order_source: order.source,
        ref_partner_id: order.ref_partner_id,
      },
    })
    .select("id, code")
    .single();
  if (error || !proposta) throw new Error(error?.message ?? "Falha ao criar a proposta.");

  // Vincula só se ninguém vinculou no meio do caminho (webhook repetido, Mesa manual).
  const { data: vinculado } = await db
    .from("partner_service_orders")
    .update({ credit_desk_proposal_id: proposta.id })
    .eq("id", order.id)
    .is("credit_desk_proposal_id", null)
    .select("id");
  if (!vinculado?.length) {
    await db.from("credit_desk_proposals").delete().eq("id", proposta.id);
    return null;
  }
  return { code: proposta.code as string, id: proposta.id as string };
}
