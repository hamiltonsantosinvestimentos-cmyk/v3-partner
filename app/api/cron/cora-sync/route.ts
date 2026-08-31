import { NextRequest, NextResponse } from "next/server";
import { createClient as sc } from "@supabase/supabase-js";
import { coraFetch } from "@/lib/cora";
import {
  reconcilePartnerLinkOrderPaid,
  reconcileDirectOrderPaid,
  type PartnerLinkOrderRow,
  type DirectOrderRow,
} from "@/lib/cora-order-reconcile";

// GET /api/cron/cora-sync: sincronização real de status de pagamento
// (31/08/2026), mesmo padrão de /api/cron/clicksign-sync (polling ativo
// pra fechar o gap de webhook que não dispara/não completa).
//
// DECISÃO EXPLÍCITA, mesmo motivo do clicksign-sync: não usa cron da Vercel
// (plano Hobby, limite de 1x/dia, session-decisions 2026-08-02). Acionar via
// n8n a cada 30 minutos batendo nesta rota de fora (Bearer CRON_SECRET),
// mesmo padrão já usado por /api/cron/clicksign-archive e /api/cron/cm-sla-alert.
//
// O que resolve de verdade: pedido pago do Osnildo Moser (Marmoraria Moser,
// R$197, indicado por Gustavo Xavier da Rocha) ficou 3 dias em PENDING com
// fatura Cora já criada (comprovante Pix real conferido), porque o webhook
// /api/cora/webhook nunca confirmou o pagamento. Causa raiz exata não
// confirmada (sem acesso aos logs do Vercel deste projeto nesta sessão),
// então esta rota fecha o gap independente da causa: reconsulta direto na
// API da Cora qualquer pedido PENDING com fatura já criada, e reconcilia
// com a mesma lógica do webhook (lib/cora-order-reconcile.ts) se já estiver
// PAID lá.
//
// Nota honesta: o timestamp de pagamento usado aqui é o momento da própria
// checagem (new Date().toISOString()), não a data exata do pagamento na
// Cora — o webhook recebe isso no payload do evento (body.data.payment_date),
// mas nenhum código deste repositório jamais confirmou o nome do campo
// equivalente na resposta de GET /v2/invoices/{id}. Precisão de poucos
// minutos é aceitável para este caso (o objetivo é nunca ficar PENDING para
// sempre, não a data exata ao segundo).
export const maxDuration = 60;

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const db = svc();
  const updated: string[] = [];
  const errors: Array<{ order_id: string; error: string }> = [];
  let checked = 0;

  // 1. Pedidos via link de partner (source != 'direct'), PENDING com fatura já criada.
  const { data: linkOrders, error: linkErr } = await db
    .from("partner_service_orders")
    .select("id, partner_id, client_name, client_email, client_doc, link_id, cora_invoice_id, partner_service_links(title, service_type, price_cents), partner:profiles!partner_id(full_name)")
    .eq("status", "PENDING")
    .neq("source", "direct")
    .not("cora_invoice_id", "is", null);

  if (linkErr) {
    return NextResponse.json({ ok: false, error: linkErr.message }, { status: 500 });
  }

  for (const order of (linkOrders ?? []) as unknown as (PartnerLinkOrderRow & { cora_invoice_id: string })[]) {
    checked++;
    try {
      const res = await coraFetch(`/v2/invoices/${order.cora_invoice_id}`, { method: "GET" });
      if (!res.ok) {
        errors.push({ order_id: order.id, error: `Cora GET ${res.status}` });
        continue;
      }
      const json = await res.json() as { status?: string };
      if (json.status !== "PAID") continue; // ainda não pago de verdade, nada a fazer

      await reconcilePartnerLinkOrderPaid(db, order, new Date().toISOString());
      updated.push(order.id);
    } catch (e) {
      errors.push({ order_id: order.id, error: e instanceof Error ? e.message : String(e) });
    }
  }

  // 2. Vendas diretas (/analise-v2, source='direct'), PENDING com fatura já criada.
  const { data: directOrders, error: directErr } = await db
    .from("partner_service_orders")
    .select("id, ref_partner_id, client_name, client_email, client_doc, service_type, amount_cents, cnpj_count, cpf_count, has_consultancy, cora_invoice_id, ref_partner:profiles!ref_partner_id(full_name)")
    .eq("status", "PENDING")
    .eq("source", "direct")
    .not("cora_invoice_id", "is", null);

  if (directErr) {
    return NextResponse.json({ ok: false, checked, updated, errors: [...errors, { order_id: "direct-query", error: directErr.message }] }, { status: 500 });
  }

  for (const order of (directOrders ?? []) as unknown as (DirectOrderRow & { cora_invoice_id: string })[]) {
    checked++;
    try {
      const res = await coraFetch(`/v2/invoices/${order.cora_invoice_id}`, { method: "GET" });
      if (!res.ok) {
        errors.push({ order_id: order.id, error: `Cora GET ${res.status}` });
        continue;
      }
      const json = await res.json() as { status?: string };
      if (json.status !== "PAID") continue;

      await reconcileDirectOrderPaid(db, order, new Date().toISOString());
      updated.push(order.id);
    } catch (e) {
      errors.push({ order_id: order.id, error: e instanceof Error ? e.message : String(e) });
    }
  }

  return NextResponse.json({ ok: true, checked, updated, errors });
}
